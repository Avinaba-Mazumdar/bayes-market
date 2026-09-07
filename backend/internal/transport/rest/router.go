package rest

import (
	"net/http"
	"time"

	"github.com/bayesmarket/bayesmarket/internal/config"
	"github.com/bayesmarket/bayesmarket/internal/middleware"
	"github.com/bayesmarket/bayesmarket/internal/transport/ws"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SetupRouter constructs and configures the Gin HTTP engine with all REST routes, WebSocket endpoints, and middleware.
func SetupRouter(pool *pgxpool.Pool, cfg *config.Config, hubOpt ...*ws.Hub) *gin.Engine {
	var hub *ws.Hub
	if len(hubOpt) > 0 && hubOpt[0] != nil {
		hub = hubOpt[0]
	}

	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())

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

	jwtSecret := ""
	corsOrigin := "*"
	if cfg != nil {
		jwtSecret = cfg.JWTSecret
		corsOrigin = cfg.CORSOrigin
	}

	// Handlers
	authHandler := NewAuthHandler(pool, jwtSecret)
	marketHandler := NewMarketHandler(pool)
	faucetHandler := NewFaucetHandler(pool)
	portfolioHandler := NewPortfolioHandler(pool)
	tradeHandler := NewTradeHandler(pool, hub)

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

	// API v1 Group
	v1 := router.Group("/api/v1")
	{
		// 1. Auth routes
		auth := v1.Group("/auth")
		{
			auth.POST("/guest", actionLimiter.LimitByClientOrUser(), authHandler.HandleGuestAuth)
		}

		// 2. Markets, Quotes & Orders
		markets := v1.Group("/markets")
		{
			markets.GET("", publicReadLimiter.LimitByIP(), marketHandler.HandleGetMarkets)
			markets.GET("/:id", publicReadLimiter.LimitByIP(), marketHandler.HandleGetMarketByID)
			markets.POST("/:id/quote", actionLimiter.LimitByClientOrUser(), marketHandler.HandleMarketQuote)
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
	}

	return router
}
