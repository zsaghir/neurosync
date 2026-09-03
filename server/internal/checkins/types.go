// Package checkins handles authenticated check-ins stored in PostgreSQL.
package checkins

import "time"

// Blocker describes what is making progress difficult for the user.
type Blocker string

const (
	BlockerShame          Blocker = "shame"
	BlockerTaskInitiation Blocker = "task_initiation"
	BlockerTimeBlindness  Blocker = "time_blindness"
)

// Helpfulness describes whether a support action helped the user.
type Helpfulness string

const (
	HelpfulnessYes     Helpfulness = "yes"
	HelpfulnessALittle Helpfulness = "a_little"
	HelpfulnessNotYet  Helpfulness = "not_yet"
)

// Response is one persisted check-in owned by the authenticated user.
type Response struct {
	ID             string       `json:"id"`
	TaskID         *string      `json:"taskId"`
	Blocker        Blocker      `json:"blocker"`
	Reason         *string      `json:"reason"`
	SupportAction  *string      `json:"supportAction"`
	NextStep       *string      `json:"nextStep"`
	PlannedMinutes *int         `json:"plannedMinutes"`
	Helpfulness    *Helpfulness `json:"helpfulness"`
	CreatedAt      time.Time    `json:"createdAt"`
	UpdatedAt      time.Time    `json:"updatedAt"`
}

// CreateRequest contains fields accepted when creating a check-in.
type CreateRequest struct {
	TaskID         *string `json:"taskId"`
	Blocker        Blocker `json:"blocker"`
	Reason         *string `json:"reason"`
	SupportAction  *string `json:"supportAction"`
	NextStep       *string `json:"nextStep"`
	PlannedMinutes *int    `json:"plannedMinutes"`
}

// OutcomeRequest records whether the chosen support action helped.
type OutcomeRequest struct {
	Helpfulness Helpfulness `json:"helpfulness"`
}
