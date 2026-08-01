package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/zsaghir/neurosync/server/internal/httpx"
)

func TestNewMiddlewareRequiresSecretKey(t *testing.T) {
	_, err := NewMiddleware(func(string) string {
		return ""
	})

	if err == nil {
		t.Fatal("expected missing CLERK_SECRET_KEY to return an error")
	}
}

func TestMiddlewareRejectsMissingToken(t *testing.T) {
	protect, err := NewMiddleware(func(name string) string {
		if name == "CLERK_SECRET_KEY" {
			return "sk_test_not-a-real-secret"
		}
		return ""
	})
	if err != nil {
		t.Fatalf("could not create Clerk middleware: %v", err)
	}

	handler := protect(http.HandlerFunc(func(
		w http.ResponseWriter,
		_ *http.Request,
	) {
		t.Fatal("protected handler ran without an authenticated user")
	}))
	request := httptest.NewRequest(http.MethodGet, "/v1/settings", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf(
			"expected status %d, got %d",
			http.StatusUnauthorized,
			recorder.Code,
		)
	}

	var response httpx.ErrorResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("could not decode response: %v", err)
	}
	if response.Error.Code != "unauthorized" {
		t.Errorf("expected unauthorized, got %q", response.Error.Code)
	}
}
