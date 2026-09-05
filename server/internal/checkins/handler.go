package checkins

import (
	"context"
	"errors"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/zsaghir/neurosync/server/internal/auth"
	"github.com/zsaghir/neurosync/server/internal/httpx"
)

const createQuery = `
WITH ensured_user AS (
	INSERT INTO users (clerk_user_id)
	VALUES ($1)
	ON CONFLICT (clerk_user_id) DO UPDATE
	SET clerk_user_id = EXCLUDED.clerk_user_id
	RETURNING id
),
owned_task AS (
	SELECT task.id
	FROM tasks AS task
	JOIN ensured_user AS owner ON owner.id = task.user_id
	WHERE task.id = $2::uuid
)
INSERT INTO check_ins (
	user_id,
	task_id,
	blocker,
	reason,
	support_action,
	next_step,
	planned_minutes,
	stuckness_before
)
SELECT
	owner.id,
	CASE WHEN $2::uuid IS NULL THEN NULL ELSE owned_task.id END,
	$3,
	$4,
	$5,
	$6,
	$7,
	$8
FROM ensured_user AS owner
LEFT JOIN owned_task ON TRUE
WHERE $2::uuid IS NULL OR owned_task.id IS NOT NULL
RETURNING
	id,
	task_id,
	blocker,
	reason,
	support_action,
	next_step,
	planned_minutes,
	stuckness_before,
	stuckness_after,
	intervention_attempted,
	next_step_taken,
	helpfulness,
	followed_up_at,
	created_at,
	updated_at`

const updateOutcomeQuery = `
UPDATE check_ins AS check_in
SET
	stuckness_after = $3,
	intervention_attempted = $4,
	next_step_taken = $5,
	helpfulness = $6,
	followed_up_at = NOW(),
	updated_at = NOW()
FROM users AS owner
WHERE check_in.user_id = owner.id
	AND owner.clerk_user_id = $1
	AND check_in.id = $2
RETURNING
	check_in.id,
	check_in.task_id,
	check_in.blocker,
	check_in.reason,
	check_in.support_action,
	check_in.next_step,
	check_in.planned_minutes,
	check_in.stuckness_before,
	check_in.stuckness_after,
	check_in.intervention_attempted,
	check_in.next_step_taken,
	check_in.helpfulness,
	check_in.followed_up_at,
	check_in.created_at,
	check_in.updated_at`

// Database is the PostgreSQL behavior required by the check-in handler.
type Database interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

// Handler serves authenticated check-in requests.
type Handler struct {
	database Database
}

// NewHandler creates a check-in handler with its database dependency.
func NewHandler(database Database) *Handler {
	return &Handler{database: database}
}

// ServeHTTP dispatches check-in creation and outcome updates.
func (handler *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	clerkUserID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "A valid Clerk session is required")
		return
	}

	checkInID := r.PathValue("id")
	if checkInID == "" {
		if r.Method != http.MethodPost {
			w.Header().Set("Allow", http.MethodPost)
			httpx.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST requests are allowed")
			return
		}
		handler.create(w, r, clerkUserID)
		return
	}

	if r.Method != http.MethodPatch {
		w.Header().Set("Allow", http.MethodPatch)
		httpx.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only PATCH requests are allowed")
		return
	}

	parsedCheckInID, err := parseCheckInID(checkInID)
	if err != nil {
		writeInvalidRequest(w, "Check-in ID must be a valid UUID")
		return
	}
	handler.updateOutcome(w, r, clerkUserID, parsedCheckInID)
}

func (handler *Handler) create(w http.ResponseWriter, r *http.Request, clerkUserID string) {
	request, err := decodeCreateRequest(r)
	if err != nil {
		writeInvalidRequest(w, err.Error())
		return
	}

	checkIn, err := scanCheckIn(handler.database.QueryRow(
		r.Context(),
		createQuery,
		clerkUserID,
		request.TaskID,
		string(request.Blocker),
		request.Reason,
		request.SupportAction,
		request.NextStep,
		request.PlannedMinutes,
		*request.StucknessBefore,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.WriteError(w, http.StatusNotFound, "task_not_found", "Task not found")
		return
	}
	if err != nil {
		writeDatabaseError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, checkIn)
}

func (handler *Handler) updateOutcome(
	w http.ResponseWriter,
	r *http.Request,
	clerkUserID string,
	checkInID pgtype.UUID,
) {
	request, err := decodeOutcomeRequest(r)
	if err != nil {
		writeInvalidRequest(w, err.Error())
		return
	}

	checkIn, err := scanCheckIn(handler.database.QueryRow(
		r.Context(),
		updateOutcomeQuery,
		clerkUserID,
		checkInID,
		*request.StucknessAfter,
		*request.InterventionAttempted,
		request.NextStepTaken,
		string(request.Helpfulness),
	))
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.WriteError(w, http.StatusNotFound, "check_in_not_found", "Check-in not found")
		return
	}
	if err != nil {
		writeDatabaseError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, checkIn)
}

func scanCheckIn(row pgx.Row) (Response, error) {
	var checkIn Response
	var blocker string
	var helpfulness *string

	err := row.Scan(
		&checkIn.ID,
		&checkIn.TaskID,
		&blocker,
		&checkIn.Reason,
		&checkIn.SupportAction,
		&checkIn.NextStep,
		&checkIn.PlannedMinutes,
		&checkIn.StucknessBefore,
		&checkIn.StucknessAfter,
		&checkIn.InterventionAttempted,
		&checkIn.NextStepTaken,
		&helpfulness,
		&checkIn.FollowedUpAt,
		&checkIn.CreatedAt,
		&checkIn.UpdatedAt,
	)
	if err != nil {
		return Response{}, err
	}

	checkIn.Blocker = Blocker(blocker)
	if helpfulness != nil {
		value := Helpfulness(*helpfulness)
		checkIn.Helpfulness = &value
	}
	return checkIn, nil
}

func writeInvalidRequest(w http.ResponseWriter, message string) {
	httpx.WriteError(w, http.StatusBadRequest, "invalid_request", message)
}

func writeDatabaseError(w http.ResponseWriter, err error) {
	log.Printf("check-in database operation failed: %v", err)
	httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "The check-in operation could not be completed")
}
