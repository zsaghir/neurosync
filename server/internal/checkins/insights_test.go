package checkins

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type insightRowData struct {
	blocker            Blocker
	supportAction      string
	created            int64
	followedUp         int64
	attempted          int64
	nextStepTaken      int64
	averageImprovement *float64
}

type fakeInsightsDatabase struct {
	summary       pgx.Row
	patterns      pgx.Rows
	patternsError error
	rowCalls      []queryCall
	queryCalls    []queryCall
}

func (fake *fakeInsightsDatabase) QueryRow(_ context.Context, query string, args ...any) pgx.Row {
	fake.rowCalls = append(fake.rowCalls, queryCall{query: query, args: args})
	return fake.summary
}

func (fake *fakeInsightsDatabase) Query(_ context.Context, query string, args ...any) (pgx.Rows, error) {
	fake.queryCalls = append(fake.queryCalls, queryCall{query: query, args: args})
	return fake.patterns, fake.patternsError
}

type insightSummaryRow struct {
	total      int64
	followedUp int64
	err        error
}

func (row *insightSummaryRow) Scan(destinations ...any) error {
	if row.err != nil {
		return row.err
	}
	*destinations[0].(*int64) = row.total
	*destinations[1].(*int64) = row.followedUp
	return nil
}

type insightRows struct {
	items  []insightRowData
	index  int
	err    error
	closed bool
}

func (rows *insightRows) Close()                                       { rows.closed = true }
func (rows *insightRows) Err() error                                   { return rows.err }
func (rows *insightRows) CommandTag() pgconn.CommandTag                { return pgconn.CommandTag{} }
func (rows *insightRows) FieldDescriptions() []pgconn.FieldDescription { return nil }
func (rows *insightRows) Values() ([]any, error)                       { return nil, errors.New("not implemented") }
func (rows *insightRows) RawValues() [][]byte                          { return nil }
func (rows *insightRows) Conn() *pgx.Conn                              { return nil }
func (rows *insightRows) Next() bool {
	if rows.index >= len(rows.items) {
		rows.Close()
		return false
	}
	rows.index++
	return true
}
func (rows *insightRows) Scan(destinations ...any) error {
	item := rows.items[rows.index-1]
	*destinations[0].(*string) = string(item.blocker)
	*destinations[1].(*string) = item.supportAction
	*destinations[2].(*int64) = item.created
	*destinations[3].(*int64) = item.followedUp
	*destinations[4].(*int64) = item.attempted
	*destinations[5].(*int64) = item.nextStepTaken
	*destinations[6].(**float64) = item.averageImprovement
	return nil
}

func TestInsightsHandlerCalculatesRatesAndSampleSizes(t *testing.T) {
	improvement := -1.5
	patternRows := &insightRows{items: []insightRowData{{
		blocker:            BlockerTaskInitiation,
		supportAction:      "tiny_step",
		created:            8,
		followedUp:         7,
		attempted:          6,
		nextStepTaken:      5,
		averageImprovement: &improvement,
	}}}
	database := &fakeInsightsDatabase{
		summary:  &insightSummaryRow{total: 10, followedUp: 8},
		patterns: patternRows,
	}
	handler := NewInsightsHandler(database)
	request := authenticatedRequest(http.MethodGet, "/v1/check-in-insights", strings.NewReader(""))
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	var response InsightsResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("could not decode insights response: %v", err)
	}
	if response.FollowUpRate == nil || *response.FollowUpRate != 0.8 {
		t.Fatalf("expected follow-up rate 0.8, got %#v", response.FollowUpRate)
	}
	if len(response.Patterns) != 1 {
		t.Fatalf("expected one pattern, got %d", len(response.Patterns))
	}
	pattern := response.Patterns[0]
	if pattern.SuccessRate == nil || *pattern.SuccessRate != float64(5)/6 {
		t.Errorf("expected success rate 5/6, got %#v", pattern.SuccessRate)
	}
	if pattern.AverageStucknessImprovement == nil || *pattern.AverageStucknessImprovement != -1.5 {
		t.Errorf("expected negative improvement -1.5, got %#v", pattern.AverageStucknessImprovement)
	}
	if pattern.InsufficientData {
		t.Error("six attempts should be enough data")
	}
	if !patternRows.closed {
		t.Error("pattern rows were not closed")
	}
	if database.rowCalls[0].args[0] != "user_test_123" || database.queryCalls[0].args[0] != "user_test_123" {
		t.Fatal("insight queries were not scoped to the verified user")
	}
	if !strings.Contains(database.queryCalls[0].query, "intervention_attempted IS TRUE") {
		t.Fatal("unattempted interventions are not excluded from the success denominator")
	}
}

func TestInsightsHandlerReturnsEmptyHistoryWithoutInventedRates(t *testing.T) {
	database := &fakeInsightsDatabase{
		summary:  &insightSummaryRow{},
		patterns: &insightRows{},
	}
	handler := NewInsightsHandler(database)
	request := authenticatedRequest(http.MethodGet, "/v1/check-in-insights", strings.NewReader(""))
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	var response InsightsResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("could not decode insights response: %v", err)
	}
	if response.FollowUpRate != nil {
		t.Errorf("expected no follow-up rate, got %#v", response.FollowUpRate)
	}
	if response.Patterns == nil || len(response.Patterns) != 0 {
		t.Errorf("expected an empty patterns array, got %#v", response.Patterns)
	}
}

func TestInsightsHandlerMarksSmallSamplesAsInsufficient(t *testing.T) {
	database := &fakeInsightsDatabase{
		summary: &insightSummaryRow{total: 2, followedUp: 1},
		patterns: &insightRows{items: []insightRowData{{
			blocker:       BlockerShame,
			supportAction: "gentle_restart",
			created:       2,
			followedUp:    1,
			attempted:     0,
		}}},
	}
	handler := NewInsightsHandler(database)
	request := authenticatedRequest(http.MethodGet, "/v1/check-in-insights", strings.NewReader(""))
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	var response InsightsResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("could not decode insights response: %v", err)
	}
	pattern := response.Patterns[0]
	if !pattern.InsufficientData {
		t.Error("fewer than five attempts should be insufficient data")
	}
	if pattern.SuccessRate != nil {
		t.Errorf("zero attempts should not produce a success rate, got %#v", pattern.SuccessRate)
	}
}

func TestInsightsHandlerRejectsUnauthorizedAndWrongMethod(t *testing.T) {
	handler := NewInsightsHandler(&fakeInsightsDatabase{})

	unauthorized := httptest.NewRecorder()
	handler.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/v1/check-in-insights", nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthorized status, got %d", unauthorized.Code)
	}

	wrongMethod := httptest.NewRecorder()
	handler.ServeHTTP(wrongMethod, authenticatedRequest(http.MethodPost, "/v1/check-in-insights", strings.NewReader("")))
	if wrongMethod.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected method-not-allowed status, got %d", wrongMethod.Code)
	}
	if wrongMethod.Header().Get("Allow") != http.MethodGet {
		t.Errorf("expected Allow GET, got %q", wrongMethod.Header().Get("Allow"))
	}
}
