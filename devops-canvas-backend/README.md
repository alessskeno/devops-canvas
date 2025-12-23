# DevOps Canvas Backend

This is the Go backend for DevOps Canvas. It handles API requests, real-time collaboration via WebSockets, and orchestration of Docker/Kind resources.

## 🚀 Quick Start

### Prerequisites
- **Docker** and **Docker Compose** installed.
- **Go 1.21+** (if running locally without Docker).

### Running the Full Stack
The easiest way to run the entire system (DB, Redis, Backend, Frontend) is:

```bash
# In the root (parent) directory
docker compose up -d --build
```

This will start:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080/api
- **PostgreSQL**: Port 5432 (mapped)
- **Redis**: Port 6379 (mapped)

## 🔧 Installation Strategy (Multi-OS)

### Windows / macOS / Linux
Since the application runs entirely in Docker, the OS differences are abstracted away. The only requirement is a running Docker Desktop (Windows/Mac) or Docker Engine (Linux).

**For Kind Cluster Support:**
- On **Linux**, the backend container mounts the host Docker socket. Kind runs "Docker-in-Docker" (sibling containers).
- On **macOS/Windows**, Docker Desktop handles the socket binding. Ensure "Allow default Docker socket" is enabled in settings if using advanced configurations.

## 📜 Deployment Instructions

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-org/devops-canvas.git
    cd devops-canvas
    ```

2.  **Environment Setup**:
    Copy `.env.example` to `.env`:
    ```bash
    cp .env.example .env
    ```
    *Ensure `POSTGRES_PASSWORD` and `JWT_SECRET` are set.*

3.  **Boot**:
    ```bash
    docker compose up -d
    ```

4.  **Access**:
    Open browser to `http://localhost:3000`.

## 🧩 Component Plugin System

Custom components serve as the bridge between the visual node and the generated infrastructure.

### Interface Definition (Go)

```go
type Component interface {
    // Validate checks if the config provided by the user is valid
    Validate(config map[string]interface{}) error

    // GenerateComposeService returns the docker-compose service definition
    GenerateComposeService(config map[string]interface{}) (ServiceDefinition, error)
    
    // Dependencies returns a list of component types this one depends on
    Dependencies() []string
}
```

### Adding a New Component
1.  Define the component in `internal/component/registry.go`.
2.  Implement the `Component` interface.
3.  Register it in the `InitRegistry()` function.
