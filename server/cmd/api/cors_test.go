package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLoadAllowedOriginsUsesLocalExpoDefault(t *testing.T) {
	origins, err := loadAllowedOrigins(func(string) string { return "" })
	if err != nil {
		t.Fatalf("expected default origin to be valid: %v", err)
	}

	if _, ok := origins[defaultAllowedOrigins]; !ok {
		t.Fatalf("expected default origin %q", defaultAllowedOrigins)
	}
}

func TestLoadAllowedOriginsAcceptsCommaSeparatedOrigins(t *testing.T) {
	origins, err := loadAllowedOrigins(func(string) string {
		return " http://localhost:8081, https://preview.example.com/ "
	})
	if err != nil {
		t.Fatalf("expected origins to be valid: %v", err)
	}

	for _, origin := range []string{
		"http://localhost:8081",
		"https://preview.example.com",
	} {
		if _, ok := origins[origin]; !ok {
			t.Errorf("expected origin %q to be allowed", origin)
		}
	}
}

func TestLoadAllowedOriginsRejectsUnsafeValues(t *testing.T) {
	for _, value := range []string{
		"*",
		"preview.example.com",
		"https://preview.example.com/a-path",
		"https://preview.example.com?token=value",
	} {
		t.Run(value, func(t *testing.T) {
			if _, err := loadAllowedOrigins(func(string) string { return value }); err == nil {
				t.Fatalf("expected %q to be rejected", value)
			}
		})
	}
}

func TestCORSAllowsConfiguredOrigin(t *testing.T) {
	nextCalled := false
	handler := withCORS(
		map[string]struct{}{"https://app.example.com": {}},
		http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			nextCalled = true
			w.WriteHeader(http.StatusOK)
		}),
	)
	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	request.Header.Set("Origin", "https://app.example.com")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK || !nextCalled {
		t.Fatalf("expected request to reach next handler, got %d", recorder.Code)
	}
	if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
		t.Errorf("expected allowed origin header, got %q", got)
	}
}

func TestCORSRejectsUnconfiguredOrigin(t *testing.T) {
	nextCalled := false
	handler := withCORS(
		map[string]struct{}{"https://app.example.com": {}},
		http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
			nextCalled = true
		}),
	)
	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	request.Header.Set("Origin", "https://other.example.com")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, recorder.Code)
	}
	if nextCalled {
		t.Fatal("expected rejected origin not to reach next handler")
	}
}

func TestCORSHandlesAllowedPreflight(t *testing.T) {
	nextCalled := false
	handler := withCORS(
		map[string]struct{}{"http://localhost:8081": {}},
		http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
			nextCalled = true
		}),
	)
	request := httptest.NewRequest(http.MethodOptions, "/v1/tasks", nil)
	request.Header.Set("Origin", "http://localhost:8081")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, recorder.Code)
	}
	if nextCalled {
		t.Fatal("expected preflight to finish before the next handler")
	}
}
