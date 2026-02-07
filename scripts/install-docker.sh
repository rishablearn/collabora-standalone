#!/bin/bash

# Collabora Online Standalone - Docker Installation Script
# Supports: Ubuntu/Debian, RHEL/CentOS/Fedora, SUSE

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Docker Installation Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Detect OS
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
}

detect_os
echo -e "${BLUE}Detected OS: ${OS_PRETTY}${NC}"
echo ""

# Check if Docker is already installed
if command -v docker &> /dev/null; then
    echo -e "${GREEN}Docker is already installed:${NC}"
    docker --version
    
    if command -v docker compose &> /dev/null; then
        echo -e "${GREEN}Docker Compose is already installed:${NC}"
        docker compose version
    fi
    
    read -p "Reinstall Docker? (y/N): " REINSTALL
    if [ "$REINSTALL" != "y" ] && [ "$REINSTALL" != "Y" ]; then
        echo "Keeping existing Docker installation."
        exit 0
    fi
fi

# Install Docker based on OS
case "$OS_NAME" in
    ubuntu|debian|linuxmint|pop)
        echo -e "${GREEN}Installing Docker for Debian/Ubuntu...${NC}"
        
        # Remove old versions
        sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
        
        # Install prerequisites
        sudo apt-get update
        sudo apt-get install -y \
            ca-certificates \
            curl \
            gnupg \
            lsb-release
        
        # Add Docker's GPG key
        sudo mkdir -p /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/$OS_NAME/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        
        # Add Docker repository
        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS_NAME \
          $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        
        # Install Docker
        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        ;;
        
    fedora)
        echo -e "${GREEN}Installing Docker for Fedora...${NC}"
        
        # Remove old versions
        sudo dnf remove -y docker docker-client docker-client-latest docker-common \
            docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true
        
        # Install prerequisites
        sudo dnf install -y dnf-plugins-core
        
        # Add Docker repository
        sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
        
        # Install Docker
        sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        
        # Start Docker
        sudo systemctl enable --now docker
        ;;
        
    centos|rhel|rocky|almalinux)
        echo -e "${GREEN}Installing Docker for RHEL/CentOS...${NC}"
        
        # Remove old versions
        sudo yum remove -y docker docker-client docker-client-latest docker-common \
            docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true
        
        # Install prerequisites
        sudo yum install -y yum-utils
        
        # Add Docker repository
        sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
        
        # Install Docker
        sudo yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        
        # Start Docker
        sudo systemctl enable --now docker
        ;;
        
    opensuse*|sles)
        echo -e "${GREEN}Installing Docker for openSUSE/SLES...${NC}"
        
        # Install Docker
        sudo zypper install -y docker docker-compose
        
        # Start Docker
        sudo systemctl enable --now docker
        ;;
        
    amzn)
        echo -e "${GREEN}Installing Docker for Amazon Linux...${NC}"
        
        # Amazon Linux 2
        if [ "$OS_VERSION" = "2" ]; then
            sudo amazon-linux-extras install -y docker
            sudo yum install -y docker
        else
            # Amazon Linux 2023
            sudo yum install -y docker
        fi
        
        # Start Docker
        sudo systemctl enable --now docker
        
        # Install Docker Compose plugin
        COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
        sudo mkdir -p /usr/local/lib/docker/cli-plugins
        sudo curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" \
            -o /usr/local/lib/docker/cli-plugins/docker-compose
        sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
        ;;
        
    *)
        echo -e "${YELLOW}Unsupported OS: $OS_NAME${NC}"
        echo "Attempting generic installation via get.docker.com..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        rm get-docker.sh
        ;;
esac

# Add current user to docker group
echo -e "${GREEN}Adding $USER to docker group...${NC}"
sudo usermod -aG docker $USER

# Start Docker if not running
if ! sudo systemctl is-active --quiet docker; then
    sudo systemctl enable --now docker
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Docker Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
docker --version
docker compose version 2>/dev/null || docker-compose --version 2>/dev/null || true
echo ""
echo -e "${YELLOW}IMPORTANT: Log out and log back in for group changes to take effect.${NC}"
echo "Or run: newgrp docker"
echo ""
