package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/bayesmarket/bayesmarket/internal/config"
	"github.com/bayesmarket/bayesmarket/internal/database"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	seedOnly := flag.Bool("seed", false, "Run migrations and seed initial markets, then exit")
	migrateOnly := flag.Bool("migrate", false, "Run pending database migrations, then exit")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Printf("[WARN] Configuration load warning: %v\n", err)
	}

	port := "8080"
	if cfg != nil && cfg.ServerPort != "" {
		port = cfg.ServerPort
	}

	// Attempt database connection pool initialization (Neon PostgreSQL)
	var dbPool *pgxpool.Pool
	if cfg != nil && cfg.DatabaseURL != "" && !strings.Contains(cfg.DatabaseURL, "ep-cool-pool-123456") {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		pool, err := database.NewPool(ctx, cfg.DatabaseURL)
		if err != nil {
			log.Printf("[WARN] Could not connect to Neon PostgreSQL: %v\n", err)
			log.Println("[INFO] Continuing server startup in detached mode. Configure valid DATABASE_URL in .env to enable persistence.")
		} else {
			dbPool = pool
			defer dbPool.Close()

			// Run pending migrations
			log.Println("[INFO] Checking and applying database migrations...")
			if err := database.RunMigrations(ctx, dbPool); err != nil {
				log.Fatalf("[FATAL] Database migration failed: %v\n", err)
			}

			// If seed flag passed, populate initial prediction markets
			if *seedOnly {
				log.Println("[INFO] Seeding initial prediction markets...")
				if err := database.SeedInitialMarkets(ctx, dbPool); err != nil {
					log.Fatalf("[FATAL] Seeding failed: %v\n", err)
				}
				log.Println("[INFO] Database seeded successfully.")
				return
			}

			if *migrateOnly {
				log.Println("[INFO] Migrations completed successfully.")
				return
			}
		}
	} else {
		log.Println("[INFO] Placeholder or empty DATABASE_URL detected. Server running in disconnected sandbox mode.")
	}

	if *seedOnly || *migrateOnly {
		log.Fatal("[FATAL] Cannot execute seed/migrate: database connection was not established.")
	}

	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())

	// Health check endpoint
	router.GET("/healthz", func(c *gin.Context) {
		dbStatus := "disconnected"
		if dbPool != nil {
			pingCtx, pingCancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
			defer pingCancel()
			if err := dbPool.Ping(pingCtx); err == nil {
				dbStatus = "connected"
			} else {
				dbStatus = "degraded"
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"service":   "bayesmarket-backend",
			"database":  dbStatus,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("[INFO] BayesMarket API server listening on :%s\n", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] Server listen error: %v\n", err)
		}
	}()

	// Graceful shutdown listener
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[INFO] Shutting down server gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("[FATAL] Server forced to shutdown: %v\n", err)
	}

	log.Println("[INFO] Server exited successfully.")
}
