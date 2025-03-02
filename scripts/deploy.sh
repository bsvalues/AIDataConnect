#!/bin/bash

# RAG Drive FTP Hub Deployment Script
# This script automates the deployment process

# Exit on error
set -e

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
LOG_FILE="./logs/deployment.log"
BACKUP_DIR="./backups"
VERSION=$(date +"%Y%m%d%H%M%S")

# Create logs and backups directories if they don't exist
mkdir -p ./logs
mkdir -p $BACKUP_DIR

# Log function
log() {
  local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  echo -e "[$timestamp] $1" | tee -a "$LOG_FILE"
}

# Section header function
section() {
  echo -e "\n${BLUE}==== $1 ====${NC}"
  log "==== $1 ===="
}

# Success function
success() {
  echo -e "${GREEN}✓ $1${NC}"
  log "✓ $1"
}

# Error function
error() {
  echo -e "${RED}✗ $1${NC}"
  log "✗ $1"
  exit 1
}

# Warning function
warning() {
  echo -e "${YELLOW}! $1${NC}"
  log "! $1"
}

# Start deployment
section "STARTING DEPLOYMENT - VERSION $VERSION"

# Check if git is available
if command -v git &> /dev/null; then
  # Get current git branch and commit
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  log "Deploying from branch: $BRANCH, commit: $COMMIT"
else
  log "Git not available, skipping branch/commit info"
fi

# Run deployment readiness check
section "RUNNING DEPLOYMENT READINESS CHECK"
if [ -f "./scripts/deployment-readiness.sh" ]; then
  log "Running deployment readiness check..."
  if ./scripts/deployment-readiness.sh; then
    success "Deployment readiness check passed"
  else
    error "Deployment readiness check failed. Please fix the issues before deploying."
  fi
else
  warning "Deployment readiness check script not found, skipping check"
fi

# Backup database
section "DATABASE BACKUP"
if [ -f "./scripts/db-backup.sh" ]; then
  log "Running database backup..."
  if ./scripts/db-backup.sh "pre_deploy_$VERSION"; then
    success "Database backup completed successfully"
  else
    error "Database backup failed"
  fi
else
  warning "Database backup script not found, skipping database backup"
fi

# Build the application
section "BUILDING APPLICATION"
log "Building the application..."
if npm run build; then
  success "Application built successfully"
else
  error "Application build failed"
fi

# Deploy using Docker (if Docker is available)
if command -v docker &> /dev/null && [ -f "docker-compose.yml" ]; then
  section "DOCKER DEPLOYMENT"
  log "Docker detected, using containerized deployment"
  
  # Build Docker images
  log "Building Docker image..."
  if docker-compose build; then
    success "Docker image built successfully"
  else
    error "Docker image build failed"
  fi
  
  # Stop existing containers
  log "Stopping existing containers..."
  docker-compose down || warning "No containers to stop or error stopping containers"
  
  # Start new containers
  log "Starting new containers..."
  if docker-compose up -d; then
    success "Containers started successfully"
  else
    error "Failed to start containers"
  fi
  
  # Check container health
  log "Checking container health..."
  sleep 10
  if docker-compose ps | grep -q "Up"; then
    success "Containers are running properly"
  else
    error "Containers are not running properly"
  fi
else
  section "STANDARD DEPLOYMENT"
  log "Docker not detected or docker-compose.yml not found, using standard deployment"
  
  # Stop and restart the server
  if [ -f "./scripts/restart.sh" ]; then
    log "Restarting server..."
    if ./scripts/restart.sh; then
      success "Server restarted successfully"
    else
      error "Failed to restart server"
    fi
  else
    warning "Restart script not found, attempting manual restart"
    log "Killing existing Node.js processes..."
    pkill -f "node" || warning "No Node.js processes found"
    
    log "Starting server..."
    nohup npm run dev > ./logs/server.log 2>&1 &
    PID=$!
    echo $PID > ./server.pid
    log "Server started with PID: $PID"
    
    # Wait for server to start
    log "Waiting for server to start..."
    sleep 5
    
    # Check if server is running
    if ps -p $PID > /dev/null; then
      success "Server is running with PID: $PID"
    else
      error "Server failed to start"
    fi
  fi
fi

# Verify deployment
section "VERIFYING DEPLOYMENT"
log "Checking if application is accessible..."

# Function to check if server is responding
check_server() {
  local attempt=1
  local max_attempts=5
  
  while [ $attempt -le $max_attempts ]; do
    log "Attempt $attempt of $max_attempts..."
    
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/ | grep -q "200\|3[0-9][0-9]"; then
      return 0  # Success
    fi
    
    sleep 3
    attempt=$((attempt + 1))
  done
  
  return 1  # Failure
}

if check_server; then
  success "Application is accessible"
else
  error "Application is not accessible after deployment"
fi

# Send deployment notification
section "DEPLOYMENT NOTIFICATION"
if [ -n "$SLACK_WEBHOOK_URL" ]; then
  log "Sending deployment notification to Slack..."
  
  # Prepare notification message
  MESSAGE="
    {
      \"text\": \"RAG Drive FTP Hub Deployment\",
      \"blocks\": [
        {
          \"type\": \"header\",
          \"text\": {
            \"type\": \"plain_text\",
            \"text\": \"🚀 Deployment Completed\",
            \"emoji\": true
          }
        },
        {
          \"type\": \"section\",
          \"fields\": [
            {
              \"type\": \"mrkdwn\",
              \"text\": \"*Environment:*\\nProduction\"
            },
            {
              \"type\": \"mrkdwn\",
              \"text\": \"*Version:*\\n$VERSION\"
            }
          ]
        },
        {
          \"type\": \"section\",
          \"fields\": [
            {
              \"type\": \"mrkdwn\",
              \"text\": \"*Branch:*\\n$BRANCH\"
            },
            {
              \"type\": \"mrkdwn\",
              \"text\": \"*Commit:*\\n$COMMIT\"
            }
          ]
        },
        {
          \"type\": \"section\",
          \"text\": {
            \"type\": \"mrkdwn\",
            \"text\": \"*Status:* ✅ Success\"
          }
        }
      ]
    }"
  
  # Send notification
  curl -s -X POST -H 'Content-type: application/json' --data "$MESSAGE" $SLACK_WEBHOOK_URL
  success "Notification sent"
else
  warning "SLACK_WEBHOOK_URL not set, skipping notification"
fi

# Deployment complete
section "DEPLOYMENT COMPLETED SUCCESSFULLY"
log "Deployment of version $VERSION completed at $(date)"
echo -e "${GREEN}Application deployed successfully!${NC}"
echo -e "Check ${BLUE}./logs/deployment.log${NC} for detailed logs"