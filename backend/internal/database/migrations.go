package database

import (
	"context"
	"embed"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// RunMigrations executes any unapplied SQL migrations sequentially inside transactions.
func RunMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	// Ensure migration tracking table exists
	createTableSQL := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version BIGINT PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		);
	`
	if _, err := pool.Exec(ctx, createTableSQL); err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}

	// Read all embedded migration files
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("failed to read embedded migrations: %w", err)
	}

	var upFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".up.sql") {
			upFiles = append(upFiles, entry.Name())
		}
	}
	sort.Strings(upFiles)

	for _, fileName := range upFiles {
		var version int64
		_, err := fmt.Sscanf(fileName, "%06d", &version)
		if err != nil {
			log.Printf("[WARN] Skipping non-standard migration filename: %s\n", fileName)
			continue
		}

		// Check if already applied
		var exists bool
		err = pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", version).Scan(&exists)
		if err != nil {
			return fmt.Errorf("failed to check migration status for %s: %w", fileName, err)
		}

		if exists {
			continue
		}

		log.Printf("[INFO] Applying migration: %s (version %d)...\n", fileName, version)
		content, err := migrationsFS.ReadFile("migrations/" + fileName)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", fileName, err)
		}

		tx, err := pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
		if err != nil {
			return fmt.Errorf("failed to begin transaction for migration %s: %w", fileName, err)
		}

		if _, err := tx.Exec(ctx, string(content)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("failed to execute migration %s: %w", fileName, err)
		}

		insertSQL := "INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, $3)"
		if _, err := tx.Exec(ctx, insertSQL, version, fileName, time.Now().UTC()); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("failed to record migration %s: %w", fileName, err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("failed to commit migration %s: %w", fileName, err)
		}

		log.Printf("[INFO] Migration %s successfully applied.\n", fileName)
	}

	return nil
}
