export interface MarketReserves {
    reserve_yes: string;
    reserve_no: string;
    collateral_reserve: string;
    total_volume_usdc: string;
}

export interface Market {
    id: string;
    slug: string;
    title: string;
    description: string;
    category: string;
    image_url?: string;
    resolution_source: string;
    resolution_date: string;
    status: 'active' | 'closed' | 'resolved';
    winning_outcome?: 'YES' | 'NO' | string;
    probability_yes: string;
    probability_no: string;
    probability_yes_pct: string;
    probability_no_pct: string;
    reserves: MarketReserves;
    created_at: string;
}

export interface QuoteRequest {
    action: 'BUY' | 'SELL';
    outcome: 'YES' | 'NO';
    amount_usdc?: string;
    shares?: string;
}

export interface BuyQuoteResponse {
    market_id: string;
    action: 'BUY';
    outcome: 'YES' | 'NO';
    deposit_usdc: string;
    shares_received: string;
    avg_price: string;
    initial_price: string;
    new_price: string;
    price_impact_pct: string;
    new_reserve_yes: string;
    new_reserve_no: string;
    new_collateral: string;
}

export interface PlaceOrderRequest {
    outcome: 'YES' | 'NO';
    amount_usdc: string;
    max_slippage_pct?: string;
}

export interface OrderResponse {
    trade_id: string;
    market_id: string;
    user_id: string;
    trade_type: string;
    outcome: 'YES' | 'NO';
    amount_usdc: string;
    shares_filled: string;
    execution_price: string;
    price_impact_pct: string;
    new_cash_balance: string;
    new_shares_owned: string;
    avg_buy_price: string;
    created_at: string;
}

export interface UserPosition {
    id?: string;
    market_id: string;
    market_slug?: string;
    market_title: string;
    category?: string;
    outcome: 'YES' | 'NO';
    shares_owned: string;
    avg_buy_price: string;
    total_invested_usdc?: string;
    current_price: string;
    current_value_usdc?: string;
    market_value?: string;
    unrealized_pnl_usdc?: string;
    unrealized_pnl?: string;
    unrealized_pnl_pct?: string;
}

export interface PortfolioResponse {
    user_id?: string;
    cash_balance?: string;
    cash_balance_usdc?: string;
    positions_value_usdc?: string;
    total_portfolio_value?: string;
    total_portfolio_value_usdc?: string;
    total_invested_usdc?: string;
    total_unrealized_pnl_usdc?: string;
    total_unrealized_pnl_pct?: string;
    positions: UserPosition[];
}

export interface CashOutRequest {
    market_id: string;
    outcome: 'YES' | 'NO';
    shares: string;
    min_payout_usdc?: string;
}

export interface CashOutResponse {
    trade_id: string;
    market_id: string;
    user_id: string;
    trade_type: string;
    outcome: 'YES' | 'NO';
    shares_sold: string;
    payout_usdc: string;
    execution_price: string;
    price_impact_pct: string;
    new_cash_balance: string;
    remaining_shares: string;
    created_at: string;
}

export interface ResolveMarketRequest {
    winning_outcome: 'YES' | 'NO';
    oracle_proof: string;
}

export interface ResolveMarketResponse {
    status: string;
    market_id: string;
    winning_outcome: 'YES' | 'NO';
    total_payout_usdc: string;
    winners_credited: number;
    oracle_proof: string;
    resolved_at: string;
}
