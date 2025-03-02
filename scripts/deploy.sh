#!/bin/bash

# RAG Drive FTP Hub Deployment Script
# This script automates the deployment process

# Exit on error
set -e

# Configuration
ENVIRONMENT=$1
APP_NAME="ragdrive"
TIMESTAMP=$(date +%Y%m%d%H%M%S)

# Check environment argument
if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <environment>"
    echo "Environments: staging, production"
    exit 1
fi

if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
    echo "Invalid environment. Use 'staging' or 'production'"
    exit 1
fi

echo "Deploying to $ENVIRONMENT environment..."

# Build the application
echo "Building application..."
npm run build

# Create deployment directory
DEPLOY_DIR="deploy_${ENVIRONMENT}_${TIMESTAMP}"
mkdir -p "$DEPLOY_DIR"

# Copy build artifacts
echo "Preparing deployment package..."
cp -r dist "$DEPLOY_DIR/"
cp package.json "$DEPLOY_DIR/"
cp package-lock.json "$DEPLOY_DIR/"
cp Dockerfile "$DEPLOY_DIR/"
cp docker-compose.yml "$DEPLOY_DIR/"
cp -r .github "$DEPLOY_DIR/"

# Create environment-specific .env file
if [ "$ENVIRONMENT" = "staging" ]; then
    echo "Creating staging environment configuration..."
    cp .env.staging "$DEPLOY_DIR/.env"
elif [ "$ENVIRONMENT" = "production" ]; then
    echo "Creating production environment configuration..."
    cp .env.production "$DEPLOY_DIR/.env"
fi

# Create necessary directories
mkdir -p "$DEPLOY_DIR/uploads"
mkdir -p "$DEPLOY_DIR/logs"

# Create deployment archive
ARCHIVE_NAME="${APP_NAME}_${ENVIRONMENT}_${TIMESTAMP}.tar.gz"
echo "Creating deployment archive: $ARCHIVE_NAME"
tar -czf "$ARCHIVE_NAME" "$DEPLOY_DIR"

# Clean up temporary directory
rm -rf "$DEPLOY_DIR"

echo "Deployment package created: $ARCHIVE_NAME"
echo "Upload this package to your $ENVIRONMENT server and extract it"
echo "Then run: cd ${DEPLOY_DIR} && docker-compose up -d"

# Display next steps
echo ""
echo "Deployment Steps:"
echo "1. Transfer $ARCHIVE_NAME to the $ENVIRONMENT server"
echo "2. Extract the archive: tar -xzf $ARCHIVE_NAME"
echo "3. Navigate to the directory: cd $DEPLOY_DIR"
echo "4. Start the application: docker-compose up -d"
echo "5. Verify the deployment: docker-compose ps"
echo ""
echo "Deployment completed successfully!"