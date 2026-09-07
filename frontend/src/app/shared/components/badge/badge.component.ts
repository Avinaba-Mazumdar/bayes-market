import { Component, computed, input } from '@angular/core';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'profit' | 'loss' | 'warning' | 'info' | 'resolved';

export type BadgeSize = 'default' | 'sm' | 'lg';

@Component({
    selector: 'app-badge',
    standalone: true,
    template: `
        <span [class]="badgeClass()">
            <ng-content />
        </span>
    `,
    styles: [
        `
            :host {
                display: inline-flex;
                vertical-align: middle;
            }

            .badge {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
                font-family: var(--font-ui, system-ui, sans-serif);
                font-weight: 600;
                line-height: 1;
                letter-spacing: 0.15px;
                border-radius: var(--radius-pill, 9999px);
                border: 1px solid transparent;
                user-select: none;
                white-space: nowrap;
                transition:
                    background-color 0.15s ease,
                    border-color 0.15s ease,
                    color 0.15s ease;
            }

            /* --- Sizes --- */
            .badge-size-default {
                padding: 4px 10px;
                font-size: 12px;
                min-height: 22px;
            }

            .badge-size-sm {
                padding: 2px 7px;
                font-size: 11px;
                min-height: 18px;
            }

            .badge-size-lg {
                padding: 6px 14px;
                font-size: 13px;
                min-height: 26px;
            }

            /* --- Variants --- */
            /* Default (Brand Amaranth #a6034c) */
            .badge-variant-default {
                background-color: var(--primary, #a6034c);
                color: var(--on-primary, #ffffff);
                border-color: var(--primary-border, #e84089);
            }

            /* Secondary (Elevated Obsidian Surface) */
            .badge-variant-secondary {
                background-color: var(--surface-card-elevated, #171f30);
                color: var(--ink-secondary, #cbd5e1);
                border-color: var(--border-strong, #606e85);
            }

            /* Destructive (Loss / Danger #be123c) */
            .badge-variant-destructive {
                background-color: var(--status-loss-bg, #330814);
                color: var(--status-loss, #fda4af);
                border-color: var(--status-loss-border, #fb7185);
            }

            /* Outline (Transparent hairline) */
            .badge-variant-outline {
                background-color: transparent;
                color: var(--ink, #f8fafc);
                border-color: var(--hairline, #1e2638);
            }

            /* Profit / Success / YES Outcome (Mint #34d399) */
            .badge-variant-profit {
                background-color: var(--status-profit-bg, #06281b);
                color: var(--status-profit, #34d399);
                border-color: var(--status-profit-border, #10b981);
            }

            /* Loss / NO Outcome (Rose #fda4af) */
            .badge-variant-loss {
                background-color: var(--status-loss-bg, #330814);
                color: var(--status-loss, #fda4af);
                border-color: var(--status-loss-border, #fb7185);
            }

            /* Warning / Pending (Amber #fcd34d) */
            .badge-variant-warning {
                background-color: var(--status-warning-bg, #2a1a02);
                color: var(--status-warning, #fcd34d);
                border-color: var(--status-warning-border, #f59e0b);
            }

            /* Info / Telemetry (Sky Blue #7dd3fc) */
            .badge-variant-info {
                background-color: var(--status-info-bg, #082536);
                color: var(--status-info, #7dd3fc);
                border-color: var(--status-info-border, #38bdf8);
            }

            /* Resolved / Settled (Purple #d8b4fe) */
            .badge-variant-resolved {
                background-color: var(--status-resolved-bg, #250e38);
                color: var(--status-resolved, #d8b4fe);
                border-color: var(--status-resolved-border, #c084fc);
            }
        `
    ]
})
export class BadgeComponent {
    readonly variant = input<BadgeVariant>('default');
    readonly size = input<BadgeSize>('default');

    protected readonly badgeClass = computed(() => {
        const v = this.variant();
        return ['badge', `badge-${v}`, `badge-variant-${v}`, `badge-size-${this.size()}`].join(' ');
    });
}
