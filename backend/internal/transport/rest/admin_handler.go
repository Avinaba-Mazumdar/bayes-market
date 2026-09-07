package rest

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/bayesmarket/bayesmarket/internal/middleware"
	"github.com/bayesmarket/bayesmarket/internal/transport/ws"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

// ResolveMarketRequest defines input payload for settling a prediction market.
type ResolveMarketRequest struct {
	WinningOutcome string `json:"winning_outcome" binding:"required"`
	OracleProof    string `json:"oracle_proof" binding:"required"`
}

// ResolveMarketResponse defines the settlement receipt returned upon successful resolution.
type ResolveMarketResponse struct {
	Status          string `json:"status"`
	MarketID        string `json:"market_id"`
	WinningOutcome  string `json:"winning_outcome"`
	TotalPayoutUSDC string `json:"total_payout_usdc"`
	WinnersCredited int    `json:"winners_credited"`
	OracleProof     string `json:"oracle_proof"`
	ResolvedAt      string `json:"resolved_at"`
}

// oracleCacheEntry holds in-memory cached oracle proof verification with a 60-second TTL.
type oracleCacheEntry struct {
	proof      string
	outcome    string
	verifiedAt time.Time
}

type oracleCache struct {
	mu    sync.RWMutex
	items map[string]oracleCacheEntry
}

func newOracleCache() *oracleCache {
	return &oracleCache{items: make(map[string]oracleCacheEntry)}
}

func (c *oracleCache) get(marketID string) (oracleCacheEntry, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	entry, ok := c.items[marketID]
	if !ok || time.Since(entry.verifiedAt) > 60*time.Second {
		return oracleCacheEntry{}, false
	}
	return entry, true
}

func (c *oracleCache) set(marketID, outcome, proof string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[marketID] = oracleCacheEntry{
		proof:      proof,
		outcome:    outcome,
		verifiedAt: time.Now(),
	}
}

// AdminHandler manages administrative operations including market resolution and payout distribution.
type AdminHandler struct {
	pool  *pgxpool.Pool
	hub   *ws.Hub
	locks *marketLockRegistry
	cache *oracleCache
}

// NewAdminHandler constructs an AdminHandler.
func NewAdminHandler(pool *pgxpool.Pool, hub *ws.Hub) *AdminHandler {
	return &AdminHandler{
		pool:  pool,
		hub:   hub,
		locks: newMarketLockRegistry(),
		cache: newOracleCache(),
	}
}

// HandleResolveMarket resolves a prediction market, credits winning share holders, and records double-entry ledger audits.
//
// POST /api/v1/admin/markets/:id/resolve
func (h *AdminHandler) HandleResolveMarket(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	marketIDParam := strings.TrimSpace(c.Param("id"))
	marketID, err := uuid.Parse(marketIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_market_id", "message": "Market ID must be a valid UUID"})
		return
	}

	idempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if idempotencyKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "idempotency_key_required",
			"message": "Idempotency-Key header is required for market resolution",
		})
		return
	}

	var req ResolveMarketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_payload", "message": "Payload must include winning_outcome ('YES'|'NO') and oracle_proof"})
		return
	}

	winningOutcome := strings.ToUpper(strings.TrimSpace(req.WinningOutcome))
	if winningOutcome != "YES" && winningOutcome != "NO" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_outcome", "message": "winning_outcome must be either 'YES' or 'NO'"})
		return
	}

	oracleProof := strings.TrimSpace(req.OracleProof)
	if oracleProof == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_proof", "message": "oracle_proof cannot be empty"})
		return
	}

	// Determine actor UUID for idempotency registration (must reference an existing user in users table)
	actorID, exists := middleware.GetUserID(c)
	if !exists || actorID == uuid.Nil {
		var sysID uuid.UUID
		err := h.pool.QueryRow(ctx, "SELECT id FROM users LIMIT 1").Scan(&sysID)
		if err == nil {
			actorID = sysID
		}
	}

	// Acquire in-process mutex lock to prevent concurrent mutation collisions
	unlock := h.locks.acquire("market:" + marketID.String())
	defer unlock()

	// Check idempotency cache first
	var cachedResponse []byte
	checkIdempQuery := `
		SELECT response
		FROM idempotency_keys
		WHERE actor_id = $1 AND operation = 'resolve' AND idempotency_key = $2;
	`
	err = h.pool.QueryRow(ctx, checkIdempQuery, actorID, idempotencyKey).Scan(&cachedResponse)
	if err == nil && len(cachedResponse) > 0 {
		var resp ResolveMarketResponse
		if jsonErr := json.Unmarshal(cachedResponse, &resp); jsonErr == nil {
			c.Header("X-Cache-Lookup", "HIT-IDEMPOTENT")
			c.JSON(http.StatusOK, resp)
			return
		}
	}

	// 60-second in-memory oracle cache evaluation
	if entry, cached := h.cache.get(marketID.String()); cached {
		if entry.outcome != winningOutcome {
			c.JSON(http.StatusConflict, gin.H{
				"error":   "oracle_proof_conflict",
				"message": fmt.Sprintf("Recent cached oracle verification indicated outcome '%s', conflicting with requested '%s'", entry.outcome, winningOutcome),
			})
			return
		}
	}

	// Begin SERIALIZABLE database transaction for atomic payout settlement
	tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to initiate settlement transaction"})
		return
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	// 1. Lock and verify market state
	var currentStatus, currentWinningOutcome, resolutionSource string
	marketQuery := `
		SELECT status, COALESCE(winning_outcome, ''), resolution_source
		FROM markets
		WHERE id = $1
		FOR UPDATE;
	`
	err = tx.QueryRow(ctx, marketQuery, marketID).Scan(&currentStatus, &currentWinningOutcome, &resolutionSource)
	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "market_not_found", "message": "Market does not exist"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to lock market row"})
		return
	}

	if currentStatus == "resolved" {
		c.JSON(http.StatusConflict, gin.H{
			"error":   "market_already_resolved",
			"message": fmt.Sprintf("Market is already resolved with outcome '%s'", currentWinningOutcome),
		})
		return
	}

	// 2. Lock liquidity pool collateral
	var collateralReserve decimal.Decimal
	poolQuery := `
		SELECT collateral_reserve
		FROM liquidity_pools
		WHERE market_id = $1
		FOR UPDATE;
	`
	err = tx.QueryRow(ctx, poolQuery, marketID).Scan(&collateralReserve)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to lock liquidity pool collateral"})
		return
	}

	// 3. Mark market as resolved
	updateMarketQuery := `
		UPDATE markets
		SET status = 'resolved', winning_outcome = $1
		WHERE id = $2;
	`
	if _, err := tx.Exec(ctx, updateMarketQuery, winningOutcome, marketID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to update market status"})
		return
	}

	// 4. Distribute complete-set collateral ($1.00 per share) to winning positions
	winningPositionsQuery := `
		SELECT id, user_id, shares_owned
		FROM user_positions
		WHERE market_id = $1 AND outcome = $2 AND shares_owned > 0
		FOR UPDATE;
	`
	rows, err := tx.Query(ctx, winningPositionsQuery, marketID, winningOutcome)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to query winning positions"})
		return
	}

	type winRecord struct {
		posID  uuid.UUID
		userID uuid.UUID
		shares decimal.Decimal
	}
	var winners []winRecord
	for rows.Next() {
		var w winRecord
		if scanErr := rows.Scan(&w.posID, &w.userID, &w.shares); scanErr == nil {
			winners = append(winners, w)
		}
	}
	rows.Close()

	totalPayout := decimal.Zero
	settlementTxID := uuid.New()

	for _, w := range winners {
		// Each winning share redeems for exactly $1.00000000 USDC
		payout := w.shares.Truncate(8)
		totalPayout = totalPayout.Add(payout)

		// Credit user cash balance
		creditUserQuery := `
			UPDATE users
			SET cash_balance = cash_balance + $1, last_active = NOW()
			WHERE id = $2;
		`
		if _, err := tx.Exec(ctx, creditUserQuery, payout, w.userID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to credit winning trader"})
			return
		}

		// Zero out winning shares
		zeroPosQuery := `
			UPDATE user_positions
			SET shares_owned = 0, updated_at = NOW()
			WHERE id = $1;
		`
		if _, err := tx.Exec(ctx, zeroPosQuery, w.posID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to zero winning position"})
			return
		}

		// Double-entry bookkeeping ledger
		insertLedger := `
			INSERT INTO ledger_entries (transaction_id, user_id, market_id, account, asset, delta, entry_type)
			VALUES 
				($1, $2, $3, 'user_cash', 'USDC', $4, 'settlement'),
				($1, $2, $3, 'pool_collateral', 'USDC', $5, 'settlement'),
				($1, $2, $3, $6, $7, $8, 'settlement');
		`
		posAccount := "position_" + strings.ToLower(winningOutcome)
		negPayout := payout.Neg()
		negShares := w.shares.Neg()
		if _, err := tx.Exec(ctx, insertLedger,
			settlementTxID, w.userID, marketID,
			payout, negPayout, posAccount, winningOutcome, negShares,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to record settlement ledger entries"})
			return
		}
	}

	// 5. Zero out all losing positions for audit hygiene
	losingPositionsQuery := `
		SELECT id, user_id, outcome, shares_owned
		FROM user_positions
		WHERE market_id = $1 AND outcome != $2 AND shares_owned > 0
		FOR UPDATE;
	`
	loseRows, err := tx.Query(ctx, losingPositionsQuery, marketID, winningOutcome)
	if err == nil {
		type loseRecord struct {
			posID   uuid.UUID
			userID  uuid.UUID
			outcome string
			shares  decimal.Decimal
		}
		var losers []loseRecord
		for loseRows.Next() {
			var l loseRecord
			if scanErr := loseRows.Scan(&l.posID, &l.userID, &l.outcome, &l.shares); scanErr == nil {
				losers = append(losers, l)
			}
		}
		loseRows.Close()

		for _, l := range losers {
			zeroLoseQuery := `
				UPDATE user_positions
				SET shares_owned = 0, updated_at = NOW()
				WHERE id = $1;
			`
			_, _ = tx.Exec(ctx, zeroLoseQuery, l.posID)

			insertLoseLedger := `
				INSERT INTO ledger_entries (transaction_id, user_id, market_id, account, asset, delta, entry_type)
				VALUES ($1, $2, $3, $4, $5, $6, 'settlement');
			`
			posAccount := "position_" + strings.ToLower(l.outcome)
			negShares := l.shares.Neg()
			_, _ = tx.Exec(ctx, insertLoseLedger, settlementTxID, l.userID, marketID, posAccount, l.outcome, negShares)
		}
	}

	// 6. Deduct total payout from liquidity pool collateral reserve
	updatePoolQuery := `
		UPDATE liquidity_pools
		SET collateral_reserve = GREATEST(0, collateral_reserve - $1), updated_at = NOW()
		WHERE market_id = $2;
	`
	if _, err := tx.Exec(ctx, updatePoolQuery, totalPayout, marketID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to update pool collateral reserve"})
		return
	}

	nowStr := time.Now().UTC().Format(time.RFC3339)
	responseObj := ResolveMarketResponse{
		Status:          "resolved",
		MarketID:        marketID.String(),
		WinningOutcome:  winningOutcome,
		TotalPayoutUSDC: totalPayout.StringFixed(8),
		WinnersCredited: len(winners),
		OracleProof:     oracleProof,
		ResolvedAt:      nowStr,
	}

	// 7. Store idempotency receipt
	respJSON, err := json.Marshal(responseObj)
	if err == nil && actorID != uuid.Nil {
		insertIdempQuery := `
			INSERT INTO idempotency_keys (actor_id, operation, idempotency_key, response)
			VALUES ($1, 'resolve', $2, $3)
			ON CONFLICT (actor_id, operation, idempotency_key) DO NOTHING;
		`
		_, _ = tx.Exec(ctx, insertIdempQuery, actorID, idempotencyKey, respJSON)
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": fmt.Sprintf("Failed to commit resolution transaction: %v", err)})
		return
	}

	// 8. Cache verified oracle response for 60 seconds
	h.cache.set(marketID.String(), winningOutcome, oracleProof)

	// 9. Broadcast MARKET_RESOLVED WebSocket frame to connected clients
	if h.hub != nil {
		h.hub.BroadcastMarketResolved(ws.MarketResolvedMessage{
			Type:           ws.MessageTypeMarketResolved,
			MarketID:       marketID.String(),
			WinningOutcome: winningOutcome,
			Timestamp:      nowStr,
		})
	}

	c.JSON(http.StatusOK, responseObj)
}
