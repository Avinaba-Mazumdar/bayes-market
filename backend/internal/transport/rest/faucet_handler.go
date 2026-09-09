package rest

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/bayesmarket/bayesmarket/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

// FaucetHandler handles virtual sandbox currency grants with cooldown protection.
type FaucetHandler struct {
	pool *pgxpool.Pool
}

// NewFaucetHandler constructs a FaucetHandler.
func NewFaucetHandler(pool *pgxpool.Pool) *FaucetHandler {
	return &FaucetHandler{pool: pool}
}

// HandleClaimFaucet issues 100 virtual USDC to the user with a 24-hour cooldown.
//
// POST /api/v1/faucet
func (h *FaucetHandler) HandleClaimFaucet(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "message": "Authentication required"})
		return
	}

	clientIP := c.ClientIP()
	cooldownDuration := 24 * time.Hour
	faucetGrant := decimal.NewFromInt(100)

	idempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))

	// Fast-path idempotency replay: return the stored receipt for a retried claim.
	if idempotencyKey != "" {
		var cachedResponse []byte
		err := h.pool.QueryRow(ctx, `
			SELECT response
			FROM idempotency_keys
			WHERE actor_id = $1 AND operation = 'faucet_claim' AND idempotency_key = $2;
		`, userID, idempotencyKey).Scan(&cachedResponse)
		if err == nil && len(cachedResponse) > 0 {
			c.Data(http.StatusOK, "application/json", cachedResponse)
			return
		}
	}

	// Check recent claim timestamps by user_id or non-loopback IP address
	queryCooldown := `
		SELECT claimed_at 
		FROM faucet_claims
		WHERE user_id = $1 OR ($2 <> '' AND $2 <> '127.0.0.1' AND $2 <> '::1' AND ip_address = $2)
		ORDER BY claimed_at DESC
		LIMIT 1;
	`
	var lastClaimedAt time.Time
	err := h.pool.QueryRow(ctx, queryCooldown, userID, clientIP).Scan(&lastClaimedAt)
	if err == nil {
		elapsed := time.Since(lastClaimedAt)
		if elapsed < cooldownDuration {
			remainingSec := int((cooldownDuration - elapsed).Seconds())
			c.Header("Retry-After", strconv.Itoa(remainingSec))
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":                      "faucet_cooldown",
				"message":                    "Faucet cooldown active. Please wait before claiming again.",
				"cooldown_remaining_seconds": remainingSec,
			})
			return
		}
	}

	// Execute atomic claim transaction
	tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to initiate transaction"})
		return
	}
	defer tx.Rollback(ctx)

	// Lock the user row first (global lock order: user row first) so concurrent
	// claims for the same account serialize before any cooldown evaluation.
	var lockedBalance decimal.Decimal
	lockUserQuery := `SELECT cash_balance FROM users WHERE id = $1 FOR UPDATE;`
	if err := tx.QueryRow(ctx, lockUserQuery, userID).Scan(&lockedBalance); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to lock user balance"})
		return
	}

	// Re-check the cooldown inside the transaction: after acquiring the user row
	// lock, any claim committed by a concurrent request is now visible, closing
	// the double-claim race window.
	var lastClaimedInTx time.Time
	err = tx.QueryRow(ctx, queryCooldown, userID, clientIP).Scan(&lastClaimedInTx)
	if err == nil {
		if elapsed := time.Since(lastClaimedInTx); elapsed < cooldownDuration {
			remainingSec := int((cooldownDuration - elapsed).Seconds())
			c.Header("Retry-After", strconv.Itoa(remainingSec))
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":                      "faucet_cooldown",
				"message":                    "Faucet cooldown active. Please wait before claiming again.",
				"cooldown_remaining_seconds": remainingSec,
			})
			return
		}
	}

	// Update user balance
	var updatedBalance decimal.Decimal
	updateQuery := `
		UPDATE users 
		SET cash_balance = cash_balance + $1, last_active = NOW()
		WHERE id = $2
		RETURNING cash_balance;
	`
	err = tx.QueryRow(ctx, updateQuery, faucetGrant, userID).Scan(&updatedBalance)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to update user cash balance"})
		return
	}

	// Record faucet claim
	insertClaim := `
		INSERT INTO faucet_claims (user_id, ip_address, amount)
		VALUES ($1, $2, $3);
	`
	_, err = tx.Exec(ctx, insertClaim, userID, clientIP, faucetGrant)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to record claim audit log"})
		return
	}

	// Insert double-entry ledger record
	txID := uuid.New()
	insertLedger := `
		INSERT INTO ledger_entries (transaction_id, user_id, account, asset, delta, entry_type)
		VALUES ($1, $2, 'user_cash', 'USDC', $3, 'faucet');
	`
	_, err = tx.Exec(ctx, insertLedger, txID, userID, faucetGrant)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to record ledger entry"})
		return
	}

	// Build the authoritative response, then persist it as the idempotency receipt.
	resp := gin.H{
		"success":          true,
		"amount_claimed":   faucetGrant.StringFixed(8),
		"amount":           faucetGrant.StringFixed(0),
		"new_balance":      updatedBalance.StringFixed(8),
		"cooldown_seconds": 86400,
		"user": gin.H{
			"id":           userID.String(),
			"cash_balance": updatedBalance.StringFixed(8),
		},
	}

	if idempotencyKey != "" {
		if respBytes, err := json.Marshal(resp); err == nil {
			insertIdempotency := `
				INSERT INTO idempotency_keys (actor_id, operation, idempotency_key, response, created_at)
				VALUES ($1, 'faucet_claim', $2, $3, NOW())
				ON CONFLICT (actor_id, operation, idempotency_key) DO NOTHING;
			`
			_, _ = tx.Exec(ctx, insertIdempotency, userID, idempotencyKey, respBytes)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to commit faucet transaction"})
		return
	}

	c.JSON(http.StatusOK, resp)
}
