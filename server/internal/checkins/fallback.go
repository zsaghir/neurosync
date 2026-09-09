package checkins

import (
	"context"
	"errors"
	"log"
)

const fallbackObservation = "Personalized suggestions are unavailable right now, so here are three reliable starting points."

const fallbackMedicalNote = "Follow your existing care plan. If medication or substance effects concern you, contact a qualified professional."

// PresetSuggester returns safe, deterministic choices for each blocker.
type PresetSuggester struct{}

func (PresetSuggester) Suggest(
	_ context.Context,
	input SuggestionInput,
) (SuggestionResponse, error) {
	response := SuggestionResponse{Observation: fallbackObservation}

	switch input.Blocker {
	case BlockerTaskInitiation:
		response.Reassurance = "Being stuck at the starting line does not mean you are incapable."
		response.Suggestions = []Suggestion{
			{
				Strategy:       StrategyTinyStep,
				Title:          "Make the start visible",
				NextStep:       "Open the task and point to the first unfinished part.",
				PlannedMinutes: 5,
				Why:            "A visible starting point removes one decision.",
			},
			{
				Strategy:       StrategyReduceChoices,
				Title:          "Choose one action",
				NextStep:       "Write one action you can do without deciding anything else.",
				PlannedMinutes: 5,
				Why:            "One choice is easier to enter than the whole task.",
			},
			{
				Strategy:       StrategyShortSprint,
				Title:          "Try ten minutes",
				NextStep:       "Set a ten-minute timer and work only until it rings.",
				PlannedMinutes: 10,
				Why:            "A clear stopping point makes starting less open-ended.",
			},
		}
	case BlockerTimeBlindness:
		response.Reassurance = "Unclear time can make a manageable task feel much larger."
		response.Suggestions = []Suggestion{
			{
				Strategy:       StrategyMakeVisible,
				Title:          "Make time visible",
				NextStep:       "Set a visible ten-minute timer for one part of the task.",
				PlannedMinutes: 10,
				Why:            "A visible timer gives the work a boundary.",
			},
			{
				Strategy:       StrategyExternalize,
				Title:          "Estimate one step",
				NextStep:       "Write the next step and estimate only that step.",
				PlannedMinutes: 5,
				Why:            "Estimating one action is easier than estimating everything.",
			},
			{
				Strategy:       StrategyShortSprint,
				Title:          "Use a stopping point",
				NextStep:       "Work on one part for fifteen minutes, then reassess.",
				PlannedMinutes: 15,
				Why:            "A planned stop keeps the task from feeling endless.",
			},
		}
	case BlockerShame:
		response.Reassurance = "Falling behind does not remove your right to restart gently."
		response.Suggestions = []Suggestion{
			{
				Strategy:       StrategyGentleRestart,
				Title:          "Restart from here",
				NextStep:       "Open the task and find the last place you touched.",
				PlannedMinutes: 5,
				Why:            "You can continue from today without repairing everything first.",
			},
			{
				Strategy:       StrategyTinyStep,
				Title:          "Lower today's bar",
				NextStep:       "Write the smallest useful version you could finish today.",
				PlannedMinutes: 5,
				Why:            "A smaller target makes returning safer and more concrete.",
			},
			{
				Strategy:       StrategyImmediateReward,
				Title:          "Pair the restart with comfort",
				NextStep:       "Choose one small reward, then work for ten minutes.",
				PlannedMinutes: 10,
				Why:            "An immediate positive cue can make re-entry feel less punishing.",
			},
		}
	default:
		return SuggestionResponse{}, errors.New("unsupported blocker")
	}

	if isTrue(input.MedicationShift) || isTrue(input.SubstanceImpact) {
		note := fallbackMedicalNote
		response.MedicalNote = &note
	}
	return response, nil
}

// FallbackSuggester uses presets when the primary provider fails or returns invalid output.
type FallbackSuggester struct {
	primary  Suggester
	fallback Suggester
}

// NewFallbackSuggester adds the standard preset fallback to a primary provider.
func NewFallbackSuggester(primary Suggester) *FallbackSuggester {
	return &FallbackSuggester{primary: primary, fallback: PresetSuggester{}}
}

func (suggester *FallbackSuggester) Suggest(
	ctx context.Context,
	input SuggestionInput,
) (SuggestionResponse, error) {
	response, err := suggester.primary.Suggest(ctx, input)
	if err == nil {
		validated, validationErr := ValidateSuggestionResponse(response)
		if validationErr == nil {
			return validated, nil
		}
		log.Print("primary suggestion provider returned invalid output; using preset fallback")
	} else {
		log.Print("primary suggestion provider failed; using preset fallback")
	}

	if ctx.Err() != nil {
		return SuggestionResponse{}, ctx.Err()
	}
	return suggester.fallback.Suggest(ctx, input)
}

func isTrue(value *bool) bool {
	return value != nil && *value
}
