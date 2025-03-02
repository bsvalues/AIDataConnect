#!/bin/bash

# RAG Drive FTP Hub Database Backup Script
# This script creates a backup of the PostgreSQL database

# Exit on error
set -e

# Configuration
TIMESTAMP=$(date +%Y%m%d%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="$BACKUP_DIR/ragdrive_db_backup_$TIMESTAMP.sql"
LOG_FILE="./logs/db-backup.log"

# Create necessary directories
mkdir -p "$BACKUP_DIR"
mkdir -p ./logs

# Log function
log() {
  local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

log "Starting database backup process..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  # Try to load from .env file
  if [ -f ".env" ]; then
    source .env
  fi
  
  if [ -z "$DATABASE_URL" ]; then
    log "ERROR: DATABASE_URL environment variable is not set."
    exit 1
  fi
fi

# Extract database connection details from DATABASE_URL
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\).*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\).*/\1/p')

# If any of these are empty, display an error
if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
  log "ERROR: Unable to parse DATABASE_URL correctly."
  log "Make sure DATABASE_URL is in the format: postgres://username:password@host:port/database"
  exit 1
fi

# Create backup
log "Creating backup of $DB_NAME at $DB_HOST..."
PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -F p -f "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
  # Get file size
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  log "Backup completed successfully: $BACKUP_FILE ($BACKUP_SIZE)"
else
  log "ERROR: Backup failed!"
  exit 1
fi

# Compress the backup
log "Compressing backup..."
gzip -f "$BACKUP_FILE"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

if [ -f "$COMPRESSED_FILE" ]; then
  COMPRESSED_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
  log "Backup compressed: $COMPRESSED_FILE ($COMPRESSED_SIZE)"
else
  log "WARNING: Compression failed, but uncompressed backup is available."
fi

# List previous backups
log "Available backups:"
ls -lh "$BACKUP_DIR" | grep -v "total" | tee -a "$LOG_FILE"

# Clean old backups (keep last 5)
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR" | wc -l)
if [ $BACKUP_COUNT -gt 5 ]; then
  log "Cleaning old backups (keeping last 5)..."
  ls -t "$BACKUP_DIR" | tail -n +6 | xargs -I {} rm "$BACKUP_DIR/{}"
  log "Old backups removed."
fi

log "Backup process completed successfully!"