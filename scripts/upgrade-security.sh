#!/bin/bash

# Collabora Online Standalone - Security Upgrade Script
# This script upgrades existing deployments to use secure passwords
# Run this if you deployed with older default/weak passwords

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Security Upgrade Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please run ./scripts/setup.sh first for new installations"
    exit 1
fi

# Check for insecure passwords
echo -e "${BLUE}Checking for insecure passwords...${NC}"
INSECURE_FOUND=false

if grep -qE "admin123" .env 2>/dev/null; then
    echo -e "  ${YELLOW}⚠ Found default Collabora admin password (admin123)${NC}"
    INSECURE_FOUND=true
fi

if grep -qE "collabora_dev_password" .env 2>/dev/null; then
    echo -e "  ${YELLOW}⚠ Found default database password${NC}"
    INSECURE_FOUND=true
fi

if grep -qE "dev-jwt-secret|dev-wopi-secret" .env 2>/dev/null; then
    echo -e "  ${YELLOW}⚠ Found development secrets${NC}"
    INSECURE_FOUND=true
fi

if grep -qE "CHANGE_ME" .env 2>/dev/null; then
    echo -e "  ${YELLOW}⚠ Found placeholder passwords that need to be changed${NC}"
    INSECURE_FOUND=true
fi

if [ "$INSECURE_FOUND" = false ]; then
    echo -e "  ${GREEN}✓ No obvious insecure passwords found${NC}"
    echo ""
    read -p "Do you still want to rotate all secrets? (y/N): " ROTATE_ANYWAY
    if [ "$ROTATE_ANYWAY" != "y" ] && [ "$ROTATE_ANYWAY" != "Y" ]; then
        echo "No changes made."
        exit 0
    fi
fi

echo ""

# Create backup
BACKUP_FILE=".env.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${BLUE}Creating backup: ${BACKUP_FILE}${NC}"
cp .env "$BACKUP_FILE"
echo -e "  ${GREEN}✓ Backup created${NC}"

# Generate new secrets
echo -e "${BLUE}Generating new secure secrets...${NC}"
NEW_JWT_SECRET=$(openssl rand -hex 32)
NEW_WOPI_SECRET=$(openssl rand -hex 32)
NEW_COLLABORA_ADMIN_PASSWORD=$(openssl rand -base64 12)
echo -e "  ${GREEN}✓ Secrets generated${NC}"

# Ask about database password
echo ""
echo -e "${YELLOW}Database password change requires additional steps.${NC}"
read -p "Do you want to change the database password? (y/N): " CHANGE_DB_PASS

if [ "$CHANGE_DB_PASS" = "y" ] || [ "$CHANGE_DB_PASS" = "Y" ]; then
    NEW_POSTGRES_PASSWORD=$(openssl rand -hex 16)
    CHANGE_DB=true
else
    CHANGE_DB=false
fi

# Update .env file
echo ""
echo -e "${BLUE}Updating .env file...${NC}"

# macOS compatible sed
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/JWT_SECRET=.*/JWT_SECRET=${NEW_JWT_SECRET}/" .env
    sed -i '' "s/WOPI_SECRET=.*/WOPI_SECRET=${NEW_WOPI_SECRET}/" .env
    sed -i '' "s/COLLABORA_ADMIN_PASSWORD=.*/COLLABORA_ADMIN_PASSWORD=${NEW_COLLABORA_ADMIN_PASSWORD}/" .env
    if [ "$CHANGE_DB" = true ]; then
        sed -i '' "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${NEW_POSTGRES_PASSWORD}/" .env
    fi
else
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=${NEW_JWT_SECRET}/" .env
    sed -i "s/WOPI_SECRET=.*/WOPI_SECRET=${NEW_WOPI_SECRET}/" .env
    sed -i "s/COLLABORA_ADMIN_PASSWORD=.*/COLLABORA_ADMIN_PASSWORD=${NEW_COLLABORA_ADMIN_PASSWORD}/" .env
    if [ "$CHANGE_DB" = true ]; then
        sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${NEW_POSTGRES_PASSWORD}/" .env
    fi
fi

echo -e "  ${GREEN}✓ .env file updated${NC}"

# Update database password if requested
if [ "$CHANGE_DB" = true ]; then
    echo ""
    echo -e "${BLUE}Updating database password...${NC}"
    
    # Check if postgres container is running
    if docker compose ps postgres 2>/dev/null | grep -q "running"; then
        # Get current password from backup
        OLD_POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" "$BACKUP_FILE" | cut -d'=' -f2)
        POSTGRES_USER=$(grep "^POSTGRES_USER=" .env | cut -d'=' -f2)
        POSTGRES_DB=$(grep "^POSTGRES_DB=" .env | cut -d'=' -f2)
        
        # Update password in PostgreSQL
        docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
            "ALTER USER $POSTGRES_USER WITH PASSWORD '${NEW_POSTGRES_PASSWORD}';" 2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo -e "  ${GREEN}✓ Database password updated${NC}"
        else
            echo -e "  ${YELLOW}⚠ Could not update database password automatically${NC}"
            echo "  Please run manually:"
            echo "    docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB"
            echo "    ALTER USER $POSTGRES_USER WITH PASSWORD '${NEW_POSTGRES_PASSWORD}';"
        fi
    else
        echo -e "  ${YELLOW}⚠ PostgreSQL container not running${NC}"
        echo "  Database password will be updated when you restart services"
        echo "  If this is a fresh database, this is fine."
        echo "  If database already exists, you'll need to update it manually."
    fi
fi

# Restart services
echo ""
read -p "Restart services now? (Y/n): " RESTART_SERVICES
if [ "$RESTART_SERVICES" != "n" ] && [ "$RESTART_SERVICES" != "N" ]; then
    echo -e "${BLUE}Restarting services...${NC}"
    docker compose down
    docker compose up -d
    echo -e "  ${GREEN}✓ Services restarted${NC}"
    
    # Wait for services to be healthy
    echo -e "${BLUE}Waiting for services to be healthy...${NC}"
    sleep 10
    docker compose ps
fi

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Security Upgrade Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Backup saved to: ${YELLOW}${BACKUP_FILE}${NC}"
echo ""
echo -e "${YELLOW}New Collabora Admin Password:${NC} ${NEW_COLLABORA_ADMIN_PASSWORD}"
echo ""
echo -e "${RED}Important:${NC}"
echo "  - All users have been logged out (JWT secret changed)"
echo "  - Active document sessions have ended (WOPI secret changed)"
echo "  - Save the new Collabora admin password shown above"
echo ""
echo "To rollback if needed:"
echo "  1. docker compose down"
echo "  2. cp ${BACKUP_FILE} .env"
if [ "$CHANGE_DB" = true ]; then
    echo "  3. Restore database password manually (see SECURITY.md)"
fi
echo "  4. docker compose up -d"
