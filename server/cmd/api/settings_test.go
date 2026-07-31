package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/jackc/pgx/v5"
)

type fakeSettingsDatabase struct {
	row   pgx.Row
	query string
	args  []any
}

func (fake *fakeSettingsDatabase) Ping(context.Context) error {
	return nil
}

func (fake *fakeSettingsDatabase) QueryRow(
	_ context.Context,
	query string,
	args ...any,
) pgx.Row {
	fake.query = query
	fake.args = args
	return fake.row
}

type fakeSettingsRow struct {
	settings SettingsResponse
	err      error
}

func (fake *fakeSettingsRow) Scan(destinations ...any) error {
	if fake.err != nil {
		return fake.err
	}

	*destinations[0].(*string) = fake.settings.PreferredTimeEstimationMode
	*destinations[1].(*string) = fake.settings.ThemeMode
	*destinations[2].(*time.Time) = fake.settings.CreatedAt
	*destinations[3].(*time.Time) = fake.settings.UpdatedAt
	return nil
}

func TestNewClerkAuthMiddlewareRequiresSecretKey(t *testing.T) {
	_, err := newClerkAuthMiddleware(func(string) string {
		return ""
	})

	if err == nil {
		t.Fatal("expected missing CLERK_SECRET_KEY to return an error")
	}
}

func TestClerkAuthMiddlewareRejectsMissingToken(t *testing.T) {
	protect, err := newClerkAuthMiddleware(func(name string) string {
		if name == "CLERK_SECRET_KEY" {
			return "sk_test_not-a-real-secret"
		}
		return ""
	})
	if err != nil {
		t.Fatalf("could not create Clerk middleware: %v", err)
	}

	handler := protect(http.HandlerFunc(func(
		w http.ResponseWriter,
		_ *http.Request,
	) {
		t.Fatal("protected handler ran without an authenticated user")
	}))
	request := httptest.NewRequest(http.MethodGet, "/v1/settings", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf(
			"expected status %d, got %d",
			http.StatusUnauthorized,
			recorder.Code,
		)
	}

	var response ErrorResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("could not decode response: %v", err)
	}
	if response.Error.Code != "unauthorized" {
		t.Errorf("expected unauthorized, got %q", response.Error.Code)
	}
}

func TestHandleSettingsGetsDefaultsForVerifiedUser(t *testing.T) {
	expected := testSettingsResponse()
	database := &fakeSettingsDatabase{
		row: &fakeSettingsRow{settings: expected},
	}
	api := &API{database: database}
	request := authenticatedSettingsRequest(http.MethodGet, nil)
	recorder := httptest.NewRecorder()

	api.handleSettings(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}
	if len(database.args) != 1 || database.args[0] != "user_test_123" {
		t.Fatalf("query did not use the verified Clerk user ID")
	}
	if !strings.Contains(database.query, "INSERT INTO users") {
		t.Fatal("expected GET to ensure the PostgreSQL user exists")
	}

	var response SettingsResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("could not decode response: %v", err)
	}
	if response.ThemeMode != expected.ThemeMode {
		t.Errorf(
			"expected theme %q, got %q",
			expected.ThemeMode,
			response.ThemeMode,
		)
	}
}

func TestHandleSettingsUpdatesVerifiedUsersSettings(t *testing.T) {
	expected := testSettingsResponse()
	expected.ThemeMode = "light"
	database := &fakeSettingsDatabase{
		row: &fakeSettingsRow{settings: expected},
	}
	api := &API{database: database}
	request := authenticatedSettingsRequest(
		http.MethodPatch,
		strings.NewReader(`{"themeMode":"light"}`),
	)
	recorder := httptest.NewRecorder()

	api.handleSettings(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}
	if len(database.args) != 3 {
		t.Fatalf("expected 3 query arguments, got %d", len(database.args))
	}
	if database.args[0] != "user_test_123" {
		t.Error("query did not use the verified Clerk user ID")
	}
	if database.args[1] != nil {
		t.Errorf("expected missing estimation mode to remain nil")
	}
	if database.args[2] != "light" {
		t.Errorf("expected theme argument light, got %#v", database.args[2])
	}
}

func TestHandleSettingsRejectsInvalidUpdate(t *testing.T) {
	database := &fakeSettingsDatabase{}
	api := &API{database: database}
	request := authenticatedSettingsRequest(
		http.MethodPatch,
		strings.NewReader(`{"themeMode":"blue"}`),
	)
	recorder := httptest.NewRecorder()

	api.handleSettings(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf(
			"expected status %d, got %d",
			http.StatusBadRequest,
			recorder.Code,
		)
	}
	if database.query != "" {
		t.Fatal("database was queried for an invalid settings update")
	}
}

func TestHandleSettingsRejectsMissingVerifiedUser(t *testing.T) {
	api := &API{database: &fakeSettingsDatabase{}}
	request := httptest.NewRequest(http.MethodGet, "/v1/settings", nil)
	recorder := httptest.NewRecorder()

	api.handleSettings(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf(
			"expected status %d, got %d",
			http.StatusUnauthorized,
			recorder.Code,
		)
	}
}

func TestHandleSettingsHidesDatabaseErrors(t *testing.T) {
	database := &fakeSettingsDatabase{
		row: &fakeSettingsRow{
			err: errors.New("sensitive database connection details"),
		},
	}
	api := &API{database: database}
	request := authenticatedSettingsRequest(http.MethodGet, nil)
	recorder := httptest.NewRecorder()

	api.handleSettings(recorder, request)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf(
			"expected status %d, got %d",
			http.StatusInternalServerError,
			recorder.Code,
		)
	}
	if strings.Contains(recorder.Body.String(), "sensitive") {
		t.Fatal("response exposed the database error")
	}
}

func authenticatedSettingsRequest(
	method string,
	body io.Reader,
) *http.Request {
	request := httptest.NewRequest(method, "/v1/settings", body)
	claims := &clerk.SessionClaims{
		RegisteredClaims: clerk.RegisteredClaims{
			Subject: "user_test_123",
		},
	}
	ctx := clerk.ContextWithSessionClaims(request.Context(), claims)
	return request.WithContext(ctx)
}

func testSettingsResponse() SettingsResponse {
	createdAt := time.Date(2026, time.July, 30, 12, 0, 0, 0, time.UTC)
	return SettingsResponse{
		PreferredTimeEstimationMode: "relative",
		ThemeMode:                   "dark",
		CreatedAt:                   createdAt,
		UpdatedAt:                   createdAt,
	}
}
