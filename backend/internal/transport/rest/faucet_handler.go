package rest

import (
	"context"
	"net/http"
	"strconv"
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

// HandleClaimFaucet issues 500 virtual USDC to the user with a 5-minute cooldown.
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
	cooldownDuration := 5 * time.Minute
	faucetGrant := decimal.NewFromInt(500)

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

	idempotencyKey := c.GetHeader("Idempotency-Key")

	// Execute atomic claim transaction
	tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to initiate transaction"})
		return
	}
	defer tx.Rollback(ctx)

	// Update user balance
	var newCashBalance decimal.Decimal
	updateQuery := `
		UPDATE users 
		SET cash_balance = cash_balance + $1, last_active = NOW()
		WHERE id = $2
		RETURNING cash_balance;
	`
	err = tx.QueryRow(ctx, updateQuery, faucetGrant, userID).Scan(&newCashBalance)
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

	// Record idempotency receipt if header provided
	if idempotencyKey != "" {
		insertIdempotency := `
			INSERT INTO idempotency_keys (actor_id, operation, idempotency_key)
			VALUES ($1, 'faucet_claim', $2)
			ON CONFLICT (actor_id, operation, idempotency_key) DO NOTHING;
		`
		_, _ = tx.Exec(ctx, insertIdempotency, userID, idempotencyKey)
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to commit faucet transaction"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":          true,
		"amount_claimed":   faucetGrant.StringFixed(8),
		"new_balance":      newCashBalance.StringFixed(8),
		"cooldown_seconds": 300,
	})
}
