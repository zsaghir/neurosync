package checkins

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
)

type fakeSuggester struct {
	calls    int
	input    SuggestionInput
	response SuggestionResponse
	err      error
}

func (fake *fakeSuggester) Suggest(
	_ context.Context,
	input SuggestionInput,
) (SuggestionResponse, error) {
	fake.calls++
	fake.input = input
	return fake.response, fake.err
}

func taskTitleRow(title string) pgx.Row {
	return &fakeRow{scan: func(destinations []any) error {
		*destinations[0].(*string) = title
		return nil
	}}
}

func TestSuggestionHandlerUsesOwnedTaskAndValidatedContext(t *testing.T) {
	database := &fakeDatabase{rows: []pgx.Row{taskTitleRow("Write project report")}}
	suggester := &fakeSuggester{response: validSuggestionResponse()}
	handler := NewSuggestionHandler(database, suggester)
	request := authenticatedRequest(
		http.MethodPost,
		"/v1/check-in-suggestions",
		strings.NewReader(`{
			"taskId":"11111111-1111-4111-8111-111111111111",
			"blocker":"task_initiation",
			"brainDump":"  I have too many assignments and cannot find the first step.  ",
			"capacity":"lower_than_usual",
			"sleep":"too_short",
			"basicNeeds":"not_really",
			"medicationShift":false,
			"substanceImpact":false,
			"difficulties":["task_too_large","first_step_unclear"]
		}`),
	)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	if len(database.calls) != 1 {
		t.Fatalf("expected one task lookup, got %d", len(database.calls))
	}
	if !strings.Contains(database.calls[0].query, "owner.clerk_user_id = $1") {
		t.Fatal("task lookup was not scoped to the verified owner")
	}
	if database.calls[0].args[0] != "user_test_123" {
		t.Errorf("expected verified user ID, got %#v", database.calls[0].args[0])
	}
	if suggester.calls != 1 {
		t.Fatalf("expected one suggester call, got %d", suggester.calls)
	}
	if suggester.input.TaskTitle == nil || *suggester.input.TaskTitle != "Write project report" {
		t.Errorf("expected owned task title, got %#v", suggester.input.TaskTitle)
	}
	if suggester.input.BrainDump != "I have too many assignments and cannot find the first step." {
		t.Errorf("expected trimmed brain dump, got %q", suggester.input.BrainDump)
	}
	if suggester.input.MedicationShift == nil || *suggester.input.MedicationShift {
		t.Error("explicit false medicationShift value was not preserved")
	}

	var response SuggestionResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("could not decode suggestion response: %v", err)
	}
	if len(response.Suggestions) != 3 {
		t.Errorf("expected three suggestions, got %d", len(response.Suggestions))
	}
}

func TestSuggestionHandlerAllowsCheckInWithoutTask(t *testing.T) {
	database := &fakeDatabase{}
	suggester := &fakeSuggester{response: validSuggestionResponse()}
	handler := NewSuggestionHandler(database, suggester)
	request := authenticatedRequest(
		http.MethodPost,
		"/v1/check-in-suggestions",
		strings.NewReader(`{
			"blocker":"shame",
			"brainDump":"I feel behind and do not know how to return."
		}`),
	)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	if len(database.calls) != 0 {
		t.Fatal("taskless suggestion unexpectedly queried a task")
	}
	if suggester.input.TaskTitle != nil {
		t.Errorf("expected no task title, got %#v", suggester.input.TaskTitle)
	}
}

func TestSuggestionHandlerHidesTaskOwnedByAnotherUser(t *testing.T) {
	database := &fakeDatabase{rows: []pgx.Row{&fakeRow{err: pgx.ErrNoRows}}}
	suggester := &fakeSuggester{response: validSuggestionResponse()}
	handler := NewSuggestionHandler(database, suggester)
	request := authenticatedRequest(
		http.MethodPost,
		"/v1/check-in-suggestions",
		strings.NewReader(`{
			"taskId":"11111111-1111-4111-8111-111111111111",
			"blocker":"task_initiation",
			"brainDump":"I cannot find the first step for this task."
		}`),
	)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, recorder.Code)
	}
	if suggester.calls != 0 {
		t.Fatal("another user's task context reached the suggestion provider")
	}
}

func TestSuggestionHandlerRejectsInvalidInputBeforeDependencies(t *testing.T) {
	database := &fakeDatabase{}
	suggester := &fakeSuggester{response: validSuggestionResponse()}
	handler := NewSuggestionHandler(database, suggester)
	request := authenticatedRequest(
		http.MethodPost,
		"/v1/check-in-suggestions",
		strings.NewReader(`{"blocker":"task_initiation","brainDump":"short"}`),
	)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, recorder.Code)
	}
	if len(database.calls) != 0 || suggester.calls != 0 {
		t.Fatal("invalid input reached a dependency")
	}
}

func TestSuggestionHandlerRejectsInvalidProviderOutput(t *testing.T) {
	invalidResponse := validSuggestionResponse()
	invalidResponse.Suggestions = invalidResponse.Suggestions[:2]
	suggester := &fakeSuggester{response: invalidResponse}
	handler := NewSuggestionHandler(&fakeDatabase{}, suggester)
	request := authenticatedRequest(
		http.MethodPost,
		"/v1/check-in-suggestions",
		strings.NewReader(`{
			"blocker":"time_blindness",
			"brainDump":"I cannot judge how long any part of this will take."
		}`),
	)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, recorder.Code)
	}
	if strings.Contains(recorder.Body.String(), "exactly 3") {
		t.Fatal("response exposed internal provider validation details")
	}
}

func TestSuggestionHandlerHandlesUnavailableProvider(t *testing.T) {
	suggester := &fakeSuggester{err: errors.New("provider secret")}
	handler := NewSuggestionHandler(&fakeDatabase{}, suggester)
	request := authenticatedRequest(
		http.MethodPost,
		"/v1/check-in-suggestions",
		strings.NewReader(`{
			"blocker":"task_initiation",
			"brainDump":"I cannot decide how to begin this assignment."
		}`),
	)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, recorder.Code)
	}
	if strings.Contains(recorder.Body.String(), "provider secret") {
		t.Fatal("response exposed the provider error")
	}
}

func TestSuggestionHandlerRequiresVerifiedUser(t *testing.T) {
	suggester := &fakeSuggester{response: validSuggestionResponse()}
	handler := NewSuggestionHandler(&fakeDatabase{}, suggester)
	request := httptest.NewRequest(
		http.MethodPost,
		"/v1/check-in-suggestions",
		strings.NewReader(`{
			"blocker":"task_initiation",
			"brainDump":"I cannot decide how to begin this assignment."
		}`),
	)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, recorder.Code)
	}
	if suggester.calls != 0 {
		t.Fatal("unauthenticated context reached the suggestion provider")
	}
}

func TestSuggestionHandlerAllowsOnlyPost(t *testing.T) {
	suggester := &fakeSuggester{response: validSuggestionResponse()}
	handler := NewSuggestionHandler(&fakeDatabase{}, suggester)
	request := authenticatedRequest(http.MethodGet, "/v1/check-in-suggestions", strings.NewReader(""))
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status %d, got %d", http.StatusMethodNotAllowed, recorder.Code)
	}
	if recorder.Header().Get("Allow") != http.MethodPost {
		t.Errorf("expected Allow header %q, got %q", http.MethodPost, recorder.Header().Get("Allow"))
	}
	if suggester.calls != 0 {
		t.Fatal("non-POST request reached the suggestion provider")
	}
}
