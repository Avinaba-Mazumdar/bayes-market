import { Component, inject, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucidePlay, LucidePause, LucidePlus, LucideLogIn, LucideLogOut, LucideUser } from '@lucide/angular';
import { WebSocketService } from '../../services/websocket.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { AuthStore } from '../../../state/auth.store';

@Component({
    selector: 'app-top-header-dock',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, ButtonComponent, LucidePlay, LucidePause, LucidePlus, LucideLogIn, LucideLogOut, LucideUser],
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

                <!-- Right: Telemetry, Stream Control, Balance, Faucet -->
                <div class="dock-right">
                    <!-- Live Telemetry Status Pulse -->
                    <div
                        class="telemetry-pill"
                        [attr.aria-label]="'Live connection status: ' + wsService.connectionStatus()"
                        [title]="'WebSocket: ' + wsService.connectionStatus()"
                    >
                        <span
                            class="status-dot"
                            [class.connected]="wsService.isConnected()"
                            [class.reconnecting]="wsService.connectionStatus() === 'reconnecting'"
                            aria-hidden="true"
                        ></span>
                        <span class="status-label">
                            @if (wsService.isConnected()) {
                                LIVE
                            } @else if (wsService.connectionStatus() === 'reconnecting') {
                                RECONNECTING
                            } @else {
                                OFFLINE
                            }
                        </span>
                    </div>

                    <!-- WCAG 2.2 SC 2.2.4 Stream Pause / Mute Toggle -->
                    <button
                        type="button"
                        (click)="toggleStreamPause()"
                        class="stream-toggle-btn"
                        [class.paused]="wsService.isPaused()"
                        [attr.aria-pressed]="wsService.isPaused()"
                        [attr.aria-label]="wsService.isPaused() ? 'Resume live ticker stream' : 'Pause live ticker stream'"
                        [title]="wsService.isPaused() ? 'Stream Paused (SC 2.2.4)' : 'Stream Active (SC 2.2.4)'"
                    >
                        @if (wsService.isPaused()) {
                            <svg lucidePlay class="toggle-icon" [size]="14" aria-hidden="true"></svg>
                            <span class="toggle-text">Resume</span>
                        } @else {
                            <svg lucidePause class="toggle-icon" [size]="14" aria-hidden="true"></svg>
                            <span class="toggle-text">Pause</span>
                        }
                    </button>

                    <!-- Guest Balance Pill (JetBrains Mono tabular figures) -->
                    <div class="balance-pill" aria-label="Current cash balance">
                        <span class="balance-label">USDC</span>
                        <span class="balance-amount tabular-nums">\${{ userBalance() }}</span>
                    </div>

                    <!-- Faucet Button -->
                    <app-button variant="faucet" size="pill" [loading]="isClaimingFaucet()" ariaLabel="Claim testnet faucet USDC" (btnClick)="onClaimFaucet()">
                        @if (isClaimingFaucet()) {
                            <span>Claiming...</span>
                        } @else {
                            <svg lucidePlus class="faucet-plus-icon" [size]="14" aria-hidden="true"></svg>
                            <span>Faucet</span>
                        }
                    </app-button>

                    <!-- Auth State & Sign In / Profile -->
                    @if (authStore.isGuest()) {
                        <button
                            type="button"
                            class="auth-action-btn guest-badge-btn"
                            (click)="authStore.openAuthModal()"
                            aria-label="Guest session active. Click to sign in or connect account."
                            title="Guest Trader (Click to Sign In with Google)"
                        >
                            <span class="guest-indicator-dot" aria-hidden="true"></span>
                            <span class="auth-btn-text">Sign In</span>
                            <svg lucideLogIn class="auth-icon" [size]="14" aria-hidden="true"></svg>
                        </button>
                    } @else {
                        <div class="user-profile-dock">
                            <button
                                type="button"
                                class="auth-action-btn user-logged-in-btn"
                                (click)="authStore.openAuthModal()"
                                [attr.aria-label]="'Trading as ' + authStore.userName() + '. Click for account details.'"
                                [title]="'Logged in as ' + authStore.userName()"
                            >
                                @if (authStore.userAvatar()) {
                                    <img [src]="authStore.userAvatar()!" [alt]="authStore.userName()" class="header-avatar" referrerpolicy="no-referrer" />
                                } @else {
                                    <svg lucideUser class="auth-icon" [size]="14" aria-hidden="true"></svg>
                                }
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
            .telemetry-pill {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 6px 12px;
                background-color: var(--canvas-subtle, #0c1017);
                border: 1px solid var(--hairline, #1e2638);
                border-radius: var(--radius-pill, 9999px);
                min-height: 36px;
            }
            .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background-color: #64748b;
            }
            .status-dot.connected {
                background-color: #10b981;
                box-shadow: 0 0 8px #10b981;
            }
            .status-dot.reconnecting {
                background-color: #f59e0b;
                box-shadow: 0 0 8px #f59e0b;
                animation: pulse 1.5s infinite;
            }
            .status-label {
                font-family: var(--font-mono);
                font-size: 10px;
                font-weight: 700;
                color: var(--ink-secondary, #cbd5e1);
                letter-spacing: 0.5px;
            }
            .stream-toggle-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                min-height: var(--touch-target-min, 44px);
                min-width: var(--touch-target-min, 44px);
                padding: 8px 12px;
                background-color: var(--canvas-subtle, #0c1017);
                color: var(--ink-secondary, #cbd5e1);
                border: 1px solid var(--border-strong, #606e85);
                border-radius: var(--radius-md, 10px);
                font-family: var(--font-ui);
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                user-select: none;
                transition:
                    background-color 0.15s ease,
                    border-color 0.15s ease;
            }
            .stream-toggle-btn:hover {
                background-color: var(--surface-card-elevated, #1a1733);
                color: var(--ink, #f8f7ff);
                border-color: var(--primary-border, #7c4dff);
            }
            .stream-toggle-btn.paused {
                background-color: rgba(245, 158, 11, 0.15);
                border-color: #f59e0b;
                color: #fcd34d;
            }
            .balance-pill {
                display: inline-flex;
                align-items: center;
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
                font-size: 14px;
                font-weight: 700;
                color: var(--ink, #f8f7ff);
                font-feature-settings: 'tnum' 1;
            }
            @keyframes pulse {
                0%,
                100% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.4;
                }
            }
            @media (max-width: 768px) {
                .toggle-text,
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

            .toggle-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }

            .faucet-plus-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                margin-right: 4px;
            }

            /* Auth Styles */
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

            .guest-badge-btn {
                background-color: rgba(54, 0, 179, 0.14);
                border: 1px solid rgba(124, 77, 255, 0.35);
                color: #b388ff;
            }

            .guest-badge-btn:hover {
                background-color: rgba(54, 0, 179, 0.25);
                border-color: #7c4dff;
                color: #ffffff;
            }

            .guest-indicator-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background-color: #7c4dff;
                box-shadow: 0 0 6px rgba(124, 77, 255, 0.6);
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

    toggleStreamPause(): void {
        this.wsService.togglePause();
    }

    onClaimFaucet(): void {
        this.authStore.claimFaucet();
    }
}
