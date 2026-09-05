package checkins

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgreSQLCheckInOwnershipAndOutcome(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not configured")
	}

	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		t.Fatalf("could not connect to test database: %v", err)
	}
	defer pool.Close()

	suffix := time.Now().UnixNano()
	ownerID := fmt.Sprintf("checkin-integration-owner-%d", suffix)
	otherID := fmt.Sprintf("checkin-integration-other-%d", suffix)
	var taskID string
	err = pool.QueryRow(context.Background(), `
		WITH owner AS (
			INSERT INTO users (clerk_user_id)
			VALUES ($1)
			RETURNING id
		)
		INSERT INTO tasks (user_id, title)
		SELECT id, 'Write project report' FROM owner
		RETURNING id`, ownerID).Scan(&taskID)
	if err != nil {
		t.Fatalf("could not seed owned task: %v", err)
	}
	if _, err := pool.Exec(context.Background(), `
		INSERT INTO users (clerk_user_id) VALUES ($1)`, otherID); err != nil {
		t.Fatalf("could not seed other user: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `
			DELETE FROM users WHERE clerk_user_id IN ($1, $2)`, ownerID, otherID)
	})

	handler := NewHandler(pool)
	createBody := fmt.Sprintf(`{
		"taskId":%q,
		"blocker":"task_initiation",
		"supportAction":"five_minute_start",
		"nextStep":"Open the document",
		"plannedMinutes":5,
		"stucknessBefore":8
	}`, taskID)

	ownerCreate := requestForUser(http.MethodPost, "/v1/check-ins", strings.NewReader(createBody), ownerID)
	ownerRecorder := httptest.NewRecorder()
	handler.ServeHTTP(ownerRecorder, ownerCreate)
	if ownerRecorder.Code != http.StatusCreated {
		t.Fatalf("expected owner create status %d, got %d: %s", http.StatusCreated, ownerRecorder.Code, ownerRecorder.Body.String())
	}

	var created Response
	if err := json.NewDecoder(ownerRecorder.Body).Decode(&created); err != nil {
		t.Fatalf("could not decode created check-in: %v", err)
	}

	otherCreate := requestForUser(http.MethodPost, "/v1/check-ins", strings.NewReader(createBody), otherID)
	otherCreateRecorder := httptest.NewRecorder()
	handler.ServeHTTP(otherCreateRecorder, otherCreate)
	if otherCreateRecorder.Code != http.StatusNotFound {
		t.Fatalf("expected cross-owner task status %d, got %d", http.StatusNotFound, otherCreateRecorder.Code)
	}

	outcomeBody := `{
		"stucknessAfter":4,
		"interventionAttempted":true,
		"nextStepTaken":true,
		"helpfulness":"yes"
	}`
	otherOutcome := requestForUser(http.MethodPatch, "/v1/check-ins/"+created.ID+"/outcome", strings.NewReader(outcomeBody), otherID)
	otherOutcome.SetPathValue("id", created.ID)
	otherOutcomeRecorder := httptest.NewRecorder()
	handler.ServeHTTP(otherOutcomeRecorder, otherOutcome)
	if otherOutcomeRecorder.Code != http.StatusNotFound {
		t.Fatalf("expected cross-owner outcome status %d, got %d", http.StatusNotFound, otherOutcomeRecorder.Code)
	}

	ownerOutcome := requestForUser(http.MethodPatch, "/v1/check-ins/"+created.ID+"/outcome", strings.NewReader(outcomeBody), ownerID)
	ownerOutcome.SetPathValue("id", created.ID)
	ownerOutcomeRecorder := httptest.NewRecorder()
	handler.ServeHTTP(ownerOutcomeRecorder, ownerOutcome)
	if ownerOutcomeRecorder.Code != http.StatusOK {
		t.Fatalf("expected owner outcome status %d, got %d: %s", http.StatusOK, ownerOutcomeRecorder.Code, ownerOutcomeRecorder.Body.String())
	}

	var completed Response
	if err := json.NewDecoder(ownerOutcomeRecorder.Body).Decode(&completed); err != nil {
		t.Fatalf("could not decode completed check-in: %v", err)
	}
	if completed.StucknessAfter == nil || *completed.StucknessAfter != 4 {
		t.Errorf("expected stuckness after 4, got %#v", completed.StucknessAfter)
	}
	if completed.NextStepTaken == nil || !*completed.NextStepTaken {
		t.Errorf("expected next step to be recorded as taken")
	}
}

func requestForUser(method, target string, body *strings.Reader, userID string) *http.Request {
	request := httptest.NewRequest(method, target, body)
	claims := &clerk.SessionClaims{
		RegisteredClaims: clerk.RegisteredClaims{Subject: userID},
	}
	return request.WithContext(clerk.ContextWithSessionClaims(request.Context(), claims))
}
