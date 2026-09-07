package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	CtxUserIDKey  = "userID"
	CtxIsGuestKey = "isGuest"
)

// GuestClaims defines the cryptographic JWT payload for guest sessions.
type GuestClaims struct {
	UserID  string `json:"user_id"`
	IsGuest bool   `json:"is_guest"`
	jwt.RegisteredClaims
}

// RequireAuth validates the Bearer JWT in the Authorization header.
func RequireAuth(jwtSecret string) gin.HandlerFunc {
	secretBytes := []byte(jwtSecret)

	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Authorization header is required",
			})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Authorization header must be formatted as 'Bearer <token>'",
			})
			return
		}

		tokenString := strings.TrimSpace(parts[1])
		claims := &GuestClaims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return secretBytes, nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Invalid, expired, or corrupted authorization token",
			})
			return
		}

		parsedID, err := uuid.Parse(claims.UserID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Token contains malformed user identifier",
			})
			return
		}

		c.Set(CtxUserIDKey, parsedID)
		c.Set(CtxIsGuestKey, claims.IsGuest)
		c.Next()
	}
}

// OptionalAuth parses the Bearer JWT if provided, but does not reject unauthenticated requests.
func OptionalAuth(jwtSecret string) gin.HandlerFunc {
	secretBytes := []byte(jwtSecret)

	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.Next()
			return
		}

		tokenString := strings.TrimSpace(parts[1])
		claims := &GuestClaims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return secretBytes, nil
		})

		if err == nil && token.Valid {
			if parsedID, err := uuid.Parse(claims.UserID); err == nil {
				c.Set(CtxUserIDKey, parsedID)
				c.Set(CtxIsGuestKey, claims.IsGuest)
			}
		}

		c.Next()
	}
}

// GetUserID retrieves the authenticated UUID from request context.
func GetUserID(c *gin.Context) (uuid.UUID, bool) {
	val, exists := c.Get(CtxUserIDKey)
	if !exists {
		return uuid.Nil, false
	}
	id, ok := val.(uuid.UUID)
	return id, ok
}
