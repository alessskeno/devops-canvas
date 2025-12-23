package db

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

func Connect() {
	var err error
	dbHost := os.Getenv("DB_HOST")
	dbUser := os.Getenv("DB_USER")
	dbPass := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")
	dbPort := "5432"

	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s", dbUser, dbPass, dbHost, dbPort, dbName)

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		log.Fatal("Unable to parse DB config:", err)
	}

	// Retry logic for DB connection
	for i := 0; i < 10; i++ {
		Pool, err = pgxpool.NewWithConfig(context.Background(), config)
		if err == nil {
			err = Pool.Ping(context.Background())
			if err == nil {
				log.Println("Successfully connected to PostgreSQL")
				return
			}
		}
		log.Printf("Failed to connect to DB, retrying in 2s (%d/10): %v", i+1, err)
		time.Sleep(2 * time.Second)
	}

	log.Fatal("Could not connect to database after retries")
}

func Close() {
	if Pool != nil {
		Pool.Close()
	}
}
