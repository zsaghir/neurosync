package subtasks

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

const listSubtasksQuery = `
SELECT
	subtask.id,
	subtask.task_id,
	subtask.title,
	subtask.completed,
	subtask.position
FROM subtasks AS subtask
JOIN tasks AS task ON task.id = subtask.task_id
JOIN users AS owner ON owner.id = task.user_id
WHERE owner.clerk_user_id = $1
  AND task.id = $2
ORDER BY subtask.position, subtask.id`

// Database is the PostgreSQL behavior required by the subtasks handler.
type Database interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

// Handler serves subtasks belonging to an authenticated user's task.
type Handler struct {
	database Database
}

// NewHandler creates a subtask handler with its database dependency.
func NewHandler(database Database) *Handler {
	return &Handler{database: database}
}

// ServeHTTP currently handles listing the subtasks for one task.
func (handler *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	clerkUserID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(
			w,
			http.StatusUnauthorized,
			"unauthorized",
			"A valid Clerk session is required",
		)
		return
	}

	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		httpx.WriteError(
			w,
			http.StatusMethodNotAllowed,
			"method_not_allowed",
			"Only GET requests are allowed",
		)
		return
	}

	taskID, err := parseTaskID(r.PathValue("taskID"))
	if err != nil {
		httpx.WriteError(
			w,
			http.StatusBadRequest,
			"invalid_task_id",
			"Task ID must be a valid UUID",
		)
		return
	}

	handler.list(w, r, clerkUserID, taskID)
}

func (handler *Handler) list(
	w http.ResponseWriter,
	r *http.Request,
	clerkUserID string,
	taskID pgtype.UUID,
) {
	rows, err := handler.database.Query(
		r.Context(),
		listSubtasksQuery,
		clerkUserID,
		taskID,
	)
	if err != nil {
		writeDatabaseError(w)
		return
	}
	defer rows.Close()

	subtasks := make([]Response, 0)
	for rows.Next() {
		subtask, scanErr := scanSubtask(rows)
		if scanErr != nil {
			writeDatabaseError(w)
			return
		}
		subtasks = append(subtasks, subtask)
	}

	if rows.Err() != nil {
		writeDatabaseError(w)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, ListResponse{Subtasks: subtasks})
}

func parseTaskID(value string) (pgtype.UUID, error) {
	var id pgtype.UUID
	if err := id.Scan(value); err != nil || !id.Valid {
		return pgtype.UUID{}, errors.New("invalid task ID")
	}
	return id, nil
}

type row interface {
	Scan(...any) error
}

func scanSubtask(result row) (Response, error) {
	var subtask Response
	err := result.Scan(
		&subtask.ID,
		&subtask.TaskID,
		&subtask.Title,
		&subtask.Completed,
		&subtask.Position,
	)
	return subtask, err
}

func writeDatabaseError(w http.ResponseWriter) {
	log.Print("subtask database operation failed")
	httpx.WriteError(
		w,
		http.StatusInternalServerError,
		"internal_error",
		"The subtask operation could not be completed",
	)
}
