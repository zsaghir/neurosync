package sessions

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgreSQLSessionOwnershipAndTaskTotal(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not configured")
	}

	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		t.Fatalf("could not connect to test database: %v", err)
	}
	defer pool.Close()

	const ownerID = "session-integration-owner"
	const otherID = "session-integration-other"
	var taskID string
	err = pool.QueryRow(context.Background(), `
		WITH owner AS (
			INSERT INTO users (clerk_user_id)
			VALUES ($1)
			RETURNING id
		)
		INSERT INTO tasks (user_id, title)
		SELECT id, 'Clean the kitchen!' FROM owner
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
	body := strings.Replace(validCreateBody(), "0f1cf89d-d998-40c7-a8ac-43b89ff5c777", taskID, 1)
	ownerRequest := requestForUser(http.MethodPost, strings.NewReader(body), ownerID)
	ownerRecorder := httptest.NewRecorder()
	handler.ServeHTTP(ownerRecorder, ownerRequest)
	if ownerRecorder.Code != http.StatusCreated {
		t.Fatalf("expected owner create status %d, got %d: %s", http.StatusCreated, ownerRecorder.Code, ownerRecorder.Body.String())
	}

	var created Response
	if err := json.NewDecoder(ownerRecorder.Body).Decode(&created); err != nil {
		t.Fatalf("could not decode created session: %v", err)
	}
	if created.TaskTitleSignature != "clean kitchen" {
		t.Errorf("expected server-derived signature, got %q", created.TaskTitleSignature)
	}

	var total int
	if err := pool.QueryRow(context.Background(), `
		SELECT time_spent_seconds FROM tasks WHERE id = $1`, taskID).Scan(&total); err != nil {
		t.Fatalf("could not read task total: %v", err)
	}
	if total != 900 {
		t.Errorf("expected atomic task total 900, got %d", total)
	}

	otherRequest := requestForUser(http.MethodPost, strings.NewReader(body), otherID)
	otherRecorder := httptest.NewRecorder()
	handler.ServeHTTP(otherRecorder, otherRequest)
	if otherRecorder.Code != http.StatusNotFound {
		t.Fatalf("expected cross-owner status %d, got %d", http.StatusNotFound, otherRecorder.Code)
	}

	otherListRequest := requestForUser(http.MethodGet, nil, otherID)
	otherListRecorder := httptest.NewRecorder()
	handler.ServeHTTP(otherListRecorder, otherListRequest)
	var otherList ListResponse
	if err := json.NewDecoder(otherListRecorder.Body).Decode(&otherList); err != nil {
		t.Fatalf("could not decode other user's list: %v", err)
	}
	if len(otherList.Sessions) != 0 {
		t.Fatal("another user could list the owner's task session")
	}
}

func requestForUser(method string, body io.Reader, userID string) *http.Request {
	request := httptest.NewRequest(method, "/v1/task-sessions", body)
	claims := &clerk.SessionClaims{
		RegisteredClaims: clerk.RegisteredClaims{Subject: userID},
	}
	return request.WithContext(clerk.ContextWithSessionClaims(request.Context(), claims))
}
