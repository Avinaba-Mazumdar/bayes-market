import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
    BuyQuoteResponse,
    CashOutRequest,
    CashOutResponse,
    Market,
    OrderResponse,
    PlaceOrderRequest,
    PortfolioResponse,
    QuoteRequest,
    ResolveMarketRequest,
    ResolveMarketResponse
} from '../models/market.model';

export interface GuestAuthResponse {
    token: string;
    user: {
        id: string;
        cash_balance: string;
        is_guest: boolean;
        created_at: string;
    };
}

export interface FaucetResponse {
    message: string;
    amount: string;
    user: {
        id: string;
        cash_balance: string;
    };
}

@Injectable({
    providedIn: 'root'
})
export class ApiService {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = this.resolveBaseUrl();

    private resolveBaseUrl(): string {
        if (typeof window !== 'undefined' && window.location) {
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                return `${window.location.protocol}//${window.location.hostname}:8080/api/v1`;
            }
            return `${window.location.origin}/api/v1`;
        }
        return 'http://localhost:8080/api/v1';
    }

    /**
     * Create or retrieve an ephemeral guest trading session.
     */
    createGuestSession(): Observable<GuestAuthResponse> {
        return this.http.post<GuestAuthResponse>(`${this.baseUrl}/auth/guest`, {});
    }

    /**
     * Fetch active prediction markets, optionally filtered by category.
     */
    getMarkets(category?: string): Observable<Market[]> {
        const url = category && category !== 'all' ? `${this.baseUrl}/markets?category=${encodeURIComponent(category)}` : `${this.baseUrl}/markets`;
        return this.http.get<Market[]>(url);
    }

    /**
     * Fetch a single market by UUID or slug.
     */
    getMarketById(idOrSlug: string): Observable<Market> {
        return this.http.get<Market>(`${this.baseUrl}/markets/${encodeURIComponent(idOrSlug)}`);
    }

    /**
     * Get an authoritative execution quote for BUY/SELL.
     */
    getQuote(marketId: string, request: QuoteRequest): Observable<BuyQuoteResponse> {
        return this.http.post<BuyQuoteResponse>(`${this.baseUrl}/markets/${encodeURIComponent(marketId)}/quote`, request);
    }

    /**
     * Place an order with mandatory Bearer authentication and unique Idempotency-Key.
     */
    placeOrder(marketId: string, request: PlaceOrderRequest, token: string, idempotencyKey: string): Observable<OrderResponse> {
        const headers = new HttpHeaders({
            Authorization: `Bearer ${token}`,
            'Idempotency-Key': idempotencyKey,
            'Content-Type': 'application/json'
        });
        return this.http.post<OrderResponse>(`${this.baseUrl}/markets/${encodeURIComponent(marketId)}/orders`, request, { headers });
    }

    /**
     * Claim testnet faucet USDC.
     */
    claimFaucet(token: string): Observable<FaucetResponse> {
        const headers = new HttpHeaders({
            Authorization: `Bearer ${token}`
        });
        return this.http.post<FaucetResponse>(`${this.baseUrl}/faucet`, {}, { headers });
    }

    /**
     * Get portfolio positions and cash balance.
     */
    getPortfolio(token: string): Observable<PortfolioResponse> {
        const headers = new HttpHeaders({
            Authorization: `Bearer ${token}`
        });
        return this.http.get<PortfolioResponse>(`${this.baseUrl}/portfolio`, { headers });
    }

    /**
     * Liquidate outcome shares back to USDC via AMM pool.
     */
    cashOut(request: CashOutRequest, token: string, idempotencyKey: string): Observable<CashOutResponse> {
        const headers = new HttpHeaders({
            Authorization: `Bearer ${token}`,
            'Idempotency-Key': idempotencyKey,
            'Content-Type': 'application/json'
        });
        return this.http.post<CashOutResponse>(`${this.baseUrl}/portfolio/cashout`, request, { headers });
    }

    /**
     * Administratively resolve a prediction market and trigger complete-set payout distribution.
     */
    resolveMarket(marketId: string, request: ResolveMarketRequest, adminToken: string, idempotencyKey: string): Observable<ResolveMarketResponse> {
        const headers = new HttpHeaders({
            Authorization: `Bearer ${adminToken}`,
            'Idempotency-Key': idempotencyKey,
            'Content-Type': 'application/json'
        });
        return this.http.post<ResolveMarketResponse>(`${this.baseUrl}/admin/markets/${encodeURIComponent(marketId)}/resolve`, request, { headers });
    }
}
