package main

import (
	"log"
	"net/http"
	"os"

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
    "devops-canvas-backend/internal/tenant"
	"devops-canvas-backend/internal/workspace"
)

func main() {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Connect to DB
	db.Connect()
	db.Migrate()
	defer db.Close()

	// Initialize Auth Module
	authRepo := auth.NewRepository()
    localAuthProvider := auth.NewLocalAuthProvider(authRepo) // Use Local Strategy for OSS
	authSvc := auth.NewService(localAuthProvider, authRepo)
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
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost", "http://localhost:80"}, // Frontend URL
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300, // Maximum value not ignored by any of major browsers
	}))

	// Routes
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
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

		// Workspace Module
		// Deploy Module (Moved up to satisfy dependency)
		deployRepo := deploy.NewRepository()
        manifestGenerator := deploy.NewManifestGenerator()
        
		// Init Docker Client
        dockerClient, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
        if err != nil {
            log.Printf("Failed to create Docker Client: %v", err)
            // Continue but logs might fail
            dockerClient = nil
        }
        
        // Workspace Module (Repo Needed for Deploy)
		workspaceRepo := workspace.NewRepository()
        
        // Tenant Provisioner (OSS = SingleTenant)
        // In SaaS entrypoint, this will be VClusterProvisioner
        tenantProvisioner := tenant.NewSingleTenantProvisioner()
        
		deploySvc := deploy.NewService(deployRepo, workspaceRepo, manifestGenerator, hub, dockerClient, tenantProvisioner) 
		deployHandler := deploy.NewHandler(deploySvc, authSvc)
		deployHandler.RegisterRoutes(r)

        // Workspace Module Svc & Handler
		workspaceSvc := workspace.NewService(workspaceRepo)
		workspaceHandler := workspace.NewHandler(workspaceSvc, authSvc, deploySvc) // Injected Deploy Svc
		workspaceHandler.RegisterRoutes(r)

		r.Get("/version", func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"version":"0.1.0"}`))
		})
	})

	// Start Async Helm Repo Init
	go func() {
		log.Println("Initializing Helm Repositories...")
		if err := deploy.InitHelmRepos(); err != nil {
			log.Printf("Failed to initialize Helm Repos: %v", err)
		} else {
			log.Println("Helm Repositories Initialized Successfully")
		}
	}()

	log.Printf("Server starting on port %s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
