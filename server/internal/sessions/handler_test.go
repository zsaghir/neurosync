package sessions

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
	"github.com/jackc/pgx/v5/pgconn"
)

type queryCall struct {
	query string
	args  []any
}

type fakeDatabase struct {
	calls    []queryCall
	rows     pgx.Rows
	queryErr error
	row      pgx.Row
}

func (fake *fakeDatabase) Query(_ context.Context, query string, args ...any) (pgx.Rows, error) {
	fake.calls = append(fake.calls, queryCall{query: query, args: args})
	return fake.rows, fake.queryErr
}

func (fake *fakeDatabase) QueryRow(_ context.Context, query string, args ...any) pgx.Row {
	fake.calls = append(fake.calls, queryCall{query: query, args: args})
	if fake.row == nil {
		return &fakeRow{err: errors.New("unexpected QueryRow call")}
	}
	return fake.row
}

type fakeRow struct {
	session Response
	err     error
}

func (row *fakeRow) Scan(destinations ...any) error {
	if row.err != nil {
		return row.err
	}
	assignSession(destinations, row.session)
	return nil
}

type fakeRows struct {
	items  []Response
	index  int
	err    error
	closed bool
}

func (rows *fakeRows) Close()                                       { rows.closed = true }
func (rows *fakeRows) Err() error                                   { return rows.err }
func (rows *fakeRows) CommandTag() pgconn.CommandTag                { return pgconn.CommandTag{} }
func (rows *fakeRows) FieldDescriptions() []pgconn.FieldDescription { return nil }
func (rows *fakeRows) Values() ([]any, error)                       { return nil, errors.New("not implemented") }
func (rows *fakeRows) RawValues() [][]byte                          { return nil }
func (rows *fakeRows) Conn() *pgx.Conn                              { return nil }
func (rows *fakeRows) Next() bool {
	if rows.index >= len(rows.items) {
		rows.Close()
		return false
	}
	rows.index++
	return true
}
func (rows *fakeRows) Scan(destinations ...any) error {
	assignSession(destinations, rows.items[rows.index-1])
	return nil
}

func assignSession(destinations []any, session Response) {
	*destinations[0].(*string) = session.ID
	*destinations[1].(**string) = session.TaskID
	*destinations[2].(*string) = session.TaskTitle
	*destinations[3].(*string) = session.TaskTitleSignature
	*destinations[4].(**int) = session.EstimatedMinutes
	*destinations[5].(*string) = session.EstimateInputType
	*destinations[6].(*int) = session.TimerMeasuredSeconds
	*destinations[7].(*int) = session.ActualSeconds
	*destinations[8].(*string) = session.ActualSecondsSource
	*destinations[9].(**time.Time) = session.StartedAt
	*destinations[10].(*time.Time) = session.EndedAt
	*destinations[11].(*bool) = session.ExcludedFromInsights
	*destinations[12].(**string) = session.ExcludeReason
	*destinations[13].(*time.Time) = session.CreatedAt
	*destinations[14].(*time.Time) = session.UpdatedAt
}

func TestHandlerListsOnlyVerifiedUsersSessions(t *testing.T) {
	database := &fakeDatabase{rows: &fakeRows{items: []Response{testSession()}}}
	handler := NewHandler(database)
	request := authenticatedRequest(http.MethodGet, nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}
	if len(database.calls) != 1 || database.calls[0].args[0] != "user_test_123" {
		t.Fatal("list query was not scoped to the verified Clerk user")
	}
	if !strings.Contains(database.calls[0].query, "owner.clerk_user_id = $1") {
		t.Fatal("list query does not enforce ownership")
	}
	var response ListResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("could not decode response: %v", err)
	}
	if len(response.Sessions) != 1 {
		t.Fatalf("expected one session, got %d", len(response.Sessions))
	}
}

func TestHandlerCreatesSessionAndUpdatesTaskAtomically(t *testing.T) {
	database := &fakeDatabase{row: &fakeRow{session: testSession()}}
	handler := NewHandler(database)
	request := authenticatedRequest(http.MethodPost, strings.NewReader(validCreateBody()))
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d: %s", http.StatusCreated, recorder.Code, recorder.Body.String())
	}
	call := database.calls[0]
	if call.args[0] != "user_test_123" {
		t.Fatal("create query did not use the verified Clerk user")
	}
	if !strings.Contains(call.query, "WITH owned_task AS") || !strings.Contains(call.query, "updated_task AS") {
		t.Fatal("session insert and task total are not one atomic statement")
	}
	if !strings.Contains(call.query, "WHEN inserted_session.excluded_from_insights THEN 0") {
		t.Fatal("excluded sessions would incorrectly increase the task total")
	}
	if !strings.Contains(call.query, "owner.clerk_user_id = $1") {
		t.Fatal("create query does not enforce task ownership")
	}
}

func TestHandlerHidesTasksNotOwnedByVerifiedUser(t *testing.T) {
	database := &fakeDatabase{row: &fakeRow{err: pgx.ErrNoRows}}
	handler := NewHandler(database)
	request := authenticatedRequest(http.MethodPost, strings.NewReader(validCreateBody()))
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, recorder.Code)
	}
}

func TestHandlerRejectsInvalidInputBeforeQuerying(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "task UUID", body: strings.Replace(validCreateBody(), "0f1cf89d-d998-40c7-a8ac-43b89ff5c777", "not-a-uuid", 1)},
		{name: "negative duration", body: strings.Replace(validCreateBody(), `"actualSeconds":900`, `"actualSeconds":-1`, 1)},
		{name: "source", body: strings.Replace(validCreateBody(), `"timer"`, `"corrected"`, 1)},
		{name: "timestamps", body: strings.Replace(validCreateBody(), "2026-08-12T18:15:00Z", "2026-08-12T17:59:00Z", 1)},
		{name: "exclusion", body: strings.Replace(validCreateBody(), `"excludeReason":null`, `"excludeReason":"weird"`, 1)},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			database := &fakeDatabase{}
			handler := NewHandler(database)
			request := authenticatedRequest(http.MethodPost, strings.NewReader(test.body))
			recorder := httptest.NewRecorder()

			handler.ServeHTTP(recorder, request)

			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("expected status %d, got %d", http.StatusBadRequest, recorder.Code)
			}
			if len(database.calls) != 0 {
				t.Fatal("invalid input reached the database")
			}
		})
	}
}

func TestHandlerRejectsMissingVerifiedUser(t *testing.T) {
	handler := NewHandler(&fakeDatabase{})
	request := httptest.NewRequest(http.MethodGet, "/v1/task-sessions", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, recorder.Code)
	}
}

func TestHandlerRejectsUnsupportedMethod(t *testing.T) {
	handler := NewHandler(&fakeDatabase{})
	request := authenticatedRequest(http.MethodDelete, nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status %d, got %d", http.StatusMethodNotAllowed, recorder.Code)
	}
	if recorder.Header().Get("Allow") != "GET, POST" {
		t.Errorf("unexpected Allow header %q", recorder.Header().Get("Allow"))
	}
}

func authenticatedRequest(method string, body io.Reader) *http.Request {
	request := httptest.NewRequest(method, "/v1/task-sessions", body)
	claims := &clerk.SessionClaims{
		RegisteredClaims: clerk.RegisteredClaims{Subject: "user_test_123"},
	}
	return request.WithContext(clerk.ContextWithSessionClaims(request.Context(), claims))
}

func testSession() Response {
	taskID := "0f1cf89d-d998-40c7-a8ac-43b89ff5c777"
	estimate := 15
	endedAt := time.Date(2026, time.August, 12, 18, 15, 0, 0, time.UTC)
	startedAt := endedAt.Add(-15 * time.Minute)
	return Response{
		ID:                   "aa0c4f09-a5c4-4f02-8e0b-619125f4483d",
		TaskID:               &taskID,
		TaskTitle:            "Clean kitchen",
		TaskTitleSignature:   "clean kitchen",
		EstimatedMinutes:     &estimate,
		EstimateInputType:    "custom",
		TimerMeasuredSeconds: 900,
		ActualSeconds:        900,
		ActualSecondsSource:  "timer",
		StartedAt:            &startedAt,
		EndedAt:              endedAt,
		CreatedAt:            endedAt,
		UpdatedAt:            endedAt,
	}
}

func validCreateBody() string {
	return `{"taskId":"0f1cf89d-d998-40c7-a8ac-43b89ff5c777","estimatedMinutes":15,"estimateInputType":"custom","timerMeasuredSeconds":900,"actualSeconds":900,"actualSecondsSource":"timer","startedAt":"2026-08-12T18:00:00Z","endedAt":"2026-08-12T18:15:00Z","excludedFromInsights":false,"excludeReason":null}`
}
