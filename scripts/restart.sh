#!/bin/bash

# RAG Drive FTP Hub Server Restart Script
# This script gracefully restarts the application server

# Exit on error
set -e

# Configuration
LOG_FILE="./logs/server-restart.log"
PID_FILE="./server.pid"

# Create logs directory if it doesn't exist
mkdir -p ./logs

# Log function
log() {
  local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

# Check if running in a Docker container
IN_CONTAINER=false
if [ -f "/.dockerenv" ]; then
  IN_CONTAINER=true
  log "Detected Docker container environment"
fi

# Function to check if a port is in use
is_port_in_use() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -i:$1 >/dev/null 2>&1
    return $?
  elif command -v nc >/dev/null 2>&1; then
    nc -z localhost $1 >/dev/null 2>&1
    return $?
  else
    (echo > /dev/tcp/localhost/$1) >/dev/null 2>&1
    return $?
  fi
}

log "Starting server restart process..."

# Check if the app is running in container mode
if $IN_CONTAINER; then
  log "Container mode: Using Docker commands for restart"
  
  # Get the container name/ID
  CONTAINER_ID=$(hostname)
  log "Container ID: $CONTAINER_ID"
  
  # For Docker deployments, we'll send a SIGTERM to the Node process
  log "Sending SIGTERM signal to Node process..."
  if pkill -TERM -f "node"; then
    log "Signal sent successfully"
  else
    log "No Node process found to terminate"
  fi
  
  # Wait for the process to terminate
  log "Waiting for server to shut down..."
  sleep 3
  
  # Check if the app is still running on port 5000
  if is_port_in_use 5000; then
    log "WARNING: Server is still running on port 5000, forcing kill..."
    pkill -KILL -f "node" || true
  fi
  
  # Start the server again
  log "Starting server again..."
  if [ -f "package.json" ]; then
    nohup npm run dev > ./logs/server.log 2>&1 &
    log "Server restarted with npm run dev"
  else
    log "ERROR: package.json not found, cannot restart server"
    exit 1
  fi
  
else
  # Standard process-based approach
  log "Standard mode: Using process signals for restart"
  
  # Check if we have a PID file
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    log "Found PID file with process ID: $PID"
    
    # Check if the process is still running
    if ps -p $PID > /dev/null; then
      log "Stopping server with PID $PID..."
      kill $PID
      
      # Wait for the process to terminate
      log "Waiting for server to shut down..."
      for i in {1..10}; do
        if ! ps -p $PID > /dev/null; then
          break
        fi
        sleep 1
      done
      
      # If still running, force kill
      if ps -p $PID > /dev/null; then
        log "Server did not shut down gracefully, force killing..."
        kill -9 $PID
      fi
    else
      log "Process with PID $PID is not running"
    fi
  else
    log "No PID file found, checking for server on default port 5000..."
    
    # Check if something is running on port 5000
    if is_port_in_use 5000; then
      log "Found server running on port 5000, attempting to stop it..."
      
      # Try to find the process ID
      if command -v lsof >/dev/null 2>&1; then
        SERVER_PID=$(lsof -t -i:5000)
        if [ -n "$SERVER_PID" ]; then
          log "Stopping server with PID $SERVER_PID..."
          kill $SERVER_PID
          
          # Wait for the process to terminate
          for i in {1..5}; do
            if ! is_port_in_use 5000; then
              break
            fi
            sleep 1
          done
          
          # If still running, force kill
          if is_port_in_use 5000; then
            log "Server did not shut down gracefully, force killing..."
            kill -9 $SERVER_PID
          fi
        fi
      else
        log "lsof command not available, cannot find process ID"
      fi
    else
      log "No server running on port 5000"
    fi
  fi
  
  # Start the server again
  log "Starting server again..."
  if [ -f "package.json" ]; then
    nohup npm run dev > ./logs/server.log 2>&1 &
    NEW_PID=$!
    echo $NEW_PID > "$PID_FILE"
    log "Server restarted with PID $NEW_PID"
  else
    log "ERROR: package.json not found, cannot restart server"
    exit 1
  fi
fi

# Final check to make sure server is running
sleep 5
if is_port_in_use 5000; then
  log "Server successfully restarted and listening on port 5000"
else
  log "ERROR: Server failed to start properly"
  tail -n 20 ./logs/server.log | tee -a "$LOG_FILE"
  exit 1
fi

log "Restart process completed successfully"