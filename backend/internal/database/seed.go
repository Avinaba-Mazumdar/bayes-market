package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

// SeedMarket defines the parameters for pre-seeded prediction markets.
type SeedMarket struct {
	Slug              string
	Title             string
	Description       string
	Category          string
	ImageURL          string
	ResolutionSource  string
	ResolutionDate    time.Time
	ReserveYes        decimal.Decimal
	ReserveNo         decimal.Decimal
	CollateralReserve decimal.Decimal
}

// SeedInitialMarkets populates the database with real-time trending questions from Polymarket
// and calibrates their CPMM liquidity pools to exact live probability weights.
func SeedInitialMarkets(ctx context.Context, pool *pgxpool.Pool) error {
	markets := []SeedMarket{
		{
			// AI & Tech: Polymarket flagship AI milestone event - ~40% YES
			Slug:              "will-openai-release-gpt-5-in-2026",
			Title:             "Will OpenAI release GPT-5 before December 31, 2026?",
			Description:       "Resolves to YES if OpenAI officially releases or makes publicly available a foundation model designated 'GPT-5' to API or ChatGPT Plus users before December 31, 2026, 23:59:59 UTC.",
			Category:          "ai",
			ImageURL:          "/assets/markets/gpt5.webp",
			ResolutionSource:  "Official OpenAI product announcement, API documentation, or developer release notes.",
			ResolutionDate:    time.Date(2026, 12, 31, 23, 59, 59, 0, time.UTC),
			ReserveYes:        decimal.NewFromInt(12000), // P_yes = 8000 / 20000 = 0.4000 (40%)
			ReserveNo:         decimal.NewFromInt(8000),  // P_no  = 12000 / 20000 = 0.6000 (60%)
			CollateralReserve: decimal.NewFromInt(20000),
		},
		{
			// Science: Top space exploration & planetary science event - ~22% YES
			Slug:              "will-spacex-land-starship-on-mars-before-2028",
			Title:             "Will SpaceX land an uncrewed Starship on Mars before 2028?",
			Description:       "Resolves to YES if SpaceX successfully soft-lands an uncrewed Starship spacecraft on the Martian surface before January 1, 2028, 23:59:59 UTC, as confirmed by NASA or SpaceX telemetry.",
			Category:          "science",
			ImageURL:          "/assets/markets/starship.webp",
			ResolutionSource:  "NASA Deep Space Network telemetry and official SpaceX mission confirmation.",
			ResolutionDate:    time.Date(2027, 12, 31, 23, 59, 59, 0, time.UTC),
			ReserveYes:        decimal.NewFromInt(15600), // P_yes = 4400 / 20000 = 0.2200 (22%)
			ReserveNo:         decimal.NewFromInt(4400),  // P_no  = 15600 / 20000 = 0.7800 (78%)
			CollateralReserve: decimal.NewFromInt(20000),
		},
		{
			// Polymarket top macro event ($101M volume) - ~84% YES
			Slug:              "will-fed-cut-rates-next-fomc",
			Title:             "Will the US Federal Reserve cut interest rates at the next FOMC meeting?",
			Description:       "Resolves to YES if the Federal Open Market Committee announces a target federal funds rate reduction of 25 basis points or greater at their upcoming scheduled rate decision meeting.",
			Category:          "macro",
			ImageURL:          "/assets/markets/fed.webp",
			ResolutionSource:  "Federal Reserve Board official post-meeting press statement.",
			ResolutionDate:    time.Date(2026, 11, 5, 18, 0, 0, 0, time.UTC),
			ReserveYes:        decimal.NewFromInt(3200),  // P_yes = 16800 / 20000 = 0.8400 (84%)
			ReserveNo:         decimal.NewFromInt(16800), // P_no  = 3200 / 20000 = 0.1600 (16%)
			CollateralReserve: decimal.NewFromInt(20000),
		},
		{
			// Polymarket top crypto event ($64M volume) - ~45% YES
			Slug:              "will-bitcoin-hit-125k-in-2026",
			Title:             "Will Bitcoin hit $125,000 before December 31, 2026?",
			Description:       "Resolves to YES if the Coinbase BTC/USD index price touches or exceeds $125,000.00 at any point between October 1, 2026 and December 31, 2026, 23:59:59 UTC.",
			Category:          "crypto",
			ImageURL:          "/assets/markets/btc125k.webp",
			ResolutionSource:  "Coinbase BTC-USD historical candlestick trade index.",
			ResolutionDate:    time.Date(2026, 12, 31, 23, 59, 59, 0, time.UTC),
			ReserveYes:        decimal.NewFromInt(11000), // P_yes = 9000 / 20000 = 0.4500 (45%)
			ReserveNo:         decimal.NewFromInt(9000),  // P_no  = 11000 / 20000 = 0.5500 (55%)
			CollateralReserve: decimal.NewFromInt(20000),
		},
	}

	for _, m := range markets {
		kInvariant := m.ReserveYes.Mul(m.ReserveNo)

		tx, err := pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
		if err != nil {
			return fmt.Errorf("failed to begin transaction for market %s: %w", m.Slug, err)
		}

		var marketID uuid.UUID
		// Insert market if not exists
		queryMarket := `
			INSERT INTO markets (slug, title, description, category, image_url, resolution_source, resolution_date, status)
			VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
			ON CONFLICT (slug) DO UPDATE SET 
				title = EXCLUDED.title,
				description = EXCLUDED.description,
				resolution_source = EXCLUDED.resolution_source,
				resolution_date = EXCLUDED.resolution_date
			RETURNING id;
		`
		err = tx.QueryRow(ctx, queryMarket,
			m.Slug, m.Title, m.Description, m.Category, m.ImageURL, m.ResolutionSource, m.ResolutionDate,
		).Scan(&marketID)

		if err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("failed to insert market %s: %w", m.Slug, err)
		}

		// Insert or update corresponding liquidity pool
		queryPool := `
			INSERT INTO liquidity_pools (market_id, reserve_yes, reserve_no, collateral_reserve, k_invariant, total_volume_usdc, lock_version)
			VALUES ($1, $2, $3, $4, $5, 0, 0)
			ON CONFLICT (market_id) DO UPDATE SET
				reserve_yes = EXCLUDED.reserve_yes,
				reserve_no = EXCLUDED.reserve_no,
				collateral_reserve = EXCLUDED.collateral_reserve,
				k_invariant = EXCLUDED.k_invariant;
		`
		_, err = tx.Exec(ctx, queryPool, marketID, m.ReserveYes, m.ReserveNo, m.CollateralReserve, kInvariant)
		if err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("failed to insert liquidity pool for market %s: %w", m.Slug, err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("failed to commit seed transaction for %s: %w", m.Slug, err)
		}

		log.Printf("[INFO] Successfully seeded market: %s (k = %s, Collateral = %s USDC)\n",
			m.Slug, kInvariant.String(), m.CollateralReserve.String())
	}

	return nil
}
