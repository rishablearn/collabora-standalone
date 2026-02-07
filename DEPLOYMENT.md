# Detailed Deployment Guide

## Linux Server Deployment

This guide provides step-by-step instructions for deploying Collabora Online Standalone on Linux servers.

**Supported Distributions:**
- Ubuntu 20.04+, Debian 11+
- RHEL 8+, CentOS Stream 8+, Rocky Linux 8+, AlmaLinux 8+
- Fedora 37+
- openSUSE Leap 15+, SLES 15+
- Amazon Linux 2/2023

---

## Table of Contents

1. [Server Requirements](#server-requirements)
2. [Initial Server Setup](#initial-server-setup)
3. [Install Docker](#install-docker)
4. [DNS Configuration](#dns-configuration)
5. [Deploy Application](#deploy-application)
6. [SSL Configuration](#ssl-configuration)
7. [Firewall Setup](#firewall-setup)
8. [Post-Deployment](#post-deployment)
9. [Production Checklist](#production-checklist)

---

## Server Requirements

### Minimum Specifications
- **OS**: Any supported Linux distribution (see above)
- **RAM**: 4 GB (8 GB recommended for production)
- **CPU**: 2 cores (4 cores recommended)
- **Storage**: 20 GB SSD minimum
- **Network**: Public IP address

### Recommended Specifications (Production)
- **RAM**: 8-16 GB
- **CPU**: 4-8 cores
- **Storage**: 100 GB+ SSD
- **Network**: 100 Mbps+

---

## Initial Server Setup

### 1. Update System

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git nano htop
```

**RHEL/CentOS/Rocky/AlmaLinux:**
```bash
sudo yum update -y
sudo yum install -y curl wget git nano htop
# Or with dnf:
sudo dnf update -y
sudo dnf install -y curl wget git nano htop
```

**Fedora:**
```bash
sudo dnf update -y
sudo dnf install -y curl wget git nano htop
```

**openSUSE:**
```bash
sudo zypper refresh && sudo zypper update -y
sudo zypper install -y curl wget git nano htop
```

### 2. Set Timezone

```bash
sudo timedatectl set-timezone UTC
# Or your preferred timezone:
# sudo timedatectl set-timezone America/New_York
```

### 3. Create Deploy User (Optional)

**Ubuntu/Debian:**
```bash
sudo adduser collabora
sudo usermod -aG sudo collabora
su - collabora
```

**RHEL/CentOS/Fedora:**
```bash
sudo useradd -m collabora
sudo passwd collabora
sudo usermod -aG wheel collabora
su - collabora
```

### 4. Configure Swap (If RAM < 8GB)

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Install Docker

### Quick Install (All Distributions)

Use the provided installation script:
```bash
chmod +x scripts/install-docker.sh
./scripts/install-docker.sh
```

### Manual Installation

#### Ubuntu/Debian

```bash
# Remove old versions
sudo apt remove docker docker-engine docker.io containerd runc 2>/dev/null

# Install prerequisites
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker's GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository (replace 'ubuntu' with 'debian' for Debian)
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

#### RHEL/CentOS/Rocky/AlmaLinux

```bash
# Remove old versions
sudo yum remove -y docker docker-client docker-client-latest docker-common \
    docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null

# Install prerequisites
sudo yum install -y yum-utils

# Add Docker repository
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Install Docker
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start and enable Docker
sudo systemctl enable --now docker
```

#### Fedora

```bash
# Remove old versions
sudo dnf remove -y docker docker-client docker-client-latest docker-common \
    docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null

# Install prerequisites
sudo dnf install -y dnf-plugins-core

# Add Docker repository
sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo

# Install Docker
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start and enable Docker
sudo systemctl enable --now docker
```

#### openSUSE

```bash
# Install Docker
sudo zypper install -y docker docker-compose

# Start and enable Docker
sudo systemctl enable --now docker
```

#### Amazon Linux 2

```bash
# Install Docker
sudo amazon-linux-extras install -y docker
sudo yum install -y docker

# Start and enable Docker
sudo systemctl enable --now docker

# Install Docker Compose plugin
COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
```

### Configure Docker (All Distributions)

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Apply group changes (or logout/login)
newgrp docker

# Verify installation
docker --version
docker compose version
```

### Configure Docker Daemon (Optional)

```bash
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
EOF

sudo systemctl restart docker
```

---

## DNS Configuration

### 1. Create DNS A Record

In your DNS provider, create an A record:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | collabora | YOUR_SERVER_IP | 300 |

**Example:**
- `collabora.example.com` → `203.0.113.50`

### 2. Verify DNS Propagation

```bash
# Check DNS resolution
dig collabora.yourdomain.com +short
nslookup collabora.yourdomain.com

# Should return your server IP
```

Wait for DNS propagation (usually 5-30 minutes, up to 48 hours).

---

## Deploy Application

### 1. Download Project

```bash
# Create installation directory
sudo mkdir -p /opt/collabora
sudo chown $USER:$USER /opt/collabora
cd /opt/collabora

# Clone or copy project files here
# (assuming files are already in place)
```

### 2. Run Setup

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run setup wizard
./scripts/setup.sh
```

**During setup, you'll be prompted for:**
- Domain name (e.g., `collabora.example.com`)
- SSL certificate generation preference

### 3. Review Configuration

```bash
# Edit environment variables if needed
nano .env
```

**Important variables to verify:**
```bash
DOMAIN=collabora.yourdomain.com
COLLABORA_ADMIN_USER=admin
# Other values are auto-generated
```

### 4. Deploy Services

```bash
./scripts/deploy.sh
```

### 5. Verify Deployment

```bash
# Check all containers are running
docker compose ps

# Check logs for errors
docker compose logs --tail=50

# Test health endpoints
curl -k https://localhost/health
```

---

## SSL Configuration

### Option A: Let's Encrypt (Recommended for Production)

```bash
# Ensure port 80 is accessible
sudo ufw allow 80/tcp

# Run Let's Encrypt setup
./scripts/ssl-letsencrypt.sh
```

**Setup Auto-Renewal:**

```bash
# Test renewal
sudo certbot renew --dry-run

# Add to crontab
sudo crontab -e
```

Add this line:
```
0 0 1 * * certbot renew --post-hook "cd /opt/collabora && docker compose restart nginx"
```

### Option B: Custom SSL Certificate

If you have certificates from a CA:

```bash
# Copy your certificates
cp /path/to/your/fullchain.pem ssl/fullchain.pem
cp /path/to/your/privkey.pem ssl/privkey.pem

# Set permissions
chmod 644 ssl/fullchain.pem
chmod 600 ssl/privkey.pem

# Restart nginx
docker compose restart nginx
```

### Option C: Self-Signed (Testing Only)

Self-signed certificates are generated during setup. Not recommended for production.

---

## Firewall Setup

### Ubuntu/Debian (UFW)

```bash
# Enable firewall
sudo ufw enable

# Allow SSH (important!)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Verify rules
sudo ufw status
```

### RHEL/CentOS/Fedora (firewalld)

```bash
# Start and enable firewalld
sudo systemctl enable --now firewalld

# Allow SSH (usually enabled by default)
sudo firewall-cmd --permanent --add-service=ssh

# Allow HTTP/HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# Reload firewall
sudo firewall-cmd --reload

# Verify rules
sudo firewall-cmd --list-all
```

### openSUSE (firewalld)

```bash
# Enable firewalld
sudo systemctl enable --now firewalld

# Allow services
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### Using iptables (Any Distribution)

```bash
# Allow SSH
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP/HTTPS
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Save rules (Ubuntu/Debian)
sudo apt install -y iptables-persistent
sudo netfilter-persistent save

# Save rules (RHEL/CentOS)
sudo yum install -y iptables-services
sudo service iptables save
sudo systemctl enable iptables
```

---

## Post-Deployment

### 1. Create First Admin User

Access the web interface and register:
- Go to `https://collabora.yourdomain.com`
- Click "Create an account"
- Register with your admin email

**Optional:** Promote to admin via database:
```bash
docker compose exec postgres psql -U collabora -d collabora_db -c \
  "UPDATE users SET role='admin' WHERE email='admin@yourdomain.com';"
```

### 2. Test Document Editing

1. Log in to the web interface
2. Click "New" → "Document"
3. Enter a name and create
4. Verify Collabora editor loads

### 3. Access Collabora Admin Console

- URL: `https://collabora.yourdomain.com/browser/dist/admin/admin.html`
- Username: `admin` (from .env COLLABORA_ADMIN_USER)
- Password: (from .env COLLABORA_ADMIN_PASSWORD)

### 4. Configure Backups

```bash
# Create backup cron job
crontab -e
```

Add:
```
# Daily backup at 2 AM
0 2 * * * /opt/collabora/scripts/backup.sh >> /var/log/collabora-backup.log 2>&1
```

---

## Production Checklist

### Security
- [ ] SSL certificate installed (Let's Encrypt or CA-signed)
- [ ] Firewall configured (only ports 80, 443, 22 open)
- [ ] Strong passwords in .env file
- [ ] Default admin user created and secured
- [ ] Rate limiting enabled (default in nginx)

### Reliability
- [ ] Automated backups configured
- [ ] Log rotation configured
- [ ] Monitoring set up (optional: Prometheus, Grafana)
- [ ] SSL auto-renewal configured

### Performance
- [ ] Adequate server resources
- [ ] Swap configured (if RAM < 8GB)
- [ ] Docker log rotation enabled

### Maintenance
- [ ] Update schedule planned
- [ ] Backup restoration tested
- [ ] Runbooks documented

---

## Monitoring (Optional)

### Basic Monitoring with Uptime Kuma

```bash
# Add to docker-compose.yml
  uptime-kuma:
    image: louislam/uptime-kuma:1
    container_name: uptime-kuma
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - uptime-kuma:/app/data

volumes:
  uptime-kuma:
```

### Health Check Endpoints

Monitor these URLs:
- `https://yourdomain.com/health` - WOPI server health
- `https://yourdomain.com/hosting/capabilities` - Collabora health

---

## Updating

### Regular Updates

```bash
cd /opt/collabora

# Backup first
./scripts/backup.sh

# Pull latest images
docker compose pull

# Rebuild and restart
docker compose up -d --build
```

### Major Updates

```bash
# Stop services
docker compose down

# Backup everything
./scripts/backup.sh
cp -r . /opt/collabora-backup-$(date +%Y%m%d)

# Update code
git pull  # or download new version

# Rebuild and start
docker compose build --no-cache
docker compose up -d

# Verify
docker compose logs -f
```

---

## Support

For issues:
1. Check logs: `docker compose logs -f`
2. Verify configuration: `cat .env`
3. Test endpoints manually
4. Review this documentation
