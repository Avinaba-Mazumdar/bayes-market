package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

// Config encapsulates validated runtime configuration settings.
type Config struct {
	DatabaseURL        string
	ServerPort         string
	CORSOrigin         string
	JWTSecret          string
	Environment        string
	AdminToken         string
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURI  string
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
		log.Println("[INFO] DATABASE_URL environment variable is not set. Operating in disconnected sandbox mode.")
	}

	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = os.Getenv("PORT")
		if port == "" {
			port = "8080"
		}
	}

	corsOrigin := os.Getenv("CORS_ORIGIN")
	if corsOrigin == "" {
		corsOrigin = "http://localhost:4200"
	}

	env := os.Getenv("APP_ENV")
	if env == "" {
		env = os.Getenv("ENVIRONMENT")
		if env == "" {
			env = "development"
		}
	}
	env = strings.ToLower(strings.TrimSpace(env))
	isDevOrLocal := env == "local" || env == "dev" || env == "development"

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		if isDevOrLocal {
			jwtSecret = "bayesmarket-development-hmac-sha256-default-secret-key-32b"
		} else {
			log.Printf("[WARN] Missing JWT_SECRET in %s environment! Using default fallback. Configure JWT_SECRET in production settings.\n", env)
			jwtSecret = "bayesmarket-development-hmac-sha256-default-secret-key-32b"
		}
	}

	adminToken := os.Getenv("ADMIN_TOKEN")
	if adminToken == "" {
		if isDevOrLocal {
			adminToken = "bayesmarket-admin-secret-token"
		} else {
			log.Printf("[WARN] Missing ADMIN_TOKEN in %s environment! Using default fallback. Configure ADMIN_TOKEN in production settings.\n", env)
			adminToken = "bayesmarket-admin-secret-token"
		}
	}

	googleClientID := os.Getenv("GOOGLE_CLIENT_ID")
	googleClientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	googleRedirectURI := os.Getenv("GOOGLE_REDIRECT_URI")
	if googleRedirectURI == "" {
		googleRedirectURI = "http://localhost:4200/auth/callback"
	}

	return &Config{
		DatabaseURL:        strings.TrimSpace(dbURL),
		ServerPort:         strings.TrimSpace(port),
		CORSOrigin:         strings.TrimSpace(corsOrigin),
		JWTSecret:          strings.TrimSpace(jwtSecret),
		Environment:        strings.TrimSpace(env),
		AdminToken:         strings.TrimSpace(adminToken),
		GoogleClientID:     strings.TrimSpace(googleClientID),
		GoogleClientSecret: strings.TrimSpace(googleClientSecret),
		GoogleRedirectURI:  strings.TrimSpace(googleRedirectURI),
	}, nil
}

// IsDevOrLocal returns true if the current environment is dev or local.
func (c *Config) IsDevOrLocal() bool {
	if c == nil {
		return true
	}
	env := strings.ToLower(strings.TrimSpace(c.Environment))
	return env == "local" || env == "dev" || env == "development"
}
