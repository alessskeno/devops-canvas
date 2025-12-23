package models

import "time"

type Workspace struct {
    ID          string    `json:"id"`
    Name        string    `json:"name"`
    Description string    `json:"description"`
    OwnerID     string    `json:"owner_id"`
    CreatedAt   time.Time `json:"created_at"`
}
