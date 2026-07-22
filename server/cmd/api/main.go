package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)
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
	//fetch database url to establish pool connection
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL not set")
	}
	pool, err := pgxpool.New(
		context.Background(),
		databaseURL,
	)
	if err != nil {
		log.Fatalf("could not create connection: %v", err)
	}
	
	defer pool.Close()
	
	if err := pool.Ping(context.Background()); err != nil {
		log.Fatalf("could not connect to PostgreSQL: %v", err)
	}
	
	log.Println("Connected to PostgreSQL")
	
	http.HandleFunc("/health", withCORS(handleHealth))
	http.HandleFunc("/subtasks", withCORS(handleGenerateSubtasks))
	
	log.Println("Starting server on port 8080")
	
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal(err)
	}
}
func withCORS(next http.HandlerFunc) http.HandlerFunc {
	// 1. Check the request's origin
	const allowedOrigin = "http://localhost:8081"
	return func (w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		// A browser origin was supplied, but it isn't one we allow.
		if (origin != ("") &&  origin != allowedOrigin ){
			http.Error(w,"origin not allowed", http.StatusForbidden)
			return
		}
		// Give the approved browser origin permission.
		if (origin == allowedOrigin) {
			//alllow origin
			w.Header().Set("Access-Control-Allow-Origin",allowedOrigin)
			//allow method
			w.Header().Set("Access-Control-Allow-Methods","POST,GET, OPTIONS")
			//allow headers
			w.Header().Set("Access-Control-Allow-Headers","Content-Type")
		}
        //check if method for preflight request is allowed 
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
