package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/bayesmarket/bayesmarket/internal/config"
	"github.com/bayesmarket/bayesmarket/internal/database"
)

func main() {
	log.Println("[INFO] Verifying Neon PostgreSQL connection...")

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[FATAL] Failed to load configuration: %v\n", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	start := time.Now()
	pool, err := database.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("[FATAL] Neon connection failed: %v\n", err)
	}
	defer pool.Close()

	var version string
	if err := pool.QueryRow(ctx, "SELECT version()").Scan(&version); err != nil {
		log.Fatalf("[FATAL] Failed to query PostgreSQL version: %v\n", err)
	}

	elapsed := time.Since(start)
	fmt.Printf("\n=== Neon PostgreSQL Verification Successful ===\n")
	fmt.Printf("Round-trip Latency: %v\n", elapsed)
	fmt.Printf("Server Version:     %s\n", version)
	fmt.Printf("Max Connections:    %d\n", pool.Stat().MaxConns())
	fmt.Printf("===============================================\n\n")
	os.Exit(0)
}
