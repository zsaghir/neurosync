package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/zsaghir/neurosync/server/internal/auth"
	"github.com/zsaghir/neurosync/server/internal/checkins"
	"github.com/zsaghir/neurosync/server/internal/httpx"
	"github.com/zsaghir/neurosync/server/internal/sessions"
	"github.com/zsaghir/neurosync/server/internal/settings"
	"github.com/zsaghir/neurosync/server/internal/tasks"
)

// API contains dependencies shared by HTTP handlers.
type API struct {
	allowedOrigins   map[string]struct{}
	checkInsHandler  http.Handler
	database         Database
	protect          func(http.Handler) http.Handler
	sessionsHandler  http.Handler
	settingsHandler  http.Handler
	tasksHandler     http.Handler
	readinessTimeout time.Duration
}

type ErrorDetails = httpx.ErrorDetails
type ErrorResponse = httpx.ErrorResponse

func main() {
	allowedOrigins, err := loadAllowedOrigins(os.Getenv)
	if err != nil {
		log.Fatalf("invalid CORS configuration: %v", err)
	}

	protect, err := auth.NewMiddleware(os.Getenv)
	if err != nil {
		log.Fatalf("invalid Clerk configuration: %v", err)
	}

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
		allowedOrigins:   allowedOrigins,
		checkInsHandler:  checkins.NewHandler(pool),
		database:         pool,
		protect:          protect,
		sessionsHandler:  sessions.NewHandler(pool),
		settingsHandler:  settings.NewHandler(pool),
		tasksHandler:     tasks.NewHandler(pool),
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
	mux.Handle(
		"/health",
		withCORS(api.allowedOrigins, http.HandlerFunc(handleHealth)),
	)
	mux.Handle(
		"/ready",
		withCORS(api.allowedOrigins, http.HandlerFunc(api.handleReady)),
	)
	mux.Handle(
		"/v1/check-ins",
		withCORS(api.allowedOrigins, api.protect(api.checkInsHandler)),
	)
	mux.Handle(
		"/v1/check-ins/{id}/outcome",
		withCORS(api.allowedOrigins, api.protect(api.checkInsHandler)),
	)
	mux.Handle(
		"/v1/task-sessions",
		withCORS(api.allowedOrigins, api.protect(api.sessionsHandler)),
	)
	mux.Handle(
		"/v1/settings",
		withCORS(api.allowedOrigins, api.protect(api.settingsHandler)),
	)
	mux.Handle(
		"/v1/tasks",
		withCORS(api.allowedOrigins, api.protect(api.tasksHandler)),
	)
	mux.Handle(
		"/v1/tasks/{id}",
		withCORS(api.allowedOrigins, api.protect(api.tasksHandler)),
	)

	return mux
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

func writeJSON(w http.ResponseWriter, status int, value any) {
	httpx.WriteJSON(w, status, value)
}
