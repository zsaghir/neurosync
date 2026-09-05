package checkins

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
)

const maxRequestBodySize = 32 * 1024

func decodeCreateRequest(r *http.Request) (CreateRequest, error) {
	var request CreateRequest
	if err := decodeOneJSON(r, &request); err != nil {
		return CreateRequest{}, err
	}
	return ValidateCreate(request)
}

func decodeOutcomeRequest(r *http.Request) (OutcomeRequest, error) {
	var request OutcomeRequest
	if err := decodeOneJSON(r, &request); err != nil {
		return OutcomeRequest{}, err
	}
	if err := ValidateOutcome(request); err != nil {
		return OutcomeRequest{}, err
	}
	return request, nil
}

func decodeSuggestionRequest(r *http.Request) (SuggestionRequest, error) {
	var request SuggestionRequest
	if err := decodeOneJSON(r, &request); err != nil {
		return SuggestionRequest{}, err
	}
	return ValidateSuggestionRequest(request)
}

func decodeOneJSON(r *http.Request, destination any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, maxRequestBodySize))
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(destination); err != nil {
		return errors.New("Request body must contain valid JSON")
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("Request body must contain exactly one JSON object")
	}
	return nil
}

func parseCheckInID(value string) (pgtype.UUID, error) {
	var id pgtype.UUID
	if err := id.Scan(strings.TrimSpace(value)); err != nil || !id.Valid {
		return pgtype.UUID{}, errors.New("invalid check-in ID")
	}
	return id, nil
}
