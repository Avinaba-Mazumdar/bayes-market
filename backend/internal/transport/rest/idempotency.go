package rest

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrIdempotencyReplay = errors.New("idempotency_replay")

const idempotencyConstraintName = "uq_trades_user_idempotency"

// GetCachedIdempotencyResponse checks if an operation with the given idempotency key
// has already been recorded for this actor. Returns the cached JSON payload and true if found.
func GetCachedIdempotencyResponse(
	ctx context.Context,
	pool *pgxpool.Pool,
	actorID uuid.UUID,
	operation string,
	idempotencyKey string,
) ([]byte, bool, error) {
	query := `
		SELECT response 
		FROM idempotency_keys 
		WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3;
	`
	var cached []byte
	err := pool.QueryRow(ctx, query, actorID, operation, idempotencyKey).Scan(&cached)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, false, nil
		}
		return nil, false, err
	}
	if len(cached) > 0 {
		return cached, true, nil
	}
	return nil, false, nil
}

// QueueIdempotencyRecord queues the idempotency key receipt insertion into a pgx batch.
func QueueIdempotencyRecord(
	batch *pgx.Batch,
	actorID uuid.UUID,
	operation string,
	idempotencyKey string,
	responseBytes []byte,
) {
	if len(responseBytes) == 0 {
		return
	}
	query := `
		INSERT INTO idempotency_keys (actor_id, operation, idempotency_key, response, created_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (actor_id, operation, idempotency_key) DO NOTHING;
	`
	batch.Queue(query, actorID, operation, idempotencyKey, responseBytes)
}

// IsIdempotencyReplayError checks if a database error corresponds to an idempotency unique constraint collision.
func IsIdempotencyReplayError(err error) bool {
	if errors.Is(err, ErrIdempotencyReplay) {
		return true
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.ConstraintName == idempotencyConstraintName {
		return true
	}
	return false
}
