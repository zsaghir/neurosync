// Package auth verifies Clerk sessions and exposes verified user identities.
package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/clerk/clerk-sdk-go/v2"
	clerkhttp "github.com/clerk/clerk-sdk-go/v2/http"

	"github.com/zsaghir/neurosync/server/internal/httpx"
)

// NewMiddleware configures Clerk and returns middleware that requires a
// verified Clerk session. The secret key is never logged or returned.
func NewMiddleware(
	getenv func(string) string,
) (func(http.Handler) http.Handler, error) {
	secretKey := strings.TrimSpace(getenv("CLERK_SECRET_KEY"))
	if secretKey == "" {
		return nil, errors.New("CLERK_SECRET_KEY is required")
	}

	clerk.SetKey(secretKey)

	authorizationFailure := http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) {
			writeUnauthorized(w)
		},
	)
	verifyAuthorization := clerkhttp.WithHeaderAuthorization(
		clerkhttp.AuthorizationFailureHandler(authorizationFailure),
	)

	return func(next http.Handler) http.Handler {
		requireVerifiedUser := http.HandlerFunc(
			func(w http.ResponseWriter, r *http.Request) {
				if _, ok := UserIDFromContext(r.Context()); !ok {
					writeUnauthorized(w)
					return
				}

				next.ServeHTTP(w, r)
			},
		)

		return verifyAuthorization(requireVerifiedUser)
	}, nil
}

// UserIDFromContext returns the Clerk user ID from verified session claims.
func UserIDFromContext(ctx context.Context) (string, bool) {
	claims, ok := clerk.SessionClaimsFromContext(ctx)
	if !ok || claims == nil {
		return "", false
	}

	clerkUserID := strings.TrimSpace(claims.Subject)
	return clerkUserID, clerkUserID != ""
}

func writeUnauthorized(w http.ResponseWriter) {
	httpx.WriteError(
		w,
		http.StatusUnauthorized,
		"unauthorized",
		"A valid Clerk session is required",
	)
}
