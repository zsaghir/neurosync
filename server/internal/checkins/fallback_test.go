package checkins

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type recoveringSuggester struct {
	calls    int
	response SuggestionResponse
}

func (suggester *recoveringSuggester) Suggest(
	_ context.Context,
	_ SuggestionInput,
) (SuggestionResponse, error) {
	suggester.calls++
	if suggester.calls == 1 {
		return SuggestionResponse{}, errors.New("temporary provider failure")
	}
	return suggester.response, nil
}

func TestPresetSuggesterReturnsValidChoicesForEveryBlocker(t *testing.T) {
	tests := []struct {
		blocker    Blocker
		strategies []Strategy
		minutes    []int
	}{
		{
			blocker:    BlockerTaskInitiation,
			strategies: []Strategy{StrategyTinyStep, StrategyReduceChoices, StrategyShortSprint},
			minutes:    []int{5, 5, 10},
		},
		{
			blocker:    BlockerTimeBlindness,
			strategies: []Strategy{StrategyMakeVisible, StrategyExternalize, StrategyShortSprint},
			minutes:    []int{10, 5, 15},
		},
		{
			blocker:    BlockerShame,
			strategies: []Strategy{StrategyGentleRestart, StrategyTinyStep, StrategyImmediateReward},
			minutes:    []int{5, 5, 10},
		},
	}

	for _, test := range tests {
		t.Run(string(test.blocker), func(t *testing.T) {
			response, err := (PresetSuggester{}).Suggest(context.Background(), SuggestionInput{
				Blocker:   test.blocker,
				BrainDump: "This content must not affect deterministic fallback choices.",
			})
			if err != nil {
				t.Fatalf("expected preset suggestions, got %v", err)
			}
			if _, err := ValidateSuggestionResponse(response); err != nil {
				t.Fatalf("preset response is invalid: %v", err)
			}
			if response.Observation != fallbackObservation {
				t.Errorf("unexpected fallback disclosure %q", response.Observation)
			}
			for index, suggestion := range response.Suggestions {
				if suggestion.Strategy != test.strategies[index] {
					t.Errorf("suggestion %d: expected strategy %q, got %q", index, test.strategies[index], suggestion.Strategy)
				}
				if suggestion.PlannedMinutes != test.minutes[index] {
					t.Errorf("suggestion %d: expected %d minutes, got %d", index, test.minutes[index], suggestion.PlannedMinutes)
				}
			}
		})
	}
}

func TestPresetSuggesterAddsMedicalNoteOnlyWhenRelevant(t *testing.T) {
	trueValue := true
	falseValue := false
	tests := []struct {
		name            string
		medicationShift *bool
		substanceImpact *bool
		expectsNote     bool
	}{
		{name: "no answers", expectsNote: false},
		{name: "explicit false", medicationShift: &falseValue, substanceImpact: &falseValue, expectsNote: false},
		{name: "medication shift", medicationShift: &trueValue, expectsNote: true},
		{name: "substance impact", substanceImpact: &trueValue, expectsNote: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response, err := (PresetSuggester{}).Suggest(context.Background(), SuggestionInput{
				Blocker:         BlockerTaskInitiation,
				MedicationShift: test.medicationShift,
				SubstanceImpact: test.substanceImpact,
			})
			if err != nil {
				t.Fatal(err)
			}
			if (response.MedicalNote != nil) != test.expectsNote {
				t.Errorf("expected medical note=%t, got %#v", test.expectsNote, response.MedicalNote)
			}
		})
	}
}

func TestFallbackSuggesterReturnsValidPrimaryResponse(t *testing.T) {
	primaryResponse := validSuggestionResponse()
	primary := &fakeSuggester{response: primaryResponse}
	fallback := &fakeSuggester{response: SuggestionResponse{Reassurance: "should not be used"}}
	suggester := &FallbackSuggester{primary: primary, fallback: fallback}

	response, err := suggester.Suggest(context.Background(), SuggestionInput{Blocker: BlockerTaskInitiation})
	if err != nil {
		t.Fatalf("expected primary response, got %v", err)
	}
	if response.Reassurance != primaryResponse.Reassurance {
		t.Error("valid primary response was replaced")
	}
	if primary.calls != 1 || fallback.calls != 0 {
		t.Fatalf("expected primary calls=1 and fallback calls=0, got %d and %d", primary.calls, fallback.calls)
	}
}

func TestFallbackSuggesterRecoversOnSecondPrimaryAttempt(t *testing.T) {
	primaryResponse := validSuggestionResponse()
	primary := &recoveringSuggester{response: primaryResponse}
	suggester := NewFallbackSuggester(primary)

	response, err := suggester.Suggest(
		context.Background(),
		SuggestionInput{Blocker: BlockerTaskInitiation},
	)
	if err != nil {
		t.Fatalf("expected retry to recover, got %v", err)
	}
	if primary.calls != 2 {
		t.Fatalf("expected two primary attempts, got %d", primary.calls)
	}
	if response.Observation != primaryResponse.Observation {
		t.Fatal("recovered personalized response was replaced")
	}
}

func TestFallbackSuggesterUsesPresetForProviderErrorsAndTimeouts(t *testing.T) {
	tests := []struct {
		name string
		err  error
	}{
		{name: "provider error", err: errors.New("private provider details")},
		{name: "provider timeout", err: context.DeadlineExceeded},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			primary := &fakeSuggester{err: test.err}
			suggester := NewFallbackSuggester(primary)
			var logs bytes.Buffer
			originalWriter := log.Writer()
			log.SetOutput(&logs)
			defer log.SetOutput(originalWriter)

			response, err := suggester.Suggest(context.Background(), SuggestionInput{Blocker: BlockerShame})
			if err != nil {
				t.Fatalf("expected fallback response, got %v", err)
			}
			if response.Observation != fallbackObservation {
				t.Error("provider failure did not use the preset response")
			}
			if primary.calls != primarySuggestionAttempts {
				t.Fatalf("expected %d primary attempts, got %d", primarySuggestionAttempts, primary.calls)
			}
			if strings.Contains(logs.String(), test.err.Error()) {
				t.Fatal("provider error details were logged")
			}
		})
	}
}

func TestFallbackSuggesterUsesPresetForInvalidPrimaryOutput(t *testing.T) {
	invalid := validSuggestionResponse()
	invalid.Suggestions = invalid.Suggestions[:2]
	primary := &fakeSuggester{response: invalid}
	suggester := NewFallbackSuggester(primary)

	response, err := suggester.Suggest(context.Background(), SuggestionInput{Blocker: BlockerTimeBlindness})
	if err != nil {
		t.Fatalf("expected fallback response, got %v", err)
	}
	if response.Observation != fallbackObservation {
		t.Error("invalid primary output did not use the preset response")
	}
}

func TestSuggestionHandlerReturns200WithFallbackSuggestions(t *testing.T) {
	primary := &fakeSuggester{err: errors.New("provider unavailable")}
	handler := NewSuggestionHandler(&fakeDatabase{}, NewFallbackSuggester(primary))
	request := authenticatedRequest(
		http.MethodPost,
		"/v1/check-in-suggestions",
		strings.NewReader(`{
			"blocker":"shame",
			"brainDump":"I feel embarrassed that I have avoided this for so long."
		}`),
	)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	var response SuggestionResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("could not decode fallback response: %v", err)
	}
	if response.Observation != fallbackObservation || len(response.Suggestions) != 3 {
		t.Fatalf("unexpected fallback response: %#v", response)
	}
}

func TestSuggestionHandlerReturns503WhenFallbackAlsoFails(t *testing.T) {
	primary := &fakeSuggester{err: errors.New("primary failure")}
	fallback := &fakeSuggester{err: errors.New("fallback failure")}
	suggester := &FallbackSuggester{primary: primary, fallback: fallback}
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
	if !strings.Contains(recorder.Body.String(), "suggestions_unavailable") {
		t.Fatalf("unexpected response %s", recorder.Body.String())
	}
	if strings.Contains(recorder.Body.String(), "fallback failure") {
		t.Fatal("fallback error details were exposed")
	}
}
