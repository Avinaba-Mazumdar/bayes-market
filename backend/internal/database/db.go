package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPool initializes a high-performance pgx connection pool optimized for Neon Serverless PostgreSQL.
func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Neon database URL: %w", err)
	}

	// Serverless Neon pool sizing & lifecycle defaults
	config.MaxConns = 30
	config.MinConns = 2
	config.MaxConnLifetime = 1 * time.Hour
	config.MaxConnIdleTime = 15 * time.Minute
	config.HealthCheckPeriod = 1 * time.Minute

	connectCtx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(connectCtx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create pgxpool connection to Neon: %w", err)
	}

	// Verify connectivity with ping (allow up to 25s for serverless wake-up)
	var pingErr error
	for attempt := 1; attempt <= 3; attempt++ {
		pingCtx, pingCancel := context.WithTimeout(ctx, 20*time.Second)
		pingErr = pool.Ping(pingCtx)
		pingCancel()
		if pingErr == nil {
			break
		}
		log.Printf("[WARN] Neon ping attempt %d/3 failed: %v. Retrying in 2s...", attempt, pingErr)
		time.Sleep(2 * time.Second)
	}

	if pingErr != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping Neon database after retries: %w", pingErr)
	}

	log.Println("[INFO] Successfully established pgx connection pool with Neon Serverless PostgreSQL")
	return pool, nil
}
