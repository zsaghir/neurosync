package settings

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

type fakeDatabase struct {
	row   pgx.Row
	query string
	args  []any
}

func (fake *fakeDatabase) QueryRow(
	_ context.Context,
	query string,
	args ...any,
) pgx.Row {
	fake.query = query
	fake.args = args
	return fake.row
}

type fakeRow struct {
	settings Response
	err      error
}

func (fake *fakeRow) Scan(destinations ...any) error {
	if fake.err != nil {
		return fake.err
	}

	*destinations[0].(*string) = fake.settings.PreferredTimeEstimationMode
	*destinations[1].(*string) = fake.settings.ThemeMode
	*destinations[2].(*time.Time) = fake.settings.CreatedAt
	*destinations[3].(*time.Time) = fake.settings.UpdatedAt
	return nil
}

func TestHandlerGetsDefaultsForVerifiedUser(t *testing.T) {
	expected := testResponse()
	database := &fakeDatabase{
		row: &fakeRow{settings: expected},
	}
	handler := NewHandler(database)
	request := authenticatedRequest(http.MethodGet, nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}
	if len(database.args) != 1 || database.args[0] != "user_test_123" {
		t.Fatalf("query did not use the verified Clerk user ID")
	}
	if !strings.Contains(database.query, "INSERT INTO users") {
		t.Fatal("expected GET to ensure the PostgreSQL user exists")
	}

	var response Response
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

func TestHandlerUpdatesVerifiedUsersSettings(t *testing.T) {
	expected := testResponse()
	expected.ThemeMode = "light"
	database := &fakeDatabase{
		row: &fakeRow{settings: expected},
	}
	handler := NewHandler(database)
	request := authenticatedRequest(
		http.MethodPatch,
		strings.NewReader(`{"themeMode":"light"}`),
	)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

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

func TestHandlerRejectsInvalidUpdate(t *testing.T) {
	database := &fakeDatabase{}
	handler := NewHandler(database)
	request := authenticatedRequest(
		http.MethodPatch,
		strings.NewReader(`{"themeMode":"blue"}`),
	)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

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

func TestHandlerRejectsMissingVerifiedUser(t *testing.T) {
	handler := NewHandler(&fakeDatabase{})
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
}

func TestHandlerHidesDatabaseErrors(t *testing.T) {
	database := &fakeDatabase{
		row: &fakeRow{
			err: errors.New("sensitive database connection details"),
		},
	}
	handler := NewHandler(database)
	request := authenticatedRequest(http.MethodGet, nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

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

func authenticatedRequest(method string, body io.Reader) *http.Request {
	request := httptest.NewRequest(method, "/v1/settings", body)
	claims := &clerk.SessionClaims{
		RegisteredClaims: clerk.RegisteredClaims{
			Subject: "user_test_123",
		},
	}
	ctx := clerk.ContextWithSessionClaims(request.Context(), claims)
	return request.WithContext(ctx)
}

func testResponse() Response {
	createdAt := time.Date(2026, time.July, 30, 12, 0, 0, 0, time.UTC)
	return Response{
		PreferredTimeEstimationMode: "relative",
		ThemeMode:                   "dark",
		CreatedAt:                   createdAt,
		UpdatedAt:                   createdAt,
	}
}
