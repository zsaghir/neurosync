// Package sessions handles authenticated task sessions stored in PostgreSQL.
package sessions

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/zsaghir/neurosync/server/internal/auth"
	"github.com/zsaghir/neurosync/server/internal/httpx"
)

const listQuery = `
SELECT
	session.id,
	session.task_id,
	session.task_title,
	session.task_title_signature,
	session.estimated_minutes,
	session.estimate_input_type,
	session.timer_measured_seconds,
	session.actual_seconds,
	session.actual_seconds_source,
	session.started_at,
	session.ended_at,
	session.excluded_from_insights,
	session.exclude_reason,
	session.created_at,
	session.updated_at
FROM task_sessions AS session
JOIN users AS owner ON owner.id = session.user_id
WHERE owner.clerk_user_id = $1
ORDER BY session.ended_at DESC, session.id DESC`

const createQuery = `
WITH owned_task AS (
	SELECT
		task.id,
		task.user_id,
		task.title,
		COALESCE(NULLIF((
			SELECT STRING_AGG(token.word, ' ' ORDER BY token.position)
			FROM REGEXP_SPLIT_TO_TABLE(
				REGEXP_REPLACE(LOWER(task.title), '[^a-z0-9_[:space:]]', ' ', 'g'),
				'[[:space:]]+'
			) WITH ORDINALITY AS token(word, position)
			WHERE token.word <> ''
			  AND token.word NOT IN ('the', 'a', 'an', 'my')
		), ''), LOWER(TRIM(task.title))) AS title_signature
	FROM tasks AS task
	JOIN users AS owner ON owner.id = task.user_id
	WHERE owner.clerk_user_id = $1
	  AND task.id = $2
),
inserted_session AS (
	INSERT INTO task_sessions (
		user_id,
		task_id,
		task_title,
		task_title_signature,
		estimated_minutes,
		estimate_input_type,
		timer_measured_seconds,
		actual_seconds,
		actual_seconds_source,
		started_at,
		ended_at,
		excluded_from_insights,
		exclude_reason
	)
	SELECT
		owned_task.user_id,
		owned_task.id,
		owned_task.title,
		owned_task.title_signature,
		$3,
		$4,
		$5,
		$6,
		$7,
		$8,
		$9,
		$10,
		$11
	FROM owned_task
	RETURNING
		id,
		task_id,
		task_title,
		task_title_signature,
		estimated_minutes,
		estimate_input_type,
		timer_measured_seconds,
		actual_seconds,
		actual_seconds_source,
		started_at,
		ended_at,
		excluded_from_insights,
		exclude_reason,
		created_at,
		updated_at
),
updated_task AS (
	UPDATE tasks AS task
	SET time_spent_seconds = task.time_spent_seconds + CASE
		WHEN inserted_session.excluded_from_insights THEN 0
		ELSE inserted_session.actual_seconds
	END
	FROM inserted_session
	WHERE task.id = inserted_session.task_id
	RETURNING task.id
)
SELECT
	inserted_session.id,
	inserted_session.task_id,
	inserted_session.task_title,
	inserted_session.task_title_signature,
	inserted_session.estimated_minutes,
	inserted_session.estimate_input_type,
	inserted_session.timer_measured_seconds,
	inserted_session.actual_seconds,
	inserted_session.actual_seconds_source,
	inserted_session.started_at,
	inserted_session.ended_at,
	inserted_session.excluded_from_insights,
	inserted_session.exclude_reason,
	inserted_session.created_at,
	inserted_session.updated_at
FROM inserted_session
JOIN updated_task ON updated_task.id = inserted_session.task_id`

// Database is the PostgreSQL behavior required by the sessions handler.
type Database interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

// Handler serves the authenticated user's task-session collection.
type Handler struct {
	database Database
}

// Response is one persisted task session owned by the authenticated user.
type Response struct {
	ID                   string     `json:"id"`
	TaskID               *string    `json:"taskId"`
	TaskTitle            string     `json:"taskTitle"`
	TaskTitleSignature   string     `json:"taskTitleSignature"`
	EstimatedMinutes     *int       `json:"estimatedMinutes"`
	EstimateInputType    string     `json:"estimateInputType"`
	TimerMeasuredSeconds int        `json:"timerMeasuredSeconds"`
	ActualSeconds        int        `json:"actualSeconds"`
	ActualSecondsSource  string     `json:"actualSecondsSource"`
	StartedAt            *time.Time `json:"startedAt"`
	EndedAt              time.Time  `json:"endedAt"`
	ExcludedFromInsights bool       `json:"excludedFromInsights"`
	ExcludeReason        *string    `json:"excludeReason"`
	CreatedAt            time.Time  `json:"createdAt"`
	UpdatedAt            time.Time  `json:"updatedAt"`
}

// ListResponse leaves room for pagination without changing the top-level shape.
type ListResponse struct {
	Sessions []Response `json:"sessions"`
}

// CreateRequest contains fields accepted when recording a task session.
type CreateRequest struct {
	TaskID               string     `json:"taskId"`
	EstimatedMinutes     *int       `json:"estimatedMinutes"`
	EstimateInputType    string     `json:"estimateInputType"`
	TimerMeasuredSeconds int        `json:"timerMeasuredSeconds"`
	ActualSeconds        int        `json:"actualSeconds"`
	ActualSecondsSource  string     `json:"actualSecondsSource"`
	StartedAt            *time.Time `json:"startedAt"`
	EndedAt              time.Time  `json:"endedAt"`
	ExcludedFromInsights bool       `json:"excludedFromInsights"`
	ExcludeReason        *string    `json:"excludeReason"`
}

// NewHandler creates the task-session handler with its database dependency.
func NewHandler(database Database) *Handler {
	return &Handler{database: database}
}

// ServeHTTP dispatches collection operations after reading verified Clerk claims.
func (handler *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	clerkUserID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "A valid Clerk session is required")
		return
	}

	switch r.Method {
	case http.MethodGet:
		handler.list(w, r, clerkUserID)
	case http.MethodPost:
		handler.create(w, r, clerkUserID)
	default:
		w.Header().Set("Allow", "GET, POST")
		httpx.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET and POST requests are allowed")
	}
}

func (handler *Handler) list(w http.ResponseWriter, r *http.Request, clerkUserID string) {
	rows, err := handler.database.Query(r.Context(), listQuery, clerkUserID)
	if err != nil {
		writeDatabaseError(w)
		return
	}
	defer rows.Close()

	sessions := make([]Response, 0)
	for rows.Next() {
		session, scanErr := scanSession(rows)
		if scanErr != nil {
			writeDatabaseError(w)
			return
		}
		sessions = append(sessions, session)
	}
	if rows.Err() != nil {
		writeDatabaseError(w)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, ListResponse{Sessions: sessions})
}

func (handler *Handler) create(w http.ResponseWriter, r *http.Request, clerkUserID string) {
	request, taskID, err := decodeCreateRequest(r)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	session, err := scanSession(handler.database.QueryRow(
		r.Context(),
		createQuery,
		clerkUserID,
		taskID,
		request.EstimatedMinutes,
		request.EstimateInputType,
		request.TimerMeasuredSeconds,
		request.ActualSeconds,
		request.ActualSecondsSource,
		request.StartedAt,
		request.EndedAt,
		request.ExcludedFromInsights,
		request.ExcludeReason,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "Task not found")
		return
	}
	if err != nil {
		writeDatabaseError(w)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, session)
}

func decodeCreateRequest(r *http.Request) (CreateRequest, pgtype.UUID, error) {
	var request CreateRequest
	decoder := json.NewDecoder(io.LimitReader(r.Body, 32*1024))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		return CreateRequest{}, pgtype.UUID{}, errors.New("Request body must contain valid JSON")
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return CreateRequest{}, pgtype.UUID{}, errors.New("Request body must contain exactly one JSON object")
	}

	var taskID pgtype.UUID
	if err := taskID.Scan(strings.TrimSpace(request.TaskID)); err != nil || !taskID.Valid {
		return CreateRequest{}, pgtype.UUID{}, errors.New("taskId must be a valid UUID")
	}
	if request.EstimatedMinutes != nil && *request.EstimatedMinutes < 0 {
		return CreateRequest{}, pgtype.UUID{}, errors.New("estimatedMinutes cannot be negative")
	}
	if !allowed(request.EstimateInputType, "bucket", "preset", "custom", "skipped") {
		return CreateRequest{}, pgtype.UUID{}, errors.New("estimateInputType must be bucket, preset, custom, or skipped")
	}
	if request.TimerMeasuredSeconds < 0 {
		return CreateRequest{}, pgtype.UUID{}, errors.New("timerMeasuredSeconds cannot be negative")
	}
	if request.ActualSeconds < 0 {
		return CreateRequest{}, pgtype.UUID{}, errors.New("actualSeconds cannot be negative")
	}
	if !allowed(request.ActualSecondsSource, "timer", "userEdited", "manual") {
		return CreateRequest{}, pgtype.UUID{}, errors.New("actualSecondsSource must be timer, userEdited, or manual")
	}
	if request.EndedAt.IsZero() {
		return CreateRequest{}, pgtype.UUID{}, errors.New("endedAt is required")
	}
	if request.StartedAt != nil && request.EndedAt.Before(*request.StartedAt) {
		return CreateRequest{}, pgtype.UUID{}, errors.New("endedAt cannot be before startedAt")
	}
	if request.ExcludeReason != nil {
		reason := strings.TrimSpace(*request.ExcludeReason)
		if reason == "" {
			request.ExcludeReason = nil
		} else {
			request.ExcludeReason = &reason
		}
	}
	if !request.ExcludedFromInsights && request.ExcludeReason != nil {
		return CreateRequest{}, pgtype.UUID{}, errors.New("excludeReason requires excludedFromInsights")
	}

	return request, taskID, nil
}

func allowed(value string, candidates ...string) bool {
	for _, candidate := range candidates {
		if value == candidate {
			return true
		}
	}
	return false
}

func scanSession(row pgx.Row) (Response, error) {
	var session Response
	err := row.Scan(
		&session.ID,
		&session.TaskID,
		&session.TaskTitle,
		&session.TaskTitleSignature,
		&session.EstimatedMinutes,
		&session.EstimateInputType,
		&session.TimerMeasuredSeconds,
		&session.ActualSeconds,
		&session.ActualSecondsSource,
		&session.StartedAt,
		&session.EndedAt,
		&session.ExcludedFromInsights,
		&session.ExcludeReason,
		&session.CreatedAt,
		&session.UpdatedAt,
	)
	return session, err
}

func writeDatabaseError(w http.ResponseWriter) {
	log.Print("task-session database operation failed")
	httpx.WriteError(w, http.StatusInternalServerError, "database_error", "The task session could not be processed")
}
