package realtime

import (
	"log"
	"sync"
)

// Hub maintains the set of active clients and broadcasts messages to the
// clients.
type Hub struct {
	// Registered clients.
	Clients map[*Client]bool

	// Inbound messages from the clients.
	Broadcast chan []byte

	// Register requests from the clients.
	Register chan *Client

	// Unregister requests from clients.
	Unregister chan *Client
    
    // Redis Adapter for cross-instance communication (optional for now, but good practice)
    Redis *RedisAdapter
    
    mu sync.Mutex
}


func NewHub(redis *RedisAdapter) *Hub {
	return &Hub{
		Broadcast:  make(chan []byte),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Clients:    make(map[*Client]bool),
        Redis:      redis,
	}
}

func (h *Hub) Run() {
    // Start Redis subscription in a separate goroutine
    if h.Redis != nil {
        go h.Redis.Subscribe(h.BroadcastToLocal)
    }

	for {
		select {
		case client := <-h.Register:
            h.mu.Lock()
			h.Clients[client] = true
            h.mu.Unlock()
            log.Printf("Client registered. Total clients: %d", len(h.Clients))

		case client := <-h.Unregister:
            h.mu.Lock()
			if _, ok := h.Clients[client]; ok {
				delete(h.Clients, client)
				close(client.Send)
                log.Printf("Client unregistered. Total clients: %d", len(h.Clients))
			}
            h.mu.Unlock()

		case message := <-h.Broadcast:
            // When we receive a message to broadcast (e.g. from a client), 
            // we publish it to Redis so ALL instances get it.
            if h.Redis != nil {
                h.Redis.Publish(message)
            } else {
                // If no Redis, just broadcast locally
                h.BroadcastToLocal(message)
            }
		}
	}
}

// BroadcastToLocal sends the message to all connected clients on THIS instance
func (h *Hub) BroadcastToLocal(message []byte) {
    h.mu.Lock()
    defer h.mu.Unlock()
    
    for client := range h.Clients {
        select {
        case client.Send <- message:
        default:
            close(client.Send)
            delete(h.Clients, client)
        }
    }
}
