// Package subtasks handles authenticated subtasks stored in PostgreSQL.
package subtasks

// Response is one persisted PostgreSQL subtask.
type Response struct {
	ID        string `json:"id"`
	TaskID    string `json:"taskId"`
	Title     string `json:"title"`
	Completed bool   `json:"completed"`
	Position  int32  `json:"position"`
}

// ListResponse is returned when listing subtasks belonging to one task.
type ListResponse struct {
	Subtasks []Response `json:"subtasks"`
}

// CreateRequest contains fields accepted when creating one subtask.
type CreateRequest struct {
	Title    string          `json:"title"`
	Position Optional[int32] `json:"position"`
}

// BatchItem is one generated subtask title waiting to be persisted.
type BatchItem struct {
	Title string `json:"title"`
}

// BatchCreateRequest contains generated suggestions to save together.
type BatchCreateRequest struct {
	Subtasks []BatchItem `json:"subtasks"`
}

// BatchCreateResponse contains rows returned after the batch commits.
type BatchCreateResponse struct {
	Subtasks []Response `json:"subtasks"`
}

// UpdateRequest contains fields accepted when updating one subtask.
type UpdateRequest struct {
	Title     Optional[string] `json:"title"`
	Completed Optional[bool]   `json:"completed"`
	Position  Optional[int32]  `json:"position"`
}
