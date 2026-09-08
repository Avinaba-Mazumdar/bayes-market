import { Component, inject, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucidePlus, LucideLogIn, LucideLogOut } from '@lucide/angular';
import { WebSocketService } from '../../services/websocket.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { BadgeComponent } from '../../../shared/components/badge/badge.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { AuthStore } from '../../../state/auth.store';

@Component({
    selector: 'app-top-header-dock',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, ButtonComponent, BadgeComponent, AvatarComponent, LucidePlus, LucideLogIn, LucideLogOut],
    template: `
        <header class="top-header-dock" role="banner">
            <div class="dock-container">
                <!-- Left: Brand Emblem & Navigation -->
                <div class="dock-left">
                    <a routerLink="/" class="brand-link" aria-label="BayesMarket Home">
                        <div class="brand-emblem" aria-hidden="true">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="#7c4dff" stroke-width="2.5" />
                                <path d="M7 12L10.5 15.5L17 9" stroke="#00d4ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </div>
                        <span class="brand-text">Bayes<span class="brand-highlight">Market</span></span>
                    </a>

                    <nav class="nav-links" role="navigation" aria-label="Primary Navigation">
                        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="nav-tab"> Markets </a>
                        <a routerLink="/portfolio" routerLinkActive="active" class="nav-tab"> Portfolio </a>
                    </nav>
                </div>

                <!-- Right: Balance, Faucet, Auth -->
                <div class="dock-right">
                    <!-- Guest Balance Badge (JetBrains Mono tabular figures) -->
                    <app-badge variant="outline" size="sm" class="balance-badge" aria-label="Current cash balance">
                        <span class="balance-label">USDC</span>
                        <span class="balance-amount tabular-nums">{{ userBalance() }}</span>
                    </app-badge>

                    <!-- Faucet Button -->
                    <app-button
                        variant="secondary"
                        size="default"
                        [loading]="isClaimingFaucet()"
                        ariaLabel="Claim testnet faucet USDC"
                        (btnClick)="onClaimFaucet()"
                    >
                        @if (isClaimingFaucet()) {
                            <span>Claiming...</span>
                        } @else {
                            <svg lucidePlus class="faucet-plus-icon" [size]="14" aria-hidden="true"></svg>
                            <span>Faucet</span>
                        }
                    </app-button>

                    <!-- Auth State & Sign In / Profile -->
                    @if (authStore.isGuest()) {
                        <app-button
                            variant="primary"
                            size="default"
                            class="guest-signin-btn"
                            ariaLabel="Guest session active. Click to sign in or connect account."
                            title="Guest Trader (Click to Sign In with Google)"
                            (btnClick)="authStore.openAuthModal()"
                        >
                            <span class="auth-btn-text">Sign In</span>
                            <svg lucideLogIn class="auth-icon" [size]="14" aria-hidden="true"></svg>
                        </app-button>
                    } @else {
                        <div class="user-profile-dock">
                            <button
                                type="button"
                                class="auth-action-btn user-logged-in-btn"
                                (click)="authStore.openAuthModal()"
                                [attr.aria-label]="'Trading as ' + authStore.userName() + '. Click for account details.'"
                                [title]="'Logged in as ' + authStore.userName()"
                            >
                                <app-avatar [src]="authStore.userAvatar() || ''" [alt]="authStore.userName()" size="sm" />
                                <span class="auth-user-name">{{ authStore.userName() }}</span>
                            </button>
                            <button
                                type="button"
                                class="signout-quick-btn"
                                (click)="authStore.logout()"
                                aria-label="Sign out and switch to guest"
                                title="Sign out"
                            >
                                <svg lucideLogOut [size]="14" aria-hidden="true"></svg>
                            </button>
                        </div>
                    }
                </div>
            </div>
        </header>
    `,
    styles: [
        `
            :host {
                display: block;
                position: sticky;
                top: 0;
                z-index: 1000;
            }
            .top-header-dock {
                height: 60px;
                background-color: var(--surface-glass, rgba(19, 17, 38, 0.88));
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border-bottom: 1px solid var(--hairline, #252140);
                display: flex;
                align-items: center;
                padding: 0 var(--space-lg, 20px);
            }
            .dock-container {
                width: 100%;
                max-width: 1560px;
                margin: 0 auto;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: var(--space-md, 16px);
            }
            .dock-left,
            .dock-right {
                display: flex;
                align-items: center;
                gap: var(--space-md, 16px);
            }
            .brand-link {
                display: flex;
                align-items: center;
                gap: 10px;
                text-decoration: none;
                min-height: var(--touch-target-min, 44px);
                min-width: var(--touch-target-min, 44px);
            }
            .brand-emblem {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                background-color: rgba(54, 0, 179, 0.16);
                border: 1px solid rgba(124, 77, 255, 0.35);
                border-radius: var(--radius-sm, 6px);
            }
            .brand-text {
                font-family: var(--font-ui);
                font-size: 18px;
                font-weight: 700;
                color: var(--ink, #f8f7ff);
                letter-spacing: -0.3px;
            }
            .brand-highlight {
                color: var(--primary-border, #7c4dff);
            }
            .nav-links {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-left: 12px;
            }
            .nav-tab {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: 38px;
                padding: 6px 14px;
                color: var(--ink-secondary, #9d97b8);
                font-family: var(--font-ui);
                font-size: 13.5px;
                font-weight: 600;
                text-decoration: none;
                border-radius: var(--radius-pill, 9999px);
                border: 1px solid transparent;
                transition:
                    background-color 0.15s ease,
                    border-color 0.15s ease,
                    color 0.15s ease;
            }
            .nav-tab:hover {
                background-color: var(--surface-card, #131126);
                color: var(--ink, #f8f7ff);
            }
            .nav-tab.active {
                background-color: var(--surface-card-elevated, #1a1733);
                color: #ffffff;
                border: 1px solid var(--hairline, #252140);
            }
            .balance-badge {
                display: inline-flex;
                align-items: center;
            }
            .balance-badge ::ng-deep .badge {
                gap: 8px;
                min-height: 38px;
                padding: 6px 14px;
                background-color: var(--surface-card, #131126);
                border: 1px solid var(--hairline, #252140);
                border-radius: var(--radius-pill, 9999px);
            }
            .balance-label {
                font-family: var(--font-ui);
                font-size: 11px;
                font-weight: 700;
                color: var(--accent, #00d4ff);
                letter-spacing: 0.5px;
            }
            .balance-amount {
                font-family: var(--font-mono);
                font-weight: 700;
                color: var(--ink, #f8f7ff);
                font-feature-settings: 'tnum' 1;
            }
            @media (max-width: 768px) {
                .balance-label {
                    display: none;
                }
                .dock-container {
                    gap: 8px;
                }
                .dock-left,
                .dock-right {
                    gap: 8px;
                }
                .brand-text {
                    font-size: 16px;
                }
            }

            .faucet-plus-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                margin-right: 4px;
            }

            /* Auth Styles */
            .guest-signin-btn {
                display: inline-flex;
                align-items: center;
            }

            .auth-action-btn {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                min-height: 38px;
                padding: 6px 14px;
                border-radius: var(--radius-pill, 9999px);
                font-family: var(--font-ui);
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition:
                    background-color 0.15s ease,
                    border-color 0.15s ease,
                    color 0.15s ease;
            }

            .user-profile-dock {
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .user-logged-in-btn {
                background-color: var(--surface-card, #131126);
                border: 1px solid var(--hairline, #252140);
                color: var(--ink, #f8f7ff);
                padding: 6px 12px;
            }

            .user-logged-in-btn:hover {
                background-color: var(--surface-card-elevated, #1a1733);
                border-color: var(--primary-border, #7c4dff);
            }

            .header-avatar {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                object-fit: cover;
                border: 1px solid var(--primary-border, #7c4dff);
            }

            .auth-user-name {
                max-width: 110px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .signout-quick-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 36px;
                min-height: 38px;
                padding: 6px 10px;
                background-color: transparent;
                border: 1px solid var(--hairline, #1e293b);
                border-radius: var(--radius-pill, 9999px);
                color: var(--muted, #94a3b8);
                cursor: pointer;
                transition:
                    background-color 0.15s ease,
                    color 0.15s ease;
            }

            .signout-quick-btn:hover {
                background-color: rgba(244, 63, 94, 0.12);
                border-color: rgba(244, 63, 94, 0.4);
                color: #fda4af;
            }
        `
    ]
})
export class TopHeaderDockComponent implements OnInit {
    readonly wsService = inject(WebSocketService);
    readonly authStore = inject(AuthStore);

    ngOnInit(): void {
        if (!this.wsService.isConnected() && this.wsService.connectionStatus() === 'disconnected') {
            this.wsService.connect();
        }
    }

    get userBalance() {
        return this.authStore.cashBalance;
    }

    get isClaimingFaucet() {
        return this.authStore.isClaimingFaucet;
    }

    onClaimFaucet(): void {
        this.authStore.claimFaucet();
    }
}
