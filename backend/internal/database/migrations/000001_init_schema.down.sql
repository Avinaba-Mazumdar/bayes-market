-- Drop indexes
DROP INDEX IF EXISTS idx_faucet_ip_time;
DROP INDEX IF EXISTS idx_ledger_entries_transaction;
DROP INDEX IF EXISTS idx_positions_user;
DROP INDEX IF EXISTS idx_trades_user;
DROP INDEX IF EXISTS idx_trades_market_created;
DROP INDEX IF EXISTS idx_markets_status_category;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS faucet_claims CASCADE;
DROP TABLE IF EXISTS idempotency_keys CASCADE;
DROP TABLE IF EXISTS ledger_entries CASCADE;
DROP TABLE IF EXISTS trades CASCADE;
DROP TABLE IF EXISTS user_positions CASCADE;
DROP TABLE IF EXISTS liquidity_pools CASCADE;
DROP TABLE IF EXISTS markets CASCADE;
DROP TABLE IF EXISTS users CASCADE;
