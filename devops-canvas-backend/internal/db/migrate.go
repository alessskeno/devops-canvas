package db

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"sort"
)

func Migrate() {
	log.Println("Running database migrations...")

	// Read all SQL files from migrations directory
	// In Docker, the migrations folder is copied to the root /app/migrations
	files, err := filepath.Glob("migrations/*.sql")
	if err != nil {
		log.Fatalf("Failed to glob migration files: %v", err)
	}

	sort.Strings(files) // Ensure order (001, 002...)

	for _, file := range files {
		log.Printf("Applying migration: %s", file)
		content, err := os.ReadFile(file)
		if err != nil {
			log.Fatalf("Failed to read migration file %s: %v", file, err)
		}

		_, err = Pool.Exec(context.Background(), string(content))
		if err != nil {
			log.Fatalf("Failed to execute migration %s: %v", file, err)
		}
	}

	log.Println("Migrations completed successfully.")
}
