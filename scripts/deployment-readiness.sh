#!/bin/bash

# RAG Drive FTP Hub Deployment Readiness Script
# This script checks if the application is ready for deployment

# Exit on error
set -e

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Configuration
LOG_FILE="./logs/deployment-readiness.log"

# Create logs directory if it doesn't exist
mkdir -p ./logs

# Log function
log() {
  local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  echo -e "[$timestamp] $1" | tee -a "$LOG_FILE"
}

# Check function
check() {
  local name="$1"
  local command="$2"
  local expected_exit="$3"
  
  echo -en "Checking $name... "
  tee -a "$LOG_FILE" <<< "Checking $name..."
  
  eval "$command" >> "$LOG_FILE" 2>&1
  local exit_code=$?
  
  if [ $exit_code -eq $expected_exit ]; then
    echo -e "${GREEN}PASS${NC}"
    tee -a "$LOG_FILE" <<< "Result: PASS"
  else
    echo -e "${RED}FAIL${NC}"
    tee -a "$LOG_FILE" <<< "Result: FAIL (Exit code: $exit_code, Expected: $expected_exit)"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
  fi
  
  echo "" >> "$LOG_FILE"
}

# Initialize
FAILED_CHECKS=0
log "Starting deployment readiness check..."

# Check Node.js version
NODE_VERSION=$(node -v)
REQUIRED_VERSION="v20"
if [[ "$NODE_VERSION" == $REQUIRED_VERSION* ]]; then
  echo -e "Node.js version: ${GREEN}$NODE_VERSION${NC} ✓"
  log "Node.js version: $NODE_VERSION ✓"
else
  echo -e "Node.js version: ${RED}$NODE_VERSION${NC} ✗ (Required: $REQUIRED_VERSION+)"
  log "Node.js version: $NODE_VERSION ✗ (Required: $REQUIRED_VERSION+)"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check npm version
NPM_VERSION=$(npm -v)
echo -e "npm version: ${GREEN}$NPM_VERSION${NC}"
log "npm version: $NPM_VERSION"

# Check environment file
if [ -f ".env" ]; then
  echo -e "Environment file: ${GREEN}Found${NC} ✓"
  log "Environment file: Found ✓"
else
  echo -e "Environment file: ${RED}Not found${NC} ✗"
  log "Environment file: Not found ✗"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check required environment variables
echo "Checking required environment variables..."
log "Checking required environment variables..."

# Load environment variables if file exists
if [ -f ".env" ]; then
  source .env
fi

ENV_VARS=("DATABASE_URL" "OPENAI_API_KEY")
for var in "${ENV_VARS[@]}"; do
  if [ -n "${!var}" ]; then
    echo -e "  $var: ${GREEN}Set${NC} ✓"
    log "  $var: Set ✓"
  else
    echo -e "  $var: ${RED}Not set${NC} ✗"
    log "  $var: Not set ✗"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
  fi
done

# Check test suite
echo "Running tests..."
log "Running tests..."
npm test --silent > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo -e "Test suite: ${GREEN}PASS${NC} ✓"
  log "Test suite: PASS ✓"
else
  echo -e "Test suite: ${RED}FAIL${NC} ✗"
  log "Test suite: FAIL ✗"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check build process
echo "Checking build process..."
log "Checking build process..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo -e "Build process: ${GREEN}PASS${NC} ✓"
  log "Build process: PASS ✓"
else
  echo -e "Build process: ${RED}FAIL${NC} ✗"
  log "Build process: FAIL ✗"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check database connectivity
echo "Checking database connectivity..."
log "Checking database connectivity..."
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection failed');
    process.exit(1);
  } else {
    console.log('Database connection successful');
    process.exit(0);
  }
});" > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo -e "Database connectivity: ${GREEN}PASS${NC} ✓"
  log "Database connectivity: PASS ✓"
else
  echo -e "Database connectivity: ${RED}FAIL${NC} ✗"
  log "Database connectivity: FAIL ✗"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check required directories
DIRS=("uploads" "logs")
for dir in "${DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo -e "Directory $dir: ${GREEN}Found${NC} ✓"
    log "Directory $dir: Found ✓"
  else
    echo -e "Directory $dir: ${YELLOW}Not found${NC} (will be created)"
    log "Directory $dir: Not found (will be created)"
    mkdir -p "$dir"
  fi
done

# Check required files for deployment
FILES=("package.json" "package-lock.json" "Dockerfile" "docker-compose.yml")
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "File $file: ${GREEN}Found${NC} ✓"
    log "File $file: Found ✓"
  else
    echo -e "File $file: ${RED}Not found${NC} ✗"
    log "File $file: Not found ✗"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
  fi
done

# Summary
echo ""
if [ $FAILED_CHECKS -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed! The application is ready for deployment.${NC}"
  log "✓ All checks passed! The application is ready for deployment."
else
  echo -e "${RED}✗ $FAILED_CHECKS check(s) failed. Please fix the issues before deployment.${NC}"
  log "✗ $FAILED_CHECKS check(s) failed. Please fix the issues before deployment."
fi

echo -e "\nDetailed logs available at: $LOG_FILE"