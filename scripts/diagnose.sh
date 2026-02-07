#!/bin/bash

# Collabora Standalone Diagnostic Script
# Collects system information and logs for troubleshooting

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Collabora Standalone Diagnostics${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Output file
OUTPUT_DIR="diagnostics_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$OUTPUT_DIR"

echo -e "${GREEN}Collecting diagnostics to: ${OUTPUT_DIR}${NC}"
echo ""

# System Information
echo -e "${YELLOW}[1/8] Collecting system information...${NC}"
{
    echo "=== System Information ==="
    echo "Date: $(date)"
    echo "Hostname: $(hostname)"
    echo "OS: $(uname -a)"
    if [ -f /etc/os-release ]; then
        cat /etc/os-release
    fi
    echo ""
    echo "=== Memory ==="
    if command -v free &> /dev/null; then
        free -h
    else
        vm_stat 2>/dev/null || echo "Memory info not available"
    fi
    echo ""
    echo "=== Disk Space ==="
    df -h
    echo ""
    echo "=== CPU ==="
    if [ -f /proc/cpuinfo ]; then
        grep "model name" /proc/cpuinfo | head -1
        grep "cpu cores" /proc/cpuinfo | head -1
    else
        sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "CPU info not available"
    fi
} > "$OUTPUT_DIR/system_info.txt" 2>&1

# Docker Information
echo -e "${YELLOW}[2/8] Collecting Docker information...${NC}"
{
    echo "=== Docker Version ==="
    docker --version
    docker compose version
    echo ""
    echo "=== Docker Info ==="
    docker info 2>&1 | head -50
    echo ""
    echo "=== Docker Disk Usage ==="
    docker system df
} > "$OUTPUT_DIR/docker_info.txt" 2>&1

# Container Status
echo -e "${YELLOW}[3/8] Collecting container status...${NC}"
{
    echo "=== Container Status ==="
    docker compose ps -a
    echo ""
    echo "=== Container Stats ==="
    docker stats --no-stream 2>/dev/null || echo "No running containers"
} > "$OUTPUT_DIR/container_status.txt" 2>&1

# Health Checks
echo -e "${YELLOW}[4/8] Running health checks...${NC}"
{
    echo "=== Health Check Results ==="
    echo ""
    
    echo "--- WOPI Server Health ---"
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null | grep -q "200"; then
        echo "✓ WOPI Server: HEALTHY"
        curl -s http://localhost:3000/health 2>/dev/null
    else
        echo "✗ WOPI Server: UNREACHABLE"
    fi
    echo ""
    
    echo "--- Collabora Health ---"
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:9980/hosting/capabilities 2>/dev/null | grep -q "200"; then
        echo "✓ Collabora: HEALTHY"
    else
        echo "✗ Collabora: UNREACHABLE"
    fi
    echo ""
    
    echo "--- PostgreSQL Health ---"
    if docker compose exec -T postgres pg_isready -U collabora 2>/dev/null; then
        echo "✓ PostgreSQL: HEALTHY"
    else
        echo "✗ PostgreSQL: UNREACHABLE"
    fi
    echo ""
    
    echo "--- Redis Health ---"
    if docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo "✓ Redis: HEALTHY"
    else
        echo "✗ Redis: UNREACHABLE"
    fi
    echo ""
    
    echo "--- Nginx Health ---"
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:80 2>/dev/null | grep -qE "200|301|302"; then
        echo "✓ Nginx: HEALTHY"
    else
        echo "✗ Nginx: UNREACHABLE or not redirecting"
    fi
} > "$OUTPUT_DIR/health_checks.txt" 2>&1

# Configuration (sanitized)
echo -e "${YELLOW}[5/8] Collecting configuration (sanitized)...${NC}"
{
    echo "=== Environment Configuration (Sanitized) ==="
    if [ -f .env ]; then
        # Copy and sanitize .env
        sed -E 's/(PASSWORD|SECRET|KEY)=.*/\1=REDACTED/gi' .env
    else
        echo ".env file not found"
    fi
    echo ""
    echo "=== Docker Compose Config ==="
    docker compose config 2>/dev/null | sed -E 's/(PASSWORD|SECRET|KEY):.*/\1: REDACTED/gi' || echo "Could not get compose config"
} > "$OUTPUT_DIR/config_sanitized.txt" 2>&1

# Service Logs
echo -e "${YELLOW}[6/8] Collecting service logs (last 500 lines each)...${NC}"
{
    echo "=== WOPI Server Logs ==="
    docker compose logs --tail=500 wopi-server 2>/dev/null || echo "Could not get wopi-server logs"
} > "$OUTPUT_DIR/logs_wopi_server.txt" 2>&1

{
    echo "=== Collabora Logs ==="
    docker compose logs --tail=500 collabora 2>/dev/null || echo "Could not get collabora logs"
} > "$OUTPUT_DIR/logs_collabora.txt" 2>&1

{
    echo "=== Nginx Logs ==="
    docker compose logs --tail=500 nginx 2>/dev/null || echo "Could not get nginx logs"
} > "$OUTPUT_DIR/logs_nginx.txt" 2>&1

{
    echo "=== PostgreSQL Logs ==="
    docker compose logs --tail=200 postgres 2>/dev/null || echo "Could not get postgres logs"
} > "$OUTPUT_DIR/logs_postgres.txt" 2>&1

{
    echo "=== Redis Logs ==="
    docker compose logs --tail=200 redis 2>/dev/null || echo "Could not get redis logs"
} > "$OUTPUT_DIR/logs_redis.txt" 2>&1

{
    echo "=== Web Frontend Logs ==="
    docker compose logs --tail=200 web-frontend 2>/dev/null || echo "Could not get web-frontend logs"
} > "$OUTPUT_DIR/logs_web_frontend.txt" 2>&1

# Database Status
echo -e "${YELLOW}[7/8] Collecting database status...${NC}"
{
    echo "=== Database Status ==="
    docker compose exec -T postgres psql -U collabora -d collabora_db -c "\dt" 2>/dev/null || echo "Could not connect to database"
    echo ""
    echo "=== User Count ==="
    docker compose exec -T postgres psql -U collabora -d collabora_db -c "SELECT COUNT(*) as user_count FROM users;" 2>/dev/null || echo "Could not query users"
    echo ""
    echo "=== File Count ==="
    docker compose exec -T postgres psql -U collabora -d collabora_db -c "SELECT COUNT(*) as file_count FROM files;" 2>/dev/null || echo "Could not query files"
    echo ""
    echo "=== Active Sessions ==="
    docker compose exec -T postgres psql -U collabora -d collabora_db -c "SELECT COUNT(*) as session_count FROM active_sessions;" 2>/dev/null || echo "Could not query sessions"
} > "$OUTPUT_DIR/database_status.txt" 2>&1

# Network Information
echo -e "${YELLOW}[8/8] Collecting network information...${NC}"
{
    echo "=== Docker Networks ==="
    docker network ls
    echo ""
    echo "=== Collabora Network Details ==="
    docker network inspect collabora-standalone_collabora-net 2>/dev/null || docker network inspect collabora-net 2>/dev/null || echo "Network not found"
    echo ""
    echo "=== Port Bindings ==="
    docker compose ps --format "table {{.Name}}\t{{.Ports}}" 2>/dev/null || docker compose ps
    echo ""
    echo "=== Listening Ports ==="
    if command -v netstat &> /dev/null; then
        netstat -tlnp 2>/dev/null | grep -E ":(80|443|3000|5432|6379|9980)" || echo "Could not get port info"
    elif command -v ss &> /dev/null; then
        ss -tlnp 2>/dev/null | grep -E ":(80|443|3000|5432|6379|9980)" || echo "Could not get port info"
    else
        lsof -i -P -n 2>/dev/null | grep LISTEN | grep -E ":(80|443|3000|5432|6379|9980)" || echo "Could not get port info"
    fi
} > "$OUTPUT_DIR/network_info.txt" 2>&1

# Create summary
echo -e "${YELLOW}Creating summary...${NC}"
{
    echo "=== Diagnostic Summary ==="
    echo "Generated: $(date)"
    echo "Directory: $OUTPUT_DIR"
    echo ""
    echo "Files collected:"
    ls -la "$OUTPUT_DIR"
    echo ""
    echo "Quick Status:"
    grep -h "✓\|✗" "$OUTPUT_DIR/health_checks.txt" 2>/dev/null || echo "See health_checks.txt for details"
} > "$OUTPUT_DIR/SUMMARY.txt"

# Create archive
echo -e "${YELLOW}Creating archive...${NC}"
tar -czf "${OUTPUT_DIR}.tar.gz" "$OUTPUT_DIR"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Diagnostics Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Results saved to: ${BLUE}${OUTPUT_DIR}/${NC}"
echo -e "Archive created:  ${BLUE}${OUTPUT_DIR}.tar.gz${NC}"
echo ""
echo -e "To view summary: ${YELLOW}cat ${OUTPUT_DIR}/SUMMARY.txt${NC}"
echo -e "To view health:  ${YELLOW}cat ${OUTPUT_DIR}/health_checks.txt${NC}"
echo ""

# Print quick health status
echo -e "${BLUE}Quick Health Status:${NC}"
cat "$OUTPUT_DIR/health_checks.txt" | grep -E "✓|✗" || echo "Check ${OUTPUT_DIR}/health_checks.txt for details"
