# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Copy package.json only to force fresh lockfile generation compatible with container
COPY package.json ./

# Install dependencies (--legacy-peer-deps for react-xtermjs peer @xterm/xterm ^5.5.0 vs project ^6.0.0)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts from builder stage (Vite builds to /dist by default)
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
