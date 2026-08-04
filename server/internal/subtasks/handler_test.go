package subtasks

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

type handlerQueryCall struct {
	query string
	args  []any
}

type handlerFakeDatabase struct {
	calls []handlerQueryCall
	rows  pgx.Rows
	err   error
}

func (fake *handlerFakeDatabase) Query(
	_ context.Context,
	query string,
	args ...any,
) (pgx.Rows, error) {
	fake.calls = append(fake.calls, handlerQueryCall{query: query, args: args})
	return fake.rows, fake.err
}

type handlerFakeRows struct {
	items  []Response
	index  int
	err    error
	closed bool
}

func (rows *handlerFakeRows) Close() {
	rows.closed = true
}

func (rows *handlerFakeRows) Err() error {
	return rows.err
}

func (rows *handlerFakeRows) CommandTag() pgconn.CommandTag {
	return pgconn.CommandTag{}
}

func (rows *handlerFakeRows) FieldDescriptions() []pgconn.FieldDescription {
	return nil
}

func (rows *handlerFakeRows) Next() bool {
	if rows.index >= len(rows.items) {
		rows.Close()
		return false
	}
	rows.index++
	return true
}

func (rows *handlerFakeRows) Scan(destinations ...any) error {
	item := rows.items[rows.index-1]
	*destinations[0].(*string) = item.ID
	*destinations[1].(*string) = item.TaskID
	*destinations[2].(*string) = item.Title
	*destinations[3].(*bool) = item.Completed
	*destinations[4].(*int32) = item.Position
	return nil
}

func (rows *handlerFakeRows) Values() ([]any, error) {
	return nil, errors.New("not implemented")
}

func (rows *handlerFakeRows) RawValues() [][]byte {
	return nil
}

func (rows *handlerFakeRows) Conn() *pgx.Conn {
	return nil
}

func TestHandlerListsSubtasksForAuthenticatedOwner(t *testing.T) {
	taskID := "0f1cf89d-d998-40c7-a8ac-43b89ff5c777"
	database := &handlerFakeDatabase{rows: &handlerFakeRows{
		items: []Response{{
			ID:       "aa0c4f09-a5c4-4f02-8e0b-619125f4483d",
			TaskID:   taskID,
			Title:    "Walk to the sink",
			Position: 0,
		}},
	}}
	handler := NewHandler(database)
	request := authenticatedSubtaskRequest(http.MethodGet, taskID)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}
	if len(database.calls) != 1 {
		t.Fatalf("expected one query, got %d", len(database.calls))
	}
	call := database.calls[0]
	if !strings.Contains(call.query, "FROM subtasks") {
		t.Fatal("expected the list subtasks query")
	}
	if call.args[0] != "user_test_123" {
		t.Errorf("expected authenticated Clerk user ID, got %#v", call.args[0])
	}
	parsedTaskID, ok := call.args[1].(pgtype.UUID)
	if !ok || !parsedTaskID.Valid {
		t.Errorf("expected parsed task UUID, got %#v", call.args[1])
	}

	var response ListResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("could not decode response: %v", err)
	}
	if len(response.Subtasks) != 1 {
		t.Fatalf("expected one subtask, got %d", len(response.Subtasks))
	}
	if response.Subtasks[0].Title != "Walk to the sink" {
		t.Errorf("unexpected subtask title %q", response.Subtasks[0].Title)
	}
}

func TestHandlerListsNoSubtasksAsEmptyArray(t *testing.T) {
	taskID := "0f1cf89d-d998-40c7-a8ac-43b89ff5c777"
	database := &handlerFakeDatabase{rows: &handlerFakeRows{}}
	handler := NewHandler(database)
	request := authenticatedSubtaskRequest(http.MethodGet, taskID)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}
	if strings.TrimSpace(recorder.Body.String()) != `{"subtasks":[]}` {
		t.Errorf("expected empty array response, got %s", recorder.Body.String())
	}
}

func TestHandlerRejectsInvalidTaskIDBeforeQuerying(t *testing.T) {
	database := &handlerFakeDatabase{}
	handler := NewHandler(database)
	request := authenticatedSubtaskRequest(http.MethodGet, "not-a-uuid")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, recorder.Code)
	}
	if len(database.calls) != 0 {
		t.Fatal("database was queried for an invalid task ID")
	}
}

func TestHandlerRejectsMissingVerifiedUser(t *testing.T) {
	handler := NewHandler(&handlerFakeDatabase{})
	request := httptest.NewRequest(http.MethodGet, "/v1/tasks/id/subtasks", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, recorder.Code)
	}
}

func authenticatedSubtaskRequest(method, taskID string) *http.Request {
	request := httptest.NewRequest(
		method,
		"/v1/tasks/"+taskID+"/subtasks",
		nil,
	)
	request.SetPathValue("taskID", taskID)
	claims := &clerk.SessionClaims{
		RegisteredClaims: clerk.RegisteredClaims{Subject: "user_test_123"},
	}
	return request.WithContext(
		clerk.ContextWithSessionClaims(request.Context(), claims),
	)
}
