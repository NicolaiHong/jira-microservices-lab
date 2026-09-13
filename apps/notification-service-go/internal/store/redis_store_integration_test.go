package store

import (
	"context"
	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/domain"
	"github.com/redis/go-redis/v9"
	"os"
	"testing"
	"time"
)

func TestMarkAllReadPreservesReadTimeExpiryAndRecipientScope(t *testing.T) {
	url := os.Getenv("NOTIFICATION_TEST_REDIS_URL")
	if url == "" {
		t.Skip("NOTIFICATION_TEST_REDIS_URL is required for real Redis integration")
	}
	s, err := NewRedisStore(url)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	ctx := context.Background()
	user := "mark-all-" + time.Now().UTC().Format("20060102150405.000000000")
	other := user + "-other"
	keys := []string{userIndex(user), userIndex(other), notificationKey(user, "unread"), notificationKey(user, "read"), notificationKey(user, "expired"), notificationKey(other, "unread")}
	defer s.client.Del(ctx, keys...)
	now := time.Now().UTC()
	err = s.SaveEventNotifications(ctx, []domain.Notification{
		{ID: "unread", UserID: user, CreatedAt: now},
		{ID: "read", UserID: user, CreatedAt: now},
		{ID: "unread", UserID: other, CreatedAt: now},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.MarkRead(ctx, user, "read"); err != nil {
		t.Fatal(err)
	}
	original := s.client.HGet(ctx, notificationKey(user, "read"), "readAt").Val()
	if err := s.client.ZAdd(ctx, userIndex(user), redis.Z{Score: 1, Member: "expired"}).Err(); err != nil {
		t.Fatal(err)
	}
	if err := s.MarkAllRead(ctx, user); err != nil {
		t.Fatal(err)
	}
	first := s.client.HGet(ctx, notificationKey(user, "unread"), "readAt").Val()
	if _, err := time.Parse(time.RFC3339Nano, first); err != nil {
		t.Fatal(err)
	}
	if err := s.MarkAllRead(ctx, user); err != nil {
		t.Fatal(err)
	}
	if s.client.HGet(ctx, notificationKey(user, "unread"), "readAt").Val() != first {
		t.Fatal("repeat call changed read time")
	}
	if s.client.HGet(ctx, notificationKey(user, "read"), "readAt").Val() != original {
		t.Fatal("already read timestamp changed")
	}
	if s.client.Exists(ctx, notificationKey(user, "expired")).Val() != 0 {
		t.Fatal("expired hash recreated")
	}
	if s.client.HGet(ctx, notificationKey(other, "unread"), "readAt").Val() != "" {
		t.Fatal("another recipient changed")
	}
	if s.client.TTL(ctx, notificationKey(user, "unread")).Val() <= 0 {
		t.Fatal("retention lost")
	}
	if err := s.MarkAllRead(ctx, user+"-empty"); err != nil {
		t.Fatal(err)
	}
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	if err := s.MarkAllRead(canceled, user); err == nil {
		t.Fatal("cancellation must fail")
	}
}
