package main

import (
	"testing"
	"time"
)

func TestMillisecondsDuration(t *testing.T) {
	tests := []struct {
		value   string
		want    time.Duration
		wantErr bool
	}{
		{value: "3000", want: 3 * time.Second},
		{value: " 15 ", want: 15 * time.Millisecond},
		{value: "0", wantErr: true},
		{value: "-1", wantErr: true},
		{value: "not-a-number", wantErr: true},
	}
	for _, test := range tests {
		got, err := millisecondsDuration("HTTP_CLIENT_TIMEOUT_MS", test.value)
		if test.wantErr {
			if err == nil {
				t.Fatalf("millisecondsDuration(%q) error = nil, want error", test.value)
			}
			continue
		}
		if err != nil {
			t.Fatalf("millisecondsDuration(%q) error = %v", test.value, err)
		}
		if got != test.want {
			t.Fatalf("millisecondsDuration(%q) = %v, want %v", test.value, got, test.want)
		}
	}
}
