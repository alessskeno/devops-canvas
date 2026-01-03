package deploy

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
    CheckOrigin: func(r *http.Request) bool {
        return true // Initial dev setting
    },
}

// HandleTerminal connects a WebSocket to a container's shell
func (h *Handler) HandleTerminal(w http.ResponseWriter, r *http.Request) {
    log.Println("[Terminal] Connection request received")
    
    workspaceID := chi.URLParam(r, "workspaceID")
    componentID := r.URL.Query().Get("component_id")

    if componentID == "" {
        log.Println("[Terminal] Missing component_id")
        http.Error(w, "component_id is required", http.StatusBadRequest)
        return
    }

    log.Printf("[Terminal] Upgrading connection for WS: %s, Component: %s", workspaceID, componentID)

    // Upgrade to WebSocket
    ws, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Printf("[Terminal] Upgrade failed: %v", err)
        return
    }
    defer ws.Close()

    log.Println("[Terminal] WebSocket upgraded successfully")

    // Adapter for Output (Writer) -> Send to WS
    wsWriter := &wsOutputWriter{ws: ws}
    
    // Adapter for Input (Reader) -> Read from WS
    wsReader := &wsInputReader{
        ws: ws,
        readChan: make(chan []byte, 10),
        closeChan: make(chan struct{}),
    }
    go wsReader.pumpRead()

    ctx, cancel := context.WithCancel(r.Context())
    defer cancel()
    
    // Monitor WS closing
    go func() {
        <-wsReader.closeChan
        log.Println("[Terminal] WS Reader channel closed")
        cancel()
    }()

    // Run Shell
    cmd := "/bin/sh"
    
    // Initial welcome message (optional)
    wsWriter.Write([]byte("\r\nConnected to container shell...\r\n"))

    log.Println("[Terminal] Executing shell...")
    err = h.svc.ExecShell(ctx, workspaceID, componentID, cmd, wsReader, wsWriter)
    if err != nil {
        log.Printf("[Terminal] ExecShell error: %v", err)
        wsWriter.Write([]byte(fmt.Sprintf("\r\nError: %v\r\n", err)))
    } else {
        log.Println("[Terminal] Shell exited normally")
        wsWriter.Write([]byte("\r\nShell exited.\r\n"))
    }
    
    // Give some time to flush
    time.Sleep(100 * time.Millisecond)
}

// wsOutputWriter writes bytes to WebSocket
type wsOutputWriter struct {
    ws *websocket.Conn
    mu sync.Mutex
}

func (w *wsOutputWriter) Write(p []byte) (n int, err error) {
    w.mu.Lock()
    defer w.mu.Unlock()
    err = w.ws.WriteMessage(websocket.BinaryMessage, p)
    if err != nil {
        return 0, err
    }
    return len(p), nil
}

// wsInputReader reads from WebSocket and exposes as io.Reader
type wsInputReader struct {
    ws *websocket.Conn
    readChan chan []byte
    buffer []byte
    closeChan chan struct{}
    once sync.Once
}

func (r *wsInputReader) pumpRead() {
    defer func() {
        r.once.Do(func() {
            close(r.closeChan)
        })
    }()
    
    for {
        _, message, err := r.ws.ReadMessage()
        if err != nil {
            break
        }
        r.readChan <- message
    }
}

func (r *wsInputReader) Read(p []byte) (n int, err error) {
    if len(r.buffer) > 0 {
        n = copy(p, r.buffer)
        r.buffer = r.buffer[n:]
        return n, nil
    }

    select {
    case msg, ok := <-r.readChan:
        if !ok {
            return 0, io.EOF
        }
        n = copy(p, msg)
        if n < len(msg) {
            r.buffer = msg[n:]
        }
        return n, nil
    case <-r.closeChan:
        return 0, io.EOF
    }
}
