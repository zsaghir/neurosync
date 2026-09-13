package checkins

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type insightSeed struct {
	blocker       Blocker
	supportAction string
	before        int
	after         *int
	attempted     *bool
	nextStepTaken *bool
	helpfulness   *Helpfulness
}

func TestPostgreSQLInsightsAggregationAndOwnership(t *testing.T) {
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
	ownerID := fmt.Sprintf("insights-integration-owner-%d", suffix)
	otherID := fmt.Sprintf("insights-integration-other-%d", suffix)
	for _, userID := range []string{ownerID, otherID} {
		if _, err := pool.Exec(context.Background(), `
			INSERT INTO users (clerk_user_id) VALUES ($1)`, userID); err != nil {
			t.Fatalf("could not seed user: %v", err)
		}
	}
	defer func() {
		_, _ = pool.Exec(context.Background(), `
			DELETE FROM users WHERE clerk_user_id IN ($1, $2)`, ownerID, otherID)
	}()

	yes := true
	no := false
	helpful := HelpfulnessYes
	notYet := HelpfulnessNotYet
	after4, after5, after6, after7 := 4, 5, 6, 7
	ownerSeeds := []insightSeed{
		{BlockerTaskInitiation, "tiny_step", 8, &after4, &yes, &yes, &helpful},
		{BlockerTaskInitiation, "tiny_step", 7, &after5, &yes, &yes, &helpful},
		{BlockerTaskInitiation, "tiny_step", 3, &after5, &yes, &yes, &helpful},
		{BlockerTaskInitiation, "tiny_step", 6, &after6, &yes, &yes, &helpful},
		{BlockerTaskInitiation, "tiny_step", 5, &after4, &yes, &no, &notYet},
		{BlockerTaskInitiation, "tiny_step", 6, &after7, &no, nil, &notYet},
		{BlockerTaskInitiation, "tiny_step", 8, nil, nil, nil, nil},
		{BlockerShame, "gentle_restart", 6, &after5, &yes, &no, &notYet},
	}
	for _, seed := range ownerSeeds {
		seedInsightCheckIn(t, pool, ownerID, seed)
	}

	after0 := 0
	seedInsightCheckIn(t, pool, otherID, insightSeed{
		BlockerTaskInitiation, "tiny_step", 10, &after0, &yes, &yes, &helpful,
	})

	handler := NewInsightsHandler(pool)
	request := requestForUser(
		http.MethodGet,
		"/v1/check-in-insights",
		strings.NewReader(""),
		ownerID,
	)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	var response InsightsResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("could not decode insights response: %v", err)
	}
	if response.TotalCheckIns != 8 || response.CompletedFollowUps != 7 {
		t.Fatalf("unexpected summary: %#v", response)
	}
	if response.FollowUpRate == nil || *response.FollowUpRate != 0.875 {
		t.Fatalf("expected follow-up rate 0.875, got %#v", response.FollowUpRate)
	}

	pattern := findInsightPattern(t, response.Patterns, "tiny_step")
	if pattern.CreatedCheckIns != 7 || pattern.CompletedFollowUps != 6 {
		t.Errorf("unexpected tiny-step sample sizes: %#v", pattern)
	}
	if pattern.AttemptedCount != 5 || pattern.NextStepTakenCount != 4 {
		t.Errorf("unattempted or cross-user outcomes affected success counts: %#v", pattern)
	}
	if pattern.SuccessRate == nil || *pattern.SuccessRate != 0.8 {
		t.Errorf("expected success rate 0.8, got %#v", pattern.SuccessRate)
	}
	if pattern.AverageStucknessImprovement == nil || math.Abs(*pattern.AverageStucknessImprovement-(2.0/3.0)) > 0.000001 {
		t.Errorf("expected average improvement 2/3 including the negative result, got %#v", pattern.AverageStucknessImprovement)
	}
	if pattern.InsufficientData {
		t.Error("five attempted interventions should be enough data")
	}

	smallPattern := findInsightPattern(t, response.Patterns, "gentle_restart")
	if !smallPattern.InsufficientData {
		t.Error("one attempted intervention should be marked insufficient")
	}
}

func seedInsightCheckIn(t *testing.T, pool *pgxpool.Pool, userID string, seed insightSeed) {
	t.Helper()
	var helpfulness *string
	if seed.helpfulness != nil {
		value := string(*seed.helpfulness)
		helpfulness = &value
	}
	_, err := pool.Exec(context.Background(), `
		INSERT INTO check_ins (
			user_id,
			blocker,
			support_action,
			stuckness_before,
			stuckness_after,
			intervention_attempted,
			next_step_taken,
			helpfulness,
			followed_up_at
		)
		SELECT
			owner.id,
			$2,
			$3,
			$4,
			$5,
			$6,
			$7,
			$8,
			CASE WHEN $5::SMALLINT IS NULL THEN NULL ELSE NOW() END
		FROM users AS owner
		WHERE owner.clerk_user_id = $1`,
		userID,
		string(seed.blocker),
		seed.supportAction,
		seed.before,
		seed.after,
		seed.attempted,
		seed.nextStepTaken,
		helpfulness,
	)
	if err != nil {
		t.Fatalf("could not seed check-in: %v", err)
	}
}

func findInsightPattern(t *testing.T, patterns []InsightPattern, supportAction string) InsightPattern {
	t.Helper()
	for _, pattern := range patterns {
		if pattern.SupportAction == supportAction {
			return pattern
		}
	}
	t.Fatalf("could not find insight pattern %q", supportAction)
	return InsightPattern{}
}
