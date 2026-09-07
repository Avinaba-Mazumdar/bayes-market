package rest

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/bayesmarket/bayesmarket/internal/amm"
	"github.com/bayesmarket/bayesmarket/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

// TradeHandler handles atomic order placements and share cash-out liquidations.
type TradeHandler struct {
	pool  *pgxpool.Pool
	locks *marketLockRegistry
}

// NewTradeHandler constructs a TradeHandler.
func NewTradeHandler(pool *pgxpool.Pool) *TradeHandler {
	return &TradeHandler{pool: pool, locks: newMarketLockRegistry()}
}

// PlaceOrderRequest defines the input payload for placing a buy order.
type PlaceOrderRequest struct {
	Outcome        string `json:"outcome"`
	AmountUSDC     string `json:"amount_usdc"`
	MaxSlippagePct string `json:"max_slippage_pct,omitempty"`
}

// OrderResponse represents the authoritative execution receipt for a trade.
type OrderResponse struct {
	TradeID        string `json:"trade_id"`
	MarketID       string `json:"market_id"`
	UserID         string `json:"user_id"`
	TradeType      string `json:"trade_type"`
	Outcome        string `json:"outcome"`
	AmountUSDC     string `json:"amount_usdc"`
	SharesFilled   string `json:"shares_filled"`
	ExecutionPrice string `json:"execution_price"`
	PriceImpactPct string `json:"price_impact_pct"`
	NewCashBalance string `json:"new_cash_balance"`
	NewSharesOwned string `json:"new_shares_owned"`
	AvgBuyPrice    string `json:"avg_buy_price"`
	CreatedAt      string `json:"created_at"`
}

// CashOutRequest defines the input payload for liquidating outcome shares back to USDC.
type CashOutRequest struct {
	MarketID      string `json:"market_id"`
	Outcome       string `json:"outcome"`
	Shares        string `json:"shares"`
	MinPayoutUSDC string `json:"min_payout_usdc,omitempty"`
}

// CashOutResponse represents the authoritative receipt for a share liquidation.
type CashOutResponse struct {
	TradeID         string `json:"trade_id"`
	MarketID        string `json:"market_id"`
	UserID          string `json:"user_id"`
	TradeType       string `json:"trade_type"`
	Outcome         string `json:"outcome"`
	SharesSold      string `json:"shares_sold"`
	PayoutUSDC      string `json:"payout_usdc"`
	ExecutionPrice  string `json:"execution_price"`
	PriceImpactPct  string `json:"price_impact_pct"`
	NewCashBalance  string `json:"new_cash_balance"`
	RemainingShares string `json:"remaining_shares"`
	CreatedAt       string `json:"created_at"`
}

// HandlePlaceOrder atomically executes a complete-set CPMM buy order.
//
// POST /api/v1/markets/:id/orders
func (h *TradeHandler) HandlePlaceOrder(c *gin.Context) {
	timeout := 30 * time.Second
	if gin.Mode() == gin.TestMode {
		timeout = 180 * time.Second
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), timeout)
	defer cancel()

	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "message": "Authentication required"})
		return
	}

	idempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if idempotencyKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "idempotency_key_required",
			"message": "Idempotency-Key header is required for order mutations",
		})
		return
	}

	marketIDParam := strings.TrimSpace(c.Param("id"))
	if marketIDParam == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_market", "message": "Market ID is required"})
		return
	}

	// Tier 1: serialize same-market mutations in-process before touching the
	// database (ARCHITECTURE.md §8.1), preventing SERIALIZABLE abort storms.
	unlock := h.locks.acquire("market:" + marketIDParam)
	defer unlock()

	var req PlaceOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_payload", "message": "Malformed JSON payload"})
		return
	}

	outcomeStr := strings.ToUpper(strings.TrimSpace(req.Outcome))
	if outcomeStr != "YES" && outcomeStr != "NO" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_outcome", "message": "Outcome must be 'YES' or 'NO'"})
		return
	}
	outcome := amm.Outcome(outcomeStr)

	amountStr := strings.TrimSpace(req.AmountUSDC)
	if amountStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_amount", "message": "amount_usdc is required"})
		return
	}
	amount, err := decimal.NewFromString(amountStr)
	if err != nil || amount.LessThanOrEqual(decimal.Zero) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_amount", "message": "amount_usdc must be a positive decimal string"})
		return
	}

	maxSlippage := decimal.NewFromFloat(5.0) // default 5%
	if slippageStr := strings.TrimSpace(req.MaxSlippagePct); slippageStr != "" {
		parsed, err := decimal.NewFromString(slippageStr)
		if err != nil || parsed.IsNegative() {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_slippage", "message": "max_slippage_pct must be non-negative"})
			return
		}
		maxSlippage = parsed
	}

	// 1. Check idempotency receipt outside tx first
	var cachedResponse []byte
	checkIdempQuery := `
		SELECT response 
		FROM idempotency_keys 
		WHERE actor_id = $1 AND operation = 'place_order' AND idempotency_key = $2;
	`
	err = h.pool.QueryRow(ctx, checkIdempQuery, userID, idempotencyKey).Scan(&cachedResponse)
	if err == nil && len(cachedResponse) > 0 {
		c.Data(http.StatusOK, "application/json", cachedResponse)
		return
	}

	// Execute with serializable retry loop (up to 25 attempts under heavy concurrent contention)
	var finalResponse *OrderResponse
	maxRetries := 25

	for attempt := 0; attempt < maxRetries; attempt++ {
		finalResponse, err = h.executeOrderTx(ctx, userID, idempotencyKey, marketIDParam, outcome, amount, maxSlippage)
		if err == nil {
			break
		}

		// Check if it was an idempotency replay collision during race
		if errors.Is(err, errIdempotencyReplay) {
			_ = h.pool.QueryRow(ctx, checkIdempQuery, userID, idempotencyKey).Scan(&cachedResponse)
			if len(cachedResponse) > 0 {
				c.Data(http.StatusOK, "application/json", cachedResponse)
				return
			}
		}

		// Check for serialization failure (PostgreSQL code 40001) or deadlock (40P01)
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && (pgErr.Code == "40001" || pgErr.Code == "40P01" || pgErr.Code == "55P03") {
			time.Sleep(time.Duration(20*(attempt+1)) * time.Millisecond)
			continue
		}

		// Business errors (insufficient balance, slippage, etc.) should abort immediately
		var appErr *AppError
		if errors.As(err, &appErr) {
			c.JSON(appErr.StatusCode, gin.H{"error": appErr.ErrorCode, "message": appErr.Message})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{"error": "execution_failed", "message": err.Error()})
		return
	}

	if err != nil {
		c.JSON(http.StatusConflict, gin.H{
			"error":   "concurrency_conflict",
			"message": "Order transaction experienced contention after retries. Please retry.",
		})
		return
	}

	c.JSON(http.StatusCreated, finalResponse)
}

var errIdempotencyReplay = errors.New("idempotency_replay")

type AppError struct {
	StatusCode int
	ErrorCode  string
	Message    string
}

func (e *AppError) Error() string {
	return e.Message
}

func (h *TradeHandler) executeOrderTx(
	ctx context.Context,
	userID uuid.UUID,
	idempotencyKey string,
	marketIDParam string,
	outcome amm.Outcome,
	amount decimal.Decimal,
	maxSlippage decimal.Decimal,
) (*OrderResponse, error) {
	// SERIALIZABLE isolation per ARCHITECTURE.md §3.3: predicate conflicts on the
	// locked rows surface as SQLSTATE 40001 and are retried by the caller's loop.
	tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Step 1: Pessimistic Lock on User Row (Hierarchy Level 1)
	var currentCashBalance decimal.Decimal
	queryUser := `SELECT cash_balance FROM users WHERE id = $1 FOR UPDATE;`
	err = tx.QueryRow(ctx, queryUser, userID).Scan(&currentCashBalance)
	if err != nil {
		return nil, err
	}

	if currentCashBalance.LessThan(amount) {
		return nil, &AppError{
			StatusCode: http.StatusBadRequest,
			ErrorCode:  "insufficient_balance",
			Message:    "Insufficient virtual USDC balance to fund order",
		}
	}

	// Step 2: Pessimistic Lock on Market Row (Hierarchy Level 2)
	var marketUUID uuid.UUID
	var marketStatus string
	queryMarket := `
		SELECT id, status 
		FROM markets 
		WHERE id::text = $1 OR slug = $1 
		FOR UPDATE;
	`
	err = tx.QueryRow(ctx, queryMarket, marketIDParam).Scan(&marketUUID, &marketStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, &AppError{StatusCode: http.StatusNotFound, ErrorCode: "not_found", Message: "Market not found"}
		}
		return nil, err
	}

	if marketStatus != "active" {
		return nil, &AppError{
			StatusCode: http.StatusBadRequest,
			ErrorCode:  "market_not_active",
			Message:    "Market is not open for trading",
		}
	}

	// Step 3: Pessimistic Lock on Liquidity Pool (Hierarchy Level 3)
	var rYes, rNo, collateral, totalVolume decimal.Decimal
	var lockVersion int
	queryPool := `
		SELECT reserve_yes, reserve_no, collateral_reserve, total_volume_usdc, lock_version 
		FROM liquidity_pools 
		WHERE market_id = $1 
		FOR UPDATE;
	`
	err = tx.QueryRow(ctx, queryPool, marketUUID).Scan(&rYes, &rNo, &collateral, &totalVolume, &lockVersion)
	if err != nil {
		return nil, err
	}

	poolReserves := amm.PoolReserves{
		ReserveYes:        rYes,
		ReserveNo:         rNo,
		CollateralReserve: collateral,
	}

	// Step 4: Mathematical AMM Execution
	quote, err := amm.CalculateCompleteSetBuy(amount, outcome, poolReserves)
	if err != nil {
		return nil, &AppError{StatusCode: http.StatusBadRequest, ErrorCode: "amm_error", Message: err.Error()}
	}

	if quote.PriceImpactPct.GreaterThan(maxSlippage) {
		return nil, &AppError{
			StatusCode: http.StatusBadRequest,
			ErrorCode:  "slippage_exceeded",
			Message:    "Price impact (" + quote.PriceImpactPct.StringFixed(4) + "%) exceeds maximum allowed slippage (" + maxSlippage.StringFixed(4) + "%)",
		}
	}

	// Step 5: Deduct User Cash
	var newCashBalance decimal.Decimal
	deductCashQuery := `
		UPDATE users 
		SET cash_balance = cash_balance - $1, last_active = NOW() 
		WHERE id = $2 
		RETURNING cash_balance;
	`
	err = tx.QueryRow(ctx, deductCashQuery, amount, userID).Scan(&newCashBalance)
	if err != nil {
		return nil, err
	}

	// Step 6: Update Liquidity Pool Virtual Reserves & Collateral
	updatePoolQuery := `
		UPDATE liquidity_pools 
		SET reserve_yes = $1, 
		    reserve_no = $2, 
		    collateral_reserve = $3, 
		    total_volume_usdc = total_volume_usdc + $4, 
		    lock_version = lock_version + 1, 
		    updated_at = NOW() 
		WHERE market_id = $5;
	`
	_, err = tx.Exec(ctx, updatePoolQuery, quote.NewReserveYes, quote.NewReserveNo, quote.NewCollateral, amount, marketUUID)
	if err != nil {
		return nil, err
	}

	// Step 7: Insert Trade Record
	tradeID := uuid.New()
	insertTradeQuery := `
		INSERT INTO trades (
			id, market_id, user_id, idempotency_key, trade_type, outcome, 
			amount_usdc, shares_filled, execution_price, price_impact_pct, created_at
		) VALUES ($1, $2, $3, $4, 'BUY', $5, $6, $7, $8, $9, NOW());
	`
	_, err = tx.Exec(ctx, insertTradeQuery,
		tradeID, marketUUID, userID, idempotencyKey, string(outcome),
		amount, quote.SharesReceived, quote.AvgPrice, quote.PriceImpactPct,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.ConstraintName == "uq_trades_user_idempotency" {
			return nil, errIdempotencyReplay
		}
		return nil, err
	}

	// Step 8: Upsert User Position with Volume-Weighted Average Price
	var finalSharesOwned, finalAvgPrice decimal.Decimal
	queryPos := `
		SELECT shares_owned, avg_buy_price, total_invested_usdc 
		FROM user_positions 
		WHERE user_id = $1 AND market_id = $2 AND outcome = $3 
		FOR UPDATE;
	`
	var existingShares, existingAvg, existingInvested decimal.Decimal
	err = tx.QueryRow(ctx, queryPos, userID, marketUUID, string(outcome)).Scan(&existingShares, &existingAvg, &existingInvested)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// First purchase of this outcome
			finalSharesOwned = quote.SharesReceived
			finalAvgPrice = quote.AvgPrice
			insertPosQuery := `
				INSERT INTO user_positions (
					user_id, market_id, outcome, shares_owned, avg_buy_price, total_invested_usdc, created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW());
			`
			_, err = tx.Exec(ctx, insertPosQuery, userID, marketUUID, string(outcome), finalSharesOwned, finalAvgPrice, amount)
			if err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	} else {
		// Existing position: update shares and weighted average price
		finalSharesOwned = existingShares.Add(quote.SharesReceived)
		newInvested := existingInvested.Add(amount)
		if finalSharesOwned.GreaterThan(decimal.Zero) {
			finalAvgPrice = newInvested.DivRound(finalSharesOwned, 8)
		} else {
			finalAvgPrice = decimal.Zero
		}
		updatePosQuery := `
			UPDATE user_positions 
			SET shares_owned = $1, avg_buy_price = $2, total_invested_usdc = $3, updated_at = NOW() 
			WHERE user_id = $4 AND market_id = $5 AND outcome = $6;
		`
		_, err = tx.Exec(ctx, updatePosQuery, finalSharesOwned, finalAvgPrice, newInvested, userID, marketUUID, string(outcome))
		if err != nil {
			return nil, err
		}
	}

	// Step 9: Immutable Balanced Double-Entry Financial Ledger
	// 1. User cash debit
	// 2. Pool collateral credit
	// 3. User position shares credit
	insertLedgerQuery := `
		INSERT INTO ledger_entries (
			transaction_id, user_id, market_id, account, asset, delta, entry_type, created_at
		) VALUES 
		($1, $2, $3, 'user_cash', 'USDC', $4, 'trade', NOW()),
		($1, $2, $3, 'pool_collateral', 'USDC', $5, 'trade', NOW()),
		($1, $2, $3, $6, $7, $8, 'trade', NOW());
	`
	positionAccount := "position_" + strings.ToLower(string(outcome))
	_, err = tx.Exec(ctx, insertLedgerQuery,
		tradeID, userID, marketUUID,
		amount.Neg(),         // user cash delta (-amount)
		amount,               // pool collateral delta (+amount)
		positionAccount,      // account name
		string(outcome),      // asset
		quote.SharesReceived, // delta shares (+shares)
	)
	if err != nil {
		return nil, err
	}

	// Prepare Response
	resp := &OrderResponse{
		TradeID:        tradeID.String(),
		MarketID:       marketUUID.String(),
		UserID:         userID.String(),
		TradeType:      "BUY",
		Outcome:        string(outcome),
		AmountUSDC:     amount.StringFixed(8),
		SharesFilled:   quote.SharesReceived.StringFixed(8),
		ExecutionPrice: quote.AvgPrice.StringFixed(8),
		PriceImpactPct: quote.PriceImpactPct.StringFixed(8),
		NewCashBalance: newCashBalance.StringFixed(8),
		NewSharesOwned: finalSharesOwned.StringFixed(8),
		AvgBuyPrice:    finalAvgPrice.StringFixed(8),
		CreatedAt:      time.Now().UTC().Format(time.RFC3339),
	}

	// Step 10: Store Idempotency Receipt
	respBytes, err := json.Marshal(resp)
	if err == nil {
		insertIdempQuery := `
			INSERT INTO idempotency_keys (actor_id, operation, idempotency_key, response, created_at)
			VALUES ($1, 'place_order', $2, $3, NOW())
			ON CONFLICT (actor_id, operation, idempotency_key) DO NOTHING;
		`
		_, _ = tx.Exec(ctx, insertIdempQuery, userID, idempotencyKey, respBytes)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return resp, nil
}

// HandleCashOut atomically liquidates shares of an outcome back to virtual USDC.
//
// POST /api/v1/portfolio/cashout
func (h *TradeHandler) HandleCashOut(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 25*time.Second)
	defer cancel()

	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "message": "Authentication required"})
		return
	}

	idempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if idempotencyKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "idempotency_key_required",
			"message": "Idempotency-Key header is required for cashout mutations",
		})
		return
	}

	var req CashOutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_payload", "message": "Malformed JSON payload"})
		return
	}

	marketIDParam := strings.TrimSpace(req.MarketID)
	if marketIDParam == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_market", "message": "market_id is required"})
		return
	}

	// Tier 1: serialize same-market mutations in-process before touching the
	// database (ARCHITECTURE.md §8.1), preventing SERIALIZABLE abort storms.
	unlock := h.locks.acquire("market:" + marketIDParam)
	defer unlock()

	outcomeStr := strings.ToUpper(strings.TrimSpace(req.Outcome))
	if outcomeStr != "YES" && outcomeStr != "NO" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_outcome", "message": "Outcome must be 'YES' or 'NO'"})
		return
	}
	outcome := amm.Outcome(outcomeStr)

	sharesStr := strings.TrimSpace(req.Shares)
	if sharesStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_shares", "message": "shares is required"})
		return
	}
	shares, err := decimal.NewFromString(sharesStr)
	if err != nil || shares.LessThanOrEqual(decimal.Zero) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_shares", "message": "shares must be a positive decimal string"})
		return
	}

	minPayout := decimal.Zero
	if minPayoutStr := strings.TrimSpace(req.MinPayoutUSDC); minPayoutStr != "" {
		parsed, err := decimal.NewFromString(minPayoutStr)
		if err != nil || parsed.IsNegative() {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_min_payout", "message": "min_payout_usdc must be non-negative"})
			return
		}
		minPayout = parsed
	}

	// Check idempotency receipt first
	var cachedResponse []byte
	checkIdempQuery := `
		SELECT response 
		FROM idempotency_keys 
		WHERE actor_id = $1 AND operation = 'cashout' AND idempotency_key = $2;
	`
	err = h.pool.QueryRow(ctx, checkIdempQuery, userID, idempotencyKey).Scan(&cachedResponse)
	if err == nil && len(cachedResponse) > 0 {
		c.Data(http.StatusOK, "application/json", cachedResponse)
		return
	}

	// Serializable transaction with retry loop (up to 25 attempts)
	var finalResponse *CashOutResponse
	maxRetries := 25

	for attempt := 0; attempt < maxRetries; attempt++ {
		finalResponse, err = h.executeCashOutTx(ctx, userID, idempotencyKey, marketIDParam, outcome, shares, minPayout)
		if err == nil {
			break
		}

		if errors.Is(err, errIdempotencyReplay) {
			_ = h.pool.QueryRow(ctx, checkIdempQuery, userID, idempotencyKey).Scan(&cachedResponse)
			if len(cachedResponse) > 0 {
				c.Data(http.StatusOK, "application/json", cachedResponse)
				return
			}
		}

		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && (pgErr.Code == "40001" || pgErr.Code == "40P01" || pgErr.Code == "55P03") {
			time.Sleep(time.Duration(20*(attempt+1)) * time.Millisecond)
			continue
		}

		var appErr *AppError
		if errors.As(err, &appErr) {
			c.JSON(appErr.StatusCode, gin.H{"error": appErr.ErrorCode, "message": appErr.Message})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{"error": "execution_failed", "message": err.Error()})
		return
	}

	if err != nil {
		c.JSON(http.StatusConflict, gin.H{
			"error":   "concurrency_conflict",
			"message": "Cashout transaction experienced contention after retries. Please retry.",
		})
		return
	}

	c.JSON(http.StatusOK, finalResponse)
}

func (h *TradeHandler) executeCashOutTx(
	ctx context.Context,
	userID uuid.UUID,
	idempotencyKey string,
	marketIDParam string,
	outcome amm.Outcome,
	shares decimal.Decimal,
	minPayout decimal.Decimal,
) (*CashOutResponse, error) {
	// SERIALIZABLE isolation per ARCHITECTURE.md §3.3: predicate conflicts on the
	// locked rows surface as SQLSTATE 40001 and are retried by the caller's loop.
	tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Step 1: Pessimistic Lock on User (Hierarchy Level 1)
	var currentCashBalance decimal.Decimal
	queryUser := `SELECT cash_balance FROM users WHERE id = $1 FOR UPDATE;`
	err = tx.QueryRow(ctx, queryUser, userID).Scan(&currentCashBalance)
	if err != nil {
		return nil, err
	}

	// Step 2: Lock Market (Hierarchy Level 2)
	var marketUUID uuid.UUID
	var marketStatus string
	queryMarket := `SELECT id, status FROM markets WHERE id::text = $1 OR slug = $1 FOR UPDATE;`
	err = tx.QueryRow(ctx, queryMarket, marketIDParam).Scan(&marketUUID, &marketStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, &AppError{StatusCode: http.StatusNotFound, ErrorCode: "not_found", Message: "Market not found"}
		}
		return nil, err
	}

	if marketStatus != "active" {
		return nil, &AppError{
			StatusCode: http.StatusBadRequest,
			ErrorCode:  "market_not_active",
			Message:    "Market is not active for trading",
		}
	}

	// Step 3: Lock User Position (Hierarchy Level 3)
	var ownedShares, avgBuyPrice, totalInvested decimal.Decimal
	queryPos := `
		SELECT shares_owned, avg_buy_price, total_invested_usdc 
		FROM user_positions 
		WHERE user_id = $1 AND market_id = $2 AND outcome = $3 
		FOR UPDATE;
	`
	err = tx.QueryRow(ctx, queryPos, userID, marketUUID, string(outcome)).Scan(&ownedShares, &avgBuyPrice, &totalInvested)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || ownedShares.LessThan(shares) {
			return nil, &AppError{
				StatusCode: http.StatusBadRequest,
				ErrorCode:  "insufficient_shares",
				Message:    "Insufficient outcome shares to liquidate",
			}
		}
		return nil, err
	}

	if ownedShares.LessThan(shares) {
		return nil, &AppError{
			StatusCode: http.StatusBadRequest,
			ErrorCode:  "insufficient_shares",
			Message:    "Insufficient outcome shares to liquidate",
		}
	}

	// Step 4: Lock Liquidity Pool (Hierarchy Level 4)
	var rYes, rNo, collateral, totalVolume decimal.Decimal
	var lockVersion int
	queryPool := `
		SELECT reserve_yes, reserve_no, collateral_reserve, total_volume_usdc, lock_version 
		FROM liquidity_pools 
		WHERE market_id = $1 
		FOR UPDATE;
	`
	err = tx.QueryRow(ctx, queryPool, marketUUID).Scan(&rYes, &rNo, &collateral, &totalVolume, &lockVersion)
	if err != nil {
		return nil, err
	}

	poolReserves := amm.PoolReserves{
		ReserveYes:        rYes,
		ReserveNo:         rNo,
		CollateralReserve: collateral,
	}

	// Step 5: AMM Sell Calculation
	quote, err := amm.CalculateCompleteSetSell(shares, outcome, poolReserves)
	if err != nil {
		return nil, &AppError{StatusCode: http.StatusBadRequest, ErrorCode: "amm_error", Message: err.Error()}
	}

	if minPayout.GreaterThan(decimal.Zero) && quote.PayoutUSDC.LessThan(minPayout) {
		return nil, &AppError{
			StatusCode: http.StatusBadRequest,
			ErrorCode:  "slippage_exceeded",
			Message:    "Payout (" + quote.PayoutUSDC.StringFixed(4) + " USDC) is below minimum acceptable (" + minPayout.StringFixed(4) + " USDC)",
		}
	}

	// Step 6: Credit User Cash Balance
	var newCashBalance decimal.Decimal
	creditCashQuery := `
		UPDATE users 
		SET cash_balance = cash_balance + $1, last_active = NOW() 
		WHERE id = $2 
		RETURNING cash_balance;
	`
	err = tx.QueryRow(ctx, creditCashQuery, quote.PayoutUSDC, userID).Scan(&newCashBalance)
	if err != nil {
		return nil, err
	}

	// Step 7: Decrement User Position
	remainingShares := ownedShares.Sub(shares)
	var remainingInvested decimal.Decimal
	if ownedShares.GreaterThan(decimal.Zero) {
		ratio := remainingShares.DivRound(ownedShares, 8)
		remainingInvested = totalInvested.Mul(ratio).Round(8)
	} else {
		remainingInvested = decimal.Zero
	}

	updatePosQuery := `
		UPDATE user_positions 
		SET shares_owned = $1, total_invested_usdc = $2, updated_at = NOW() 
		WHERE user_id = $3 AND market_id = $4 AND outcome = $5;
	`
	_, err = tx.Exec(ctx, updatePosQuery, remainingShares, remainingInvested, userID, marketUUID, string(outcome))
	if err != nil {
		return nil, err
	}

	// Step 8: Update Pool Virtual Reserves & Collateral
	updatePoolQuery := `
		UPDATE liquidity_pools 
		SET reserve_yes = $1, 
		    reserve_no = $2, 
		    collateral_reserve = $3, 
		    total_volume_usdc = total_volume_usdc + $4, 
		    lock_version = lock_version + 1, 
		    updated_at = NOW() 
		WHERE market_id = $5;
	`
	_, err = tx.Exec(ctx, updatePoolQuery, quote.NewReserveYes, quote.NewReserveNo, quote.NewCollateral, quote.PayoutUSDC, marketUUID)
	if err != nil {
		return nil, err
	}

	// Step 9: Insert Trade Record (SELL)
	tradeID := uuid.New()
	insertTradeQuery := `
		INSERT INTO trades (
			id, market_id, user_id, idempotency_key, trade_type, outcome, 
			amount_usdc, shares_filled, execution_price, price_impact_pct, created_at
		) VALUES ($1, $2, $3, $4, 'SELL', $5, $6, $7, $8, $9, NOW());
	`
	_, err = tx.Exec(ctx, insertTradeQuery,
		tradeID, marketUUID, userID, idempotencyKey, string(outcome),
		quote.PayoutUSDC, shares, quote.AvgPrice, quote.PriceImpactPct,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.ConstraintName == "uq_trades_user_idempotency" {
			return nil, errIdempotencyReplay
		}
		return nil, err
	}

	// Step 10: Immutable Balanced Double-Entry Financial Ledger
	// 1. Pool collateral debit (-quote.PayoutUSDC)
	// 2. User cash credit (+quote.PayoutUSDC)
	// 3. User position shares debit (-shares)
	insertLedgerQuery := `
		INSERT INTO ledger_entries (
			transaction_id, user_id, market_id, account, asset, delta, entry_type, created_at
		) VALUES 
		($1, $2, $3, 'pool_collateral', 'USDC', $4, 'trade', NOW()),
		($1, $2, $3, 'user_cash', 'USDC', $5, 'trade', NOW()),
		($1, $2, $3, $6, $7, $8, 'trade', NOW());
	`
	positionAccount := "position_" + strings.ToLower(string(outcome))
	_, err = tx.Exec(ctx, insertLedgerQuery,
		tradeID, userID, marketUUID,
		quote.PayoutUSDC.Neg(), // pool collateral delta (-payout)
		quote.PayoutUSDC,       // user cash delta (+payout)
		positionAccount,        // account
		string(outcome),        // asset
		shares.Neg(),           // delta shares (-shares)
	)
	if err != nil {
		return nil, err
	}

	// Prepare Response
	resp := &CashOutResponse{
		TradeID:         tradeID.String(),
		MarketID:        marketUUID.String(),
		UserID:          userID.String(),
		TradeType:       "SELL",
		Outcome:         string(outcome),
		SharesSold:      shares.StringFixed(8),
		PayoutUSDC:      quote.PayoutUSDC.StringFixed(8),
		ExecutionPrice:  quote.AvgPrice.StringFixed(8),
		PriceImpactPct:  quote.PriceImpactPct.StringFixed(8),
		NewCashBalance:  newCashBalance.StringFixed(8),
		RemainingShares: remainingShares.StringFixed(8),
		CreatedAt:       time.Now().UTC().Format(time.RFC3339),
	}

	// Store Idempotency Receipt
	respBytes, err := json.Marshal(resp)
	if err == nil {
		insertIdempQuery := `
			INSERT INTO idempotency_keys (actor_id, operation, idempotency_key, response, created_at)
			VALUES ($1, 'cashout', $2, $3, NOW())
			ON CONFLICT (actor_id, operation, idempotency_key) DO NOTHING;
		`
		_, _ = tx.Exec(ctx, insertIdempQuery, userID, idempotencyKey, respBytes)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return resp, nil
}
