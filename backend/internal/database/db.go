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

	connectCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(connectCtx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create pgxpool connection to Neon: %w", err)
	}

	// Verify connectivity with immediate ping
	pingCtx, pingCancel := context.WithTimeout(ctx, 5*time.Second)
	defer pingCancel()

	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping Neon database: %w", err)
	}

	log.Println("[INFO] Successfully established pgx connection pool with Neon Serverless PostgreSQL")
	return pool, nil
}
