#!/bin/bash

# Collabora Online Standalone - Setup Script
# This script sets up the initial environment for deployment
# Supports: Ubuntu/Debian (apt), RHEL/CentOS/Fedora (yum/dnf), SUSE (zypper)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect OS and package manager
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_NAME=$ID
        OS_VERSION=$VERSION_ID
        OS_PRETTY=$PRETTY_NAME
    elif [ -f /etc/redhat-release ]; then
        OS_NAME="rhel"
        OS_PRETTY=$(cat /etc/redhat-release)
    elif [ -f /etc/debian_version ]; then
        OS_NAME="debian"
        OS_PRETTY="Debian $(cat /etc/debian_version)"
    else
        OS_NAME="unknown"
        OS_PRETTY="Unknown Linux"
    fi

    # Detect package manager
    if command -v apt-get &> /dev/null; then
        PKG_MANAGER="apt"
        PKG_INSTALL="apt-get install -y"
        PKG_UPDATE="apt-get update"
    elif command -v dnf &> /dev/null; then
        PKG_MANAGER="dnf"
        PKG_INSTALL="dnf install -y"
        PKG_UPDATE="dnf check-update || true"
    elif command -v yum &> /dev/null; then
        PKG_MANAGER="yum"
        PKG_INSTALL="yum install -y"
        PKG_UPDATE="yum check-update || true"
    elif command -v zypper &> /dev/null; then
        PKG_MANAGER="zypper"
        PKG_INSTALL="zypper install -y"
        PKG_UPDATE="zypper refresh"
    else
        PKG_MANAGER="unknown"
    fi

    export OS_NAME OS_VERSION OS_PRETTY PKG_MANAGER PKG_INSTALL PKG_UPDATE
}

# Install package based on detected package manager
install_package() {
    local pkg_apt=$1
    local pkg_yum=$2
    local pkg_zypper=${3:-$2}

    if [ "$PKG_MANAGER" = "apt" ]; then
        sudo $PKG_INSTALL $pkg_apt
    elif [ "$PKG_MANAGER" = "dnf" ] || [ "$PKG_MANAGER" = "yum" ]; then
        sudo $PKG_INSTALL $pkg_yum
    elif [ "$PKG_MANAGER" = "zypper" ]; then
        sudo $PKG_INSTALL $pkg_zypper
    else
        echo -e "${RED}Unknown package manager. Please install manually: $pkg_apt (Debian) or $pkg_yum (RHEL)${NC}"
        return 1
    fi
}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Collabora Online Standalone Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Detect OS
detect_os
echo -e "${BLUE}Detected OS: ${OS_PRETTY}${NC}"
echo -e "${BLUE}Package Manager: ${PKG_MANAGER}${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}Note: Some operations may require sudo privileges${NC}"
fi

# Check prerequisites
echo -e "${GREEN}Checking prerequisites...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed.${NC}"
    echo ""
    echo "Install Docker using one of these methods:"
    echo ""
    if [ "$PKG_MANAGER" = "apt" ]; then
        echo "  # Ubuntu/Debian:"
        echo "  curl -fsSL https://get.docker.com -o get-docker.sh"
        echo "  sudo sh get-docker.sh"
    elif [ "$PKG_MANAGER" = "dnf" ]; then
        echo "  # Fedora:"
        echo "  sudo dnf install -y dnf-plugins-core"
        echo "  sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo"
        echo "  sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin"
        echo "  sudo systemctl enable --now docker"
    elif [ "$PKG_MANAGER" = "yum" ]; then
        echo "  # RHEL/CentOS:"
        echo "  sudo yum install -y yum-utils"
        echo "  sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo"
        echo "  sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin"
        echo "  sudo systemctl enable --now docker"
    else
        echo "  Visit: https://docs.docker.com/engine/install/"
    fi
    exit 1
fi
echo -e "  ✓ Docker installed"

# Check Docker Compose
if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose is not installed.${NC}"
    echo ""
    if [ "$PKG_MANAGER" = "apt" ]; then
        echo "  sudo apt-get install -y docker-compose-plugin"
    elif [ "$PKG_MANAGER" = "dnf" ] || [ "$PKG_MANAGER" = "yum" ]; then
        echo "  sudo $PKG_INSTALL docker-compose-plugin"
        echo "  # Or standalone: https://docs.docker.com/compose/install/standalone/"
    fi
    exit 1
fi
echo -e "  ✓ Docker Compose installed"

# Check OpenSSL
if ! command -v openssl &> /dev/null; then
    echo -e "${YELLOW}OpenSSL not found. Attempting to install...${NC}"
    install_package "openssl" "openssl"
fi
echo -e "  ✓ OpenSSL installed"

echo ""

# Get domain name
read -p "Enter your domain name (e.g., collabora.example.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Domain name is required${NC}"
    exit 1
fi

# Create .env file from template
echo -e "${GREEN}Creating environment configuration...${NC}"

if [ -f .env ]; then
    read -p ".env file already exists. Overwrite? (y/N): " OVERWRITE
    if [ "$OVERWRITE" != "y" ] && [ "$OVERWRITE" != "Y" ]; then
        echo "Keeping existing .env file"
    else
        cp .env.example .env
    fi
else
    cp .env.example .env
fi

# Generate secure secrets
JWT_SECRET=$(openssl rand -hex 32)
WOPI_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
COLLABORA_ADMIN_PASSWORD=$(openssl rand -base64 12)

# Update .env file (macOS compatible)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS requires empty string for -i
    sed -i '' "s/DOMAIN=.*/DOMAIN=${DOMAIN}/" .env
    sed -i '' "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" .env
    sed -i '' "s/WOPI_SECRET=.*/WOPI_SECRET=${WOPI_SECRET}/" .env
    sed -i '' "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${POSTGRES_PASSWORD}/" .env
    sed -i '' "s/COLLABORA_ADMIN_PASSWORD=.*/COLLABORA_ADMIN_PASSWORD=${COLLABORA_ADMIN_PASSWORD}/" .env
else
    sed -i "s/DOMAIN=.*/DOMAIN=${DOMAIN}/" .env
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" .env
    sed -i "s/WOPI_SECRET=.*/WOPI_SECRET=${WOPI_SECRET}/" .env
    sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${POSTGRES_PASSWORD}/" .env
    sed -i "s/COLLABORA_ADMIN_PASSWORD=.*/COLLABORA_ADMIN_PASSWORD=${COLLABORA_ADMIN_PASSWORD}/" .env
fi

echo -e "  ✓ Environment file configured"

# Create SSL directory
echo -e "${GREEN}Setting up SSL certificates...${NC}"
mkdir -p ssl

# Check for existing certificates
if [ -f ssl/fullchain.pem ] && [ -f ssl/privkey.pem ]; then
    echo -e "  ✓ SSL certificates already exist"
else
    read -p "Generate self-signed certificates for testing? (Y/n): " GEN_CERT
    if [ "$GEN_CERT" != "n" ] && [ "$GEN_CERT" != "N" ]; then
        # Generate self-signed certificate
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ssl/privkey.pem \
            -out ssl/fullchain.pem \
            -subj "/CN=${DOMAIN}" \
            -addext "subjectAltName=DNS:${DOMAIN}"
        echo -e "  ✓ Self-signed certificates generated"
        echo -e "${YELLOW}  Note: For production, use Let's Encrypt certificates${NC}"
    else
        echo -e "${YELLOW}  Please add your SSL certificates to the ssl/ directory:${NC}"
        echo "    - ssl/fullchain.pem"
        echo "    - ssl/privkey.pem"
    fi
fi

# Create necessary directories
echo -e "${GREEN}Creating directories...${NC}"
mkdir -p nginx/logs
mkdir -p wopi-server/templates
echo -e "  ✓ Directories created"

# Create empty document templates
echo -e "${GREEN}Creating document templates...${NC}"
touch wopi-server/templates/empty.odt
touch wopi-server/templates/empty.ods
touch wopi-server/templates/empty.odp
echo -e "  ✓ Templates created"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Configuration summary:"
echo -e "  Domain: ${YELLOW}${DOMAIN}${NC}"
echo -e "  Collabora Admin Password: ${YELLOW}${COLLABORA_ADMIN_PASSWORD}${NC}"
echo ""
echo "Next steps:"
echo "  1. Review and update .env file if needed"
echo "  2. For production: Replace self-signed SSL certificates"
echo "  3. Run: ./scripts/deploy.sh"
echo ""
echo -e "${YELLOW}Important: Save the Collabora admin password shown above!${NC}"
