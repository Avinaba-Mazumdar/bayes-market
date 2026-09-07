import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideUser, LucideCheck, LucideShieldCheck, LucideZap } from '@lucide/angular';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { AuthStore } from '../../state/auth.store';
import { ApiService } from '../../core/services/api.service';

@Component({
    selector: 'app-auth-dialog',
    standalone: true,
    imports: [CommonModule, DialogComponent, ButtonComponent, LucideUser, LucideCheck, LucideShieldCheck, LucideZap],
    template: `
        <app-dialog
            [open]="authStore.isAuthModalOpen()"
            (closed)="onClose()"
            [title]="authStore.isGuest() ? 'Sign In to BayesMarket' : 'Your Account'"
            [description]="
                authStore.isGuest()
                    ? 'Connect your Google account to preserve your predictions, portfolio balance, and track performance.'
                    : 'Manage your verified trading profile and preferences.'
            "
            size="default"
            role="dialog"
            ariaLabel="Authentication Dialog"
        >
            <div class="auth-dialog-content">
                @if (authStore.isGuest()) {
                    <!-- Guest Upgrade Callout -->
                    <div class="upgrade-banner" role="status">
                        <svg lucideShieldCheck class="banner-icon" [size]="20" aria-hidden="true"></svg>
                        <div class="banner-text">
                            <span class="banner-title">Guest Session Active</span>
                            <span class="banner-desc">
                                Upgrading to Google will preserve your active positions and {{ authStore.cashBalance() }} balance.
                            </span>
                        </div>
                    </div>

                    <!-- Main Google Sign-In Action -->
                    <div class="auth-card primary-auth">
                        <div class="auth-card-body">
                            <h3 class="auth-method-title">Sign in with Google</h3>
                            <p class="auth-method-desc">Seamless one-click authentication. Never lose your predictions or liquidity pool allocations.</p>

                            <button
                                type="button"
                                class="google-signin-btn"
                                (click)="initiateGoogleAuth()"
                                [disabled]="authStore.isAuthenticating() || isRedirecting()"
                                aria-label="Sign in with your Google account"
                            >
                                @if (authStore.isAuthenticating() || isRedirecting()) {
                                    <div class="spinner" aria-hidden="true"></div>
                                    <span>Connecting to Google...</span>
                                } @else {
                                    <svg class="google-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                                        <path
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            fill="#4285F4"
                                        />
                                        <path
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            fill="#34A853"
                                        />
                                        <path
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                                            fill="#FBBC05"
                                        />
                                        <path
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                                            fill="#EA4335"
                                        />
                                    </svg>
                                    <span class="btn-text">Continue with Google</span>
                                }
                            </button>
                        </div>
                    </div>

                    <!-- Development Quick Login (Available when simulated / local dev) -->
                    <div class="dev-quick-option">
                        <div class="divider">
                            <span class="divider-label">DEVELOPMENT & TESTING</span>
                        </div>
                        <div class="dev-box">
                            <div class="dev-info">
                                <svg lucideZap class="dev-icon" [size]="16" aria-hidden="true"></svg>
                                <span>Simulate Google Sign-In with mock developer credentials</span>
                            </div>
                            <app-button
                                variant="secondary"
                                size="sm"
                                [loading]="authStore.isAuthenticating()"
                                (btnClick)="onDevQuickLogin()"
                                ariaLabel="One-click simulate Google sign-in"
                            >
                                Quick Dev Sign-In
                            </app-button>
                        </div>
                    </div>

                    <div class="divider">
                        <span class="divider-label">OR</span>
                    </div>

                    <!-- Guest Session Details -->
                    <div class="auth-card guest-auth">
                        <div class="auth-card-body">
                            <div class="guest-info-row">
                                <div class="guest-details">
                                    <h4 class="guest-title">Continue as Anonymous Guest</h4>
                                    <p class="guest-desc">Instant access to prediction markets with $1,000 sandbox USDC. No email or registration required.</p>
                                </div>
                                <app-button variant="ghost" size="default" (btnClick)="continueAsGuest()" ariaLabel="Continue as guest trader">
                                    Stay as Guest
                                </app-button>
                            </div>
                        </div>
                    </div>
                } @else {
                    <!-- Authenticated Profile View -->
                    <div class="profile-card">
                        <div class="profile-header">
                            @if (authStore.userAvatar()) {
                                <img [src]="authStore.userAvatar()!" [alt]="authStore.userName()" class="user-avatar" referrerpolicy="no-referrer" />
                            } @else {
                                <div class="avatar-placeholder" aria-hidden="true">
                                    <svg lucideUser [size]="24"></svg>
                                </div>
                            }
                            <div class="profile-meta">
                                <h3 class="profile-name">{{ authStore.userName() }}</h3>
                                <p class="profile-email">{{ authStore.userEmail() || 'Google Authenticated User' }}</p>
                                <span class="provider-badge">
                                    <svg lucideCheck class="badge-icon" [size]="12" aria-hidden="true"></svg>
                                    Google Verified
                                </span>
                            </div>
                        </div>

                        <div class="profile-stats">
                            <div class="stat-item">
                                <span class="stat-label">Available Balance</span>
                                <span class="stat-val tabular-nums">{{ authStore.cashBalance() }}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Account Mode</span>
                                <span class="stat-val highlight">Persistent</span>
                            </div>
                        </div>

                        <div class="profile-actions">
                            <app-button variant="destructive" size="default" (btnClick)="onSignOut()" ariaLabel="Sign out of BayesMarket">
                                Sign Out
                            </app-button>
                        </div>
                    </div>
                }
            </div>
        </app-dialog>
    `,
    styles: [
        `
            .auth-dialog-content {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .upgrade-banner {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 12px 16px;
                background-color: rgba(56, 189, 248, 0.08);
                border: 1px solid rgba(56, 189, 248, 0.25);
                border-radius: var(--radius-md, 10px);
            }

            .banner-icon {
                color: #38bdf8;
                flex-shrink: 0;
                margin-top: 2px;
            }

            .banner-text {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .banner-title {
                font-family: var(--font-ui);
                font-size: 13px;
                font-weight: 700;
                color: #38bdf8;
            }

            .banner-desc {
                font-family: var(--font-ui);
                font-size: 12px;
                color: var(--ink-secondary, #cbd5e1);
                line-height: 1.4;
            }

            .auth-card {
                background-color: var(--canvas-subtle, #0c1017);
                border: 1px solid var(--border-subtle, #1e2638);
                border-radius: var(--radius-lg, 14px);
                overflow: hidden;
            }

            .auth-card.primary-auth {
                border-color: rgba(232, 64, 137, 0.3);
                background: linear-gradient(180deg, rgba(23, 31, 48, 0.6) 0%, rgba(12, 16, 23, 0.9) 100%);
            }

            .auth-card-body {
                padding: 18px 20px;
                display: flex;
                flex-direction: column;
                gap: 14px;
            }

            .auth-method-title {
                margin: 0;
                font-family: var(--font-ui);
                font-size: 16px;
                font-weight: 700;
                color: var(--ink, #f8fafc);
            }

            .auth-method-desc {
                margin: 0;
                font-family: var(--font-ui);
                font-size: 13px;
                line-height: 1.45;
                color: var(--body, #a2b4c9);
            }

            .google-signin-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                width: 100%;
                min-height: var(--touch-target-min, 44px);
                padding: 10px 16px;
                background-color: #ffffff;
                color: #1f2937;
                border: 1px solid #d1d5db;
                border-radius: var(--radius-md, 10px);
                font-family: var(--font-ui);
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
                transition:
                    background-color 0.15s ease,
                    box-shadow 0.15s ease,
                    transform 0.05s ease;
            }

            .google-signin-btn:hover:not(:disabled) {
                background-color: #f3f4f6;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
            }

            .google-signin-btn:active:not(:disabled) {
                transform: translateY(1px);
            }

            .google-signin-btn:focus-visible {
                outline: 2px solid var(--primary-border, #e84089);
                outline-offset: 2px;
            }

            .google-signin-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .google-icon {
                flex-shrink: 0;
            }

            .divider {
                display: flex;
                align-items: center;
                text-align: center;
                margin: 4px 0;
            }

            .divider::before,
            .divider::after {
                content: '';
                flex: 1;
                border-bottom: 1px solid var(--hairline, #1e2638);
            }

            .divider-label {
                padding: 0 12px;
                font-family: var(--font-mono);
                font-size: 10px;
                font-weight: 700;
                color: var(--muted, #64748b);
                letter-spacing: 0.8px;
            }

            .dev-quick-option {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .dev-box {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 10px 14px;
                background-color: rgba(245, 158, 11, 0.06);
                border: 1px dashed rgba(245, 158, 11, 0.3);
                border-radius: var(--radius-md, 10px);
            }

            .dev-info {
                display: flex;
                align-items: center;
                gap: 8px;
                font-family: var(--font-ui);
                font-size: 12px;
                color: #fcd34d;
            }

            .dev-icon {
                flex-shrink: 0;
                color: #f59e0b;
            }

            .guest-info-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
            }

            .guest-details {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .guest-title {
                margin: 0;
                font-family: var(--font-ui);
                font-size: 14px;
                font-weight: 600;
                color: var(--ink, #f8fafc);
            }

            .guest-desc {
                margin: 0;
                font-family: var(--font-ui);
                font-size: 12px;
                color: var(--muted, #a2b4c9);
                line-height: 1.4;
            }

            /* Profile Card Styles */
            .profile-card {
                display: flex;
                flex-direction: column;
                gap: 20px;
                padding: 16px;
                background-color: var(--canvas-subtle, #0c1017);
                border: 1px solid var(--border-subtle, #1e2638);
                border-radius: var(--radius-lg, 14px);
            }

            .profile-header {
                display: flex;
                align-items: center;
                gap: 16px;
            }

            .user-avatar {
                width: 52px;
                height: 52px;
                border-radius: 50%;
                border: 2px solid var(--primary-border, #e84089);
                object-fit: cover;
            }

            .avatar-placeholder {
                width: 52px;
                height: 52px;
                border-radius: 50%;
                background-color: rgba(166, 3, 76, 0.2);
                border: 2px solid var(--primary-border, #e84089);
                display: flex;
                align-items: center;
                justify-content: center;
                color: #ffffff;
            }

            .profile-meta {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .profile-name {
                margin: 0;
                font-family: var(--font-ui);
                font-size: 16px;
                font-weight: 700;
                color: var(--ink, #f8fafc);
            }

            .profile-email {
                margin: 0;
                font-family: var(--font-mono);
                font-size: 12px;
                color: var(--ink-secondary, #cbd5e1);
            }

            .provider-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-family: var(--font-mono);
                font-size: 11px;
                font-weight: 600;
                color: #34d399;
                background-color: rgba(52, 211, 153, 0.1);
                padding: 2px 8px;
                border-radius: 9999px;
                width: fit-content;
                margin-top: 2px;
            }

            .profile-stats {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                padding: 12px;
                background-color: var(--surface-card, #111622);
                border: 1px solid var(--hairline, #1e2638);
                border-radius: var(--radius-md, 10px);
            }

            .stat-item {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .stat-label {
                font-family: var(--font-ui);
                font-size: 11px;
                color: var(--muted, #64748b);
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .stat-val {
                font-family: var(--font-mono);
                font-size: 15px;
                font-weight: 700;
                color: var(--ink, #f8fafc);
            }

            .stat-val.highlight {
                color: #38bdf8;
            }

            .profile-actions {
                display: flex;
                justify-content: flex-end;
            }

            .spinner {
                width: 16px;
                height: 16px;
                border: 2px solid rgba(31, 41, 55, 0.2);
                border-top-color: #1f2937;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }

            @keyframes spin {
                to {
                    transform: rotate(360deg);
                }
            }

            @media (max-width: 640px) {
                .guest-info-row {
                    flex-direction: column;
                    align-items: flex-start;
                }
                .dev-box {
                    flex-direction: column;
                    align-items: flex-start;
                }
            }
        `
    ]
})
export class AuthDialogComponent {
    readonly authStore = inject(AuthStore);
    private readonly apiService = inject(ApiService);

    readonly isRedirecting = signal<boolean>(false);

    onClose(): void {
        this.authStore.closeAuthModal();
    }

    continueAsGuest(): void {
        this.authStore.closeAuthModal();
    }

    onDevQuickLogin(): void {
        this.authStore.loginWithGoogle('dev-mock-id-token-12345', 'trader@bayesmarket.com', 'Alex Mercer (Trader)');
    }

    initiateGoogleAuth(): void {
        this.isRedirecting.set(true);

        // Fetch the Google OAuth authorization URL from backend
        this.apiService.getGoogleAuthUrl().subscribe({
            next: (res) => {
                this.isRedirecting.set(false);
                if (res.simulated || !res.url) {
                    // Backend is running in simulated / dev mode without client ID
                    this.onDevQuickLogin();
                } else {
                    // Real Google OAuth redirect flow
                    window.location.href = res.url;
                }
            },
            error: () => {
                this.isRedirecting.set(false);
                // Fallback to dev quick login if error or offline
                this.onDevQuickLogin();
            }
        });
    }

    onSignOut(): void {
        this.authStore.logout();
        this.authStore.closeAuthModal();
    }
}
