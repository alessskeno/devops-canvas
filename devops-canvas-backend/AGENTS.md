# DevOps Canvas Backend - Agent Context

**Role:** Backend Architect & Implementation Specialist  
**Stack:** Go (Golang), PostgreSQL, Redis, Docker, Kind

## 📂 Project Structure
```
devops-canvas-backend/
├── cmd/api/            # Application entrypoint
├── internal/
│   ├── auth/           # Authentication logic (Handlers, Services)
│   ├── workspace/      # Workspace management
│   ├── canvas/         # Canvas node/connection logic
│   ├── component/      # Component registry & plugins
│   ├── deploy/         # Deployment orchestration (Docker/Kind)
│   ├── websocket/      # Real-time hub
│   ├── db/             # Database access (PostgreSQL)
│   ├── cache/          # Cache access (Redis)
│   └── models/         # Domain models & DTOs
├── migrations/         # SQL migrations
├── Dockerfile          # Backend container definition
├── docker-compose.yml  # Local development stack
```

## 🛠 Core Responsibilities
1.  **API**: Provide REST endpoints for Frontend (React).
2.  **Real-time**: Sync canvas state across users via WebSockets.
3.  **Orchestration**: Translate visual node graphs into actual infrastructure (Docker Compose files / Kind configs) and execute them.
4.  **Persistence**: Store state reliably in Postgres.

## ⚠️ Critical Implementation Rules
1.  **Error Handling**: Return clean JSON errors `{ "error": "message", "code": "..." }`.
2.  **Configuration**: 12-Factor App principles. All config via Environment Variables.
3.  **Simplicity**: Use standard library where reasonable. Use proven libraries (`chi` router, `pgx` driver, `go-redis`) otherwise.
4.  **Security**: Validate ALL inputs. DO NOT trust the frontend. Sanitize generated YAML/JSON.

## 🔄 Interaction Flow
1.  **Frontend** sends `POST /deploy` with `workspaceId`.
2.  **Backend** fetches full graph from DB.
3.  **Backend** validates graph (connections, required configs).
4.  **Backend** generates `docker-compose.yml`.
5.  **Backend** executes `docker compose up -d`.
6.  **Backend** streams logs to Frontend via WebSocket.
