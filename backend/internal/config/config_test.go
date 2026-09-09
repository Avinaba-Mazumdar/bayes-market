package config_test

import (
	"testing"

	"github.com/bayesmarket/bayesmarket/internal/config"
)

func TestConfig_IsDevOrLocal(t *testing.T) {
	tests := []struct {
		env      string
		expected bool
	}{
		{"development", true},
		{"dev", true},
		{"local", true},
		{"LOCAL", true},
		{"Dev", true},
		{"production", false},
		{"prod", false},
		{"staging", false},
		{"test", false},
		{"", false},
	}

	for _, tt := range tests {
		cfg := &config.Config{Environment: tt.env}
		if got := cfg.IsDevOrLocal(); got != tt.expected {
			t.Errorf("IsDevOrLocal() for env %q = %v; expected %v", tt.env, got, tt.expected)
		}
	}
}
