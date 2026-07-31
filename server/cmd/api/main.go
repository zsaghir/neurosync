package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// API contains dependencies shared by HTTP handlers.
type API struct {
	database         Database
	readinessTimeout time.Duration
}

type GenerateSubtasksRequest struct {
	TaskTitle string `json:"taskTitle"`
}

type Subtask struct {
	Key       string `json:"_key"`
	Title     string `json:"title"`
	Completed bool   `json:"completed"`
}

type GenerateSubtasksResponse struct {
	Subtasks []Subtask `json:"subtasks"`
}

// ErrorDetails describes why an operation failed.
type ErrorDetails struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// ErrorResponse gives every API error the same structure.
type ErrorResponse struct {
	Error ErrorDetails `json:"error"`
}

func main() {
	databaseConfig, err := loadDatabaseConfig(os.Getenv)
	if err != nil {
		log.Fatalf("invalid database configuration: %v", err)
	}

	pool, err := connectDatabase(context.Background(), databaseConfig)
	if err != nil {
		log.Fatal("could not initialize PostgreSQL")
	}
	defer pool.Close()

	api := &API{
		database:         pool,
		readinessTimeout: databaseConfig.ReadinessTimeout,
	}

	log.Println("Connected to PostgreSQL")
	log.Println("Starting server on port 8080")

	if err := http.ListenAndServe(":8080", api.routes()); err != nil {
		log.Fatal(err)
	}
}

func (api *API) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", withCORS(handleHealth))
	mux.HandleFunc("/ready", withCORS(api.handleReady))
	mux.HandleFunc("/subtasks", withCORS(handleGenerateSubtasks))

	return mux
}

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	// 1. Check the request's origin
	const allowedOrigin = "http://localhost:8081"
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		// A browser origin was supplied, but it isn't one we allow.
		if origin != "" && origin != allowedOrigin {
			http.Error(w, "origin not allowed", http.StatusForbidden)
			return
		}
		// Give the approved browser origin permission.
		if origin == allowedOrigin {
			// allow origin
			w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
			// allow method
			w.Header().Set("Access-Control-Allow-Methods", "POST,GET, OPTIONS")
			// allow headers
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		}
		// check if method for preflight request is allowed
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, "healthy")
}

func (api *API) handleReady(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		writeJSON(w, http.StatusMethodNotAllowed, ErrorResponse{
			Error: ErrorDetails{
				Code:    "method_not_allowed",
				Message: "Only GET requests are allowed",
			},
		})
		return
	}

	if api.database == nil {
		writeJSON(w, http.StatusServiceUnavailable, ErrorResponse{
			Error: ErrorDetails{
				Code:    "database_unavailable",
				Message: "The service is not ready",
			},
		})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), api.readinessTimeout)
	defer cancel()

	if err := api.database.Ping(ctx); err != nil {
		log.Print("database readiness check failed")
		writeJSON(w, http.StatusServiceUnavailable, ErrorResponse{
			Error: ErrorDetails{
				Code:    "database_unavailable",
				Message: "The service is not ready",
			},
		})
		return
	}

	fmt.Fprint(w, "ready")
}

func handleGenerateSubtasks(w http.ResponseWriter, r *http.Request) {
	// Only POST represents the operation supported by this endpoint.
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)

		writeJSON(w, http.StatusMethodNotAllowed, ErrorResponse{
			Error: ErrorDetails{
				Code:    "method_not_allowed",
				Message: "Only POST requests are allowed",
			},
		})
		return
	}

	var request GenerateSubtasksRequest

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{
			Error: ErrorDetails{
				Code:    "invalid_json",
				Message: "Request body must contain valid JSON",
			},
		})
		return
	}

	taskTitle := strings.TrimSpace(request.TaskTitle)

	if taskTitle == "" {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{
			Error: ErrorDetails{
				Code:    "invalid_request",
				Message: "taskTitle is required",
			},
		})
		return
	}

	if len([]rune(taskTitle)) > 200 {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{
			Error: ErrorDetails{
				Code:    "invalid_request",
				Message: "taskTitle must be 200 characters or fewer",
			},
		})
		return
	}

	response := GenerateSubtasksResponse{
		Subtasks: []Subtask{
			{
				Key:       "step-1",
				Title:     "Walk to the kitchen sink",
				Completed: false,
			},
			{
				Key:       "step-2",
				Title:     "Put one dirty dish beside the sink",
				Completed: false,
			},
		},
	}

	writeJSON(w, http.StatusOK, response)
}

// writeJSON converts a Go value into an HTTP JSON response.
func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Printf("could not encode JSON response: %v", err)
	}
}
