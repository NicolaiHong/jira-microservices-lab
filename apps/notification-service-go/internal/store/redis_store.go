package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/domain"
	"github.com/redis/go-redis/v9"
)

var ErrNotFound = errors.New("notification not found")

type RedisStore struct {
	client *redis.Client
}

func NewRedisStore(redisURL string) (*RedisStore, error) {
	options, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis URL: %w", err)
	}
	return &RedisStore{client: redis.NewClient(options)}, nil
}

func (s *RedisStore) Close() error { return s.client.Close() }

func (s *RedisStore) Ping(ctx context.Context) error {
	return s.client.Ping(ctx).Err()
}

func (s *RedisStore) SaveEventNotifications(
	ctx context.Context,
	notifications []domain.Notification,
) error {
	pipe := s.client.TxPipeline()
	for _, notification := range notifications {
		key := notificationKey(notification.UserID, notification.ID)
		fields := map[string]any{
			"id": notification.ID, "userId": notification.UserID,
			"eventId": notification.EventID, "type": notification.Type,
			"title": notification.Title, "body": notification.Body,
			"issueId": notification.IssueID, "projectId": notification.ProjectID,
			"createdAt": notification.CreatedAt.Format(time.RFC3339Nano), "readAt": "",
		}
		for field, value := range fields {
			pipe.HSetNX(ctx, key, field, value)
		}
		pipe.Expire(ctx, key, 90*24*time.Hour)
		pipe.ZAdd(ctx, userIndex(notification.UserID), redis.Z{
			Score: float64(notification.CreatedAt.UnixMilli()), Member: notification.ID,
		})
		pipe.Expire(ctx, userIndex(notification.UserID), 90*24*time.Hour)
	}
	if _, err := pipe.Exec(ctx); err != nil {
		return err
	}
	return nil
}

func (s *RedisStore) List(ctx context.Context, userID string, limit int) ([]domain.Notification, error) {
	ids, err := s.client.ZRevRange(ctx, userIndex(userID), 0, int64(limit-1)).Result()
	if err != nil {
		return nil, err
	}
	notifications := make([]domain.Notification, 0, len(ids))
	for _, id := range ids {
		fields, err := s.client.HGetAll(ctx, notificationKey(userID, id)).Result()
		if err != nil {
			return nil, err
		}
		if len(fields) == 0 {
			continue
		}
		notification, err := fromHash(fields)
		if err != nil {
			return nil, err
		}
		notifications = append(notifications, notification)
	}
	sort.SliceStable(notifications, func(i, j int) bool {
		return notifications[i].CreatedAt.After(notifications[j].CreatedAt)
	})
	return notifications, nil
}

func (s *RedisStore) MarkRead(ctx context.Context, userID, notificationID string) error {
	key := notificationKey(userID, notificationID)
	exists, err := s.client.Exists(ctx, key).Result()
	if err != nil {
		return err
	}
	if exists == 0 {
		return ErrNotFound
	}
	readAt, err := s.client.HGet(ctx, key, "readAt").Result()
	if err != nil && err != redis.Nil {
		return err
	}
	if readAt != "" {
		return nil
	}
	return s.client.HSet(ctx, key, "readAt", time.Now().UTC().Format(time.RFC3339Nano)).Err()
}

func (s *RedisStore) MarkAllRead(ctx context.Context, userID string) error {
	ids, err := s.client.ZRange(ctx, userIndex(userID), 0, -1).Result()
	if err != nil {
		return err
	}
	for _, id := range ids {
		if err := s.MarkRead(ctx, userID, id); err != nil && !errors.Is(err, ErrNotFound) {
			return err
		}
	}
	return nil
}

func DeterministicID(eventID, userID string) string {
	sum := sha256.Sum256([]byte(eventID + ":" + userID))
	return hex.EncodeToString(sum[:16])
}

func notificationKey(userID, id string) string { return "notification:" + userID + ":" + id }
func userIndex(userID string) string           { return "notifications:user:" + userID }

func fromHash(fields map[string]string) (domain.Notification, error) {
	createdAt, err := time.Parse(time.RFC3339Nano, fields["createdAt"])
	if err != nil {
		return domain.Notification{}, fmt.Errorf("parse createdAt: %w", err)
	}
	var readAt *time.Time
	if fields["readAt"] != "" {
		value, err := time.Parse(time.RFC3339Nano, fields["readAt"])
		if err != nil {
			return domain.Notification{}, fmt.Errorf("parse readAt: %w", err)
		}
		readAt = &value
	}
	return domain.Notification{
		ID: fields["id"], UserID: fields["userId"], EventID: fields["eventId"],
		Type: fields["type"], Title: fields["title"], Body: fields["body"],
		IssueID: fields["issueId"], ProjectID: fields["projectId"],
		CreatedAt: createdAt, ReadAt: readAt,
	}, nil
}
