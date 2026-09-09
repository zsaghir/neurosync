package checkins

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (roundTrip roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return roundTrip(request)
}

func TestNewGeminiSuggesterValidatesConfiguration(t *testing.T) {
	if _, err := NewGeminiSuggester("", ""); err == nil {
		t.Fatal("expected a missing API key error")
	}
	if _, err := NewGeminiSuggester("test-key", "models/not-safe"); err == nil {
		t.Fatal("expected an invalid model error")
	}

	suggester, err := NewGeminiSuggester(" test-key ", "")
	if err != nil {
		t.Fatalf("expected valid configuration, got %v", err)
	}
	if suggester.apiKey != "test-key" {
		t.Error("API key was not trimmed")
	}
	if suggester.model != defaultGeminiModel {
		t.Errorf("expected default model %q, got %q", defaultGeminiModel, suggester.model)
	}
}

func TestGeminiSuggesterSendsSafeStructuredRequest(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/test-model:generateContent" {
			t.Errorf("unexpected path %q", r.URL.Path)
		}
		if r.Header.Get("x-goog-api-key") != "server-secret" {
			t.Error("API key was not sent in the server-only header")
		}

		var request geminiRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatalf("could not decode Gemini request: %v", err)
		}
		if request.GenerationConfig.ResponseMimeType != "application/json" {
			t.Errorf("unexpected response MIME type %q", request.GenerationConfig.ResponseMimeType)
		}
		if len(request.GenerationConfig.ResponseSchema) == 0 {
			t.Fatal("structured response schema was not sent")
		}
		if !strings.Contains(request.SystemInstruction.Parts[0].Text, "Do not diagnose") {
			t.Error("safety instruction was not sent")
		}

		contextText := request.Contents[0].Parts[0].Text
		if !strings.Contains(contextText, `"taskTitle":"Write project report"`) {
			t.Errorf("owned task title was not sent: %s", contextText)
		}
		if !strings.Contains(contextText, `"brainDump":"I am frozen because every part feels equally urgent."`) {
			t.Errorf("brain dump was not sent: %s", contextText)
		}
		if strings.Contains(contextText, "server-secret") || strings.Contains(contextText, "clerk") {
			t.Fatal("secret or identity data leaked into provider context")
		}

		return geminiSuggestionHTTPResponse(t, validSuggestionResponse()), nil
	})}

	suggester, err := NewGeminiSuggester("server-secret", "test-model")
	if err != nil {
		t.Fatalf("could not create suggester: %v", err)
	}
	suggester.baseURL = "https://gemini.test"
	suggester.client = client
	taskTitle := "Write project report"

	response, err := suggester.Suggest(context.Background(), SuggestionInput{
		TaskTitle: &taskTitle,
		Blocker:   BlockerTaskInitiation,
		BrainDump: "I am frozen because every part feels equally urgent.",
	})
	if err != nil {
		t.Fatalf("expected suggestions, got %v", err)
	}
	if len(response.Suggestions) != 3 {
		t.Errorf("expected three suggestions, got %d", len(response.Suggestions))
	}
}

func TestGeminiSuggesterRejectsProviderFailureWithoutLeakingBody(t *testing.T) {
	suggester, err := NewGeminiSuggester("server-secret", "test-model")
	if err != nil {
		t.Fatalf("could not create suggester: %v", err)
	}
	suggester.client = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusTooManyRequests,
			Body:       io.NopCloser(strings.NewReader("private provider details")),
		}, nil
	})}

	_, err = suggester.Suggest(context.Background(), SuggestionInput{
		Blocker:   BlockerTimeBlindness,
		BrainDump: "I cannot tell how long this assignment will take.",
	})
	if err == nil || !strings.Contains(err.Error(), "status 429") {
		t.Fatalf("expected status error, got %v", err)
	}
	if strings.Contains(err.Error(), "private provider details") {
		t.Fatal("provider response body leaked into the error")
	}
}

func TestGeminiSuggesterRejectsMissingGeneratedContent(t *testing.T) {
	suggester, err := NewGeminiSuggester("server-secret", "test-model")
	if err != nil {
		t.Fatalf("could not create suggester: %v", err)
	}
	suggester.client = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(`{"candidates":[]}`)),
		}, nil
	})}

	_, err = suggester.Suggest(context.Background(), SuggestionInput{
		Blocker:   BlockerShame,
		BrainDump: "I feel embarrassed that I am behind again.",
	})
	if err == nil || !strings.Contains(err.Error(), "no suggestion content") {
		t.Fatalf("expected missing content error, got %v", err)
	}
}

func geminiSuggestionHTTPResponse(t *testing.T, response SuggestionResponse) *http.Response {
	t.Helper()
	generatedJSON, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("could not encode generated suggestions: %v", err)
	}
	providerResponse := geminiResponse{}
	providerResponse.Candidates = append(providerResponse.Candidates, struct {
		Content geminiContent `json:"content"`
	}{Content: geminiContent{Parts: []geminiPart{{Text: string(generatedJSON)}}}})

	var body bytes.Buffer
	if err := json.NewEncoder(&body).Encode(providerResponse); err != nil {
		t.Fatalf("could not encode Gemini response: %v", err)
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(&body),
	}
}
