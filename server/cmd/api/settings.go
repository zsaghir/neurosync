package main

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/clerk/clerk-sdk-go/v2"
	clerkhttp "github.com/clerk/clerk-sdk-go/v2/http"
)

const getSettingsQuery = `
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

const updateSettingsQuery = `
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

// SettingsResponse is the authenticated user's persisted NeuroSync settings.
type SettingsResponse struct {
	PreferredTimeEstimationMode string    `json:"preferredTimeEstimationMode"`
	ThemeMode                   string    `json:"themeMode"`
	CreatedAt                   time.Time `json:"createdAt"`
	UpdatedAt                   time.Time `json:"updatedAt"`
}

// UpdateSettingsRequest contains the settings a user is allowed to change.
// Pointers distinguish a missing field from a supplied field.
type UpdateSettingsRequest struct {
	PreferredTimeEstimationMode *string `json:"preferredTimeEstimationMode"`
	ThemeMode                   *string `json:"themeMode"`
}

func newClerkAuthMiddleware(
	getenv func(string) string,
) (func(http.Handler) http.Handler, error) {
	secretKey := strings.TrimSpace(getenv("CLERK_SECRET_KEY"))
	if secretKey == "" {
		return nil, errors.New("CLERK_SECRET_KEY is required")
	}

	clerk.SetKey(secretKey)

	authorizationFailure := http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) {
			writeUnauthorized(w)
		},
	)
	verifyAuthorization := clerkhttp.WithHeaderAuthorization(
		clerkhttp.AuthorizationFailureHandler(authorizationFailure),
	)

	return func(next http.Handler) http.Handler {
		requireVerifiedUser := http.HandlerFunc(
			func(w http.ResponseWriter, r *http.Request) {
				claims, ok := clerk.SessionClaimsFromContext(r.Context())
				if !ok || claims == nil || strings.TrimSpace(claims.Subject) == "" {
					writeUnauthorized(w)
					return
				}

				next.ServeHTTP(w, r)
			},
		)

		return verifyAuthorization(requireVerifiedUser)
	}, nil
}

func writeUnauthorized(w http.ResponseWriter) {
	writeJSON(w, http.StatusUnauthorized, ErrorResponse{
		Error: ErrorDetails{
			Code:    "unauthorized",
			Message: "A valid Clerk session is required",
		},
	})
}

func clerkUserIDFromRequest(r *http.Request) (string, bool) {
	claims, ok := clerk.SessionClaimsFromContext(r.Context())
	if !ok || claims == nil {
		return "", false
	}

	clerkUserID := strings.TrimSpace(claims.Subject)
	return clerkUserID, clerkUserID != ""
}

func (api *API) handleSettings(w http.ResponseWriter, r *http.Request) {
	clerkUserID, ok := clerkUserIDFromRequest(r)
	if !ok {
		writeUnauthorized(w)
		return
	}

	switch r.Method {
	case http.MethodGet:
		api.getSettings(w, r, clerkUserID)
	case http.MethodPatch:
		api.updateSettings(w, r, clerkUserID)
	default:
		w.Header().Set("Allow", "GET, PATCH")
		writeJSON(w, http.StatusMethodNotAllowed, ErrorResponse{
			Error: ErrorDetails{
				Code:    "method_not_allowed",
				Message: "Only GET and PATCH requests are allowed",
			},
		})
	}
}

func (api *API) getSettings(
	w http.ResponseWriter,
	r *http.Request,
	clerkUserID string,
) {
	settings, err := scanSettings(
		api.database.QueryRow(r.Context(), getSettingsQuery, clerkUserID),
	)
	if err != nil {
		writeSettingsDatabaseError(w)
		return
	}

	writeJSON(w, http.StatusOK, settings)
}

func (api *API) updateSettings(
	w http.ResponseWriter,
	r *http.Request,
	clerkUserID string,
) {
	request, err := decodeUpdateSettingsRequest(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{
			Error: ErrorDetails{
				Code:    "invalid_request",
				Message: err.Error(),
			},
		})
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

	settings, err := scanSettings(
		api.database.QueryRow(
			r.Context(),
			updateSettingsQuery,
			clerkUserID,
			preferredTimeEstimationMode,
			themeMode,
		),
	)
	if err != nil {
		writeSettingsDatabaseError(w)
		return
	}

	writeJSON(w, http.StatusOK, settings)
}

func decodeUpdateSettingsRequest(
	r *http.Request,
) (UpdateSettingsRequest, error) {
	var request UpdateSettingsRequest

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&request); err != nil {
		return UpdateSettingsRequest{}, errors.New(
			"Request body must contain valid JSON",
		)
	}

	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return UpdateSettingsRequest{}, errors.New(
			"Request body must contain exactly one JSON object",
		)
	}

	if request.PreferredTimeEstimationMode == nil && request.ThemeMode == nil {
		return UpdateSettingsRequest{}, errors.New(
			"At least one setting must be provided",
		)
	}

	if request.PreferredTimeEstimationMode != nil {
		value := strings.TrimSpace(*request.PreferredTimeEstimationMode)
		if !isAllowedValue(value, "relative", "minutes", "custom") {
			return UpdateSettingsRequest{}, errors.New(
				"preferredTimeEstimationMode must be relative, minutes, or custom",
			)
		}
		request.PreferredTimeEstimationMode = &value
	}

	if request.ThemeMode != nil {
		value := strings.TrimSpace(*request.ThemeMode)
		if !isAllowedValue(value, "dark", "light") {
			return UpdateSettingsRequest{}, errors.New(
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

type settingsRow interface {
	Scan(...any) error
}

func scanSettings(row settingsRow) (SettingsResponse, error) {
	var settings SettingsResponse
	err := row.Scan(
		&settings.PreferredTimeEstimationMode,
		&settings.ThemeMode,
		&settings.CreatedAt,
		&settings.UpdatedAt,
	)
	return settings, err
}

func writeSettingsDatabaseError(w http.ResponseWriter) {
	log.Print("settings database operation failed")
	writeJSON(w, http.StatusInternalServerError, ErrorResponse{
		Error: ErrorDetails{
			Code:    "internal_error",
			Message: "The settings operation could not be completed",
		},
	})
}
