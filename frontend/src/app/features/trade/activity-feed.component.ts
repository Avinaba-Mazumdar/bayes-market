import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LucideZap, LucideArrowUp, LucideArrowDown } from '@lucide/angular';
import { WebSocketService } from '../../core/services/websocket.service';
import { TradeEvent } from '../../core/models/websocket.model';
import { formatShares, formatPrice, formatTimestamp } from '../../core/utils/formatters';

import { BadgeComponent } from '../../shared/components/badge/badge.component';

@Component({
    selector: 'app-activity-feed',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BadgeComponent, LucideZap, LucideArrowUp, LucideArrowDown],
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
                                    <app-badge [variant]="trade.outcome === 'YES' ? 'profit' : 'loss'" size="sm">
                                        @if (trade.outcome === 'YES') {
                                            <svg lucideArrowUp class="trade-badge-icon" [size]="12" aria-hidden="true"></svg>
                                            YES
                                        } @else {
                                            <svg lucideArrowDown class="trade-badge-icon" [size]="12" aria-hidden="true"></svg>
                                            NO
                                        }
                                    </app-badge>
                                    <span class="trade-amount tabular-nums"> {{ trade.formattedShares }} shares </span>
                                </div>
                                <div class="trade-details">
                                    <span class="trade-price tabular-nums"> at {{ '$' + trade.formattedPrice }} </span>
                                    <span class="trade-time tabular-nums">
                                        {{ trade.formattedTime }}
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
                contain: layout style paint;
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
                background-color: var(--outcome-yes, #065f46);
                box-shadow: 0 0 8px var(--outcome-yes-glow, rgba(6, 95, 70, 0.4));
                will-change: opacity;
                animation: pulseLive 2.5s ease-in-out infinite;
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
                font-family: var(--font-ui);
                font-size: 15px;
                font-weight: 700;
                color: var(--ink, #f8fafc);
                margin: 0;
            }

            .feed-count {
                font-family: var(--font-mono);
                font-size: 11.5px;
                font-weight: 600;
                color: var(--muted, #a2b4c9);
            }

            .trades-scroll-container {
                max-height: 380px;
                overflow-y: auto;
                overscroll-behavior: contain;
                contain: layout style;
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
                background-color: var(--canvas-subtle, #0a0d14);
                border: 1px solid var(--hairline, #1e2638);
                border-radius: var(--radius-md, 10px);
                font-size: 13px;
                transition: background-color 0.12s ease;
            }

            .trade-item:hover,
            .trade-item:focus-visible {
                background-color: var(--surface-card, #111622);
                border-color: var(--primary-border, #3b82f6);
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
                padding: 3px 7px;
                border-radius: var(--radius-sm, 6px);
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.5px;
            }

            .trade-badge-icon {
                flex-shrink: 0;
            }

            .trade-yes {
                background-color: var(--outcome-yes-subtle, rgba(6, 95, 70, 0.09));
                color: var(--outcome-yes-text, #065f46);
                border: 1px solid var(--outcome-yes-border, rgba(6, 95, 70, 0.35));
            }

            .trade-no {
                background-color: var(--outcome-no-subtle, rgba(159, 18, 57, 0.09));
                color: var(--outcome-no-text, #9f1239);
                border: 1px solid var(--outcome-no-border, rgba(159, 18, 57, 0.35));
            }

            .trade-amount {
                font-family: var(--font-mono);
                font-weight: 600;
                color: var(--ink, #f8fafc);
            }

            .trade-details {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .trade-price {
                font-family: var(--font-mono);
                color: var(--muted, #a2b4c9);
                font-size: 12px;
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
        const list = !id ? trades.slice(0, 15) : trades.filter((t) => !t.market_id || t.market_id === id).slice(0, 15);
        return list.map((t) => ({
            ...t,
            formattedShares: formatShares(t.shares),
            formattedPrice: formatPrice(t.price, 4).replace('$', ''),
            formattedTime: formatTimestamp(t.timestamp)
        }));
    });
}
