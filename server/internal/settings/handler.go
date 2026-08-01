// Package settings handles authenticated user settings stored in PostgreSQL.
package settings

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

	"github.com/zsaghir/neurosync/server/internal/auth"
	"github.com/zsaghir/neurosync/server/internal/httpx"
)

const getQuery = `
WITH ensured_user AS (
	INSERT INTO users (clerk_user_id)
	VALUES ($1)
	ON CONFLICT (clerk_user_id) DO UPDATE
	SET clerk_user_id = EXCLUDED.clerk_user_id
	RETURNING id
)
INSERT INTO user_settings (user_id)
SELECT id
FROM ensured_user
ON CONFLICT (user_id) DO UPDATE
SET user_id = EXCLUDED.user_id
RETURNING
	preferred_time_estimation_mode,
	theme_mode,
	created_at,
	updated_at`

const updateQuery = `
WITH ensured_user AS (
	INSERT INTO users (clerk_user_id)
	VALUES ($1)
	ON CONFLICT (clerk_user_id) DO UPDATE
	SET clerk_user_id = EXCLUDED.clerk_user_id
	RETURNING id
)
INSERT INTO user_settings (
	user_id,
	preferred_time_estimation_mode,
	theme_mode
)
SELECT
	id,
	COALESCE($2::text, 'relative'),
	COALESCE($3::text, 'dark')
FROM ensured_user
ON CONFLICT (user_id) DO UPDATE
SET
	preferred_time_estimation_mode = COALESCE(
		$2::text,
		user_settings.preferred_time_estimation_mode
	),
	theme_mode = COALESCE($3::text, user_settings.theme_mode),
	updated_at = NOW()
RETURNING
	preferred_time_estimation_mode,
	theme_mode,
	created_at,
	updated_at`

// Database is the PostgreSQL behavior required by the settings handler.
type Database interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

// Handler serves the authenticated user's settings endpoint.
type Handler struct {
	database Database
}

// Response is the authenticated user's persisted NeuroSync settings.
type Response struct {
	PreferredTimeEstimationMode string    `json:"preferredTimeEstimationMode"`
	ThemeMode                   string    `json:"themeMode"`
	CreatedAt                   time.Time `json:"createdAt"`
	UpdatedAt                   time.Time `json:"updatedAt"`
}

// UpdateRequest contains the settings a user is allowed to change.
// Pointers distinguish a missing field from a supplied field.
type UpdateRequest struct {
	PreferredTimeEstimationMode *string `json:"preferredTimeEstimationMode"`
	ThemeMode                   *string `json:"themeMode"`
}

// NewHandler creates the settings HTTP handler with its database dependency.
func NewHandler(database Database) *Handler {
	return &Handler{database: database}
}

// ServeHTTP dispatches supported settings operations.
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

	switch r.Method {
	case http.MethodGet:
		handler.get(w, r, clerkUserID)
	case http.MethodPatch:
		handler.update(w, r, clerkUserID)
	default:
		w.Header().Set("Allow", "GET, PATCH")
		httpx.WriteError(
			w,
			http.StatusMethodNotAllowed,
			"method_not_allowed",
			"Only GET and PATCH requests are allowed",
		)
	}
}

func (handler *Handler) get(
	w http.ResponseWriter,
	r *http.Request,
	clerkUserID string,
) {
	settings, err := scan(
		handler.database.QueryRow(r.Context(), getQuery, clerkUserID),
	)
	if err != nil {
		writeDatabaseError(w)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, settings)
}

func (handler *Handler) update(
	w http.ResponseWriter,
	r *http.Request,
	clerkUserID string,
) {
	request, err := decodeUpdateRequest(r)
	if err != nil {
		httpx.WriteError(
			w,
			http.StatusBadRequest,
			"invalid_request",
			err.Error(),
		)
		return
	}

	var preferredTimeEstimationMode any
	if request.PreferredTimeEstimationMode != nil {
		preferredTimeEstimationMode = *request.PreferredTimeEstimationMode
	}

	var themeMode any
	if request.ThemeMode != nil {
		themeMode = *request.ThemeMode
	}

	settings, err := scan(
		handler.database.QueryRow(
			r.Context(),
			updateQuery,
			clerkUserID,
			preferredTimeEstimationMode,
			themeMode,
		),
	)
	if err != nil {
		writeDatabaseError(w)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, settings)
}

func decodeUpdateRequest(r *http.Request) (UpdateRequest, error) {
	var request UpdateRequest

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&request); err != nil {
		return UpdateRequest{}, errors.New(
			"Request body must contain valid JSON",
		)
	}

	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return UpdateRequest{}, errors.New(
			"Request body must contain exactly one JSON object",
		)
	}

	if request.PreferredTimeEstimationMode == nil && request.ThemeMode == nil {
		return UpdateRequest{}, errors.New(
			"At least one setting must be provided",
		)
	}

	if request.PreferredTimeEstimationMode != nil {
		value := strings.TrimSpace(*request.PreferredTimeEstimationMode)
		if !isAllowedValue(value, "relative", "minutes", "custom") {
			return UpdateRequest{}, errors.New(
				"preferredTimeEstimationMode must be relative, minutes, or custom",
			)
		}
		request.PreferredTimeEstimationMode = &value
	}

	if request.ThemeMode != nil {
		value := strings.TrimSpace(*request.ThemeMode)
		if !isAllowedValue(value, "dark", "light") {
			return UpdateRequest{}, errors.New(
				"themeMode must be dark or light",
			)
		}
		request.ThemeMode = &value
	}

	return request, nil
}

func isAllowedValue(value string, allowed ...string) bool {
	for _, candidate := range allowed {
		if value == candidate {
			return true
		}
	}
	return false
}

type row interface {
	Scan(...any) error
}

func scan(result row) (Response, error) {
	var settings Response
	err := result.Scan(
		&settings.PreferredTimeEstimationMode,
		&settings.ThemeMode,
		&settings.CreatedAt,
		&settings.UpdatedAt,
	)
	return settings, err
}

func writeDatabaseError(w http.ResponseWriter) {
	log.Print("settings database operation failed")
	httpx.WriteError(
		w,
		http.StatusInternalServerError,
		"internal_error",
		"The settings operation could not be completed",
	)
}
