package checkins

import (
	"strings"
	"testing"
)

func TestValidateSuggestionRequestTrimsValidInput(t *testing.T) {
	taskID := " 11111111-1111-4111-8111-111111111111 "
	capacity := CapacityLowerThanUsual
	sleep := SleepTooShort
	basicNeeds := BasicNeedsNotReally
	medicationShift := false
	request := SuggestionRequest{
		TaskID:          &taskID,
		Blocker:         BlockerTaskInitiation,
		BrainDump:       "  I have three assignments and cannot choose where to begin.  ",
		Capacity:        &capacity,
		Sleep:           &sleep,
		BasicNeeds:      &basicNeeds,
		MedicationShift: &medicationShift,
		Difficulties: []Difficulty{
			DifficultyTaskTooLarge,
			DifficultyFirstStepUnclear,
		},
	}

	validated, err := ValidateSuggestionRequest(request)
	if err != nil {
		t.Fatalf("expected valid request, got %v", err)
	}
	if validated.BrainDump != "I have three assignments and cannot choose where to begin." {
		t.Errorf("brain dump was not trimmed: %q", validated.BrainDump)
	}
	if validated.TaskID == nil || *validated.TaskID != "11111111-1111-4111-8111-111111111111" {
		t.Errorf("task ID was not trimmed: %#v", validated.TaskID)
	}
	if validated.MedicationShift == nil || *validated.MedicationShift {
		t.Error("explicit false medicationShift value was not preserved")
	}
}

func TestValidateSuggestionRequestRejectsInvalidInput(t *testing.T) {
	valid := validSuggestionRequest()

	tests := []struct {
		name    string
		change  func(*SuggestionRequest)
		message string
	}{
		{
			name:    "short brain dump",
			change:  func(request *SuggestionRequest) { request.BrainDump = "Too hard" },
			message: "brainDump must be between",
		},
		{
			name: "long brain dump",
			change: func(request *SuggestionRequest) {
				request.BrainDump = strings.Repeat("a", maxBrainDumpLength+1)
			},
			message: "brainDump must be between",
		},
		{
			name:    "invalid blocker",
			change:  func(request *SuggestionRequest) { request.Blocker = "overwhelmed" },
			message: "blocker must be",
		},
		{
			name: "invalid task ID",
			change: func(request *SuggestionRequest) {
				value := "not-a-uuid"
				request.TaskID = &value
			},
			message: "taskId must be a valid UUID",
		},
		{
			name: "invalid capacity",
			change: func(request *SuggestionRequest) {
				value := Capacity("exhausted")
				request.Capacity = &value
			},
			message: "capacity is invalid",
		},
		{
			name: "invalid sleep",
			change: func(request *SuggestionRequest) {
				value := SleepQuality("none")
				request.Sleep = &value
			},
			message: "sleep is invalid",
		},
		{
			name: "invalid basic needs",
			change: func(request *SuggestionRequest) {
				value := BasicNeeds("maybe")
				request.BasicNeeds = &value
			},
			message: "basicNeeds is invalid",
		},
		{
			name: "invalid difficulty",
			change: func(request *SuggestionRequest) {
				request.Difficulties = []Difficulty{"unknown"}
			},
			message: "difficulty \"unknown\" is invalid",
		},
		{
			name: "duplicate difficulty",
			change: func(request *SuggestionRequest) {
				request.Difficulties = []Difficulty{DifficultyShame, DifficultyShame}
			},
			message: "cannot be repeated",
		},
		{
			name: "too many difficulties",
			change: func(request *SuggestionRequest) {
				request.Difficulties = []Difficulty{
					DifficultyTaskTooLarge,
					DifficultyFirstStepUnclear,
					DifficultyShame,
					DifficultyDistracted,
					DifficultyTimeUnclear,
					DifficultyTooManyChoices,
					DifficultyLowEnergy,
					DifficultyEmotionallyOverwhelmed,
					DifficultyTaskTooLarge,
				}
			},
			message: "cannot contain more than 8 items",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := valid
			test.change(&request)
			_, err := ValidateSuggestionRequest(request)
			if err == nil || !strings.Contains(err.Error(), test.message) {
				t.Fatalf("expected error containing %q, got %v", test.message, err)
			}
		})
	}
}

func TestValidateSuggestionResponseTrimsValidOutput(t *testing.T) {
	medicalNote := "  Follow your prescription instructions or ask a pharmacist if unsure.  "
	response := validSuggestionResponse()
	response.Reassurance = "  You are not failing.  "
	response.MedicalNote = &medicalNote
	response.Suggestions[0].NextStep = "  Open the assignment instructions.  "

	validated, err := ValidateSuggestionResponse(response)
	if err != nil {
		t.Fatalf("expected valid response, got %v", err)
	}
	if validated.Reassurance != "You are not failing." {
		t.Errorf("reassurance was not trimmed: %q", validated.Reassurance)
	}
	if validated.Suggestions[0].NextStep != "Open the assignment instructions." {
		t.Errorf("next step was not trimmed: %q", validated.Suggestions[0].NextStep)
	}
	if validated.MedicalNote == nil || strings.HasPrefix(*validated.MedicalNote, " ") {
		t.Errorf("medical note was not trimmed: %#v", validated.MedicalNote)
	}
}

func TestValidateSuggestionResponseRejectsInvalidOutput(t *testing.T) {
	valid := validSuggestionResponse()

	tests := []struct {
		name    string
		change  func(*SuggestionResponse)
		message string
	}{
		{
			name:    "wrong suggestion count",
			change:  func(response *SuggestionResponse) { response.Suggestions = response.Suggestions[:2] },
			message: "exactly 3",
		},
		{
			name:    "invalid strategy",
			change:  func(response *SuggestionResponse) { response.Suggestions[0].Strategy = "medication_change" },
			message: "strategy is invalid",
		},
		{
			name:    "duplicate strategy",
			change:  func(response *SuggestionResponse) { response.Suggestions[1].Strategy = StrategyTinyStep },
			message: "strategy cannot be repeated",
		},
		{
			name:    "blank next step",
			change:  func(response *SuggestionResponse) { response.Suggestions[0].NextStep = "   " },
			message: "nextStep is required",
		},
		{
			name:    "duration too long",
			change:  func(response *SuggestionResponse) { response.Suggestions[0].PlannedMinutes = 31 },
			message: "plannedMinutes must be between 2 and 30",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := valid
			response.Suggestions = append([]Suggestion(nil), valid.Suggestions...)
			test.change(&response)
			_, err := ValidateSuggestionResponse(response)
			if err == nil || !strings.Contains(err.Error(), test.message) {
				t.Fatalf("expected error containing %q, got %v", test.message, err)
			}
		})
	}
}

func validSuggestionRequest() SuggestionRequest {
	return SuggestionRequest{
		Blocker:   BlockerTaskInitiation,
		BrainDump: "I cannot decide how to begin this assignment.",
	}
}

func validSuggestionResponse() SuggestionResponse {
	return SuggestionResponse{
		Reassurance: "You are not failing.",
		Observation: "The unclear starting point may be increasing the effort needed to begin.",
		Suggestions: []Suggestion{
			{
				Strategy:       StrategyTinyStep,
				Title:          "Find the smallest start",
				NextStep:       "Open the assignment instructions.",
				PlannedMinutes: 5,
				Why:            "A visible first action removes one decision.",
			},
			{
				Strategy:       StrategyExternalize,
				Title:          "Put the steps on paper",
				NextStep:       "Write down the three requirements.",
				PlannedMinutes: 5,
				Why:            "A short list reduces what you need to hold in mind.",
			},
			{
				Strategy:       StrategyShortSprint,
				Title:          "Try a short sprint",
				NextStep:       "Work on the first requirement for ten minutes.",
				PlannedMinutes: 10,
				Why:            "A stopping point makes the commitment more predictable.",
			},
		},
	}
}
