package subtasks

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
)

func decodeCreateRequest(r *http.Request) (CreateRequest, error) {
	var request CreateRequest

	if err := decodeOneJSON(r, &request); err != nil {
		return CreateRequest{}, err
	}

	title, err := validateTitle(request.Title, "title is required")
	if err != nil {
		return CreateRequest{}, err
	}
	request.Title = title

	if err := validatePosition(request.Position); err != nil {
		return CreateRequest{}, err
	}

	return request, nil
}

func decodeBatchCreateRequest(
	r *http.Request,
) (BatchCreateRequest, error) {
	var request BatchCreateRequest

	if err := decodeOneJSON(r, &request); err != nil {
		return BatchCreateRequest{}, err
	}

	if len(request.Subtasks) == 0 {
		return BatchCreateRequest{}, errors.New(
			"subtasks must contain at least one item",
		)
	}

	if len(request.Subtasks) > MaxBatchSize {
		return BatchCreateRequest{}, fmt.Errorf(
			"subtasks cannot contain more than %d items",
			MaxBatchSize,
		)
	}

	for index := range request.Subtasks {
		title, err := validateTitle(
			request.Subtasks[index].Title,
			fmt.Sprintf("subtasks[%d].title is required", index),
		)
		if err != nil {
			return BatchCreateRequest{}, err
		}

		request.Subtasks[index].Title = title
	}

	return request, nil
}

func decodeUpdateRequest(r *http.Request) (UpdateRequest, error) {
	var request UpdateRequest

	if err := decodeOneJSON(r, &request); err != nil {
		return UpdateRequest{}, err
	}

	if !request.Title.Set &&
		!request.Completed.Set &&
		!request.Position.Set {
		return UpdateRequest{}, errors.New(
			"At least one subtask field must be provided",
		)
	}

	if request.Title.Set {
		if request.Title.Value == nil {
			return UpdateRequest{}, errors.New(
				"title cannot be null",
			)
		}

		title, err := validateTitle(
			*request.Title.Value,
			"title cannot be empty",
		)
		if err != nil {
			return UpdateRequest{}, err
		}

		request.Title.Value = &title
	}

	if request.Completed.Set && request.Completed.Value == nil {
		return UpdateRequest{}, errors.New(
			"completed cannot be null",
		)
	}

	if err := validatePosition(request.Position); err != nil {
		return UpdateRequest{}, err
	}

	return request, nil
}

func decodeOneJSON(r *http.Request, destination any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(destination); err != nil {
		return errors.New(
			"Request body must contain valid JSON",
		)
	}

	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New(
			"Request body must contain exactly one JSON object",
		)
	}

	return nil
}
