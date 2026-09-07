import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { WebSocketService } from '../../services/websocket.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';

@Component({
    selector: 'app-top-header-dock',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, ButtonComponent],
    template: `
        <header class="top-header-dock" role="banner">
            <div class="dock-container">
                <!-- Left: Brand Emblem & Navigation -->
                <div class="dock-left">
                    <a routerLink="/" class="brand-link" aria-label="BayesMarket Home">
                        <div class="brand-emblem" aria-hidden="true">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#a6034c" />
                                <path d="M2 17L12 22L22 17" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" />
                                <path d="M2 12L12 17L22 12" stroke="#34d399" stroke-width="2" stroke-linecap="round" />
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
                        <span class="toggle-icon" aria-hidden="true">
                            {{ wsService.isPaused() ? '▶' : '⏸' }}
                        </span>
                        <span class="toggle-text">
                            {{ wsService.isPaused() ? 'Resume' : 'Pause' }}
                        </span>
                    </button>

                    <!-- Guest Balance Pill (JetBrains Mono tabular figures) -->
                    <div class="balance-pill" aria-label="Current cash balance">
                        <span class="balance-label">USDC</span>
                        <span class="balance-amount tabular-nums">{{ userBalance() }}</span>
                    </div>

                    <!-- Faucet Button -->
                    <app-button variant="faucet" size="pill" [loading]="isClaimingFaucet()" ariaLabel="Claim testnet faucet USDC" (btnClick)="onClaimFaucet()">
                        @if (isClaimingFaucet()) {
                            <span>Claiming...</span>
                        } @else {
                            <span class="faucet-plus" aria-hidden="true">+</span>
                            <span>Faucet</span>
                        }
                    </app-button>
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
                height: 64px;
                background-color: var(--surface-glass, rgba(17, 22, 34, 0.88));
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border-bottom: 1px solid var(--hairline, #1e2638);
                display: flex;
                align-items: center;
                padding: 0 var(--space-lg, 20px);
            }
            .dock-container {
                width: 100%;
                max-width: 1600px;
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
                background-color: rgba(166, 3, 76, 0.15);
                border: 1px solid var(--primary-border, #e84089);
                border-radius: var(--radius-sm, 6px);
            }
            .brand-text {
                font-family: var(--font-ui);
                font-size: 18px;
                font-weight: 700;
                color: var(--ink, #f8fafc);
                letter-spacing: -0.3px;
            }
            .brand-highlight {
                color: var(--primary-border, #e84089);
            }
            .nav-links {
                display: flex;
                align-items: center;
                gap: 4px;
                margin-left: 8px;
            }
            .nav-tab {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: var(--touch-target-min, 44px);
                min-width: var(--touch-target-min, 44px);
                padding: 8px 16px;
                color: var(--ink-secondary, #cbd5e1);
                font-family: var(--font-ui);
                font-size: 14px;
                font-weight: 600;
                text-decoration: none;
                border-radius: var(--radius-md, 10px);
                transition:
                    background-color 0.15s ease,
                    color 0.15s ease;
            }
            .nav-tab:hover {
                background-color: var(--surface-card-elevated, #171f30);
                color: var(--ink, #f8fafc);
            }
            .nav-tab.active {
                background-color: rgba(166, 3, 76, 0.18);
                color: #ffffff;
                border: 1px solid rgba(232, 64, 137, 0.4);
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
                background-color: var(--surface-card-elevated, #171f30);
                color: var(--ink, #f8fafc);
                border-color: var(--primary-border, #e84089);
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
                min-height: var(--touch-target-min, 44px);
                padding: 8px 14px;
                background-color: var(--surface-card, #111622);
                border: 1px solid var(--border-strong, #606e85);
                border-radius: var(--radius-md, 10px);
            }
            .balance-label {
                font-family: var(--font-ui);
                font-size: 11px;
                font-weight: 700;
                color: var(--body, #a2b4c9);
                letter-spacing: 0.5px;
            }
            .balance-amount {
                font-family: var(--font-mono);
                font-size: 14px;
                font-weight: 700;
                color: var(--ink, #f8fafc);
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

            .faucet-plus {
                font-size: 15px;
                font-weight: 700;
                margin-right: 2px;
            }
        `
    ]
})
export class TopHeaderDockComponent {
    readonly wsService = inject(WebSocketService);

    readonly userBalance = signal<string>('$1,000.00');
    readonly isClaimingFaucet = signal<boolean>(false);

    toggleStreamPause(): void {
        this.wsService.togglePause();
    }

    onClaimFaucet(): void {
        this.isClaimingFaucet.set(true);
        // Simulate faucet claim interaction (in Phase 8/9 connected to API)
        setTimeout(() => {
            this.userBalance.set('$1,500.00');
            this.isClaimingFaucet.set(false);
        }, 600);
    }
}
