#!/bin/bash

# RAG Drive FTP Hub Database Restore Script
# This script restores a PostgreSQL database from a backup

# Exit on error
set -e

# Configuration
BACKUP_DIR="./backups"
LOG_FILE="./logs/db-restore.log"

# Create logs directory if it doesn't exist
mkdir -p ./logs

# Log function
log() {
  local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

log "Starting database restore process..."

# Check if backup file is specified
if [ -z "$1" ]; then
  log "ERROR: No backup file specified."
  log "Usage: $0 <backup_file>"
  log "Available backups:"
  ls -lh "$BACKUP_DIR" | grep -v "total" | tee -a "$LOG_FILE"
  exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  log "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

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

# Ask for confirmation
echo -n "WARNING: This will OVERWRITE the current database ($DB_NAME). Are you sure? [y/N] "
read CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  log "Restore canceled by user."
  exit 0
fi

# Check if the backup file is compressed
if [[ "$BACKUP_FILE" == *.gz ]]; then
  log "Detected compressed backup, decompressing..."
  TEMP_FILE="/tmp/ragdrive_db_restore_$(date +%Y%m%d%H%M%S).sql"
  gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
  BACKUP_FILE="$TEMP_FILE"
  log "Decompressed to temporary file: $TEMP_FILE"
fi

# Create backup of current database before restore
TIMESTAMP=$(date +%Y%m%d%H%M%S)
PRE_RESTORE_BACKUP="$BACKUP_DIR/pre_restore_backup_$TIMESTAMP.sql.gz"
log "Creating backup of current database before restore..."
PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -F p | gzip > "$PRE_RESTORE_BACKUP"

if [ $? -eq 0 ]; then
  log "Pre-restore backup created: $PRE_RESTORE_BACKUP"
else
  log "WARNING: Failed to create pre-restore backup, but continuing with restore."
fi

# Restore database
log "Restoring database from backup: $BACKUP_FILE"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$BACKUP_FILE"

# Check if restore was successful
if [ $? -eq 0 ]; then
  log "Database restored successfully!"
else
  log "ERROR: Database restore failed!"
  log "You may want to restore from the pre-restore backup: $PRE_RESTORE_BACKUP"
  exit 1
fi

# Clean up temporary file if it was created
if [[ "$TEMP_FILE" == "/tmp/ragdrive_db_restore_"* ]]; then
  log "Cleaning up temporary file..."
  rm "$TEMP_FILE"
fi

log "Restore process completed successfully."