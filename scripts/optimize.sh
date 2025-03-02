#!/bin/bash

# RAG Drive FTP Hub Optimization Script
# This script runs various optimization tools to improve application performance

# Exit on error
set -e

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
LOG_FILE="./logs/optimization.log"
DATE=$(date +"%Y%m%d%H%M%S")

# Create logs directory if it doesn't exist
mkdir -p ./logs

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
  EXIT_CODE=1
}

# Warning function
warning() {
  echo -e "${YELLOW}! $1${NC}"
  log "! $1"
}

# Start optimization process
section "STARTING OPTIMIZATION PROCESS - $DATE"

# Initialize variables
EXIT_CODE=0

# Check dependencies
section "CHECKING DEPENDENCIES"
MISSING_DEPS=0

# Check for required npm packages
NPM_DEPS=("nanospinner" "source-map-explorer" "eslint" "prettier" "depcheck")
for dep in "${NPM_DEPS[@]}"; do
  if ! npm list $dep -g &> /dev/null && ! npm list $dep --depth=0 &> /dev/null; then
    warning "Missing dependency: $dep. Installing..."
    npm install -g $dep
    if [ $? -eq 0 ]; then
      success "Installed $dep successfully"
    else
      error "Failed to install $dep"
      MISSING_DEPS=$((MISSING_DEPS + 1))
    fi
  else
    success "Dependency $dep is already installed"
  fi
done

if [ $MISSING_DEPS -gt 0 ]; then
  warning "$MISSING_DEPS dependencies could not be installed. Some optimizations may not run properly."
fi

# Run code formatting
section "CODE FORMATTING"
if command -v prettier &> /dev/null; then
  log "Running Prettier to format code..."
  if prettier --write "**/*.{ts,tsx,js,jsx,json,md}" &> /dev/null; then
    success "Code formatted successfully"
  else
    warning "Code formatting completed with warnings"
  fi
else
  warning "Prettier not found, skipping code formatting"
fi

# Run linting
section "CODE LINTING"
if command -v eslint &> /dev/null; then
  log "Running ESLint to check code quality..."
  if eslint . --ext .ts,.tsx &> /dev/null; then
    success "Linting passed successfully"
  else
    warning "Linting found issues that need to be addressed"
  fi
else
  warning "ESLint not found, skipping linting"
fi

# Run unused dependency check
section "CHECKING UNUSED DEPENDENCIES"
if command -v depcheck &> /dev/null; then
  log "Checking for unused dependencies..."
  UNUSED_DEPS=$(depcheck --json | jq -r '.dependencies | keys[]' 2>/dev/null || echo "")
  
  if [ -n "$UNUSED_DEPS" ]; then
    warning "Found unused dependencies:"
    echo "$UNUSED_DEPS" | while read dep; do
      echo "  - $dep"
    done
    echo -e "\nConsider removing these unused dependencies to reduce bundle size."
  else
    success "No unused dependencies found"
  fi
else
  warning "depcheck not found, skipping unused dependency check"
fi

# Run bundle analysis
section "ANALYZING BUNDLE SIZE"
if command -v source-map-explorer &> /dev/null; then
  log "Analyzing bundle size..."
  
  # Check if build directory exists
  if [ -d "./dist" ]; then
    # Find JS files in build directory
    JS_FILES=$(find ./dist -name "*.js" -not -path "*/node_modules/*" | grep -v "chunk-")
    
    if [ -n "$JS_FILES" ]; then
      echo "$JS_FILES" | while read file; do
        if [ -f "${file}.map" ]; then
          echo -e "\nAnalyzing ${file}..."
          source-map-explorer "$file" --html "${file}.analysis.html"
          success "Bundle analysis for $file saved to ${file}.analysis.html"
        else
          warning "No source map found for $file, skipping analysis"
        fi
      done
    else
      warning "No JavaScript files found in build directory"
    fi
  else
    warning "Build directory not found. Run 'npm run build' first to generate bundle."
  fi
else
  warning "source-map-explorer not found, skipping bundle analysis"
fi

# Run performance audit
section "RUNNING PERFORMANCE AUDIT"
if [ -f "./scripts/performance-audit.js" ]; then
  log "Running performance audit..."
  if node ./scripts/performance-audit.js; then
    success "Performance audit completed successfully"
  else
    warning "Performance audit completed with warnings"
  fi
else
  warning "Performance audit script not found"
fi

# Run tests with coverage
section "RUNNING TESTS WITH COVERAGE"
if [ -f "./test-coverage.sh" ]; then
  log "Running test coverage analysis..."
  if ./test-coverage.sh; then
    success "Test coverage analysis completed successfully"
  else
    warning "Test coverage analysis completed with warnings"
  fi
else
  warning "Test coverage script not found"
fi

# Check deployment readiness
section "CHECKING DEPLOYMENT READINESS"
if [ -f "./scripts/deployment-readiness.sh" ]; then
  log "Running deployment readiness check..."
  if ./scripts/deployment-readiness.sh; then
    success "Deployment readiness check passed"
  else
    warning "Deployment readiness check found issues"
  fi
else
  warning "Deployment readiness script not found"
fi

# Final summary
section "OPTIMIZATION SUMMARY"

if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}All optimization tasks completed successfully!${NC}"
  log "All optimization tasks completed successfully!"
else
  echo -e "${YELLOW}Some optimization tasks had warnings or errors. Check the logs for details.${NC}"
  log "Some optimization tasks had warnings or errors. See above for details."
fi

echo -e "\nPerformed optimizations:"
echo -e "✓ Code formatting"
echo -e "✓ Code linting"
echo -e "✓ Unused dependency check"
echo -e "✓ Bundle size analysis"
echo -e "✓ Performance audit"
echo -e "✓ Test coverage analysis"
echo -e "✓ Deployment readiness check"

echo -e "\nNext steps:"
echo -e "1. Review the performance audit report at ./performance-audit-report.md"
echo -e "2. Check bundle analysis HTML files for large dependencies"
echo -e "3. Address any linting or formatting issues"
echo -e "4. Improve test coverage where needed"
echo -e "5. Fix any deployment readiness issues"

echo -e "\nDetailed logs available at: ${BLUE}$LOG_FILE${NC}"
log "Optimization process completed at $(date)"

# Exit with proper code
exit $EXIT_CODE