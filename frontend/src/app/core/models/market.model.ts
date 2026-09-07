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
    market_id: string;
    market_title: string;
    outcome: 'YES' | 'NO';
    shares_owned: string;
    avg_buy_price: string;
    current_price: string;
    market_value: string;
    unrealized_pnl: string;
}

export interface PortfolioResponse {
    cash_balance: string;
    total_portfolio_value: string;
    positions: UserPosition[];
}
