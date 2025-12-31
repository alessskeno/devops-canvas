package realtime

import (
	"encoding/json"
	"log"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/mem"
)

type SystemStats struct {
    Type   string  `json:"type"` // "system_stats"
    CPU    float64 `json:"cpu"`
    Memory uint64  `json:"memory"` // In bytes
    TotalMemory uint64 `json:"total_memory"`
}

type Monitor struct {
    Hub *Hub
}

func NewMonitor(hub *Hub) *Monitor {
    return &Monitor{Hub: hub}
}

func (m *Monitor) Start() {
    ticker := time.NewTicker(2 * time.Second)
    go func() {
        for range ticker.C {
            stats, err := m.GetStats()
            if err != nil {
                log.Printf("Error collecting stats: %v", err)
                continue
            }

            msg, err := json.Marshal(stats)
            if err != nil {
                continue
            }

            // Broadcast stats directly to local hub? 
            // Or via Redis? System stats are per-instance usually, 
            // but if we want a "Cluster Health" we might want to aggregate.
            // For now, let's just broadcast to connected clients to show "Server" health.
            // Since this app is likely running as a single instance in Docker Compose for now,
            // we can just use BroadcastToLocal to avoid Redis noise for high-freq stats.
            
            m.Hub.BroadcastToLocal(msg)
        }
    }()
}

func (m *Monitor) GetStats() (*SystemStats, error) {
    v, err := mem.VirtualMemory()
    if err != nil {
        return nil, err
    }

    c, err := cpu.Percent(0, false)
    if err != nil {
        return nil, err
    }
    
    cpuObj := 0.0
    if len(c) > 0 {
        cpuObj = c[0]
    }

    return &SystemStats{
        Type:        "system_stats",
        CPU:         cpuObj,
        Memory:      v.Used,
        TotalMemory: v.Total,
    }, nil
}
