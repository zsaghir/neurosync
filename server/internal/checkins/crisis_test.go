package checkins

import "testing"

func TestRequiresCrisisSupportRecognizesDirectImmediateLanguage(t *testing.T) {
	tests := []string{
		"I want to kill myself.",
		"I'M   GOING TO END MY LIFE!",
		"I've been thinking about suicide.",
		"I’ll hurt myself tonight.",
		"I plan to self-harm.",
		"I am going to commit suicide.",
		"I am in immediate danger.",
		"I am in danger right now.",
		"Someone is trying to hurt me.",
	}

	for _, value := range tests {
		if !requiresCrisisSupport(value) {
			t.Errorf("expected crisis support for %q", value)
		}
	}
}

func TestRequiresCrisisSupportAvoidsBroadAndNegatedLanguage(t *testing.T) {
	tests := []string{
		"This assignment is killing me.",
		"I'm dead tired.",
		"I want to kill this task.",
		"I am not going to kill myself.",
		"I don't want to kill myself.",
		"I'm studying suicide prevention.",
		`My story contains the line "I want to kill myself."`,
		"My character wants to end her life.",
	}

	for _, value := range tests {
		if requiresCrisisSupport(value) {
			t.Errorf("did not expect crisis support for %q", value)
		}
	}
}
