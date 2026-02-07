#!/bin/bash

# Collabora Online Standalone - Let's Encrypt SSL Setup
# This script obtains and configures Let's Encrypt certificates
# Supports: Ubuntu/Debian (apt), RHEL/CentOS/Fedora (yum/dnf), SUSE (zypper)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Detect OS and package manager
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_NAME=$ID
        OS_VERSION=$VERSION_ID
    elif [ -f /etc/redhat-release ]; then
        OS_NAME="rhel"
    elif [ -f /etc/debian_version ]; then
        OS_NAME="debian"
    else
        OS_NAME="unknown"
    fi

    # Detect package manager
    if command -v apt-get &> /dev/null; then
        PKG_MANAGER="apt"
    elif command -v dnf &> /dev/null; then
        PKG_MANAGER="dnf"
    elif command -v yum &> /dev/null; then
        PKG_MANAGER="yum"
    elif command -v zypper &> /dev/null; then
        PKG_MANAGER="zypper"
    else
        PKG_MANAGER="unknown"
    fi
}

# Install certbot based on OS
install_certbot() {
    echo -e "${YELLOW}Installing Certbot...${NC}"
    
    case "$PKG_MANAGER" in
        apt)
            sudo apt-get update
            sudo apt-get install -y certbot
            ;;
        dnf)
            sudo dnf install -y certbot
            ;;
        yum)
            # For RHEL/CentOS, may need EPEL
            if [ "$OS_NAME" = "centos" ] || [ "$OS_NAME" = "rhel" ]; then
                sudo yum install -y epel-release 2>/dev/null || true
            fi
            sudo yum install -y certbot
            ;;
        zypper)
            sudo zypper install -y certbot
            ;;
        *)
            echo -e "${RED}Unknown package manager. Please install certbot manually.${NC}"
            echo "Visit: https://certbot.eff.org/"
            exit 1
            ;;
    esac
}

# Load environment variables
source .env

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Error: DOMAIN not set in .env${NC}"
    exit 1
fi

# Detect OS
detect_os
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Let's Encrypt SSL Certificate Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Detected: $OS_NAME ($PKG_MANAGER)${NC}"
echo "Domain: $DOMAIN"
echo ""

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    install_certbot
fi

# Get email for Let's Encrypt
read -p "Enter your email for Let's Encrypt notifications: " EMAIL
if [ -z "$EMAIL" ]; then
    echo -e "${RED}Email is required${NC}"
    exit 1
fi

# Stop nginx temporarily to free port 80
echo -e "${GREEN}Stopping services temporarily...${NC}"
docker compose down nginx 2>/dev/null || true

# Obtain certificate
echo -e "${GREEN}Obtaining Let's Encrypt certificate...${NC}"
sudo certbot certonly --standalone \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive

# Copy certificates to project directory
echo -e "${GREEN}Copying certificates...${NC}"
sudo cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ssl/fullchain.pem
sudo cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" ssl/privkey.pem
sudo chown "$USER:$USER" ssl/*.pem
chmod 600 ssl/privkey.pem

# Restart services
echo -e "${GREEN}Restarting services...${NC}"
docker compose up -d

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}SSL Certificate Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Certificates installed:"
echo "  - ssl/fullchain.pem"
echo "  - ssl/privkey.pem"
echo ""
echo -e "${YELLOW}Important: Set up auto-renewal with:${NC}"
echo "  sudo certbot renew --dry-run"
echo ""
echo "Add to crontab for automatic renewal:"
echo "  0 0 1 * * certbot renew --post-hook 'cd $PROJECT_DIR && ./scripts/copy-certs.sh'"
