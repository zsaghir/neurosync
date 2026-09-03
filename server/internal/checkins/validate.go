package checkins

import (
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
)

const (
	maxShortTextLength = 64
	maxNextStepLength  = 280
	maxPlannedMinutes  = 1440
	maxStuckness       = 10
)

// ValidateCreate validates and trims a request to create a check-in.
func ValidateCreate(request CreateRequest) (CreateRequest, error) {
	if !validBlocker(request.Blocker) {
		return CreateRequest{}, errors.New("blocker must be shame, task_initiation, or time_blindness")
	}
	if err := validateStuckness(request.StucknessBefore, "stucknessBefore"); err != nil {
		return CreateRequest{}, err
	}

	if request.TaskID != nil {
		taskID := strings.TrimSpace(*request.TaskID)
		var parsedTaskID pgtype.UUID
		if err := parsedTaskID.Scan(taskID); err != nil || !parsedTaskID.Valid {
			return CreateRequest{}, errors.New("taskId must be a valid UUID")
		}
		request.TaskID = &taskID
	}

	var err error
	request.Reason, err = validateOptionalText(request.Reason, "reason", maxShortTextLength)
	if err != nil {
		return CreateRequest{}, err
	}

	request.SupportAction, err = validateOptionalText(request.SupportAction, "supportAction", maxShortTextLength)
	if err != nil {
		return CreateRequest{}, err
	}

	request.NextStep, err = validateOptionalText(request.NextStep, "nextStep", maxNextStepLength)
	if err != nil {
		return CreateRequest{}, err
	}

	if request.PlannedMinutes != nil && (*request.PlannedMinutes < 1 || *request.PlannedMinutes > maxPlannedMinutes) {
		return CreateRequest{}, fmt.Errorf("plannedMinutes must be between 1 and %d", maxPlannedMinutes)
	}

	return request, nil
}

// ValidateOutcome validates a request to record whether support helped.
func ValidateOutcome(request OutcomeRequest) error {
	if err := validateStuckness(request.StucknessAfter, "stucknessAfter"); err != nil {
		return err
	}
	if request.InterventionAttempted == nil {
		return errors.New("interventionAttempted is required")
	}
	if *request.InterventionAttempted && request.NextStepTaken == nil {
		return errors.New("nextStepTaken is required when interventionAttempted is true")
	}
	if !*request.InterventionAttempted && request.NextStepTaken != nil {
		return errors.New("nextStepTaken must be omitted when interventionAttempted is false")
	}
	if !validHelpfulness(request.Helpfulness) {
		return errors.New("helpfulness must be yes, a_little, or not_yet")
	}
	return nil
}

func validateStuckness(value *int, field string) error {
	if value == nil {
		return fmt.Errorf("%s is required", field)
	}
	if *value < 0 || *value > maxStuckness {
		return fmt.Errorf("%s must be between 0 and %d", field, maxStuckness)
	}
	return nil
}

func validBlocker(blocker Blocker) bool {
	return blocker == BlockerShame ||
		blocker == BlockerTaskInitiation ||
		blocker == BlockerTimeBlindness
}

func validHelpfulness(helpfulness Helpfulness) bool {
	return helpfulness == HelpfulnessYes ||
		helpfulness == HelpfulnessALittle ||
		helpfulness == HelpfulnessNotYet
}

func validateOptionalText(value *string, field string, maxLength int) (*string, error) {
	if value == nil {
		return nil, nil
	}

	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil, fmt.Errorf("%s cannot be blank", field)
	}
	if len([]rune(trimmed)) > maxLength {
		return nil, fmt.Errorf("%s must be %d characters or fewer", field, maxLength)
	}

	return &trimmed, nil
}
