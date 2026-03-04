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

# Ensure deps are tidy (fixes missing sum entries for transitive deps)
RUN go mod tidy

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/api

# Run Stage
FROM alpine:3.21

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata helm docker-cli docker-cli-compose curl

# Install Kubectl
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x ./kubectl && \
    mv ./kubectl /usr/local/bin/kubectl

# Install Kind
RUN curl -Lo ./kind "https://kind.sigs.k8s.io/dl/v0.31.0/kind-linux-amd64" && \
    chmod +x ./kind && \
    mv ./kind /usr/local/bin/kind

# Copy the binary from the builder stage
COPY --from=builder /app/main .
COPY --from=builder /app/migrations ./migrations

# Expose the application port
EXPOSE 8080

# Run the binary
CMD ["./main"]
