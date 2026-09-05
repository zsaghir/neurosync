package checkins

// Capacity describes how much usable energy the user feels they have.
type Capacity string

const (
	CapacityAboutNormal       Capacity = "about_normal"
	CapacityLowerThanUsual    Capacity = "lower_than_usual"
	CapacityAlmostNothingLeft Capacity = "almost_nothing_left"
	CapacityNotSure           Capacity = "not_sure"
)

// SleepQuality describes the user's optional sleep check-in.
type SleepQuality string

const (
	SleepRestful        SleepQuality = "restful"
	SleepTooShort       SleepQuality = "too_short"
	SleepRestless       SleepQuality = "restless"
	SleepPreferNotToSay SleepQuality = "prefer_not_to_say"
)

// BasicNeeds describes whether the user has recently eaten and had water.
type BasicNeeds string

const (
	BasicNeedsMet            BasicNeeds = "yes"
	BasicNeedsNotReally      BasicNeeds = "not_really"
	BasicNeedsPreferNotToSay BasicNeeds = "prefer_not_to_say"
)

// Difficulty is one immediate problem the user may select.
type Difficulty string

const (
	DifficultyTaskTooLarge           Difficulty = "task_too_large"
	DifficultyFirstStepUnclear       Difficulty = "first_step_unclear"
	DifficultyShame                  Difficulty = "shame"
	DifficultyDistracted             Difficulty = "distracted"
	DifficultyTimeUnclear            Difficulty = "time_unclear"
	DifficultyTooManyChoices         Difficulty = "too_many_choices"
	DifficultyLowEnergy              Difficulty = "low_energy"
	DifficultyEmotionallyOverwhelmed Difficulty = "emotionally_overwhelmed"
)

// Strategy is one non-medical support approach the suggestion system may use.
type Strategy string

const (
	StrategyExternalize        Strategy = "externalize"
	StrategyTinyStep           Strategy = "tiny_step"
	StrategyShortSprint        Strategy = "short_sprint"
	StrategyMakeVisible        Strategy = "make_visible"
	StrategyReduceChoices      Strategy = "reduce_choices"
	StrategyBodyDouble         Strategy = "body_double"
	StrategyImmediateReward    Strategy = "immediate_reward"
	StrategyBasicNeedsCheck    Strategy = "basic_needs_check"
	StrategyReduceDistractions Strategy = "reduce_distractions"
	StrategyGentleRestart      Strategy = "gentle_restart"
)

// SuggestionRequest contains temporary context used to generate suggestions.
// This contract does not imply that the raw brain dump is persisted.
type SuggestionRequest struct {
	TaskID          *string       `json:"taskId"`
	Blocker         Blocker       `json:"blocker"`
	BrainDump       string        `json:"brainDump"`
	Capacity        *Capacity     `json:"capacity"`
	Sleep           *SleepQuality `json:"sleep"`
	BasicNeeds      *BasicNeeds   `json:"basicNeeds"`
	MedicationShift *bool         `json:"medicationShift"`
	SubstanceImpact *bool         `json:"substanceImpact"`
	Difficulties    []Difficulty  `json:"difficulties"`
}

// Suggestion is one concrete, bounded action returned to the user.
type Suggestion struct {
	Strategy       Strategy `json:"strategy"`
	Title          string   `json:"title"`
	NextStep       string   `json:"nextStep"`
	PlannedMinutes int      `json:"plannedMinutes"`
	Why            string   `json:"why"`
}

// SuggestionResponse contains supportive copy and three actionable choices.
type SuggestionResponse struct {
	Reassurance string       `json:"reassurance"`
	Observation string       `json:"observation"`
	Suggestions []Suggestion `json:"suggestions"`
	MedicalNote *string      `json:"medicalNote"`
}
