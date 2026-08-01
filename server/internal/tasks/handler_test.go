package tasks

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

type queryCall struct {
	query string
	args  []any
}

type fakeDatabase struct {
	rowCalls []queryCall
	rows     []pgx.Row
}

func (fake *fakeDatabase) Query(
	context.Context,
	string,
	...any,
) (pgx.Rows, error) {
	return nil, errors.New("unexpected Query call")
}

func (fake *fakeDatabase) QueryRow(
	_ context.Context,
	query string,
	args ...any,
) pgx.Row {
	fake.rowCalls = append(fake.rowCalls, queryCall{query: query, args: args})
	if len(fake.rows) == 0 {
		return &fakeRow{err: errors.New("unexpected QueryRow call")}
	}
	row := fake.rows[0]
	fake.rows = fake.rows[1:]
	return row
}

type fakeRow struct {
	scan func([]any) error
	err  error
}

func (fake *fakeRow) Scan(destinations ...any) error {
	if fake.err != nil {
		return fake.err
	}
	return fake.scan(destinations)
}

func taskRow(task Response) pgx.Row {
	return &fakeRow{scan: func(destinations []any) error {
		*destinations[0].(*string) = task.ID
		*destinations[1].(*string) = task.Title
		*destinations[2].(*bool) = task.Completed
		*destinations[3].(*int) = task.TimeSpentSeconds
		*destinations[4].(**int) = task.EstimatedMinutes
		*destinations[5].(**string) = task.Notes
		*destinations[6].(**time.Time) = task.AlarmAt
		*destinations[7].(**string) = task.NotificationID
		*destinations[8].(**time.Time) = task.CompletedAt
		*destinations[9].(*time.Time) = task.CreatedAt
		return nil
	}}
}

func boolRow(value bool) pgx.Row {
	return &fakeRow{scan: func(destinations []any) error {
		*destinations[0].(*bool) = value
		return nil
	}}
}

func TestHandlerCreatesTaskForVerifiedUser(t *testing.T) {
	expected := testTask()
	database := &fakeDatabase{rows: []pgx.Row{taskRow(expected)}}
	handler := NewHandler(database)
	request := authenticatedRequest(
		http.MethodPost,
		"/v1/tasks",
		strings.NewReader(`{"title":"  Clean kitchen  ","estimatedMinutes":15}`),
	)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, recorder.Code)
	}
	if len(database.rowCalls) != 1 {
		t.Fatalf("expected one database call, got %d", len(database.rowCalls))
	}
	call := database.rowCalls[0]
	if !strings.Contains(call.query, "INSERT INTO tasks") {
		t.Fatal("expected the create query")
	}
	if call.args[0] != "user_test_123" {
		t.Fatal("create query did not use the verified Clerk user ID")
	}
	if call.args[1] != "Clean kitchen" {
		t.Errorf("expected trimmed title, got %#v", call.args[1])
	}

	var response Response
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("could not decode task response: %v", err)
	}
	if response.ID != expected.ID {
		t.Errorf("expected task ID %q, got %q", expected.ID, response.ID)
	}
}

func TestHandlerPassesExplicitNullForNullableUpdate(t *testing.T) {
	expected := testTask()
	expected.Notes = nil
	database := &fakeDatabase{rows: []pgx.Row{taskRow(expected)}}
	handler := NewHandler(database)
	request := authenticatedRequest(
		http.MethodPatch,
		"/v1/tasks/0f1cf89d-d998-40c7-a8ac-43b89ff5c777",
		strings.NewReader(`{"notes":null}`),
	)
	request.SetPathValue("id", "0f1cf89d-d998-40c7-a8ac-43b89ff5c777")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}
	args := database.rowCalls[0].args
	if args[8] != true {
		t.Errorf("expected notes supplied flag, got %#v", args[8])
	}
	if args[9] != nil {
		t.Errorf("expected explicit null notes value, got %#v", args[9])
	}
	if args[14] != 0 {
		t.Errorf("expected omitted time delta to become zero, got %#v", args[14])
	}
}

func TestHandlerRejectsTimeUpdateThatWouldBecomeNegative(t *testing.T) {
	database := &fakeDatabase{rows: []pgx.Row{
		&fakeRow{err: pgx.ErrNoRows},
		boolRow(true),
	}}
	handler := NewHandler(database)
	request := authenticatedRequest(
		http.MethodPatch,
		"/v1/tasks/0f1cf89d-d998-40c7-a8ac-43b89ff5c777",
		strings.NewReader(`{"timeSpentSecondsDelta":-60}`),
	)
	request.SetPathValue("id", "0f1cf89d-d998-40c7-a8ac-43b89ff5c777")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, recorder.Code)
	}
	if len(database.rowCalls) != 2 {
		t.Fatalf("expected update and ownership queries, got %d calls", len(database.rowCalls))
	}
	if !strings.Contains(database.rowCalls[1].query, "SELECT EXISTS") {
		t.Fatal("expected the ownership check after the rejected update")
	}
}

func TestHandlerRejectsInvalidTaskIDBeforeQuerying(t *testing.T) {
	database := &fakeDatabase{}
	handler := NewHandler(database)
	request := authenticatedRequest(http.MethodGet, "/v1/tasks/not-a-uuid", nil)
	request.SetPathValue("id", "not-a-uuid")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, recorder.Code)
	}
	if len(database.rowCalls) != 0 {
		t.Fatal("database was queried for an invalid task ID")
	}
}

func TestHandlerRejectsMissingVerifiedUser(t *testing.T) {
	handler := NewHandler(&fakeDatabase{})
	request := httptest.NewRequest(http.MethodGet, "/v1/tasks", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, recorder.Code)
	}
}

func authenticatedRequest(method, target string, body io.Reader) *http.Request {
	request := httptest.NewRequest(method, target, body)
	claims := &clerk.SessionClaims{
		RegisteredClaims: clerk.RegisteredClaims{Subject: "user_test_123"},
	}
	return request.WithContext(clerk.ContextWithSessionClaims(request.Context(), claims))
}

func testTask() Response {
	estimate := 15
	createdAt := time.Date(2026, time.July, 31, 12, 0, 0, 0, time.UTC)
	return Response{
		ID:               "0f1cf89d-d998-40c7-a8ac-43b89ff5c777",
		Title:            "Clean kitchen",
		TimeSpentSeconds: 0,
		EstimatedMinutes: &estimate,
		CreatedAt:        createdAt,
	}
}
