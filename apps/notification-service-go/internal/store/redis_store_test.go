package store

import "testing"

func TestDeterministicIDIsStableAndRecipientScoped(t *testing.T) {
	first := DeterministicID("event-1", "user-1")
	if first != DeterministicID("event-1", "user-1") {
		t.Fatal("same event and user should generate the same notification ID")
	}
	if first == DeterministicID("event-1", "user-2") {
		t.Fatal("different recipients must not share a notification ID")
	}
}
