package subtasks

import (
	"errors"
	"fmt"
	"strings"
)

const (
	// MaxTitleLength is measured in Unicode code points.
	MaxTitleLength = 200

	// MaxBatchSize prevents excessively large database requests.
	MaxBatchSize = 50
)

func validateTitle(title string, emptyMessage string) (string, error) {
	title = strings.TrimSpace(title)

	if title == "" {
		return "", errors.New(emptyMessage)
	}

	if len([]rune(title)) > MaxTitleLength {
		return "", fmt.Errorf(
			"title must be %d characters or fewer",
			MaxTitleLength,
		)
	}

	return title, nil
}

func validatePosition(position Optional[int32]) error {
	if !position.Set {
		return nil
	}

	if position.Value == nil {
		return errors.New("position cannot be null")
	}

	if *position.Value < 0 {
		return errors.New("position cannot be negative")
	}

	return nil
}
