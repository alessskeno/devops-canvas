# System Architecture

## 1. Architecture Diagram

```mermaid
graph TD
    Client[Frontend Client (React)]
    
    subgraph "Host Machine / Local Environment"
        Entry[Nginx Reverse Proxy]
        
        subgraph "Backend Services"
            API[Go Backend API]
            WS[WebSocket Hub]
            Orch[Deployment Orchestrator]
        end
        
        subgraph "Persistence Layer"
            PG[(PostgreSQL)]
            Redis[(Redis Cache)]
        end
        
        subgraph "Infrastructure Layer"
            DockerEng[Docker Engine]
            KindClust[Kind Clusters]
        end
    end

    Client -->|HTTP/REST| Entry
    Client -->|WebSocket| Entry
    Entry -->|Proxy| API
    
    API -->|Read/Write| PG
    API -->|Cache/PubSub| Redis
    WS -->|PubSub| Redis
    
    Orch -->|Docker Socket| DockerEng
    Orch -->|Kubeconfig| KindClust
```

## 2. Technology Stack Justification

| component | Technology | Justification |
|-----------|------------|---------------|
| **Backend Language** | **Go (Golang)** | Selected for its superior concurrency model (goroutines) which is essential for handling multiple real-time WebSocket connections and blocking orchestration tasks (deployments). Static typing ensures robustness. Excellent standard library for HTTP and JSON. |
| **Database** | **PostgreSQL** | Relational data model fits the structured nature of Users, Workspaces, and Component Configurations perfectly. Strong ACID guarantees are required for configuration state integrity. JSONB support allows flexible storage of component-specific configs. |
| **Caching / PubSub** | **Redis** | Essential for (1) WebSocket session management (who is online), (2) Real-time ephemeral state (cursor positions), and (3) Job queueing for deployments to decouple the API response from long-running tasks. |
| **Orchestration** | **Docker Compose** | The primary target environment for this tool. It allows defining multi-container applications in a single file, which maps 1:1 with the "Canvas" concept. |
| **Reverse Proxy** | **Nginx** | Handles routing between Frontend and Backend, serves static assets, and manages WebSocket upgrades. Simulates a production-like environment even locally. |

## 3. Database Schema

### Users
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | PK |
| `email` | VARCHAR | Unique email |
| `password_hash` | VARCHAR | Argon2 hash |
| `role` | VARCHAR | 'admin', 'editor', 'viewer' |
| `created_at` | TIMESTAMP | |

### Workspaces
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | PK |
| `owner_id` | UUID | FK -> Users.id |
| `name` | VARCHAR | Workspace Name |
| `description` | TEXT | |
| `config_json` | JSONB | **Components and Connections snapshot** |
| `environment` | VARCHAR | 'development', 'staging', 'production' |
| `visibility` | VARCHAR | 'private', 'team', 'public' |
| `created_at` | TIMESTAMP | |

### Deployments
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | PK |
| `workspace_id` | UUID | FK -> Workspaces.id |
| `status` | VARCHAR | 'pending', 'running', 'success', 'failed' |
| `logs` | TEXT | Aggregated logs |
| `started_at` | TIMESTAMP | |
| `ended_at` | TIMESTAMP | |

**Redis Keys:**
- `session:{token}` -> `userId` (TTL: 24h)
- `ws:hub:{workspaceId}` -> Set of `connectionId`
- `canvas:lock:{nodeId}` -> `userId` (for locking nodes during edit)

## 4. Real-time Collaboration Flow

1.  **Connection**: Frontend initiates `WS /ws/workspaces/:id?token=...`.
2.  **Auth**: Backend validates token via Redis/DB. upgrades connection.
3.  **Registration**: Backend adds connection to `Hub.rooms[workspaceId]`.
4.  **Broadcast Loop**:
    - **User Action**: Frontend sends `{ type: "MOVE_NODE", payload: { id: "n1", x: 100, y: 200 } }`.
    - **Hub Processing**: Backend validates move. Updates in-memory state (or Redis).
    - **Broadcast**: Backend iterates over all connections in `room[workspaceId]` and sends `{ type: "NODE_MOVED", payload: ..., actorId: "u1" }`.
5.  **Persistence**: To save DB IO, the Canvas state is only flushed to PostgreSQL on explicit "Save" or via a "Debounced Auto-save" (e.g. every 30s if changes exist).

## 5. Security Model
- **Authentication**: JWT (JSON Web Tokens) with short lifespan + Refresh Tokens.
- **Workspace Isolation**: Middleware checks `SELECT 1 FROM workspace_members WHERE user_id = ? AND workspace_id = ?` before every request.
- **Docker Security**: The Backend connects to the Docker Socket (`/var/run/docker.sock`). **Risk**: This gives root equivalent access. **Mitigation**: The backend container should run as a non-root user that is part of the `docker` group, or ideally use a proxy. For this MVP, we map the socket directly but sanitize all inputs to the Docker Client.
