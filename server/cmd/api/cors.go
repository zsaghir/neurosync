package main

import (
	"errors"
	"net/http"
	"net/url"
	"strings"
)

const defaultAllowedOrigins = "http://localhost:8081"

func loadAllowedOrigins(getenv func(string) string) (map[string]struct{}, error) {
	rawOrigins := strings.TrimSpace(getenv("ALLOWED_ORIGINS"))
	if rawOrigins == "" {
		rawOrigins = defaultAllowedOrigins
	}

	allowedOrigins := make(map[string]struct{})
	for _, value := range strings.Split(rawOrigins, ",") {
		origin := strings.TrimSpace(value)
		if !isValidOrigin(origin) {
			return nil, errors.New(
				"ALLOWED_ORIGINS must contain comma-separated http or https origins",
			)
		}

		allowedOrigins[strings.TrimSuffix(origin, "/")] = struct{}{}
	}

	return allowedOrigins, nil
}

func isValidOrigin(origin string) bool {
	if origin == "" || origin == "*" {
		return false
	}

	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}

	return (parsed.Scheme == "http" || parsed.Scheme == "https") &&
		parsed.Host != "" &&
		parsed.User == nil &&
		(parsed.Path == "" || parsed.Path == "/") &&
		parsed.RawQuery == "" &&
		parsed.Fragment == ""
}

func withCORS(
	allowedOrigins map[string]struct{},
	next http.Handler,
) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			next.ServeHTTP(w, r)
			return
		}

		if _, allowed := allowedOrigins[origin]; !allowed {
			http.Error(w, "origin not allowed", http.StatusForbidden)
			return
		}

		w.Header().Add("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set(
			"Access-Control-Allow-Methods",
			"GET, PATCH, POST, DELETE, OPTIONS",
		)
		w.Header().Set(
			"Access-Control-Allow-Headers",
			"Authorization, Content-Type",
		)

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
