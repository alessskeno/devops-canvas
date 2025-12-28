package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"

	"devops-canvas-backend/internal/auth"
	"devops-canvas-backend/internal/db"
	"devops-canvas-backend/internal/deploy"
	"devops-canvas-backend/internal/team"
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
	authSvc := auth.NewService(authRepo)
	authHandler := auth.NewHandler(authSvc)

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

	r.Route("/api", func(r chi.Router) {
		// API routes will be mounted here
		authHandler.RegisterRoutes(r)
		
		// Team Module
		teamRepo := team.NewRepository()
		teamSvc := team.NewService(teamRepo)
		teamHandler := team.NewHandler(teamSvc, authSvc)
		teamHandler.RegisterRoutes(r)

		// Workspace Module
		workspaceRepo := workspace.NewRepository()
		workspaceSvc := workspace.NewService(workspaceRepo)
		workspaceHandler := workspace.NewHandler(workspaceSvc, authSvc)
		workspaceHandler.RegisterRoutes(r)

		// Deploy Module
		deployRepo := deploy.NewRepository()
        manifestGenerator := deploy.NewManifestGenerator()
		deploySvc := deploy.NewService(deployRepo, workspaceRepo, manifestGenerator)
		deployHandler := deploy.NewHandler(deploySvc, authSvc)
		deployHandler.RegisterRoutes(r)

		r.Get("/version", func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"version":"0.1.0"}`))
		})
	})

	log.Printf("Server starting on port %s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
