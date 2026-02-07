# Troubleshooting Guide

This guide helps diagnose and resolve common issues with the Collabora Online Standalone deployment.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Installation Issues](#installation-issues)
3. [Docker Issues](#docker-issues)
4. [Service Issues](#service-issues)
5. [Authentication Issues](#authentication-issues)
6. [File/Document Issues](#filedocument-issues)
7. [SSL/Certificate Issues](#sslcertificate-issues)
8. [Performance Issues](#performance-issues)
9. [Debug Mode](#debug-mode)
10. [Log Locations](#log-locations)

---

## Quick Diagnostics

### Check All Services Status

```bash
# View all container statuses
docker compose ps

# Expected output - all services should be "Up" and "healthy"
# NAME              STATUS              PORTS
# collabora         Up (healthy)        9980/tcp
# nginx             Up                  0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
# postgres          Up (healthy)        5432/tcp
# redis             Up (healthy)        6379/tcp
# web-frontend      Up (healthy)        80/tcp
# wopi-server       Up (healthy)        3000/tcp
```

### Quick Health Checks

```bash
# Check WOPI server
curl -s http://localhost:3000/health | jq .

# Check Collabora
curl -s http://localhost:9980/hosting/capabilities | head -20

# Check PostgreSQL
docker compose exec postgres pg_isready -U collabora

# Check Redis
docker compose exec redis redis-cli ping
```

### View Recent Logs

```bash
# All services (last 100 lines)
docker compose logs --tail=100

# Specific service
docker compose logs --tail=50 wopi-server
docker compose logs --tail=50 collabora
docker compose logs --tail=50 nginx
```

---

## Installation Issues

### Issue: `npm ci` fails with missing package-lock.json

**Symptoms:**
```
failed to solve: process "/bin/sh -c npm ci" did not complete successfully: exit code: 1
```

**Solution:**
```bash
# Generate package-lock.json for wopi-server
cd wopi-server
npm install
cd ..

# Generate package-lock.json for web-frontend
cd web-frontend
npm install
cd ..

# Rebuild
docker compose build --no-cache
```

### Issue: Docker not installed

**Solution:**
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

### Issue: Permission denied on scripts

**Solution:**
```bash
chmod +x scripts/*.sh
```

---

## Docker Issues

### Issue: Container won't start

**Diagnosis:**
```bash
# Check container logs
docker compose logs <service-name>

# Check container status
docker compose ps -a

# Inspect container
docker inspect <container-name>
```

**Common causes:**
- Port already in use
- Missing environment variables
- Volume mount issues

### Issue: Port already in use

**Symptoms:**
```
Error: bind: address already in use
```

**Solution:**
```bash
# Find what's using the port
sudo lsof -i :80
sudo lsof -i :443

# Stop the conflicting service or change ports in docker-compose.yml
```

### Issue: Out of disk space

**Solution:**
```bash
# Clean up Docker resources
docker system prune -a --volumes

# Check disk usage
df -h
docker system df
```

### Issue: Container keeps restarting

**Diagnosis:**
```bash
# Check exit code and logs
docker compose logs --tail=200 <service-name>
docker inspect <container-name> --format='{{.State.ExitCode}}'
```

---

## Service Issues

### Issue: WOPI server not responding

**Diagnosis:**
```bash
# Check if container is running
docker compose ps wopi-server

# Check logs
docker compose logs wopi-server

# Test health endpoint
curl http://localhost:3000/health
```

**Common fixes:**
```bash
# Restart the service
docker compose restart wopi-server

# Check database connection
docker compose exec wopi-server node -e "require('./src/db/pool').query('SELECT 1')"
```

### Issue: Collabora not loading documents

**Diagnosis:**
```bash
# Check Collabora logs
docker compose logs collabora

# Test Collabora capabilities
curl http://localhost:9980/hosting/capabilities

# Check WOPI connectivity from Collabora
docker compose exec collabora curl -v http://wopi-server:3000/health
```

**Common causes:**
- WOPI server unreachable from Collabora container
- Invalid WOPI token
- File permissions

### Issue: Web frontend shows blank page

**Diagnosis:**
```bash
# Check frontend logs
docker compose logs web-frontend

# Check if build succeeded
docker compose exec web-frontend ls -la /usr/share/nginx/html

# Check browser console for errors (F12 in browser)
```

### Issue: Nginx returning 502 Bad Gateway

**Diagnosis:**
```bash
# Check nginx logs
docker compose logs nginx

# Check if backend services are running
docker compose ps

# Test upstream services
docker compose exec nginx curl http://wopi-server:3000/health
docker compose exec nginx curl http://web-frontend:80
```

---

## Authentication Issues

### Issue: Cannot login - "Invalid credentials"

**Diagnosis:**
```bash
# Check if user exists in database
docker compose exec postgres psql -U collabora -d collabora_db \
  -c "SELECT id, email, username, is_active FROM users;"

# Check auth logs
docker compose logs wopi-server | grep -i auth
```

**Solution:**
```bash
# Reset admin password (create new admin)
docker compose exec postgres psql -U collabora -d collabora_db -c "
  UPDATE users SET password_hash = '\$2a\$10\$yournewhash' WHERE email = 'admin@example.com';
"
```

### Issue: Token expired errors

**Symptoms:** Frequent logouts, "Token expired" messages

**Solution:**
```bash
# Increase session timeout in .env
SESSION_TIMEOUT=172800  # 48 hours

# Restart services
docker compose restart wopi-server
```

### Issue: "Access token required" errors

**Diagnosis:**
- Check if token is being sent in Authorization header
- Verify token hasn't expired
- Check if Redis session store is working

```bash
# Check Redis
docker compose exec redis redis-cli keys "collabora:sess:*"
```

---

## File/Document Issues

### Issue: File upload fails

**Diagnosis:**
```bash
# Check wopi-server logs
docker compose logs wopi-server | grep -i upload

# Check storage permissions
docker compose exec wopi-server ls -la /storage

# Check storage quota
docker compose exec postgres psql -U collabora -d collabora_db \
  -c "SELECT storage_used, storage_quota FROM users WHERE id = 'user-id';"
```

**Solutions:**
```bash
# Fix storage permissions
docker compose exec wopi-server chown -R nodejs:nodejs /storage

# Increase upload size limit in .env
MAX_UPLOAD_SIZE=200M
```

### Issue: Document won't open in editor

**Diagnosis:**
```bash
# Check WOPI logs
docker compose logs wopi-server | grep -i wopi

# Check file exists
docker compose exec wopi-server ls -la /storage/<user-id>/

# Check file record in database
docker compose exec postgres psql -U collabora -d collabora_db \
  -c "SELECT id, filename, storage_path FROM files WHERE id = 'file-id';"
```

### Issue: Changes not being saved

**Diagnosis:**
```bash
# Check WOPI PutFile logs
docker compose logs wopi-server | grep -i "PutFile"

# Check file permissions
docker compose exec wopi-server stat /storage/<path-to-file>

# Check for lock conflicts
docker compose exec postgres psql -U collabora -d collabora_db \
  -c "SELECT * FROM file_locks WHERE file_id = 'file-id';"
```

---

## SSL/Certificate Issues

### Issue: SSL certificate errors in browser

**Diagnosis:**
```bash
# Check certificate
openssl x509 -in ssl/fullchain.pem -text -noout | head -20

# Check certificate expiry
openssl x509 -in ssl/fullchain.pem -noout -enddate

# Verify certificate chain
openssl verify -CAfile ssl/fullchain.pem ssl/fullchain.pem
```

**Solutions:**

For self-signed certificates (development):
```bash
# Regenerate certificates
./scripts/setup.sh
```

For Let's Encrypt (production):
```bash
# Renew certificates
./scripts/ssl-letsencrypt.sh
```

### Issue: Mixed content warnings

**Cause:** HTTP resources being loaded on HTTPS page

**Solution:** Ensure all URLs in configuration use HTTPS:
```bash
# Check .env
grep -i "http://" .env  # Should return nothing for production
```

---

## Performance Issues

### Issue: Slow document loading

**Diagnosis:**
```bash
# Check Collabora resource usage
docker stats collabora

# Check database query times
docker compose logs wopi-server | grep -i "slow\|timeout"
```

**Solutions:**
```bash
# Increase Collabora resources in docker-compose.yml
services:
  collabora:
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2'
```

### Issue: High memory usage

**Diagnosis:**
```bash
# Check container memory
docker stats --no-stream

# Check for memory leaks
docker compose logs wopi-server | grep -i "memory\|heap"
```

**Solutions:**
```bash
# Restart services to free memory
docker compose restart

# Set memory limits in docker-compose.yml
```

---

## Debug Mode

### Enable Debug Logging

**Backend (wopi-server):**
```bash
# Edit .env file
LOG_LEVEL=debug
NODE_ENV=development
LOG_TO_FILE=true

# Restart
docker compose restart wopi-server

# View debug logs
docker compose logs -f wopi-server
```

**Frontend (browser console):**
```javascript
// In browser console (F12)
window.setLogLevel('DEBUG');

// View all logs
// Check Console tab for detailed API request/response logs
```

### View Detailed Request Logs

```bash
# WOPI server - shows all requests
docker compose logs -f wopi-server | grep -E "(Request|Response|DEBUG)"

# Nginx access logs
docker compose exec nginx tail -f /var/log/nginx/access.log

# Nginx error logs
docker compose exec nginx tail -f /var/log/nginx/error.log
```

---

## Log Locations

### Container Logs
```bash
# All logs
docker compose logs

# Specific service
docker compose logs <service-name>

# Follow logs in real-time
docker compose logs -f <service-name>

# Last N lines
docker compose logs --tail=100 <service-name>
```

### Inside Containers

| Service | Log Location |
|---------|--------------|
| wopi-server | `/app/logs/combined.log`, `/app/logs/error.log` |
| nginx | `/var/log/nginx/access.log`, `/var/log/nginx/error.log` |
| postgres | Docker logs only |
| redis | Docker logs only |
| collabora | `/var/log/coolwsd.log` |

### Export Logs for Support

```bash
# Export all logs to file
docker compose logs > all-logs-$(date +%Y%m%d).txt

# Export specific service logs
docker compose logs wopi-server > wopi-logs-$(date +%Y%m%d).txt

# Create diagnostic bundle
mkdir -p diagnostics
docker compose ps > diagnostics/services.txt
docker compose logs > diagnostics/logs.txt
docker system df > diagnostics/docker-disk.txt
cp .env diagnostics/env.txt
# Remove secrets from env file
sed -i 's/PASSWORD=.*/PASSWORD=REDACTED/g' diagnostics/env.txt
sed -i 's/SECRET=.*/SECRET=REDACTED/g' diagnostics/env.txt
tar -czf diagnostics-$(date +%Y%m%d).tar.gz diagnostics/
```

---

## Getting Help

If you're still experiencing issues:

1. **Collect diagnostic information:**
   ```bash
   # Run diagnostic script
   ./scripts/diagnose.sh > diagnostics.txt
   ```

2. **Check the logs** for specific error messages

3. **Search existing issues** in the project repository

4. **Create a new issue** with:
   - Description of the problem
   - Steps to reproduce
   - Relevant log output
   - Environment details (OS, Docker version)
