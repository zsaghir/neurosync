package checkins

import (
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
)

const (
	minBrainDumpLength       = 10
	maxBrainDumpLength       = 2000
	maxDifficulties          = 8
	requiredSuggestionCount  = 3
	maxSuggestionTitleLength = 64
	maxReassuranceLength     = 160
	maxObservationLength     = 240
	maxSuggestionWhyLength   = 160
	maxMedicalNoteLength     = 280
	minSuggestionMinutes     = 2
	maxSuggestionMinutes     = 30
)

// ValidateSuggestionRequest validates and trims temporary suggestion context.
func ValidateSuggestionRequest(request SuggestionRequest) (SuggestionRequest, error) {
	if !validBlocker(request.Blocker) {
		return SuggestionRequest{}, errors.New("blocker must be shame, task_initiation, or time_blindness")
	}

	request.BrainDump = strings.TrimSpace(request.BrainDump)
	brainDumpLength := len([]rune(request.BrainDump))
	if brainDumpLength < minBrainDumpLength || brainDumpLength > maxBrainDumpLength {
		return SuggestionRequest{}, fmt.Errorf(
			"brainDump must be between %d and %d characters",
			minBrainDumpLength,
			maxBrainDumpLength,
		)
	}

	if request.TaskID != nil {
		taskID := strings.TrimSpace(*request.TaskID)
		var parsedTaskID pgtype.UUID
		if err := parsedTaskID.Scan(taskID); err != nil || !parsedTaskID.Valid {
			return SuggestionRequest{}, errors.New("taskId must be a valid UUID")
		}
		request.TaskID = &taskID
	}

	if request.Capacity != nil && !validCapacity(*request.Capacity) {
		return SuggestionRequest{}, errors.New("capacity is invalid")
	}
	if request.Sleep != nil && !validSleepQuality(*request.Sleep) {
		return SuggestionRequest{}, errors.New("sleep is invalid")
	}
	if request.BasicNeeds != nil && !validBasicNeeds(*request.BasicNeeds) {
		return SuggestionRequest{}, errors.New("basicNeeds is invalid")
	}
	if len(request.Difficulties) > maxDifficulties {
		return SuggestionRequest{}, fmt.Errorf("difficulties cannot contain more than %d items", maxDifficulties)
	}

	seenDifficulties := make(map[Difficulty]struct{}, len(request.Difficulties))
	for _, difficulty := range request.Difficulties {
		if !validDifficulty(difficulty) {
			return SuggestionRequest{}, fmt.Errorf("difficulty %q is invalid", difficulty)
		}
		if _, exists := seenDifficulties[difficulty]; exists {
			return SuggestionRequest{}, fmt.Errorf("difficulty %q cannot be repeated", difficulty)
		}
		seenDifficulties[difficulty] = struct{}{}
	}

	return request, nil
}

// ValidateSuggestionResponse validates and trims generated suggestion output.
func ValidateSuggestionResponse(response SuggestionResponse) (SuggestionResponse, error) {
	var err error
	response.Reassurance, err = validateRequiredSuggestionText(
		response.Reassurance,
		"reassurance",
		maxReassuranceLength,
	)
	if err != nil {
		return SuggestionResponse{}, err
	}
	response.Observation, err = validateRequiredSuggestionText(
		response.Observation,
		"observation",
		maxObservationLength,
	)
	if err != nil {
		return SuggestionResponse{}, err
	}
	response.MedicalNote, err = validateOptionalText(
		response.MedicalNote,
		"medicalNote",
		maxMedicalNoteLength,
	)
	if err != nil {
		return SuggestionResponse{}, err
	}

	if len(response.Suggestions) != requiredSuggestionCount {
		return SuggestionResponse{}, fmt.Errorf("suggestions must contain exactly %d items", requiredSuggestionCount)
	}

	seenStrategies := make(map[Strategy]struct{}, requiredSuggestionCount)
	for index := range response.Suggestions {
		suggestion := &response.Suggestions[index]
		if !validStrategy(suggestion.Strategy) {
			return SuggestionResponse{}, fmt.Errorf("suggestions[%d].strategy is invalid", index)
		}
		if _, exists := seenStrategies[suggestion.Strategy]; exists {
			return SuggestionResponse{}, fmt.Errorf("suggestions[%d].strategy cannot be repeated", index)
		}
		seenStrategies[suggestion.Strategy] = struct{}{}

		suggestion.Title, err = validateRequiredSuggestionText(
			suggestion.Title,
			fmt.Sprintf("suggestions[%d].title", index),
			maxSuggestionTitleLength,
		)
		if err != nil {
			return SuggestionResponse{}, err
		}
		suggestion.NextStep, err = validateRequiredSuggestionText(
			suggestion.NextStep,
			fmt.Sprintf("suggestions[%d].nextStep", index),
			maxNextStepLength,
		)
		if err != nil {
			return SuggestionResponse{}, err
		}
		suggestion.Why, err = validateRequiredSuggestionText(
			suggestion.Why,
			fmt.Sprintf("suggestions[%d].why", index),
			maxSuggestionWhyLength,
		)
		if err != nil {
			return SuggestionResponse{}, err
		}
		if suggestion.PlannedMinutes < minSuggestionMinutes || suggestion.PlannedMinutes > maxSuggestionMinutes {
			return SuggestionResponse{}, fmt.Errorf(
				"suggestions[%d].plannedMinutes must be between %d and %d",
				index,
				minSuggestionMinutes,
				maxSuggestionMinutes,
			)
		}
	}

	return response, nil
}

func validateRequiredSuggestionText(value, field string, maxLength int) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", fmt.Errorf("%s is required", field)
	}
	if len([]rune(trimmed)) > maxLength {
		return "", fmt.Errorf("%s must be %d characters or fewer", field, maxLength)
	}
	return trimmed, nil
}

func validCapacity(value Capacity) bool {
	return value == CapacityAboutNormal ||
		value == CapacityLowerThanUsual ||
		value == CapacityAlmostNothingLeft ||
		value == CapacityNotSure
}

func validSleepQuality(value SleepQuality) bool {
	return value == SleepRestful ||
		value == SleepTooShort ||
		value == SleepRestless ||
		value == SleepPreferNotToSay
}

func validBasicNeeds(value BasicNeeds) bool {
	return value == BasicNeedsMet ||
		value == BasicNeedsNotReally ||
		value == BasicNeedsPreferNotToSay
}

func validDifficulty(value Difficulty) bool {
	return value == DifficultyTaskTooLarge ||
		value == DifficultyFirstStepUnclear ||
		value == DifficultyShame ||
		value == DifficultyDistracted ||
		value == DifficultyTimeUnclear ||
		value == DifficultyTooManyChoices ||
		value == DifficultyLowEnergy ||
		value == DifficultyEmotionallyOverwhelmed
}

func validStrategy(value Strategy) bool {
	return value == StrategyExternalize ||
		value == StrategyTinyStep ||
		value == StrategyShortSprint ||
		value == StrategyMakeVisible ||
		value == StrategyReduceChoices ||
		value == StrategyBodyDouble ||
		value == StrategyImmediateReward ||
		value == StrategyBasicNeedsCheck ||
		value == StrategyReduceDistractions ||
		value == StrategyGentleRestart
}
