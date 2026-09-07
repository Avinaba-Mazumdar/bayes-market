package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

// Config encapsulates validated runtime configuration settings.
type Config struct {
	DatabaseURL string
	ServerPort  string
	CORSOrigin  string
	JWTSecret   string
	Environment string
}

// Load reads configuration from environment variables and local .env files.
// It searches both current directory and workspace root for .env.
func Load() (*Config, error) {
	// Attempt to load from potential .env locations (current dir, parent dir, workspace root)
	for _, envPath := range []string{".env", "../.env", "../../.env", "../../../.env", "../../../../.env", "../../../../../.env"} {
		if _, err := os.Stat(envPath); err == nil {
			_ = godotenv.Load(envPath)
			break
		}
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("missing required environment variable: DATABASE_URL")
	}

	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "8080"
	}

	corsOrigin := os.Getenv("CORS_ORIGIN")
	if corsOrigin == "" {
		corsOrigin = "http://localhost:4200"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "bayesmarket-development-hmac-sha256-default-secret-key-32b"
	}

	env := os.Getenv("APP_ENV")
	if env == "" {
		env = "development"
	}

	return &Config{
		DatabaseURL: strings.TrimSpace(dbURL),
		ServerPort:  strings.TrimSpace(port),
		CORSOrigin:  strings.TrimSpace(corsOrigin),
		JWTSecret:   strings.TrimSpace(jwtSecret),
		Environment: strings.TrimSpace(env),
	}, nil
}
