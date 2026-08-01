// Package tasks handles authenticated tasks stored in PostgreSQL.
package tasks

import (
	"bytes"
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
	task.id,
	task.title,
	task.completed,
	task.time_spent_seconds,
	task.estimated_minutes,
	task.notes,
	task.alarm_at,
	task.notification_id,
	task.completed_at,
	task.created_at
FROM tasks AS task
JOIN users AS owner ON owner.id = task.user_id
WHERE owner.clerk_user_id = $1
ORDER BY task.created_at DESC, task.id DESC`

const createQuery = `
WITH ensured_user AS (
	INSERT INTO users (clerk_user_id)
	VALUES ($1)
	ON CONFLICT (clerk_user_id) DO UPDATE
	SET clerk_user_id = EXCLUDED.clerk_user_id
	RETURNING id
)
INSERT INTO tasks (
	user_id,
	title,
	estimated_minutes,
	notes,
	alarm_at,
	notification_id
)
SELECT
	id,
	$2,
	$3,
	$4,
	$5,
	$6
FROM ensured_user
RETURNING
	id,
	title,
	completed,
	time_spent_seconds,
	estimated_minutes,
	notes,
	alarm_at,
	notification_id,
	completed_at,
	created_at`

const getQuery = `
SELECT
	task.id,
	task.title,
	task.completed,
	task.time_spent_seconds,
	task.estimated_minutes,
	task.notes,
	task.alarm_at,
	task.notification_id,
	task.completed_at,
	task.created_at
FROM tasks AS task
JOIN users AS owner ON owner.id = task.user_id
WHERE owner.clerk_user_id = $1
  AND task.id = $2`

const updateQuery = `
UPDATE tasks AS task
SET
	title = CASE
		WHEN $3::boolean THEN $4::text
		ELSE task.title
	END,
	completed = CASE
		WHEN $5::boolean THEN $6::boolean
		ELSE task.completed
	END,
	completed_at = CASE
		WHEN NOT $5::boolean THEN task.completed_at
		WHEN $6::boolean THEN COALESCE(task.completed_at, NOW())
		ELSE NULL
	END,
	estimated_minutes = CASE
		WHEN $7::boolean THEN $8::integer
		ELSE task.estimated_minutes
	END,
	notes = CASE
		WHEN $9::boolean THEN $10::text
		ELSE task.notes
	END,
	alarm_at = CASE
		WHEN $11::boolean THEN $12::timestamptz
		ELSE task.alarm_at
	END,
	notification_id = CASE
		WHEN $13::boolean THEN $14::text
		ELSE task.notification_id
	END,
	time_spent_seconds =
		task.time_spent_seconds + COALESCE($15::integer, 0)
FROM users AS owner
WHERE task.user_id = owner.id
  AND owner.clerk_user_id = $1
  AND task.id = $2
  AND task.time_spent_seconds + COALESCE($15::integer, 0) >= 0
RETURNING
	task.id,
	task.title,
	task.completed,
	task.time_spent_seconds,
	task.estimated_minutes,
	task.notes,
	task.alarm_at,
	task.notification_id,
	task.completed_at,
	task.created_at`

const ownedTaskExistsQuery = `
SELECT EXISTS (
	SELECT 1
	FROM tasks AS task
	JOIN users AS owner ON owner.id = task.user_id
	WHERE owner.clerk_user_id = $1
	  AND task.id = $2
)`

const deleteQuery = `
DELETE FROM tasks AS task
USING users AS owner
WHERE task.user_id = owner.id
  AND owner.clerk_user_id = $1
  AND task.id = $2
RETURNING task.id`

// Database is the PostgreSQL behavior required by the tasks handler.
type Database interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

// Handler serves the authenticated user's task collection and task resources.
type Handler struct {
	database Database
}

// Response is one persisted task owned by the authenticated user.
type Response struct {
	ID               string     `json:"id"`
	Title            string     `json:"title"`
	Completed        bool       `json:"completed"`
	TimeSpentSeconds int        `json:"timeSpentSeconds"`
	EstimatedMinutes *int       `json:"estimatedMinutes"`
	Notes            *string    `json:"notes"`
	AlarmAt          *time.Time `json:"alarmAt"`
	NotificationID   *string    `json:"notificationId"`
	CompletedAt      *time.Time `json:"completedAt"`
	CreatedAt        time.Time  `json:"createdAt"`
}

// ListResponse leaves room for pagination without changing the top-level shape.
type ListResponse struct {
	Tasks []Response `json:"tasks"`
}

// CreateRequest contains fields accepted when creating a task.
type CreateRequest struct {
	Title            string     `json:"title"`
	EstimatedMinutes *int       `json:"estimatedMinutes"`
	Notes            *string    `json:"notes"`
	AlarmAt          *time.Time `json:"alarmAt"`
	NotificationID   *string    `json:"notificationId"`
}

// Optional distinguishes an omitted field from an explicit JSON null.
type Optional[T any] struct {
	Set   bool
	Value *T
}

// UnmarshalJSON records that the field was supplied, including when it is null.
func (optional *Optional[T]) UnmarshalJSON(data []byte) error {
	optional.Set = true
	if bytes.Equal(bytes.TrimSpace(data), []byte("null")) {
		optional.Value = nil
		return nil
	}

	var value T
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}
	optional.Value = &value
	return nil
}

// UpdateRequest contains fields accepted when partially updating a task.
type UpdateRequest struct {
	Title                 Optional[string]    `json:"title"`
	Completed             Optional[bool]      `json:"completed"`
	EstimatedMinutes      Optional[int]       `json:"estimatedMinutes"`
	Notes                 Optional[string]    `json:"notes"`
	AlarmAt               Optional[time.Time] `json:"alarmAt"`
	NotificationID        Optional[string]    `json:"notificationId"`
	TimeSpentSecondsDelta Optional[int]       `json:"timeSpentSecondsDelta"`
}

// NewHandler creates the tasks HTTP handler with its database dependency.
func NewHandler(database Database) *Handler {
	return &Handler{database: database}
}

// ServeHTTP dispatches collection and individual-task operations.
func (handler *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	clerkUserID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "A valid Clerk session is required")
		return
	}

	taskID := r.PathValue("id")
	if taskID == "" {
		handler.serveCollection(w, r, clerkUserID)
		return
	}

	parsedTaskID, err := parseTaskID(taskID)
	if err != nil {
		writeInvalidRequest(w, "Task ID must be a valid UUID")
		return
	}
	handler.serveTask(w, r, clerkUserID, parsedTaskID)
}

func (handler *Handler) serveCollection(w http.ResponseWriter, r *http.Request, clerkUserID string) {
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

func (handler *Handler) serveTask(w http.ResponseWriter, r *http.Request, clerkUserID string, taskID pgtype.UUID) {
	switch r.Method {
	case http.MethodGet:
		handler.get(w, r, clerkUserID, taskID)
	case http.MethodPatch:
		handler.update(w, r, clerkUserID, taskID)
	case http.MethodDelete:
		handler.delete(w, r, clerkUserID, taskID)
	default:
		w.Header().Set("Allow", "GET, PATCH, DELETE")
		httpx.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET, PATCH, and DELETE requests are allowed")
	}
}

func (handler *Handler) list(w http.ResponseWriter, r *http.Request, clerkUserID string) {
	rows, err := handler.database.Query(r.Context(), listQuery, clerkUserID)
	if err != nil {
		writeDatabaseError(w)
		return
	}
	defer rows.Close()

	tasks := make([]Response, 0)
	for rows.Next() {
		task, scanErr := scanTask(rows)
		if scanErr != nil {
			writeDatabaseError(w)
			return
		}
		tasks = append(tasks, task)
	}
	if rows.Err() != nil {
		writeDatabaseError(w)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, ListResponse{Tasks: tasks})
}

func (handler *Handler) create(w http.ResponseWriter, r *http.Request, clerkUserID string) {
	request, err := decodeCreateRequest(r)
	if err != nil {
		writeInvalidRequest(w, err.Error())
		return
	}

	task, err := scanTask(handler.database.QueryRow(
		r.Context(),
		createQuery,
		clerkUserID,
		request.Title,
		request.EstimatedMinutes,
		request.Notes,
		request.AlarmAt,
		request.NotificationID,
	))
	if err != nil {
		writeDatabaseError(w)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, task)
}

func (handler *Handler) get(w http.ResponseWriter, r *http.Request, clerkUserID string, taskID pgtype.UUID) {
	task, err := scanTask(handler.database.QueryRow(r.Context(), getQuery, clerkUserID, taskID))
	if errors.Is(err, pgx.ErrNoRows) {
		writeNotFound(w)
		return
	}
	if err != nil {
		writeDatabaseError(w)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, task)
}

func (handler *Handler) update(w http.ResponseWriter, r *http.Request, clerkUserID string, taskID pgtype.UUID) {
	request, err := decodeUpdateRequest(r)
	if err != nil {
		writeInvalidRequest(w, err.Error())
		return
	}

	task, err := scanTask(handler.database.QueryRow(
		r.Context(),
		updateQuery,
		clerkUserID,
		taskID,
		request.Title.Set,
		optionalValue(request.Title),
		request.Completed.Set,
		optionalValue(request.Completed),
		request.EstimatedMinutes.Set,
		optionalValue(request.EstimatedMinutes),
		request.Notes.Set,
		optionalValue(request.Notes),
		request.AlarmAt.Set,
		optionalValue(request.AlarmAt),
		request.NotificationID.Set,
		optionalValue(request.NotificationID),
		optionalValueOrZero(request.TimeSpentSecondsDelta),
	))
	if errors.Is(err, pgx.ErrNoRows) {
		if request.TimeSpentSecondsDelta.Set && optionalValueOrZero(request.TimeSpentSecondsDelta) < 0 {
			exists, existsErr := handler.ownedTaskExists(r.Context(), clerkUserID, taskID)
			if existsErr != nil {
				writeDatabaseError(w)
				return
			}
			if exists {
				writeInvalidRequest(w, "timeSpentSecondsDelta would make timeSpentSeconds negative")
				return
			}
		}
		writeNotFound(w)
		return
	}
	if err != nil {
		writeDatabaseError(w)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, task)
}

func (handler *Handler) ownedTaskExists(ctx context.Context, clerkUserID string, taskID pgtype.UUID) (bool, error) {
	var exists bool
	err := handler.database.QueryRow(ctx, ownedTaskExistsQuery, clerkUserID, taskID).Scan(&exists)
	return exists, err
}

func (handler *Handler) delete(w http.ResponseWriter, r *http.Request, clerkUserID string, taskID pgtype.UUID) {
	var deletedID string
	err := handler.database.QueryRow(r.Context(), deleteQuery, clerkUserID, taskID).Scan(&deletedID)
	if errors.Is(err, pgx.ErrNoRows) {
		writeNotFound(w)
		return
	}
	if err != nil {
		writeDatabaseError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func decodeCreateRequest(r *http.Request) (CreateRequest, error) {
	var request CreateRequest
	if err := decodeOneJSON(r, &request); err != nil {
		return CreateRequest{}, err
	}

	request.Title = strings.TrimSpace(request.Title)
	if request.Title == "" {
		return CreateRequest{}, errors.New("title is required")
	}
	if len([]rune(request.Title)) > 200 {
		return CreateRequest{}, errors.New("title must be 200 characters or fewer")
	}
	if request.EstimatedMinutes != nil && *request.EstimatedMinutes < 0 {
		return CreateRequest{}, errors.New("estimatedMinutes cannot be negative")
	}
	request.Notes = trimOptionalString(request.Notes)
	request.NotificationID = trimOptionalString(request.NotificationID)
	return request, nil
}

func decodeUpdateRequest(r *http.Request) (UpdateRequest, error) {
	var request UpdateRequest
	if err := decodeOneJSON(r, &request); err != nil {
		return UpdateRequest{}, err
	}

	if !request.Title.Set && !request.Completed.Set && !request.EstimatedMinutes.Set &&
		!request.Notes.Set && !request.AlarmAt.Set && !request.NotificationID.Set &&
		!request.TimeSpentSecondsDelta.Set {
		return UpdateRequest{}, errors.New("At least one task field must be provided")
	}
	if request.Title.Set {
		if request.Title.Value == nil {
			return UpdateRequest{}, errors.New("title cannot be null")
		}
		value := strings.TrimSpace(*request.Title.Value)
		if value == "" {
			return UpdateRequest{}, errors.New("title cannot be empty")
		}
		if len([]rune(value)) > 200 {
			return UpdateRequest{}, errors.New("title must be 200 characters or fewer")
		}
		request.Title.Value = &value
	}
	if request.Completed.Set && request.Completed.Value == nil {
		return UpdateRequest{}, errors.New("completed cannot be null")
	}
	if request.EstimatedMinutes.Set && request.EstimatedMinutes.Value != nil && *request.EstimatedMinutes.Value < 0 {
		return UpdateRequest{}, errors.New("estimatedMinutes cannot be negative")
	}
	if request.TimeSpentSecondsDelta.Set && request.TimeSpentSecondsDelta.Value == nil {
		return UpdateRequest{}, errors.New("timeSpentSecondsDelta cannot be null")
	}
	if request.Notes.Set {
		request.Notes.Value = trimOptionalString(request.Notes.Value)
	}
	if request.NotificationID.Set {
		request.NotificationID.Value = trimOptionalString(request.NotificationID.Value)
	}
	return request, nil
}

func decodeOneJSON(r *http.Request, destination any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return errors.New("Request body must contain valid JSON")
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("Request body must contain exactly one JSON object")
	}
	return nil
}

func parseTaskID(value string) (pgtype.UUID, error) {
	var id pgtype.UUID
	err := id.Scan(value)
	if err != nil || !id.Valid {
		return pgtype.UUID{}, errors.New("invalid task ID")
	}
	return id, nil
}

func optionalValue[T any](optional Optional[T]) any {
	if optional.Value == nil {
		return nil
	}
	return *optional.Value
}

func optionalValueOrZero(optional Optional[int]) int {
	if optional.Value == nil {
		return 0
	}
	return *optional.Value
}

func trimOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	return &trimmed
}

type row interface {
	Scan(...any) error
}

func scanTask(result row) (Response, error) {
	var task Response
	err := result.Scan(
		&task.ID,
		&task.Title,
		&task.Completed,
		&task.TimeSpentSeconds,
		&task.EstimatedMinutes,
		&task.Notes,
		&task.AlarmAt,
		&task.NotificationID,
		&task.CompletedAt,
		&task.CreatedAt,
	)
	return task, err
}

func writeInvalidRequest(w http.ResponseWriter, message string) {
	httpx.WriteError(w, http.StatusBadRequest, "invalid_request", message)
}

func writeNotFound(w http.ResponseWriter) {
	httpx.WriteError(w, http.StatusNotFound, "task_not_found", "Task not found")
}

func writeDatabaseError(w http.ResponseWriter) {
	log.Print("task database operation failed")
	httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "The task operation could not be completed")
}
