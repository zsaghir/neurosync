package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

type fakeDatabase struct {
	err error
}

func (fake *fakeDatabase) Ping(context.Context) error {
	return fake.err
}

func (fake *fakeDatabase) QueryRow(
	context.Context,
	string,
	...any,
) pgx.Row {
	return nil
}

func TestHandleReadySuccess(t *testing.T) {
	api := &API{
		database:         &fakeDatabase{},
		readinessTimeout: time.Second,
	}
	request := httptest.NewRequest(http.MethodGet, "/ready", nil)
	recorder := httptest.NewRecorder()

	api.handleReady(recorder, request)

	response := recorder.Result()
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		t.Fatalf(
			"expected status %d, got %d",
			http.StatusOK,
			response.StatusCode,
		)
	}

	if recorder.Body.String() != "ready" {
		t.Errorf("expected ready response, got %q", recorder.Body.String())
	}
}

func TestHandleReadyWhenDatabaseUnavailable(t *testing.T) {
	api := &API{
		database: &fakeDatabase{
			err: errors.New("connection failed with sensitive details"),
		},
		readinessTimeout: time.Second,
	}
	request := httptest.NewRequest(http.MethodGet, "/ready", nil)
	recorder := httptest.NewRecorder()

	api.handleReady(recorder, request)

	response := recorder.Result()
	defer response.Body.Close()

	if response.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf(
			"expected status %d, got %d",
			http.StatusServiceUnavailable,
			response.StatusCode,
		)
	}

	if strings.Contains(recorder.Body.String(), "sensitive details") {
		t.Fatal("readiness response exposed the database error")
	}

	var body ErrorResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("could not decode readiness response: %v", err)
	}

	if body.Error.Code != "database_unavailable" {
		t.Errorf(
			"expected database_unavailable, got %q",
			body.Error.Code,
		)
	}
}

func TestHandleReadyRejectsWrongMethod(t *testing.T) {
	api := &API{
		database:         &fakeDatabase{},
		readinessTimeout: time.Second,
	}
	request := httptest.NewRequest(http.MethodPost, "/ready", nil)
	recorder := httptest.NewRecorder()

	api.handleReady(recorder, request)

	response := recorder.Result()
	defer response.Body.Close()

	if response.StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf(
			"expected status %d, got %d",
			http.StatusMethodNotAllowed,
			response.StatusCode,
		)
	}
}

func TestHandleHealth(t *testing.T) {
	request := httptest.NewRequest(
		http.MethodGet,
		"/health",
		nil,
	)

	recorder := httptest.NewRecorder()

	handleHealth(recorder, request)

	response := recorder.Result()
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		t.Fatalf(
			"expected status %d, got %d",
			http.StatusOK,
			response.StatusCode,
		)
	}
}

func TestRoutesProtectTaskSessions(t *testing.T) {
	protected := false
	handled := false
	api := &API{
		allowedOrigins: map[string]struct{}{"http://localhost:8081": {}},
		protect: func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				protected = true
				next.ServeHTTP(w, r)
			})
		},
		sessionsHandler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			handled = true
			w.WriteHeader(http.StatusOK)
		}),
	}
	request := httptest.NewRequest(http.MethodGet, "/v1/task-sessions", nil)
	request.Header.Set("Origin", "http://localhost:8081")
	recorder := httptest.NewRecorder()

	api.routes().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}
	if !protected || !handled {
		t.Fatal("task-session route did not pass through authentication protection")
	}
}
