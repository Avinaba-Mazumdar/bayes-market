import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideSearch, LucideSearchX } from '@lucide/angular';
import { ApiService } from '../../core/services/api.service';
import { Market } from '../../core/models/market.model';
import { MarketCardComponent } from './market-card.component';
import { GlossaryPopoverComponent } from './glossary-popover.component';
import { ButtonComponent } from '../../shared/components/button/button.component';

export type CategoryFilter = 'all' | 'macro' | 'crypto' | 'ai' | 'science';

@Component({
    selector: 'app-market-list',
    standalone: true,
    imports: [FormsModule, MarketCardComponent, GlossaryPopoverComponent, ButtonComponent, LucideSearch, LucideSearchX],
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
                    <div class="search-input-wrapper">
                        <svg lucideSearch class="search-icon" [size]="16" aria-hidden="true"></svg>
                        <input
                            type="search"
                            [(ngModel)]="searchQuery"
                            placeholder="Search prediction markets..."
                            class="search-input"
                            aria-label="Search prediction markets by title or keyword"
                        />
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
                padding: 36px 32px;
                background: linear-gradient(135deg, rgba(17, 22, 34, 0.95) 0%, rgba(14, 19, 29, 0.85) 100%);
                border: 1px solid var(--hairline, #1e2638);
                border-radius: var(--radius-xl, 20px);
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
                background: radial-gradient(circle, rgba(166, 3, 76, 0.12) 0%, transparent 60%);
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
                background-color: rgba(166, 3, 76, 0.2);
                border: 1px solid var(--primary-border, #e84089);
                border-radius: var(--radius-pill, 9999px);
                padding: 4px 12px;
                font-family: var(--font-mono);
                font-size: 11px;
                font-weight: 700;
                color: #fbcfe8;
                letter-spacing: 0.5px;
                margin-bottom: 12px;
            }

            .pulse-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: #e84089;
                box-shadow: 0 0 6px #e84089;
            }

            .hero-title {
                font-family: var(--font-ui);
                font-size: 34px;
                font-weight: 700;
                line-height: 1.2;
                color: var(--ink, #f8fafc);
                letter-spacing: -0.5px;
                margin-bottom: 12px;
            }

            .hero-desc {
                font-family: var(--font-ui);
                font-size: 15px;
                line-height: 1.55;
                color: var(--body, #a2b4c9);
                margin: 0;
            }

            .hero-stats-panel {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 16px;
                background-color: var(--canvas, #07090e);
                border: 1px solid var(--hairline, #1e2638);
                border-radius: var(--radius-lg, 14px);
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
                font-size: 11.5px;
                font-weight: 600;
                color: var(--muted, #a2b4c9);
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }

            .stat-val {
                font-family: var(--font-mono);
                font-size: 20px;
                font-weight: 700;
                color: var(--ink, #f8fafc);
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
                background-color: var(--surface-card, #111622);
                border: 1px solid var(--border-strong, #606e85);
                border-radius: var(--radius-md, 10px);
                padding: 4px 12px;
                gap: 8px;
                min-height: var(--touch-target-min, 44px);
                min-width: 260px;
            }

            .search-input-wrapper:focus-within {
                border-color: var(--primary-border, #e84089);
            }

            .search-icon {
                color: var(--muted, #a2b4c9);
                flex-shrink: 0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }

            .search-input {
                background: transparent;
                border: none;
                color: var(--ink, #f8fafc);
                font-family: var(--font-ui);
                font-size: 14px;
                outline: none;
                width: 100%;
            }

            /* --- Markets Grid --- */
            .markets-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                gap: 20px;
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
                border: 3px solid rgba(166, 3, 76, 0.2);
                border-top-color: var(--primary-border, #e84089);
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
export class MarketListComponent implements OnInit {
    private readonly apiService = inject(ApiService);

    readonly markets = signal<Market[]>([]);
    readonly isLoading = signal<boolean>(true);
    readonly selectedCategory = signal<CategoryFilter>('all');
    searchQuery = '';

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
        const query = this.searchQuery.trim().toLowerCase();
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
    }

    setCategory(cat: CategoryFilter): void {
        this.selectedCategory.set(cat);
    }

    resetFilters(): void {
        this.selectedCategory.set('all');
        this.searchQuery = '';
    }

    private fetchMarkets(): void {
        this.isLoading.set(true);
        this.apiService.getMarkets().subscribe({
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
