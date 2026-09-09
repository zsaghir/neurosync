package checkins

import (
	"context"
	"os"
	"testing"
	"time"
)

func TestLiveGeminiStructuredSuggestion(t *testing.T) {
	suggester, err := NewGeminiSuggester(
		os.Getenv("GOOGLE_GENERATIVE_AI_API_KEY"),
		os.Getenv("GEMINI_MODEL"),
	)
	if err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	response, err := suggester.Suggest(ctx, SuggestionInput{
		Blocker:   BlockerTaskInitiation,
		BrainDump: "I have a short test task and do not know where to begin.",
		Difficulties: []Difficulty{
			DifficultyFirstStepUnclear,
		},
	})
	if err != nil {
		t.Fatalf("structured Gemini request failed: %v", err)
	}
	if _, err := ValidateSuggestionResponse(response); err != nil {
		t.Fatalf("Gemini response failed validation: %v", err)
	}
}
