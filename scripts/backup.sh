#!/bin/bash

# Collabora Online Standalone - Backup Script
# Creates backups of database and document storage

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

cd "$PROJECT_DIR"

# Load environment variables
source .env

echo -e "${GREEN}Starting backup...${NC}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Determine docker compose command
if command -v docker compose &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Backup PostgreSQL database
echo -e "${GREEN}Backing up database...${NC}"
$COMPOSE_CMD exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_DIR/database_${TIMESTAMP}.sql"
gzip "$BACKUP_DIR/database_${TIMESTAMP}.sql"
echo -e "  ✓ Database backed up to database_${TIMESTAMP}.sql.gz"

# Backup document storage
echo -e "${GREEN}Backing up document storage...${NC}"
docker run --rm \
    -v collabora-standalone_document-storage:/data \
    -v "$BACKUP_DIR":/backup \
    alpine tar czf "/backup/documents_${TIMESTAMP}.tar.gz" -C /data .
echo -e "  ✓ Documents backed up to documents_${TIMESTAMP}.tar.gz"

# Cleanup old backups (keep last 7 days)
echo -e "${GREEN}Cleaning up old backups...${NC}"
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
echo -e "  ✓ Old backups cleaned up"

echo ""
echo -e "${GREEN}Backup complete!${NC}"
echo "Backup location: $BACKUP_DIR"
ls -lh "$BACKUP_DIR"/*_${TIMESTAMP}.*
