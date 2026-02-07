#!/bin/bash

# Copy Let's Encrypt certificates to project directory
# Used for auto-renewal post-hook

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"
source .env

if [ -z "$DOMAIN" ]; then
    echo "Error: DOMAIN not set"
    exit 1
fi

# Copy certificates
cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ssl/fullchain.pem
cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" ssl/privkey.pem

# Fix permissions
chmod 644 ssl/fullchain.pem
chmod 600 ssl/privkey.pem

# Restart nginx to load new certificates
docker compose restart nginx

echo "Certificates updated and nginx restarted"
