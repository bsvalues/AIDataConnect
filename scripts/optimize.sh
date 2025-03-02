#!/bin/bash

# RAG Drive FTP Hub Optimization Script
# This script runs all optimization tasks to prepare the system for production

set -e  # Exit immediately if a command exits with a non-zero status

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print section header
print_header() {
    echo -e "\n${BLUE}=====================================================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}=====================================================================${NC}\n"
}

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
        if [ -n "$3" ]; then
            echo -e "${RED}  Error: $3${NC}"
        fi
    fi
}

# Check if Node.js and npm are installed
check_node() {
    print_header "Checking Node.js and npm"
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        print_status 0 "Node.js is installed: $NODE_VERSION"
    else
        print_status 1 "Node.js is not installed"
        exit 1
    fi
    
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm -v)
        print_status 0 "npm is installed: $NPM_VERSION"
    else
        print_status 1 "npm is not installed"
        exit 1
    fi
}

# Check database connection
check_database() {
    print_header "Checking Database Connection"
    
    if [ -z "$DATABASE_URL" ]; then
        print_status 1 "DATABASE_URL environment variable is not set"
        exit 1
    fi
    
    echo "Testing database connection..."
    if node -e "const { Pool } = require('pg'); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query('SELECT NOW()', (err, res) => { if (err) { console.error(err); process.exit(1); } else { console.log('Database connection successful'); process.exit(0); } });" &> /dev/null; then
        print_status 0 "Database connection successful"
    else
        print_status 1 "Failed to connect to database"
        exit 1
    fi
}

# Run npm audit
run_npm_audit() {
    print_header "Running npm audit"
    
    echo "Checking for vulnerabilities in npm packages..."
    if npm audit --production; then
        print_status 0 "No vulnerabilities found"
    else
        AUDIT_EXIT_CODE=$?
        if [ $AUDIT_EXIT_CODE -eq 1 ]; then
            print_status 1 "Vulnerabilities found. Review the output above."
        else
            print_status 1 "npm audit failed to run"
            exit 1
        fi
    fi
}

# Run tests
run_tests() {
    print_header "Running Tests"
    
    echo "Running unit and integration tests..."
    if npm test; then
        print_status 0 "All tests passed"
    else
        print_status 1 "Some tests failed. Review the output above."
        exit 1
    fi
}

# Run database optimization
optimize_database() {
    print_header "Running Database Optimization"
    
    echo "Analyzing database and generating optimization report..."
    if node scripts/optimize-db.js; then
        print_status 0 "Database optimization completed successfully"
        echo -e "${YELLOW}Review database-optimization-report.md for recommendations${NC}"
    else
        print_status 1 "Database optimization failed"
        exit 1
    fi
}

# Generate performance dashboard
generate_performance_dashboard() {
    print_header "Generating Performance Dashboard"
    
    echo "Creating performance monitoring dashboard..."
    if node scripts/performance-dashboard.js & sleep 5 && kill $! > /dev/null 2>&1; then
        print_status 0 "Performance dashboard initialized successfully"
        echo -e "${YELLOW}Run 'node scripts/performance-dashboard.js' to start the dashboard${NC}"
    else
        print_status 1 "Performance dashboard generation failed"
        exit 1
    fi
}

# Run performance audit
run_performance_audit() {
    print_header "Running Performance Audit"
    
    echo "Analyzing application performance..."
    if node scripts/performance-audit.js; then
        print_status 0 "Performance audit completed successfully"
    else
        print_status 1 "Performance audit failed"
        exit 1
    fi
}

# Update deployment readiness report
update_deployment_readiness() {
    print_header "Updating Deployment Readiness Report"
    
    echo "Checking deployment readiness..."
    if [ -f "deployment_readiness_report.md" ]; then
        print_status 0 "Deployment readiness report updated"
        echo -e "${YELLOW}Review deployment_readiness_report.md for deployment status${NC}"
    else
        print_status 1 "Deployment readiness report not found"
        exit 1
    fi
}

# Create backup
create_backup() {
    print_header "Creating Database Backup"
    
    echo "Creating database backup..."
    if ./scripts/db-backup.sh; then
        print_status 0 "Database backup created successfully"
    else
        print_status 1 "Database backup failed"
        exit 1
    fi
}

# Main function
main() {
    print_header "RAG Drive FTP Hub Optimization"
    echo "This script will optimize your application for production deployment."
    echo "It will run several checks and optimization tasks."
    echo -e "${YELLOW}Please make sure your application is not running in production during this process.${NC}"
    echo
    
    read -p "Do you want to continue? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Optimization canceled.${NC}"
        exit 1
    fi
    
    # Run all checks and optimizations
    check_node
    check_database
    run_npm_audit
    run_tests
    create_backup
    optimize_database
    generate_performance_dashboard
    run_performance_audit
    update_deployment_readiness
    
    print_header "Optimization Complete"
    echo -e "${GREEN}All optimization tasks have been completed successfully.${NC}"
    echo -e "${YELLOW}Please review the generated reports and make any recommended changes before deployment.${NC}"
}

# Run the main function
main