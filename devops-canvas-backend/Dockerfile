# Build Stage
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download all dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/api

# Run Stage
FROM alpine:3.18

WORKDIR /app

# Install runtime dependencies (e.g. for health checks or debugging)
RUN apk add --no-cache ca-certificates tzdata

# Copy the binary from the builder stage
COPY --from=builder /app/main .
COPY --from=builder /app/migrations ./migrations

# Expose the application port
EXPOSE 8080

# Run the binary
CMD ["./main"]
