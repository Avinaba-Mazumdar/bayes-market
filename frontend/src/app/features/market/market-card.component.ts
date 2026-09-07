import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowUp, LucideArrowDown, LucideArrowRight } from '@lucide/angular';
import { Market } from '../../core/models/market.model';
import { BadgeComponent } from '../../shared/components/badge/badge.component';

@Component({
    selector: 'app-market-card',
    standalone: true,
    imports: [RouterLink, BadgeComponent, LucideArrowUp, LucideArrowDown, LucideArrowRight],
    template: `
        <article class="market-card" [attr.aria-label]="cardAriaLabel()">
            <a [routerLink]="['/markets', market().id]" class="market-card-link">
                <!-- Header Meta: Category Badge & Status -->
                <div class="card-meta-row">
                    @if (market().status === 'resolved') {
                        <app-badge variant="secondary" size="sm"> RESOLVED: {{ market().winning_outcome || 'SETTLED' }} </app-badge>
                    } @else {
                        <app-badge variant="outline" size="sm">
                            {{ market().category.toUpperCase() }}
                        </app-badge>
                    }
                    <span class="meta-date">
                        {{ market().status === 'resolved' ? 'Settled' : 'Resolves ' + formattedDate() }}
                    </span>
                </div>

                <!-- Market Title -->
                <h3 class="market-title">
                    {{ market().title }}
                </h3>

                <!-- Probability Split Bar (Visualizing Consensus Curve) -->
                <div
                    class="split-bar-container"
                    role="meter"
                    aria-label="Implied probability meter"
                    [attr.aria-valuenow]="yesPct()"
                    aria-valuemin="0"
                    aria-valuemax="100"
                >
                    <div class="split-track">
                        <div class="split-fill-yes" [style.width.%]="yesPct()" [title]="'YES: ' + yesPct() + '%'"></div>
                        <div class="split-fill-no" [style.width.%]="noPct()" [title]="'NO: ' + noPct() + '%'"></div>
                    </div>
                </div>

                <!-- Dual Outcome Probability Pills (Dual-Coded Level AAA) -->
                <div class="pills-row">
                    <div class="pill-badge pill-yes" [attr.aria-label]="'YES implied price: ' + yesPriceCents() + ' cents'">
                        <svg lucideArrowUp class="pill-glyph" [size]="14" aria-hidden="true"></svg>
                        <span class="pill-price tabular-nums">{{ yesPriceCents() }}¢</span>
                        <span class="pill-label">YES</span>
                    </div>

                    <div class="pill-badge pill-no" [attr.aria-label]="'NO implied price: ' + noPriceCents() + ' cents'">
                        <svg lucideArrowDown class="pill-glyph" [size]="14" aria-hidden="true"></svg>
                        <span class="pill-price tabular-nums">{{ noPriceCents() }}¢</span>
                        <span class="pill-label">NO</span>
                    </div>
                </div>

                <!-- Footer: Volume & Action Hint -->
                <div class="card-footer">
                    <span class="volume-stat">
                        Vol: <strong class="tabular-nums">{{ '$' + formattedVolume() }}</strong>
                    </span>
                    <span class="trade-cta-hint" aria-hidden="true">
                        <span>Trade</span>
                        <svg lucideArrowRight [size]="14" aria-hidden="true"></svg>
                    </span>
                </div>
            </a>
        </article>
    `,
    styles: [
        `
            :host {
                display: block;
                height: 100%;
            }

            .market-card {
                background-color: var(--surface-card, #111622);
                border: 1px solid var(--hairline, #1e2638);
                border-radius: var(--radius-xl, 20px);
                transition:
                    transform 0.15s ease,
                    border-color 0.15s ease,
                    box-shadow 0.15s ease;
                height: 100%;
                display: flex;
                flex-direction: column;
                position: relative;
            }

            .market-card:hover {
                transform: translateY(-2px);
                border-color: var(--primary-border, #e84089);
                box-shadow: var(--shadow-md);
            }

            .market-card-link {
                display: flex;
                flex-direction: column;
                height: 100%;
                padding: 18px 20px;
                text-decoration: none;
                color: inherit;
                border-radius: var(--radius-xl, 20px);
                outline: none;
            }

            .market-card-link:focus-visible {
                outline: 2px solid var(--focus-outline, #e84089);
                outline-offset: 2px;
            }

            .card-meta-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin-bottom: 12px;
            }

            .meta-date {
                font-family: var(--font-ui);
                font-size: 11.5px;
                color: var(--muted, #a2b4c9);
            }

            .market-title {
                font-family: var(--font-ui);
                font-size: 16px;
                font-weight: 700;
                color: var(--ink, #f8fafc);
                line-height: 1.4;
                margin-bottom: 16px;
                flex: 1;
                display: -webkit-box;
                -webkit-line-clamp: 3;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            .split-bar-container {
                margin-bottom: 14px;
            }

            .split-track {
                width: 100%;
                height: 7px;
                border-radius: var(--radius-pill, 9999px);
                display: flex;
                overflow: hidden;
                background-color: var(--canvas-subtle, #0c1017);
                border: 1px solid var(--hairline, #1e2638);
            }

            .split-fill-yes {
                background-color: var(--outcome-yes, #10b981);
                transition: width 0.3s ease;
            }

            .split-fill-no {
                background-color: var(--outcome-no, #fb7185);
                transition: width 0.3s ease;
            }

            .pills-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 14px;
            }

            .pill-badge {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                padding: 8px 12px;
                border-radius: var(--radius-md, 10px);
                font-family: var(--font-mono);
                font-weight: 700;
                font-size: 13px;
                min-height: var(--touch-target-min, 44px);
                user-select: none;
            }

            .pill-yes {
                background-color: rgba(16, 185, 129, 0.15);
                border: 1px solid var(--outcome-yes-border, #10b981);
                color: var(--outcome-yes-text, #34d399);
            }

            .pill-no {
                background-color: rgba(251, 113, 133, 0.15);
                border: 1px solid var(--outcome-no-border, #fb7185);
                color: var(--outcome-no-text, #fda4af);
            }

            .pill-glyph {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }

            .pill-price {
                font-size: 14px;
                font-feature-settings: 'tnum' 1;
            }

            .pill-label {
                font-family: var(--font-ui);
                font-size: 11px;
                opacity: 0.9;
            }

            .card-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-top: 1px solid var(--hairline, #1e2638);
                padding-top: 10px;
                font-size: 12px;
            }

            .volume-stat {
                font-family: var(--font-ui);
                color: var(--muted, #a2b4c9);
            }

            .volume-stat strong {
                font-family: var(--font-mono);
                color: var(--ink-secondary, #cbd5e1);
                font-weight: 600;
                font-feature-settings: 'tnum' 1;
            }

            .trade-cta-hint {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-family: var(--font-ui);
                font-weight: 600;
                color: var(--primary-border, #e84089);
                transition: transform 0.15s ease;
            }

            .market-card:hover .trade-cta-hint {
                transform: translateX(2px);
            }
        `
    ]
})
export class MarketCardComponent {
    readonly market = input.required<Market>();

    protected readonly yesPct = computed(() => {
        const val = parseFloat(this.market().probability_yes_pct);
        return isNaN(val) ? 50 : Math.round(val);
    });

    protected readonly noPct = computed(() => {
        return Math.max(0, 100 - this.yesPct());
    });

    protected readonly yesPriceCents = computed(() => {
        return this.yesPct().toString();
    });

    protected readonly noPriceCents = computed(() => {
        return this.noPct().toString();
    });

    protected readonly formattedDate = computed(() => {
        const raw = this.market().resolution_date;
        if (!raw) return 'Soon';
        const d = new Date(raw);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    });

    protected readonly formattedVolume = computed(() => {
        const raw = this.market().reserves?.total_volume_usdc || '0';
        const num = parseFloat(raw);
        if (isNaN(num) || num === 0) return '0.00';
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });

    protected readonly cardAriaLabel = computed(() => {
        return `${this.market().title}. Category: ${this.market().category}. YES at ${this.yesPriceCents()} cents, NO at ${this.noPriceCents()} cents.`;
    });
}
