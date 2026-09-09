package checkins

import (
	"context"
	"errors"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5"

	"github.com/zsaghir/neurosync/server/internal/auth"
	"github.com/zsaghir/neurosync/server/internal/httpx"
)

const ownedTaskTitleQuery = `
SELECT task.title
FROM tasks AS task
JOIN users AS owner ON owner.id = task.user_id
WHERE owner.clerk_user_id = $1
	AND task.id = $2::uuid`

// Suggester turns validated, de-identified context into actionable choices.
type Suggester interface {
	Suggest(context.Context, SuggestionInput) (SuggestionResponse, error)
}

// SuggestionHandler serves authenticated suggestion requests.
type SuggestionHandler struct {
	database  Database
	suggester Suggester
}

// NewSuggestionHandler creates a handler with database and provider dependencies.
func NewSuggestionHandler(database Database, suggester Suggester) *SuggestionHandler {
	return &SuggestionHandler{database: database, suggester: suggester}
}

func (handler *SuggestionHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	clerkUserID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "A valid Clerk session is required")
		return
	}
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		httpx.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST requests are allowed")
		return
	}

	request, err := decodeSuggestionRequest(r)
	if err != nil {
		writeInvalidRequest(w, err.Error())
		return
	}

	var taskTitle *string
	if request.TaskID != nil {
		var title string
		err := handler.database.QueryRow(
			r.Context(),
			ownedTaskTitleQuery,
			clerkUserID,
			*request.TaskID,
		).Scan(&title)
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, http.StatusNotFound, "task_not_found", "Task not found")
			return
		}
		if err != nil {
			writeDatabaseError(w, err)
			return
		}
		taskTitle = &title
	}

	response, err := handler.suggester.Suggest(r.Context(), SuggestionInput{
		TaskTitle:       taskTitle,
		Blocker:         request.Blocker,
		BrainDump:       request.BrainDump,
		Capacity:        request.Capacity,
		Sleep:           request.Sleep,
		BasicNeeds:      request.BasicNeeds,
		MedicationShift: request.MedicationShift,
		SubstanceImpact: request.SubstanceImpact,
		Difficulties:    request.Difficulties,
	})
	if err != nil {
		log.Print("check-in suggestion provider failed")
		writeSuggestionsUnavailable(w)
		return
	}

	response, err = ValidateSuggestionResponse(response)
	if err != nil {
		log.Print("check-in suggestion provider returned invalid output")
		writeSuggestionsUnavailable(w)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, response)
}

func writeSuggestionsUnavailable(w http.ResponseWriter) {
	httpx.WriteError(
		w,
		http.StatusServiceUnavailable,
		"suggestions_unavailable",
		"Suggestions are temporarily unavailable",
	)
}
