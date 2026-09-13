package checkins

import (
	"context"
	"net/http"

	"github.com/jackc/pgx/v5"

	"github.com/zsaghir/neurosync/server/internal/auth"
	"github.com/zsaghir/neurosync/server/internal/httpx"
)

const insightsSummaryQuery = `
SELECT
	COUNT(check_in.id),
	COUNT(check_in.followed_up_at)
FROM check_ins AS check_in
JOIN users AS owner ON owner.id = check_in.user_id
WHERE owner.clerk_user_id = $1`

const insightPatternsQuery = `
SELECT
	check_in.blocker,
	check_in.support_action,
	COUNT(*),
	COUNT(check_in.followed_up_at),
	COUNT(*) FILTER (WHERE check_in.intervention_attempted IS TRUE),
	COUNT(*) FILTER (WHERE check_in.next_step_taken IS TRUE),
	AVG((check_in.stuckness_before - check_in.stuckness_after)::DOUBLE PRECISION)
		FILTER (WHERE check_in.followed_up_at IS NOT NULL)
FROM check_ins AS check_in
JOIN users AS owner ON owner.id = check_in.user_id
WHERE owner.clerk_user_id = $1
	AND check_in.support_action IS NOT NULL
GROUP BY check_in.blocker, check_in.support_action
ORDER BY check_in.blocker, check_in.support_action`

// InsightsResponse summarizes one authenticated user's check-in history.
type InsightsResponse struct {
	TotalCheckIns      int              `json:"totalCheckIns"`
	CompletedFollowUps int              `json:"completedFollowUps"`
	FollowUpRate       *float64         `json:"followUpRate"`
	Patterns           []InsightPattern `json:"patterns"`
}

// InsightPattern describes repeated outcomes for one blocker and support action.
type InsightPattern struct {
	Blocker                     Blocker  `json:"blocker"`
	SupportAction               string   `json:"supportAction"`
	CreatedCheckIns             int      `json:"createdCheckIns"`
	CompletedFollowUps          int      `json:"completedFollowUps"`
	AttemptedCount              int      `json:"attemptedCount"`
	NextStepTakenCount          int      `json:"nextStepTakenCount"`
	SuccessRate                 *float64 `json:"successRate"`
	AverageStucknessImprovement *float64 `json:"averageStucknessImprovement"`
	InsufficientData            bool     `json:"insufficientData"`
}

// InsightsDatabase is the PostgreSQL behavior needed to calculate insights.
type InsightsDatabase interface {
	QueryRow(context.Context, string, ...any) pgx.Row
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

// InsightsHandler serves personal check-in outcome summaries.
type InsightsHandler struct {
	database InsightsDatabase
}

// NewInsightsHandler creates an insights handler with its database dependency.
func NewInsightsHandler(database InsightsDatabase) *InsightsHandler {
	return &InsightsHandler{database: database}
}

func (handler *InsightsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	clerkUserID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "A valid Clerk session is required")
		return
	}
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		httpx.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET requests are allowed")
		return
	}

	response, err := handler.load(r.Context(), clerkUserID)
	if err != nil {
		writeDatabaseError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, response)
}

func (handler *InsightsHandler) load(ctx context.Context, clerkUserID string) (InsightsResponse, error) {
	var totalCheckIns int64
	var completedFollowUps int64
	if err := handler.database.QueryRow(
		ctx,
		insightsSummaryQuery,
		clerkUserID,
	).Scan(&totalCheckIns, &completedFollowUps); err != nil {
		return InsightsResponse{}, err
	}

	response := InsightsResponse{
		TotalCheckIns:      int(totalCheckIns),
		CompletedFollowUps: int(completedFollowUps),
		Patterns:           make([]InsightPattern, 0),
	}
	if totalCheckIns > 0 {
		rate := float64(completedFollowUps) / float64(totalCheckIns)
		response.FollowUpRate = &rate
	}

	rows, err := handler.database.Query(ctx, insightPatternsQuery, clerkUserID)
	if err != nil {
		return InsightsResponse{}, err
	}
	defer rows.Close()

	for rows.Next() {
		var pattern InsightPattern
		var blocker string
		var createdCheckIns int64
		var patternFollowUps int64
		var attemptedCount int64
		var nextStepTakenCount int64

		if err := rows.Scan(
			&blocker,
			&pattern.SupportAction,
			&createdCheckIns,
			&patternFollowUps,
			&attemptedCount,
			&nextStepTakenCount,
			&pattern.AverageStucknessImprovement,
		); err != nil {
			return InsightsResponse{}, err
		}

		pattern.Blocker = Blocker(blocker)
		pattern.CreatedCheckIns = int(createdCheckIns)
		pattern.CompletedFollowUps = int(patternFollowUps)
		pattern.AttemptedCount = int(attemptedCount)
		pattern.NextStepTakenCount = int(nextStepTakenCount)
		pattern.InsufficientData = attemptedCount < 5
		if attemptedCount > 0 {
			rate := float64(nextStepTakenCount) / float64(attemptedCount)
			pattern.SuccessRate = &rate
		}

		response.Patterns = append(response.Patterns, pattern)
	}
	if err := rows.Err(); err != nil {
		return InsightsResponse{}, err
	}

	return response, nil
}
