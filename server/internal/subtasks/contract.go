package subtasks

import (
	"bytes"
	"encoding/json"
)

// Optional distinguishes an omitted JSON field from an explicitly supplied
// value or null. This is necessary for PATCH requests, where omitted means
// "leave unchanged" while false and zero are real values that must be kept.
type Optional[T any] struct {
	Set   bool
	Value *T
}

// UnmarshalJSON records that an Optional field appeared in the request and
// preserves whether its JSON value was null or a concrete value.
func (optional *Optional[T]) UnmarshalJSON(data []byte) error {
	optional.Set = true

	if bytes.Equal(bytes.TrimSpace(data), []byte("null")) {
		optional.Value = nil
		return nil
	}

	var value T
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}

	optional.Value = &value
	return nil
}
