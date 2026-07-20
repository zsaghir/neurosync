package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandleGenerateSubtasksSuccess(t *testing.T) {
	// Arrange: create a valid POST request.
	requestBody := `{"taskTitle":"Clean the kitchen"}`

	request := httptest.NewRequest(
		http.MethodPost,
		"/subtasks",
		strings.NewReader(requestBody),
	)

	recorder := httptest.NewRecorder()

	// Act: call the real handler.
	handleGenerateSubtasks(recorder, request)

	response := recorder.Result()
	defer response.Body.Close()

	// Assert: verify the HTTP status.
	if response.StatusCode != http.StatusOK {
		t.Fatalf(
			"expected status %d, got %d",
			http.StatusOK,
			response.StatusCode,
		)
	}

	// Assert: verify that the response is JSON.
	contentType := response.Header.Get("Content-Type")

	if contentType != "application/json" {
		t.Errorf(
			"expected Content-Type application/json, got %q",
			contentType,
		)
	}

	// Decode the JSON response into a Go value.
	var body GenerateSubtasksResponse

	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("could not decode response body: %v", err)
	}

	// Make sure subtasks were actually returned.
	if len(body.Subtasks) != 2 {
		t.Fatalf(
			"expected 2 subtasks, got %d",
			len(body.Subtasks),
		)
	}

	// Validate every returned subtask.
	for _, subtask := range body.Subtasks {
		if subtask.Key == "" {
			t.Error("expected every subtask to have a key")
		}

		if subtask.Title == "" {
			t.Error("expected every subtask to have a title")
		}

		if subtask.Completed {
			t.Error("expected generated subtasks to begin incomplete")
		}
	}
}
func TestHandleGenerateSubtasksRejectsInvalidRequests(t *testing.T) {
	tests := []struct {
		name           string
		method         string
		body           string
		expectedStatus int
		expectedCode   string
	}{
		{
			name:           "wrong HTTP method",
			method:         http.MethodGet,
			body:           "",
			expectedStatus: http.StatusMethodNotAllowed,
			expectedCode:   "method_not_allowed",
		},
		{
			name:           "malformed JSON",
			method:         http.MethodPost,
			body:           `{"taskTitle":`,
			expectedStatus: http.StatusBadRequest,
			expectedCode:   "invalid_json",
		},
		{
			name:           "empty task title",
			method:         http.MethodPost,
			body:           `{"taskTitle":"   "}`,
			expectedStatus: http.StatusBadRequest,
			expectedCode:   "invalid_request",
		},
		{
			name:           "unknown JSON field",
			method:         http.MethodPost,
			body:           `{"taskTitle":"Clean","unexpected":true}`,
			expectedStatus: http.StatusBadRequest,
			expectedCode:   "invalid_json",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(
				test.method,
				"/subtasks",
				strings.NewReader(test.body),
			)

			recorder := httptest.NewRecorder()

			handleGenerateSubtasks(recorder, request)

			response := recorder.Result()
			defer response.Body.Close()

			if response.StatusCode != test.expectedStatus {
				t.Fatalf(
					"expected status %d, got %d",
					test.expectedStatus,
					response.StatusCode,
				)
			}

			var body ErrorResponse

			if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
				t.Fatalf("could not decode error response: %v", err)
			}

			if body.Error.Code != test.expectedCode {
				t.Errorf(
					"expected error code %q, got %q",
					test.expectedCode,
					body.Error.Code,
				)
			}
		})
	}
}
