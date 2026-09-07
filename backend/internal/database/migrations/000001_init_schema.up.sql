-- Enable cryptographic extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS & GUEST SESSIONS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_guest BOOLEAN NOT NULL DEFAULT true,
    cash_balance NUMERIC(28, 8) NOT NULL DEFAULT 1000.00000000, -- Seeded with $1,000.00 USDC
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_positive_balance CHECK (cash_balance >= 0)
);

-- 2. PREDICTION MARKETS
CREATE TABLE IF NOT EXISTS markets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(128) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(64) NOT NULL,            -- 'ai', 'crypto', 'macro', 'space'
    image_url VARCHAR(512),
    resolution_source TEXT NOT NULL,           -- Criteria / URL defining resolution
    resolution_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active', -- 'draft', 'active', 'suspended', 'locked', 'resolved', 'settled'
    winning_outcome VARCHAR(8),                -- 'YES', 'NO', NULL
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. LIQUIDITY POOLS (CPMM Invariant State: k = ReserveYes * ReserveNo)
CREATE TABLE IF NOT EXISTS liquidity_pools (
    market_id UUID PRIMARY KEY REFERENCES markets(id) ON DELETE CASCADE,
    reserve_yes NUMERIC(28, 8) NOT NULL,       -- R_yes virtual inventory
    reserve_no NUMERIC(28, 8) NOT NULL,        -- R_no virtual inventory
    collateral_reserve NUMERIC(28, 8) NOT NULL, -- USDC backing issued complete sets
    k_invariant NUMERIC(56, 16) NOT NULL,      -- Invariant k = R_yes * R_no
    total_volume_usdc NUMERIC(28, 8) NOT NULL DEFAULT 0.00000000,
    lock_version INT NOT NULL DEFAULT 0,       -- Optimistic concurrency versioning
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_positive_reserves CHECK (reserve_yes > 0 AND reserve_no > 0),
    CONSTRAINT chk_nonnegative_collateral CHECK (collateral_reserve >= 0)
);

-- 4. USER OUTCOME POSITIONS
CREATE TABLE IF NOT EXISTS user_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    outcome VARCHAR(8) NOT NULL,               -- 'YES' or 'NO'
    shares_owned NUMERIC(28, 8) NOT NULL DEFAULT 0.00000000,
    avg_buy_price NUMERIC(28, 8) NOT NULL DEFAULT 0.00000000,
    total_invested_usdc NUMERIC(28, 8) NOT NULL DEFAULT 0.00000000,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_market_outcome UNIQUE (user_id, market_id, outcome),
    CONSTRAINT chk_positive_shares CHECK (shares_owned >= 0)
);

-- 5. ORDER & TRADE EXECUTION AUDIT LOG
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(128) NOT NULL,
    trade_type VARCHAR(8) NOT NULL,            -- 'BUY' or 'SELL'
    outcome VARCHAR(8) NOT NULL,               -- 'YES' or 'NO'
    amount_usdc NUMERIC(28, 8) NOT NULL,
    shares_filled NUMERIC(28, 8) NOT NULL,
    execution_price NUMERIC(28, 8) NOT NULL,   -- Effective price per share
    price_impact_pct NUMERIC(16, 8) NOT NULL,  -- Calculated slippage
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_trades_user_idempotency UNIQUE (user_id, idempotency_key)
);

-- 6. IMMUTABLE FINANCIAL LEDGER (Double-Entry Bookkeeping)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    market_id UUID REFERENCES markets(id) ON DELETE RESTRICT,
    account VARCHAR(32) NOT NULL,              -- 'user_cash', 'pool_collateral', 'position_yes', 'position_no'
    asset VARCHAR(8) NOT NULL,                 -- 'USDC', 'YES', 'NO'
    delta NUMERIC(28, 8) NOT NULL,             -- Signed quantity change
    entry_type VARCHAR(32) NOT NULL,           -- 'trade', 'faucet', 'settlement', 'refund'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 7. MUTATION IDEMPOTENCY RECEIPTS
CREATE TABLE IF NOT EXISTS idempotency_keys (
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    operation VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    response JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (actor_id, operation, idempotency_key)
);

-- 8. FAUCET CLAIMS (Abuse Prevention Ledger)
CREATE TABLE IF NOT EXISTS faucet_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45) NOT NULL,
    amount NUMERIC(28, 8) NOT NULL DEFAULT 500.00000000,
    claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- HIGH-PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_markets_status_category ON markets(status, category);
CREATE INDEX IF NOT EXISTS idx_trades_market_created ON trades(market_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_positions_user ON user_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_faucet_ip_time ON faucet_claims(ip_address, claimed_at DESC);
