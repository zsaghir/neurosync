package checkins

import (
	"context"
	"encoding/json"
	"errors"
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
	calls []queryCall
	rows  []pgx.Row
}

func (fake *fakeDatabase) QueryRow(
	_ context.Context,
	query string,
	args ...any,
) pgx.Row {
	fake.calls = append(fake.calls, queryCall{query: query, args: args})
	if len(fake.rows) == 0 {
		return &fakeRow{err: errors.New("unexpected QueryRow call")}
	}
	row := fake.rows[0]
	fake.rows = fake.rows[1:]
	return row
}

type fakeRow struct {
	err  error
	scan func([]any) error
}

func (fake *fakeRow) Scan(destinations ...any) error {
	if fake.err != nil {
		return fake.err
	}
	return fake.scan(destinations)
}

func responseRow(checkIn Response) pgx.Row {
	return &fakeRow{scan: func(destinations []any) error {
		*destinations[0].(*string) = checkIn.ID
		*destinations[1].(**string) = checkIn.TaskID
		*destinations[2].(*string) = string(checkIn.Blocker)
		*destinations[3].(**string) = checkIn.Reason
		*destinations[4].(**string) = checkIn.SupportAction
		*destinations[5].(**string) = checkIn.NextStep
		*destinations[6].(**int) = checkIn.PlannedMinutes
		*destinations[7].(*int) = checkIn.StucknessBefore
		*destinations[8].(**int) = checkIn.StucknessAfter
		*destinations[9].(**bool) = checkIn.InterventionAttempted
		*destinations[10].(**bool) = checkIn.NextStepTaken
		if checkIn.Helpfulness == nil {
			*destinations[11].(**string) = nil
		} else {
			value := string(*checkIn.Helpfulness)
			*destinations[11].(**string) = &value
		}
		*destinations[12].(**time.Time) = checkIn.FollowedUpAt
		*destinations[13].(*time.Time) = checkIn.CreatedAt
		*destinations[14].(*time.Time) = checkIn.UpdatedAt
		return nil
	}}
}

func TestHandlerCreatesCheckInForVerifiedUser(t *testing.T) {
	expected := testCheckIn()
	database := &fakeDatabase{rows: []pgx.Row{responseRow(expected)}}
	handler := NewHandler(database)
	request := authenticatedRequest(
		http.MethodPost,
		"/v1/check-ins",
		strings.NewReader(`{
			"blocker":"task_initiation",
			"reason":"  Hard to begin  ",
			"supportAction":"five_minute_start",
			"nextStep":"  Open the document  ",
			"plannedMinutes":5,
			"stucknessBefore":8
		}`),
	)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d: %s", http.StatusCreated, recorder.Code, recorder.Body.String())
	}
	if len(database.calls) != 1 {
		t.Fatalf("expected one database call, got %d", len(database.calls))
	}
	call := database.calls[0]
	if !strings.Contains(call.query, "INSERT INTO check_ins") {
		t.Fatal("expected the check-in creation query")
	}
	if call.args[0] != "user_test_123" {
		t.Errorf("expected verified user ID, got %#v", call.args[0])
	}
	if reason := call.args[3].(*string); *reason != "Hard to begin" {
		t.Errorf("expected trimmed reason, got %q", *reason)
	}
	if nextStep := call.args[5].(*string); *nextStep != "Open the document" {
		t.Errorf("expected trimmed next step, got %q", *nextStep)
	}

	var response Response
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("could not decode response: %v", err)
	}
	if response.ID != expected.ID {
		t.Errorf("expected check-in ID %q, got %q", expected.ID, response.ID)
	}
}

func TestHandlerRejectsInvalidCreateBeforeDatabase(t *testing.T) {
	database := &fakeDatabase{}
	handler := NewHandler(database)
	request := authenticatedRequest(
		http.MethodPost,
		"/v1/check-ins",
		strings.NewReader(`{"blocker":"overwhelmed","stucknessBefore":8}`),
	)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, recorder.Code)
	}
	if len(database.calls) != 0 {
		t.Fatal("invalid input reached the database")
	}
}

func TestHandlerRecordsOutcomeForVerifiedOwner(t *testing.T) {
	expected := testCheckIn()
	stucknessAfter := 4
	attempted := true
	nextStepTaken := true
	helpfulness := HelpfulnessYes
	now := time.Now().UTC()
	expected.StucknessAfter = &stucknessAfter
	expected.InterventionAttempted = &attempted
	expected.NextStepTaken = &nextStepTaken
	expected.Helpfulness = &helpfulness
	expected.FollowedUpAt = &now
	database := &fakeDatabase{rows: []pgx.Row{responseRow(expected)}}
	handler := NewHandler(database)
	request := authenticatedRequest(
		http.MethodPatch,
		"/v1/check-ins/11111111-1111-4111-8111-111111111111/outcome",
		strings.NewReader(`{
			"stucknessAfter":4,
			"interventionAttempted":true,
			"nextStepTaken":true,
			"helpfulness":"yes"
		}`),
	)
	request.SetPathValue("id", "11111111-1111-4111-8111-111111111111")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	if len(database.calls) != 1 {
		t.Fatalf("expected one database call, got %d", len(database.calls))
	}
	call := database.calls[0]
	if !strings.Contains(call.query, "owner.clerk_user_id = $1") {
		t.Fatal("outcome query was not scoped to the verified owner")
	}
	if call.args[0] != "user_test_123" {
		t.Errorf("expected verified user ID, got %#v", call.args[0])
	}
}

func TestHandlerHidesAnotherUsersCheckIn(t *testing.T) {
	database := &fakeDatabase{rows: []pgx.Row{&fakeRow{err: pgx.ErrNoRows}}}
	handler := NewHandler(database)
	request := authenticatedRequest(
		http.MethodPatch,
		"/v1/check-ins/11111111-1111-4111-8111-111111111111/outcome",
		strings.NewReader(`{
			"stucknessAfter":4,
			"interventionAttempted":false,
			"helpfulness":"not_yet"
		}`),
	)
	request.SetPathValue("id", "11111111-1111-4111-8111-111111111111")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, recorder.Code)
	}
}

func authenticatedRequest(method, target string, body *strings.Reader) *http.Request {
	request := httptest.NewRequest(method, target, body)
	claims := &clerk.SessionClaims{
		RegisteredClaims: clerk.RegisteredClaims{Subject: "user_test_123"},
	}
	return request.WithContext(clerk.ContextWithSessionClaims(request.Context(), claims))
}

func testCheckIn() Response {
	reason := "Hard to begin"
	supportAction := "five_minute_start"
	nextStep := "Open the document"
	plannedMinutes := 5
	now := time.Now().UTC()
	return Response{
		ID:              "11111111-1111-4111-8111-111111111111",
		Blocker:         BlockerTaskInitiation,
		Reason:          &reason,
		SupportAction:   &supportAction,
		NextStep:        &nextStep,
		PlannedMinutes:  &plannedMinutes,
		StucknessBefore: 8,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
}
