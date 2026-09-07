package rest

import (
	"context"
	"net/http"
	"time"

	"github.com/bayesmarket/bayesmarket/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

// AuthHandler handles user registration, guest session generation, and token issuance.
type AuthHandler struct {
	pool      *pgxpool.Pool
	jwtSecret string
}

// NewAuthHandler constructs an AuthHandler.
func NewAuthHandler(pool *pgxpool.Pool, jwtSecret string) *AuthHandler {
	return &AuthHandler{
		pool:      pool,
		jwtSecret: jwtSecret,
	}
}

// UserResponse represents the public user JSON structure with canonical decimal string balances.
type UserResponse struct {
	ID          string `json:"id"`
	IsGuest     bool   `json:"is_guest"`
	CashBalance string `json:"cash_balance"`
	CreatedAt   string `json:"created_at"`
}

// GuestAuthResponse holds the newly minted JWT token and user profile.
type GuestAuthResponse struct {
	Token string       `json:"token"`
	User  UserResponse `json:"user"`
}

// HandleGuestAuth provisions a new guest account seeded with $1,000.00 virtual USDC
// and issues an HMAC-SHA256 signed JWT.
//
// POST /api/v1/auth/guest
func (h *AuthHandler) HandleGuestAuth(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	clientIP := c.ClientIP()
	initialBalance := decimal.NewFromInt(1000)

	var (
		userID      uuid.UUID
		isGuest     bool
		cashBalance decimal.Decimal
		createdAt   time.Time
	)

	query := `
		INSERT INTO users (is_guest, cash_balance, ip_address)
		VALUES (true, $1, $2)
		RETURNING id, is_guest, cash_balance, created_at;
	`
	err := h.pool.QueryRow(ctx, query, initialBalance, clientIP).Scan(
		&userID, &isGuest, &cashBalance, &createdAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "database_error",
			"message": "Failed to provision guest user session",
		})
		return
	}

	// Create JWT Claims
	claims := middleware.GuestClaims{
		UserID:  userID.String(),
		IsGuest: isGuest,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "bayesmarket",
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(time.Now().UTC()),
			ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(30 * 24 * time.Hour)), // 30-day session
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(h.jwtSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "auth_error",
			"message": "Failed to sign authentication token",
		})
		return
	}

	c.JSON(http.StatusCreated, GuestAuthResponse{
		Token: tokenString,
		User: UserResponse{
			ID:          userID.String(),
			IsGuest:     isGuest,
			CashBalance: cashBalance.StringFixed(8),
			CreatedAt:   createdAt.Format(time.RFC3339),
		},
	})
}
