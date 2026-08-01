// Package httpx contains shared HTTP response helpers.
package httpx

import (
	"encoding/json"
	"log"
	"net/http"
)

// ErrorDetails describes why an API operation failed.
type ErrorDetails struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// ErrorResponse gives every API error the same JSON structure.
type ErrorResponse struct {
	Error ErrorDetails `json:"error"`
}

// WriteJSON converts a Go value into an HTTP JSON response.
func WriteJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Print("could not encode JSON response")
	}
}

// WriteError writes the API's standard JSON error response.
func WriteError(w http.ResponseWriter, status int, code, message string) {
	WriteJSON(w, status, ErrorResponse{
		Error: ErrorDetails{
			Code:    code,
			Message: message,
		},
	})
}
