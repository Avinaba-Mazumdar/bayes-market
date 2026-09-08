import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LucideSearch, LucideSearchX } from '@lucide/angular';
import { ApiService } from '../../core/services/api.service';
import { Market } from '../../core/models/market.model';
import { MarketCardComponent } from './market-card.component';
import { GlossaryPopoverComponent } from './glossary-popover.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { WebSocketService } from '../../core/services/websocket.service';

export type CategoryFilter = 'all' | 'macro' | 'crypto' | 'ai' | 'science';

@Component({
    selector: 'app-market-list',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, MarketCardComponent, GlossaryPopoverComponent, ButtonComponent, InputComponent, LucideSearch, LucideSearchX],
    template: `
        <div class="market-catalog-container">
            <!-- Hero Banner: Platform Mission & Market Stats -->
            <section class="hero-section" aria-labelledby="hero-title">
                <div class="hero-content">
                    <span class="hero-badge">
                        <span class="pulse-dot" aria-hidden="true"></span>
                        LIVE PREDICTION EXCHANGE
                    </span>
                    <h1 id="hero-title" class="hero-title">Trade the Probability of Tomorrow.</h1>
                    <p class="hero-desc">
                        Institutional-grade binary prediction markets powered by fixed-point AMM bonding curves, fully collateralized outcomes, and atomic
                        settlement.
                    </p>
                </div>

                <div class="hero-stats-panel" role="region" aria-label="Exchange statistics">
                    <div class="stat-box">
                        <span class="stat-label">Active Markets</span>
                        <span class="stat-val tabular-nums">{{ markets().length }}</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">Total Volume</span>
                        <span class="stat-val tabular-nums">{{ '$' + totalVolume() }}</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">Collateral Locked</span>
                        <span class="stat-val tabular-nums">{{ '$' + totalCollateral() }}</span>
                    </div>
                </div>
            </section>

            <!-- Filter Controls & Search Bar -->
            <section class="catalog-controls" aria-label="Market filters and search">
                <!-- Category Filter Chips -->
                <div class="category-tabs" role="tablist" aria-label="Filter markets by category">
                    @for (cat of categories; track cat.id) {
                        <app-button
                            variant="chip"
                            size="sm"
                            [selected]="selectedCategory() === cat.id"
                            role="tab"
                            [attr.aria-selected]="selectedCategory() === cat.id"
                            [ariaLabel]="'Filter by ' + cat.label"
                            (btnClick)="setCategory(cat.id)"
                        >
                            {{ cat.label }}
                        </app-button>
                    }
                </div>

                <!-- Right Tools: Search Bar & Glossary Trigger -->
                <div class="filter-tools-right">
                    <div class="search-input-container">
                        <app-input
                            type="search"
                            size="sm"
                            [value]="searchQuery()"
                            (valueChange)="searchQuery.set($event.toString())"
                            placeholder="Search prediction markets..."
                            ariaLabel="Search prediction markets by title or keyword"
                        >
                            <svg prefix lucideSearch class="search-icon" [size]="16" aria-hidden="true"></svg>
                        </app-input>
                    </div>
                    <app-glossary-popover />
                </div>
            </section>

            <!-- Active Markets Catalog Grid -->
            <section class="catalog-grid-section" aria-label="Active prediction markets">
                @if (isLoading()) {
                    <div class="loading-state" role="status">
                        <div class="spinner" aria-hidden="true"></div>
                        <p class="loading-text">Loading prediction markets...</p>
                    </div>
                } @else if (filteredMarkets().length === 0) {
                    <div class="empty-state" role="status">
                        <svg lucideSearchX class="empty-icon" [size]="40" aria-hidden="true"></svg>
                        <h3>No Markets Found</h3>
                        <p>No active prediction markets match your selected filter or search term.</p>
                        <app-button variant="secondary" size="default" (btnClick)="resetFilters()"> Reset Filters </app-button>
                    </div>
                } @else {
                    <div class="markets-grid">
                        @for (market of filteredMarkets(); track market.id) {
                            <app-market-card [market]="market" />
                        }
                    </div>
                }
            </section>
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
            }

            .market-catalog-container {
                max-width: 1440px;
                margin: 0 auto;
                padding: var(--space-xl, 32px) var(--space-lg, 20px) 64px;
                display: flex;
                flex-direction: column;
                gap: 32px;
            }

            /* --- Hero Section --- */
            .hero-section {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 24px;
                padding: 32px 28px;
                background: var(--hero-gradient, linear-gradient(135deg, #ffffff 0%, #f8fafc 100%));
                border: 1px solid var(--hairline, #cbd5e1);
                border-radius: var(--radius-lg, 14px);
                position: relative;
                overflow: hidden;
                box-shadow: var(--shadow-md);
            }

            .hero-section::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -20%;
                width: 70%;
                height: 200%;
                background: var(--hero-glow, radial-gradient(circle, rgba(67, 56, 202, 0.08) 0%, transparent 70%));
                pointer-events: none;
            }

            .hero-content {
                max-width: 640px;
                position: relative;
                z-index: 1;
            }

            .hero-badge {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background-color: var(--primary-subtle, rgba(67, 56, 202, 0.08));
                border: 1px solid var(--primary-border, #4338ca);
                border-radius: var(--radius-pill, 9999px);
                padding: 4px 12px;
                font-family: var(--font-mono);
                font-size: 11px;
                font-weight: 700;
                color: var(--primary-text, #4338ca);
                letter-spacing: 0.5px;
                margin-bottom: 12px;
            }

            .pulse-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: var(--primary-text, #4338ca);
                box-shadow: 0 0 6px var(--primary-text, #4338ca);
            }

            .hero-title {
                font-family: var(--font-ui);
                font-size: 32px;
                font-weight: 700;
                line-height: 1.2;
                color: var(--ink, #0f172a);
                letter-spacing: -0.5px;
                margin-bottom: 12px;
            }

            .hero-desc {
                font-family: var(--font-ui);
                font-size: 14.5px;
                line-height: 1.55;
                color: var(--muted, #3b4861);
                margin: 0;
            }

            .hero-stats-panel {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 16px;
                background-color: var(--surface-card, #ffffff);
                border: 1px solid var(--hairline, #cbd5e1);
                border-radius: var(--radius-md, 10px);
                padding: 16px 20px;
                position: relative;
                z-index: 1;
                min-width: 420px;
            }

            .stat-box {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .stat-label {
                font-family: var(--font-ui);
                font-size: 11px;
                font-weight: 600;
                color: var(--muted, #3b4861);
                text-transform: uppercase;
                letter-spacing: 0.4px;
            }

            .stat-val {
                font-family: var(--font-mono);
                font-size: 19px;
                font-weight: 700;
                color: var(--ink, #0f172a);
                font-feature-settings: 'tnum' 1;
            }

            /* --- Controls Bar --- */
            .catalog-controls {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 16px;
            }

            .category-tabs {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }

            .filter-tools-right {
                display: flex;
                align-items: center;
                gap: 12px;
                flex-wrap: wrap;
            }

            .search-input-wrapper {
                display: flex;
                align-items: center;
                background-color: var(--surface-card, #ffffff);
                border: 1px solid var(--hairline, #cbd5e1);
                border-radius: var(--radius-pill, 9999px);
                padding: 4px 14px;
                gap: 8px;
                min-height: 38px;
                min-width: 260px;
                box-sizing: border-box;
                transition:
                    border-color 0.15s ease,
                    box-shadow 0.15s ease;
            }

            .search-input-wrapper:focus-within {
                border-color: var(--focus-outline, #3730a3);
                box-shadow: 0 0 0 3px var(--focus-ring, rgba(55, 48, 163, 0.25));
            }

            .search-icon {
                color: var(--muted, #3b4861);
                flex-shrink: 0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }

            .search-input {
                background: transparent;
                border: none;
                color: var(--ink, #0f172a);
                font-family: var(--font-ui);
                font-size: 13.5px;
                outline: none;
                box-shadow: none;
                width: 100%;
            }

            .search-input:focus,
            .search-input:focus-visible {
                outline: none;
                box-shadow: none;
            }

            .search-input::-webkit-search-decoration,
            .search-input::-webkit-search-cancel-button,
            .search-input::-webkit-search-results-button,
            .search-input::-webkit-search-results-decoration {
                -webkit-appearance: none;
            }

            /* --- Markets Grid --- */
            .markets-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                gap: 18px;
            }

            /* --- States --- */
            .loading-state,
            .empty-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 64px 20px;
                text-align: center;
                gap: 12px;
            }

            .spinner {
                width: 36px;
                height: 36px;
                border: 3px solid rgba(124, 77, 255, 0.2);
                border-top-color: var(--primary-border, #4338ca);
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }

            @keyframes spin {
                to {
                    transform: rotate(360deg);
                }
            }

            .loading-text {
                font-family: var(--font-ui);
                font-size: 15px;
                color: var(--muted, #a2b4c9);
            }

            .empty-icon {
                color: var(--muted, #a2b4c9);
                margin-bottom: 4px;
            }

            .empty-state h3 {
                margin: 0;
                font-size: 18px;
                color: var(--ink, #f8fafc);
            }

            .empty-state p {
                margin: 0 0 16px 0;
                color: var(--muted, #a2b4c9);
                font-size: 14px;
            }

            @media (max-width: 1024px) {
                .hero-section {
                    flex-direction: column;
                    align-items: stretch;
                }
                .hero-stats-panel {
                    min-width: unset;
                }
            }

            @media (max-width: 640px) {
                .hero-title {
                    font-size: 26px;
                }
                .hero-stats-panel {
                    grid-template-columns: 1fr;
                }
                .catalog-controls {
                    flex-direction: column;
                    align-items: stretch;
                }
                .filter-tools-right {
                    flex-direction: column;
                    align-items: stretch;
                }
                .search-input-wrapper {
                    min-width: 100%;
                }
            }
        `
    ]
})
export class MarketListComponent implements OnInit, OnDestroy {
    private readonly apiService = inject(ApiService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly wsService = inject(WebSocketService);

    readonly markets = signal<Market[]>([]);
    readonly isLoading = signal<boolean>(true);
    readonly selectedCategory = signal<CategoryFilter>('all');
    readonly searchQuery = signal<string>('');

    protected readonly categories: { id: CategoryFilter; label: string }[] = [
        { id: 'all', label: 'All Markets' },
        { id: 'macro', label: 'Macro & Fed' },
        { id: 'crypto', label: 'Crypto' },
        { id: 'ai', label: 'Artificial Intelligence' },
        { id: 'science', label: 'Space & Science' }
    ];

    protected readonly totalVolume = computed(() => {
        const total = this.markets().reduce((acc, m) => {
            const v = parseFloat(m.reserves?.total_volume_usdc || '0');
            return acc + (isNaN(v) ? 0 : v);
        }, 0);
        return total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });

    protected readonly totalCollateral = computed(() => {
        const total = this.markets().reduce((acc, m) => {
            const c = parseFloat(m.reserves?.collateral_reserve || '0');
            return acc + (isNaN(c) ? 0 : c);
        }, 0);
        return total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });

    protected readonly filteredMarkets = computed(() => {
        const cat = this.selectedCategory();
        const query = this.searchQuery().trim().toLowerCase();
        let list = this.markets();

        if (cat !== 'all') {
            list = list.filter((m) => m.category.toLowerCase() === cat);
        }

        if (query) {
            list = list.filter(
                (m) => m.title.toLowerCase().includes(query) || m.description.toLowerCase().includes(query) || m.category.toLowerCase().includes(query)
            );
        }

        return list;
    });

    ngOnInit(): void {
        this.fetchMarkets();
        // Connect to global WS stream for live price updates on the listing page
        this.wsService.connect();
    }

    ngOnDestroy(): void {
        this.wsService.disconnect();
    }

    setCategory(cat: CategoryFilter): void {
        this.selectedCategory.set(cat);
    }

    resetFilters(): void {
        this.selectedCategory.set('all');
        this.searchQuery.set('');
    }

    private fetchMarkets(): void {
        this.isLoading.set(true);
        this.apiService
            .getMarkets()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (data) => {
                    this.markets.set(data || []);
                    this.isLoading.set(false);
                },
                error: (err) => {
                    console.error('Failed to load markets:', err);
                    this.isLoading.set(false);
                }
            });
    }
}
