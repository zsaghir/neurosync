package subtasks

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDecodeCreateRequest(t *testing.T) {
	t.Run("trims the title and allows an omitted position", func(t *testing.T) {
		request := newJSONRequest(
			http.MethodPost,
			`{"title":"  Walk to the sink  "}`,
		)

		result, err := decodeCreateRequest(request)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Title != "Walk to the sink" {
			t.Errorf("expected trimmed title, got %q", result.Title)
		}
		if result.Position.Set {
			t.Error("expected position to remain omitted")
		}
	})

	t.Run("preserves an explicit zero position", func(t *testing.T) {
		request := newJSONRequest(
			http.MethodPost,
			`{"title":"Walk to the sink","position":0}`,
		)

		result, err := decodeCreateRequest(request)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !result.Position.Set || result.Position.Value == nil {
			t.Fatal("expected position to be supplied with a value")
		}
		if *result.Position.Value != 0 {
			t.Errorf("expected position 0, got %d", *result.Position.Value)
		}
	})
}

func TestDecodeCreateRequestRejectsInvalidInput(t *testing.T) {
	overlongTitle := strings.Repeat("🧠", MaxTitleLength+1)

	tests := []struct {
		name        string
		body        string
		expectedErr string
	}{
		{
			name:        "missing title",
			body:        `{}`,
			expectedErr: "title is required",
		},
		{
			name:        "blank title",
			body:        `{"title":"   "}`,
			expectedErr: "title is required",
		},
		{
			name:        "overlong Unicode title",
			body:        `{"title":"` + overlongTitle + `"}`,
			expectedErr: "title must be 200 characters or fewer",
		},
		{
			name:        "null position",
			body:        `{"title":"Walk","position":null}`,
			expectedErr: "position cannot be null",
		},
		{
			name:        "negative position",
			body:        `{"title":"Walk","position":-1}`,
			expectedErr: "position cannot be negative",
		},
		{
			name:        "completed field",
			body:        `{"title":"Walk","completed":true}`,
			expectedErr: "Request body must contain valid JSON",
		},
		{
			name:        "user ID field",
			body:        `{"title":"Walk","userId":"user_123"}`,
			expectedErr: "Request body must contain valid JSON",
		},
		{
			name:        "malformed JSON",
			body:        `{"title":`,
			expectedErr: "Request body must contain valid JSON",
		},
		{
			name:        "second JSON object",
			body:        `{"title":"Walk"} {"title":"Stop"}`,
			expectedErr: "Request body must contain exactly one JSON object",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := newJSONRequest(http.MethodPost, test.body)
			_, err := decodeCreateRequest(request)
			requireContractError(t, err, test.expectedErr)
		})
	}
}

func TestDecodeCreateRequestCountsUnicodeCodePoints(t *testing.T) {
	title := strings.Repeat("🧠", MaxTitleLength)
	request := newJSONRequest(
		http.MethodPost,
		`{"title":"`+title+`"}`,
	)

	result, err := decodeCreateRequest(request)
	if err != nil {
		t.Fatalf("expected %d Unicode code points to be valid: %v", MaxTitleLength, err)
	}
	if len([]rune(result.Title)) != MaxTitleLength {
		t.Errorf("expected %d code points, got %d", MaxTitleLength, len([]rune(result.Title)))
	}
}

func TestDecodeBatchCreateRequest(t *testing.T) {
	request := newJSONRequest(
		http.MethodPost,
		`{
			"subtasks": [
				{"title":"  First step  "},
				{"title":"Second step"}
			]
		}`,
	)

	result, err := decodeBatchCreateRequest(request)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Subtasks) != 2 {
		t.Fatalf("expected 2 subtasks, got %d", len(result.Subtasks))
	}
	if result.Subtasks[0].Title != "First step" {
		t.Errorf("expected trimmed first title, got %q", result.Subtasks[0].Title)
	}
	if result.Subtasks[1].Title != "Second step" {
		t.Errorf("expected second title to remain unchanged, got %q", result.Subtasks[1].Title)
	}
}

func TestDecodeBatchCreateRequestRejectsInvalidInput(t *testing.T) {
	tooManyItems := BatchCreateRequest{
		Subtasks: make([]BatchItem, MaxBatchSize+1),
	}
	for index := range tooManyItems.Subtasks {
		tooManyItems.Subtasks[index].Title = "Step"
	}
	tooManyJSON, err := json.Marshal(tooManyItems)
	if err != nil {
		t.Fatalf("could not prepare oversized batch: %v", err)
	}

	tests := []struct {
		name        string
		body        string
		expectedErr string
	}{
		{
			name:        "missing subtasks",
			body:        `{}`,
			expectedErr: "subtasks must contain at least one item",
		},
		{
			name:        "null subtasks",
			body:        `{"subtasks":null}`,
			expectedErr: "subtasks must contain at least one item",
		},
		{
			name:        "empty subtasks",
			body:        `{"subtasks":[]}`,
			expectedErr: "subtasks must contain at least one item",
		},
		{
			name:        "more than maximum batch size",
			body:        string(tooManyJSON),
			expectedErr: "subtasks cannot contain more than 50 items",
		},
		{
			name:        "blank item title",
			body:        `{"subtasks":[{"title":"   "}]}`,
			expectedErr: "subtasks[0].title is required",
		},
		{
			name:        "unknown batch item field",
			body:        `{"subtasks":[{"title":"Walk","completed":true}]}`,
			expectedErr: "Request body must contain valid JSON",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := newJSONRequest(http.MethodPost, test.body)
			_, decodeErr := decodeBatchCreateRequest(request)
			requireContractError(t, decodeErr, test.expectedErr)
		})
	}
}

func TestDecodeUpdateRequest(t *testing.T) {
	request := newJSONRequest(
		http.MethodPatch,
		`{"title":"  Revised title  ","completed":false,"position":0}`,
	)

	result, err := decodeUpdateRequest(request)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Title.Set || result.Title.Value == nil {
		t.Fatal("expected title to be supplied with a value")
	}
	if *result.Title.Value != "Revised title" {
		t.Errorf("expected trimmed title, got %q", *result.Title.Value)
	}
	if !result.Completed.Set || result.Completed.Value == nil {
		t.Fatal("expected completed to be supplied with a value")
	}
	if *result.Completed.Value {
		t.Error("expected explicit false to be preserved")
	}
	if !result.Position.Set || result.Position.Value == nil {
		t.Fatal("expected position to be supplied with a value")
	}
	if *result.Position.Value != 0 {
		t.Errorf("expected explicit position 0, got %d", *result.Position.Value)
	}
}

func TestDecodeUpdateRequestRejectsInvalidInput(t *testing.T) {
	tests := []struct {
		name        string
		body        string
		expectedErr string
	}{
		{
			name:        "empty update",
			body:        `{}`,
			expectedErr: "At least one subtask field must be provided",
		},
		{
			name:        "null title",
			body:        `{"title":null}`,
			expectedErr: "title cannot be null",
		},
		{
			name:        "blank title",
			body:        `{"title":"   "}`,
			expectedErr: "title cannot be empty",
		},
		{
			name:        "null completed",
			body:        `{"completed":null}`,
			expectedErr: "completed cannot be null",
		},
		{
			name:        "null position",
			body:        `{"position":null}`,
			expectedErr: "position cannot be null",
		},
		{
			name:        "negative position",
			body:        `{"position":-1}`,
			expectedErr: "position cannot be negative",
		},
		{
			name:        "unknown field",
			body:        `{"finished":true}`,
			expectedErr: "Request body must contain valid JSON",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := newJSONRequest(http.MethodPatch, test.body)
			_, err := decodeUpdateRequest(request)
			requireContractError(t, err, test.expectedErr)
		})
	}
}

func TestResponseJSONContract(t *testing.T) {
	response := Response{
		ID:        "subtask-id",
		TaskID:    "task-id",
		Title:     "Walk to the sink",
		Completed: false,
		Position:  0,
	}

	encoded, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("could not encode response: %v", err)
	}

	expected := `{"id":"subtask-id","taskId":"task-id","title":"Walk to the sink","completed":false,"position":0}`
	if string(encoded) != expected {
		t.Errorf("expected JSON %s, got %s", expected, encoded)
	}
}

func TestEmptyListResponseEncodesSubtasksAsArray(t *testing.T) {
	response := ListResponse{Subtasks: make([]Response, 0)}

	encoded, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("could not encode list response: %v", err)
	}
	if string(encoded) != `{"subtasks":[]}` {
		t.Errorf("expected empty array, got %s", encoded)
	}
}

func newJSONRequest(method, body string) *http.Request {
	return httptest.NewRequest(method, "/", strings.NewReader(body))
}

func requireContractError(t *testing.T, err error, expected string) {
	t.Helper()

	if err == nil {
		t.Fatalf("expected error %q, got nil", expected)
	}
	if err.Error() != expected {
		t.Fatalf("expected error %q, got %q", expected, err.Error())
	}
}
