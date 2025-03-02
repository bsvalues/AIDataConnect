#!/bin/bash

# RAG Drive FTP Hub Server Restart Script
# This script restarts the application server

# Exit on error
set -e

# Configuration
ENV_FILE=".env"
LOG_FILE="./logs/restart.log"

# Create logs directory if it doesn't exist
mkdir -p ./logs

# Log function
log() {
  local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

log "Starting server restart process..."

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
  log "WARNING: $ENV_FILE does not exist. Using default environment variables."
fi

# Check for running processes and stop them
log "Checking for running processes..."
if pgrep -f "node.*dist/index.js" > /dev/null; then
  log "Stopping running server processes..."
  pkill -f "node.*dist/index.js" || log "Failed to stop server processes"
  sleep 2
fi

# Check if npm processes need to be stopped
if pgrep -f "npm run dev" > /dev/null; then
  log "Stopping npm run dev processes..."
  pkill -f "npm run dev" || log "Failed to stop npm processes"
  sleep 2
fi

# Clean dist directory if it exists
if [ -d "dist" ]; then
  log "Cleaning dist directory..."
  rm -rf dist
fi

# Build the application
log "Building application..."
npm run build

# Start the server based on environment
if [ "$NODE_ENV" = "production" ]; then
  log "Starting production server..."
  NODE_ENV=production node dist/index.js > ./logs/server.log 2>&1 &
else
  log "Starting development server..."
  npm run dev > ./logs/server.log 2>&1 &
fi

# Check if server started successfully
sleep 5
if pgrep -f "node.*dist/index.js" > /dev/null || pgrep -f "npm run dev" > /dev/null; then
  log "Server restarted successfully!"
  log "Server logs available at: ./logs/server.log"
else
  log "ERROR: Failed to restart server. Check logs for details."
  exit 1
fi