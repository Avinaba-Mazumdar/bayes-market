package ws

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// WSHandler manages HTTP to WebSocket upgrades.
type WSHandler struct {
	hub      *Hub
	upgrader websocket.Upgrader
}

// NewWSHandler creates a new WebSocket handler instance.
func NewWSHandler(hub *Hub, allowedOrigin string) *WSHandler {
	return &WSHandler{
		hub: hub,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				// Allow all origins in local/test development, or check origin header
				origin := r.Header.Get("Origin")
				if origin == "" || allowedOrigin == "" || allowedOrigin == "*" {
					return true
				}
				return strings.EqualFold(origin, allowedOrigin) || strings.Contains(origin, "localhost") || strings.Contains(origin, "127.0.0.1")
			},
		},
	}
}

// HandleMarketWS upgrades connections requesting market-specific telemetry.
//
// GET /ws/markets/:id
func (h *WSHandler) HandleMarketWS(c *gin.Context) {
	marketID := strings.TrimSpace(c.Param("id"))
	h.serveWS(c, marketID)
}

// HandleGlobalWS upgrades connections requesting the global stream across all markets.
//
// GET /ws/markets or GET /ws
func (h *WSHandler) HandleGlobalWS(c *gin.Context) {
	h.serveWS(c, "all")
}

func (h *WSHandler) serveWS(c *gin.Context, marketID string) {
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[WARN] Failed to upgrade WebSocket connection: %v", err)
		return
	}

	client := NewClient(h.hub, conn, marketID)
	h.hub.register <- client

	// Start pump goroutines
	go client.writePump()
	go client.readPump()
}
