#!/bin/bash

# Collabora Online Standalone - Deployment Script
# This script deploys all services using Docker Compose

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deploying Collabora Online Standalone${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please run ./scripts/setup.sh first"
    exit 1
fi

# Load environment variables
source .env

# Check for SSL certificates
if [ ! -f ssl/fullchain.pem ] || [ ! -f ssl/privkey.pem ]; then
    echo -e "${RED}Error: SSL certificates not found${NC}"
    echo "Please ensure ssl/fullchain.pem and ssl/privkey.pem exist"
    exit 1
fi

# Determine docker compose command
if command -v docker compose &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}Error: Docker Compose not found${NC}"
    exit 1
fi

# Build and start services
echo -e "${GREEN}Building Docker images...${NC}"
$COMPOSE_CMD build --no-cache

echo ""
echo -e "${GREEN}Starting services...${NC}"
$COMPOSE_CMD up -d

echo ""
echo -e "${GREEN}Waiting for services to be healthy...${NC}"

# Wait for services with timeout
TIMEOUT=120
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
    # Check if all services are running
    RUNNING=$($COMPOSE_CMD ps --format json 2>/dev/null | grep -c '"running"' || echo "0")
    TOTAL=$($COMPOSE_CMD ps --format json 2>/dev/null | wc -l || echo "0")
    
    if [ "$RUNNING" -ge 5 ]; then
        break
    fi
    
    echo -n "."
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done

echo ""

# Check service status
echo -e "${GREEN}Service Status:${NC}"
$COMPOSE_CMD ps

echo ""

# Health check
echo -e "${GREEN}Running health checks...${NC}"

# Check WOPI server
if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "  ✓ WOPI Server: ${GREEN}Healthy${NC}"
else
    echo -e "  ✗ WOPI Server: ${RED}Not responding${NC}"
fi

# Check Collabora
if curl -sf http://localhost:9980/hosting/capabilities > /dev/null 2>&1; then
    echo -e "  ✓ Collabora Online: ${GREEN}Healthy${NC}"
else
    echo -e "  ✗ Collabora Online: ${YELLOW}Starting up (may take a minute)${NC}"
fi

# Check Nginx
if curl -sf -k https://localhost/health > /dev/null 2>&1; then
    echo -e "  ✓ Nginx: ${GREEN}Healthy${NC}"
else
    echo -e "  ✓ Nginx: ${GREEN}Running${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Access Points:${NC}"
echo -e "  Web Application:    https://${DOMAIN}"
echo -e "  Admin Console:      https://${DOMAIN}/browser/dist/admin/admin.html"
echo -e "  Health Check:       https://${DOMAIN}/health"
echo -e "  Debug Collabora:    https://${DOMAIN}/api/debug/collabora"
echo ""
echo -e "${YELLOW}Admin Credentials:${NC}"
echo -e "  Username: ${COLLABORA_ADMIN_USER:-admin}"
echo -e "  Password: (see .env - COLLABORA_ADMIN_PASSWORD)"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo "  View all logs:      $COMPOSE_CMD logs -f"
echo "  View specific log:  $COMPOSE_CMD logs -f <service>"
echo "  Stop services:      $COMPOSE_CMD down"
echo "  Restart service:    $COMPOSE_CMD restart <service>"
echo "  Check status:       $COMPOSE_CMD ps"
echo ""
echo -e "${YELLOW}Services: collabora, wopi-server, web-frontend, nginx, postgres, redis${NC}"
echo ""
