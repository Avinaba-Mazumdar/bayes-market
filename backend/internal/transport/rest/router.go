package rest

import (
	"compress/gzip"
	"fmt"
	"net/http"
	"runtime"
	"strings"
	"time"

	"github.com/bayesmarket/bayesmarket/internal/config"
	"github.com/bayesmarket/bayesmarket/internal/middleware"
	"github.com/bayesmarket/bayesmarket/internal/transport/ws"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type gzipWriter struct {
	gin.ResponseWriter
	writer *gzip.Writer
}

func (g *gzipWriter) Write(data []byte) (int, error) {
	return g.writer.Write(data)
}

func (g *gzipWriter) WriteString(s string) (int, error) {
	return g.writer.Write([]byte(s))
}

// gzipMiddleware compresses HTTP responses using gzip when supported by the client.
func gzipMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !strings.HasPrefix(c.Request.URL.Path, "/api/") ||
			!strings.Contains(c.GetHeader("Accept-Encoding"), "gzip") ||
			strings.Contains(c.GetHeader("Connection"), "Upgrade") ||
			strings.HasPrefix(c.Request.URL.Path, "/ws") {
			c.Next()
			return
		}

		gz, err := gzip.NewWriterLevel(c.Writer, gzip.DefaultCompression)
		if err != nil {
			c.Next()
			return
		}
		defer gz.Close()

		c.Header("Content-Encoding", "gzip")
		c.Header("Vary", "Accept-Encoding")
		c.Writer = &gzipWriter{ResponseWriter: c.Writer, writer: gz}
		c.Next()
	}
}

// SetupRouter constructs and configures the Gin HTTP engine with all REST routes, WebSocket endpoints, and middleware.
func SetupRouter(pool *pgxpool.Pool, cfg *config.Config, hubOpt ...*ws.Hub) *gin.Engine {
	var hub *ws.Hub
	if len(hubOpt) > 0 && hubOpt[0] != nil {
		hub = hubOpt[0]
	}

	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery(), gzipMiddleware())

	// CORS Middleware
	router.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		allowedOrigin := ""
		if cfg != nil {
			allowedOrigin = cfg.CORSOrigin
		}
		if allowedOrigin == "" || allowedOrigin == "*" || origin == allowedOrigin {
			c.Header("Access-Control-Allow-Origin", origin)
		} else {
			c.Header("Access-Control-Allow-Origin", allowedOrigin)
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, Idempotency-Key, Accept")
		c.Header("Access-Control-Expose-Headers", "Retry-After, Content-Length")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	})

	// Rate Limiters
	publicReadLimiter := middleware.NewPublicReadLimiter()
	actionLimiter := middleware.NewActionLimiter()
	quoteLimiter := middleware.NewQuoteLimiter()

	jwtSecret := ""
	corsOrigin := "*"
	if cfg != nil {
		jwtSecret = cfg.JWTSecret
		corsOrigin = cfg.CORSOrigin
	}

	// In-memory read-through cache (5-second TTL, event-invalidated on trades/settlements)
	marketCache := NewMarketCache(5 * time.Second)

	// Handlers
	authHandler := NewAuthHandler(pool, cfg)
	marketHandler := NewMarketHandler(pool, marketCache)
	faucetHandler := NewFaucetHandler(pool)
	portfolioHandler := NewPortfolioHandler(pool)
	tradeHandler := NewTradeHandler(pool, hub)
	tradeHandler.SetCache(marketCache)
	adminHandler := NewAdminHandler(pool, hub)
	adminHandler.SetMarketCache(marketCache)

	adminToken := ""
	if cfg != nil {
		adminToken = cfg.AdminToken
	}

	// WebSocket Endpoints
	if hub != nil {
		wsHandler := ws.NewWSHandler(hub, corsOrigin)
		router.GET("/ws/markets/:id", wsHandler.HandleMarketWS)
		router.GET("/ws/markets", wsHandler.HandleGlobalWS)
		router.GET("/ws", wsHandler.HandleGlobalWS)
	}

	// Health check endpoint (unlimited)
	router.GET("/healthz", func(c *gin.Context) {
		dbStatus := "disconnected"
		if pool != nil {
			pingCtx, pingCancel := c.Request.Context(), func() {}
			_ = pingCtx
			_ = pingCancel
			if err := pool.Ping(c.Request.Context()); err == nil {
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

	// Prometheus metrics endpoint (unlimited)
	router.GET("/metrics", func(c *gin.Context) {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)

		var dbConns int
		if pool != nil {
			dbConns = int(pool.Stat().AcquiredConns())
		}

		metricsText := fmt.Sprintf(`# HELP go_goroutines Number of goroutines that currently exist.
# TYPE go_goroutines gauge
go_goroutines %d
# HELP go_memstats_alloc_bytes Number of bytes allocated and still in use.
# TYPE go_memstats_alloc_bytes gauge
go_memstats_alloc_bytes %d
# HELP go_memstats_sys_bytes Number of bytes obtained from system.
# TYPE go_memstats_sys_bytes gauge
go_memstats_sys_bytes %d
# HELP bayesmarket_db_connections_acquired Active database connections in use.
# TYPE bayesmarket_db_connections_acquired gauge
bayesmarket_db_connections_acquired %d
# HELP bayesmarket_up Health status indicator (1 = healthy).
# TYPE bayesmarket_up gauge
bayesmarket_up 1
`, runtime.NumGoroutine(), m.Alloc, m.Sys, dbConns)

		c.Data(http.StatusOK, "text/plain; version=0.0.4; charset=utf-8", []byte(metricsText))
	})

	// API v1 Group
	v1 := router.Group("/api/v1")
	{
		// 1. Auth routes
		auth := v1.Group("/auth")
		{
			auth.POST("/guest", actionLimiter.LimitByClientOrUser(), authHandler.HandleGuestAuth)
			auth.POST("/google/verify", middleware.OptionalAuth(jwtSecret), actionLimiter.LimitByClientOrUser(), authHandler.HandleGoogleAuthVerify)
			auth.GET("/google/url", publicReadLimiter.LimitByIP(), authHandler.HandleGoogleAuthURL)
			auth.POST("/google/callback", middleware.OptionalAuth(jwtSecret), actionLimiter.LimitByClientOrUser(), authHandler.HandleGoogleAuthCallback)
			auth.GET("/me", middleware.RequireAuth(jwtSecret), publicReadLimiter.LimitByIP(), authHandler.HandleGetMe)
		}

		// 2. Markets, Quotes & Orders
		markets := v1.Group("/markets")
		{
			markets.GET("", publicReadLimiter.LimitByIP(), marketHandler.HandleGetMarkets)
			markets.GET("/:id", publicReadLimiter.LimitByIP(), marketHandler.HandleGetMarketByID)
			markets.POST("/:id/quote", quoteLimiter.LimitByClientOrUser(), marketHandler.HandleMarketQuote)
			markets.POST("/:id/orders",
				middleware.RequireAuth(cfg.JWTSecret),
				actionLimiter.LimitByClientOrUser(),
				tradeHandler.HandlePlaceOrder,
			)
		}

		// 3. Faucet claim (Protected)
		v1.POST("/faucet",
			middleware.RequireAuth(cfg.JWTSecret),
			actionLimiter.LimitByClientOrUser(),
			faucetHandler.HandleClaimFaucet,
		)

		// 4. Portfolio read & Cashout (Protected)
		v1.GET("/portfolio",
			middleware.RequireAuth(cfg.JWTSecret),
			portfolioHandler.HandleGetPortfolio,
		)
		v1.POST("/portfolio/cashout",
			middleware.RequireAuth(cfg.JWTSecret),
			actionLimiter.LimitByClientOrUser(),
			tradeHandler.HandleCashOut,
		)

		// 5. Admin Market Resolution & Payout Settlement (Protected)
		admin := v1.Group("/admin")
		{
			admin.POST("/markets/:id/resolve",
				middleware.RequireAdminAuth(adminToken, jwtSecret),
				actionLimiter.LimitByClientOrUser(),
				adminHandler.HandleResolveMarket,
			)
		}
	}

	return router
}
