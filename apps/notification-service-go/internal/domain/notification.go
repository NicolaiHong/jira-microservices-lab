package domain

import "time"

type Notification struct {
	ID        string     `json:"id"`
	UserID    string     `json:"userId"`
	EventID   string     `json:"eventId"`
	Type      string     `json:"type"`
	Title     string     `json:"title"`
	Body      string     `json:"body"`
	IssueID   string     `json:"issueId"`
	ProjectID string     `json:"projectId"`
	CreatedAt time.Time  `json:"createdAt"`
	ReadAt    *time.Time `json:"readAt"`
}

type IssueEvent struct {
	EventID          string         `json:"eventId"`
	EventType        string         `json:"eventType"`
	SchemaVersion    int            `json:"schemaVersion"`
	AggregateID      string         `json:"aggregateId"`
	AggregateVersion int            `json:"aggregateVersion"`
	ProjectID        string         `json:"projectId"`
	ActorUserID      string         `json:"actorUserId"`
	OccurredAt       time.Time      `json:"occurredAt"`
	Payload          map[string]any `json:"payload"`
}
