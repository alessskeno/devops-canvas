package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/docker/docker/client"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"

	"devops-canvas-backend/internal/auth"
	"devops-canvas-backend/internal/db"
	"devops-canvas-backend/internal/deploy"
	"devops-canvas-backend/internal/realtime"
	"devops-canvas-backend/internal/team"
	"devops-canvas-backend/internal/workspace"

	// SaaS Implementations (Private)
	saasAuth "devops-canvas-backend/saas/auth"
	saasTenant "devops-canvas-backend/saas/tenant"
)

func main() {
	// Load .env file (SaaS Specific envs expected)
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Connect to DB (Shared or Tenant-Aware DB connection)
	db.Connect()
	db.Migrate()
	defer db.Close()

	// Initialize Auth Module with CLERK Provider
	authRepo := auth.NewRepository()
	clerkAuthProvider := saasAuth.NewClerkAuthProvider()
	authSvc := auth.NewService(clerkAuthProvider, authRepo)
	authHandler := auth.NewHandler(authSvc)

	// --- Realtime / WebSocket Init ---
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}

	// 1. Redis Adapter
	redisAdapter := realtime.NewRedisAdapter(redisAddr)

	// 2. Hub
	hub := realtime.NewHub(redisAdapter)
	go hub.Run()

	// 3. System Monitor
	monitor := realtime.NewMonitor(hub)
	monitor.Start()

	// 4. Docker Monitor (Workspace Resources)
	dockerMonitor := deploy.NewDockerMonitor(hub)
	dockerMonitor.Start()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   saasCorsAllowedOrigins(),
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Routes
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok", "edition":"saas"}`))
	})

	// WebSocket Route
	r.Get("/api/ws", func(w http.ResponseWriter, r *http.Request) {
		realtime.HandleWs(hub, w, r)
	})

	r.Route("/api", func(r chi.Router) {
		// API routes will be mounted here
		authHandler.RegisterRoutes(r)

		// Team Module
		teamRepo := team.NewRepository()
		teamSvc := team.NewService(teamRepo)
		teamHandler := team.NewHandler(teamSvc, authSvc)
		teamHandler.RegisterRoutes(r)

		// Deploy Module
		deployRepo := deploy.NewRepository()
		manifestGenerator := deploy.NewManifestGenerator()

		// Init Docker Client (Ideally this connects to vCluster or Host management plane)
		// For SaaS, "Docker" might be restricted or replaced by K8s client only.
		// But for compatibility, we might keep it nil or restricted.
		dockerClient, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
		if err != nil {
			log.Printf("Docker client init failed (Expected in SaaS if using K8s only): %v", err)
			dockerClient = nil
		}

		// Workspace Module
		workspaceRepo := workspace.NewRepository()

		// Tenant Provisioner (SaaS = VCluster)
		vClusterProvisioner := saasTenant.NewVClusterProvisioner()

		deploySvc := deploy.NewService(deployRepo, workspaceRepo, manifestGenerator, hub, dockerClient, vClusterProvisioner)
		deployHandler := deploy.NewHandler(deploySvc, authSvc)
		deployHandler.RegisterRoutes(r)

		// Workspace Service
		workspaceSvc := workspace.NewService(workspaceRepo)
		workspaceHandler := workspace.NewHandler(workspaceSvc, authSvc, deploySvc)
		workspaceHandler.RegisterRoutes(r)

		r.Get("/version", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"version":"0.1.0-saas"}`))
		})
	})

	// Start Async Init
	go func() {
		_ = deploy.Init()
	}()

	log.Printf("SaaS Server starting on port %s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

// saasCorsAllowedOrigins returns CORS_ALLOWED_ORIGINS (comma-separated) or local dev defaults.
func saasCorsAllowedOrigins() []string {
	if v := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS")); v != "" {
		parts := strings.Split(v, ",")
		var out []string
		for _, p := range parts {
			if s := strings.TrimSpace(p); s != "" {
				out = append(out, s)
			}
		}
		if len(out) > 0 {
			return out
		}
	}
	return []string{"http://localhost:3000", "http://localhost:80", "http://127.0.0.1:3000"}
}
