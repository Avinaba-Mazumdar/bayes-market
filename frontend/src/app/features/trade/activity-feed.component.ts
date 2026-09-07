import { Component, computed, inject, input } from '@angular/core';
import { LucideZap, LucideArrowUp, LucideArrowDown } from '@lucide/angular';
import { WebSocketService } from '../../core/services/websocket.service';
import { TradeEvent } from '../../core/models/websocket.model';

@Component({
    selector: 'app-activity-feed',
    standalone: true,
    imports: [LucideZap, LucideArrowUp, LucideArrowDown],
    template: `
        <div class="activity-feed-card" role="region" aria-label="Live Market Trades Feed">
            <div class="feed-header">
                <div class="header-title-group">
                    <span class="live-indicator" aria-hidden="true"></span>
                    <h4 class="feed-title">Live Trade Activity</h4>
                </div>
                <span class="feed-count tabular-nums"> {{ filteredTrades().length }} recent </span>
            </div>

            <div class="trades-scroll-container" role="feed" aria-busy="false">
                @if (filteredTrades().length === 0) {
                    <div class="empty-trades">
                        <svg lucideZap class="empty-icon" [size]="24" aria-hidden="true"></svg>
                        <p class="empty-text">Listening for live trades on this market...</p>
                        <span class="empty-hint">Orders placed will appear here instantaneously via WebSockets</span>
                    </div>
                } @else {
                    <div class="trades-list">
                        @for (trade of filteredTrades(); track trade.trade_id || trade.timestamp) {
                            <article class="trade-item" tabindex="0">
                                <div class="trade-main">
                                    <span class="trade-badge" [class.trade-yes]="trade.outcome === 'YES'" [class.trade-no]="trade.outcome === 'NO'">
                                        @if (trade.outcome === 'YES') {
                                            <svg lucideArrowUp class="trade-badge-icon" [size]="12" aria-hidden="true"></svg>
                                            YES
                                        } @else {
                                            <svg lucideArrowDown class="trade-badge-icon" [size]="12" aria-hidden="true"></svg>
                                            NO
                                        }
                                    </span>
                                    <span class="trade-amount tabular-nums"> {{ formatShares(trade.shares) }} shares </span>
                                </div>
                                <div class="trade-details">
                                    <span class="trade-price tabular-nums"> at {{ '$' + formatPrice(trade.price) }} </span>
                                    <span class="trade-time tabular-nums">
                                        {{ formatTime(trade.timestamp) }}
                                    </span>
                                </div>
                            </article>
                        }
                    </div>
                }
            </div>
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
                width: 100%;
            }

            .activity-feed-card {
                background-color: var(--surface-card, #111622);
                border: 1px solid var(--hairline, #1e2638);
                border-radius: var(--radius-xl, 20px);
                padding: 18px 20px;
                display: flex;
                flex-direction: column;
                gap: 14px;
            }

            .feed-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid var(--hairline, #1e2638);
                padding-bottom: 12px;
            }

            .header-title-group {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .live-indicator {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background-color: #10b981;
                box-shadow: 0 0 8px #10b981;
                animation: pulseLive 2s infinite;
            }

            @keyframes pulseLive {
                0%,
                100% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.4;
                }
            }

            .feed-title {
                margin: 0;
                font-family: var(--font-ui);
                font-size: 15px;
                font-weight: 700;
                color: var(--ink, #f8fafc);
            }

            .feed-count {
                font-family: var(--font-mono);
                font-size: 12px;
                color: var(--muted, #a2b4c9);
            }

            .trades-scroll-container {
                max-height: 280px;
                overflow-y: auto;
            }

            .trades-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .trade-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 12px;
                background-color: var(--canvas-subtle, #0c1017);
                border: 1px solid var(--hairline, #1e2638);
                border-radius: var(--radius-md, 10px);
                font-size: 13px;
                transition: border-color 0.15s ease;
            }

            .trade-item:hover,
            .trade-item:focus-visible {
                border-color: var(--border-strong, #606e85);
                outline: none;
            }

            .trade-main {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .trade-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-family: var(--font-mono);
                font-size: 11px;
                font-weight: 700;
                padding: 2px 8px;
                border-radius: var(--radius-sm, 6px);
            }

            .trade-badge-icon {
                flex-shrink: 0;
            }

            .trade-yes {
                background-color: rgba(16, 185, 129, 0.15);
                color: var(--outcome-yes-text, #34d399);
                border: 1px solid rgba(16, 185, 129, 0.3);
            }

            .trade-no {
                background-color: rgba(251, 113, 133, 0.15);
                color: var(--outcome-no-text, #fda4af);
                border: 1px solid rgba(251, 113, 133, 0.3);
            }

            .trade-amount {
                font-family: var(--font-mono);
                font-weight: 600;
                color: var(--ink, #f8fafc);
                font-feature-settings: 'tnum' 1;
            }

            .trade-details {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .trade-price {
                font-family: var(--font-mono);
                color: var(--ink-secondary, #cbd5e1);
                font-feature-settings: 'tnum' 1;
            }

            .trade-time {
                font-family: var(--font-ui);
                font-size: 11px;
                color: var(--muted, #a2b4c9);
            }

            .empty-trades {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 28px 16px;
                text-align: center;
                gap: 6px;
            }

            .empty-icon {
                color: var(--status-warning, #fcd34d);
                flex-shrink: 0;
                margin-bottom: 2px;
            }

            .empty-text {
                font-family: var(--font-ui);
                font-size: 13.5px;
                color: var(--ink-secondary, #cbd5e1);
                margin: 0;
            }

            .empty-hint {
                font-family: var(--font-ui);
                font-size: 11.5px;
                color: var(--muted, #a2b4c9);
            }
        `
    ]
})
export class ActivityFeedComponent {
    readonly marketId = input<string>('');
    private readonly wsService = inject(WebSocketService);

    protected readonly filteredTrades = computed(() => {
        const id = this.marketId();
        const trades = this.wsService.recentTrades();
        if (!id) return trades.slice(0, 15);
        return trades.filter((t) => !t.market_id || t.market_id === id).slice(0, 15);
    });

    formatShares(raw: string): string {
        const n = parseFloat(raw);
        return isNaN(n) ? '0.00' : n.toFixed(2);
    }

    formatPrice(raw: string): string {
        const n = parseFloat(raw);
        return isNaN(n) ? '0.000' : n.toFixed(4);
    }

    formatTime(raw: string): string {
        if (!raw) return 'just now';
        const d = new Date(raw);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
}
