import { inject, Injectable, signal } from '@angular/core';
import { ApiService } from '../core/services/api.service';
import { ToastService } from '../shared/components/toast/toast.service';

const TOKEN_STORAGE_KEY = 'bayesmarket_guest_token';
const USER_ID_STORAGE_KEY = 'bayesmarket_guest_user_id';
const BALANCE_STORAGE_KEY = 'bayesmarket_guest_balance';

@Injectable({
    providedIn: 'root'
})
export class AuthStore {
    private readonly apiService = inject(ApiService);
    private readonly toastService = inject(ToastService);

    readonly token = signal<string | null>(this.getInitialToken());
    readonly userId = signal<string | null>(this.getInitialUserId());
    readonly cashBalance = signal<string>(this.getInitialBalance());
    readonly isInitializing = signal<boolean>(false);
    readonly isClaimingFaucet = signal<boolean>(false);

    constructor() {
        this.initializeSession();
    }

    private getInitialToken(): string | null {
        if (typeof window !== 'undefined' && window.localStorage) {
            return localStorage.getItem(TOKEN_STORAGE_KEY);
        }
        return null;
    }

    private getInitialUserId(): string | null {
        if (typeof window !== 'undefined' && window.localStorage) {
            return localStorage.getItem(USER_ID_STORAGE_KEY);
        }
        return null;
    }

    private getInitialBalance(): string {
        if (typeof window !== 'undefined' && window.localStorage) {
            return localStorage.getItem(BALANCE_STORAGE_KEY) || '$1,000.00';
        }
        return '$1,000.00';
    }

    /**
     * Initializes or verifies guest session.
     */
    initializeSession(): void {
        const existingToken = this.token();
        if (existingToken) {
            // Verify session by fetching portfolio balance
            this.refreshBalance();
            return;
        }

        this.provisionNewGuestSession();
    }

    provisionNewGuestSession(): void {
        this.isInitializing.set(true);
        this.apiService.createGuestSession().subscribe({
            next: (res) => {
                this.token.set(res.token);
                this.userId.set(res.user.id);
                const formattedBalance = this.formatBalance(res.user.cash_balance);
                this.cashBalance.set(formattedBalance);

                if (typeof window !== 'undefined' && window.localStorage) {
                    localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
                    localStorage.setItem(USER_ID_STORAGE_KEY, res.user.id);
                    localStorage.setItem(BALANCE_STORAGE_KEY, formattedBalance);
                }
                this.isInitializing.set(false);
            },
            error: (err) => {
                console.error('Failed to provision guest session:', err);
                this.isInitializing.set(false);
            }
        });
    }

    /**
     * Synchronizes balance with the backend.
     */
    refreshBalance(): void {
        const token = this.token();
        if (!token) return;

        this.apiService.getPortfolio(token).subscribe({
            next: (portfolio) => {
                const formatted = this.formatBalance(portfolio.cash_balance || portfolio.cash_balance_usdc || '0');
                this.updateBalance(formatted);
            },
            error: (err) => {
                // If token expired or invalid, re-provision
                if (err?.status === 401) {
                    this.provisionNewGuestSession();
                }
            }
        });
    }

    /**
     * Updates cash balance in state and localStorage.
     */
    updateBalance(formattedBalance: string): void {
        this.cashBalance.set(formattedBalance);
        if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(BALANCE_STORAGE_KEY, formattedBalance);
        }
    }

    /**
     * Claims testnet faucet funds.
     */
    claimFaucet(): void {
        const token = this.token();
        if (!token) {
            this.toastService.error('Session Error', 'Guest session not ready');
            return;
        }

        this.isClaimingFaucet.set(true);
        this.apiService.claimFaucet(token).subscribe({
            next: (res) => {
                const formatted = this.formatBalance(res.user.cash_balance);
                this.updateBalance(formatted);
                this.isClaimingFaucet.set(false);
                this.toastService.success('Faucet Claimed', `+$${res.amount} USDC credited to your guest balance`);
            },
            error: (err) => {
                this.isClaimingFaucet.set(false);
                const msg = err?.error?.message || 'Faucet cooldown in effect or request rate exceeded';
                this.toastService.warning('Faucet Cooldown', msg);
            }
        });
    }

    formatBalance(raw: string | number): string {
        const num = typeof raw === 'string' ? parseFloat(raw) : raw;
        if (isNaN(num)) return '$1,000.00';
        return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}
