# Collabora Online Standalone Deployment

A complete standalone deployment of **Collabora Online** with built-in authentication, web interface, and file storage—**no OwnCloud or NextCloud required**.

## 🚀 Features

- **Standalone Collabora Online** - Full office suite (Writer, Calc, Impress)
- **Built-in Authentication** - JWT-based auth with user management
- **File Storage** - Local file storage with quota management
- **Modern Web UI** - React-based document manager
- **WOPI Protocol** - Complete WOPI server implementation
- **Docker Deployment** - Containerized for easy deployment
- **SSL/TLS Ready** - Nginx reverse proxy with HTTPS
- **Customizable Branding** - Custom logo, colors, and home page ([see guide](CUSTOMIZATION.md))
- **Secure by Default** - Encrypted passwords, JWT auth, no cleartext secrets ([security guide](SECURITY.md))

## 📋 Prerequisites

- **Linux Distribution** (any of the following):
  - Ubuntu 20.04+, Debian 11+
  - RHEL 8+, CentOS Stream 8+, Rocky Linux 8+, AlmaLinux 8+
  - Fedora 37+
  - openSUSE Leap 15+, SLES 15+
  - Amazon Linux 2/2023
- **Docker Engine** 20.10+
- **Docker Compose** v2.0+
- **Domain name** with DNS pointing to your server
- **Minimum specs**: 4GB RAM, 2 CPU cores, 20GB storage

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS (443)
┌─────────────────────────▼───────────────────────────────────┐
│                    Nginx Reverse Proxy                       │
│              (SSL termination, routing)                      │
└──────┬──────────────┬──────────────────┬────────────────────┘
       │              │                  │
       ▼              ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│ Web Frontend │ │ WOPI Server  │ │ Collabora Online │
│   (React)    │ │  (Node.js)   │ │     (CODE)       │
└──────────────┘ └──────┬───────┘ └──────────────────┘
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
     ┌──────────────┐        ┌──────────────┐
     │  PostgreSQL  │        │    Redis     │
     │  (Database)  │        │  (Sessions)  │
     └──────────────┘        └──────────────┘
```

## 📁 Project Structure

```
collabora-standalone/
├── docker-compose.yml      # Main Docker Compose configuration
├── .env.example           # Environment variables template
├── nginx/
│   ├── nginx.conf         # Nginx main configuration
│   └── conf.d/
│       └── default.conf   # Server block configuration
├── ssl/                   # SSL certificates (generated)
├── wopi-server/           # Custom WOPI server
│   ├── Dockerfile
│   ├── package.json
│   ├── db/
│   │   └── init.sql       # Database schema
│   └── src/
│       ├── index.js       # Entry point
│       ├── routes/        # API routes
│       ├── middleware/    # Auth middleware
│       └── utils/         # Utilities
├── web-frontend/          # React web application
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       ├── pages/         # Page components
│       └── components/    # UI components
└── scripts/
    ├── setup.sh           # Initial setup
    ├── deploy.sh          # Deployment script
    ├── backup.sh          # Backup script
    └── ssl-letsencrypt.sh # Let's Encrypt setup
```

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Clone or download the project
cd collabora-standalone

# Make scripts executable
chmod +x scripts/*.sh

# (Optional) Install Docker if not already installed
./scripts/install-docker.sh

# Run setup script
./scripts/setup.sh
```

The setup script will:
- Detect your Linux distribution automatically
- Check prerequisites (Docker, Docker Compose, OpenSSL)
- Generate secure secrets
- Create SSL certificates (self-signed for testing)
- Configure the environment

### 2. Deploy

```bash
./scripts/deploy.sh
```

### 3. Access

- **Web Application**: `https://your-domain.com`
- **Collabora Admin**: `https://your-domain.com/browser/dist/admin/admin.html`

## 📖 Detailed Installation Guide

### Step 1: Prepare Ubuntu Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose (if not included)
sudo apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

### Step 2: Configure DNS

Point your domain to your server's IP address:

```
collabora.yourdomain.com  A  your-server-ip
```

### Step 3: Download and Configure

```bash
# Create project directory
mkdir -p /opt/collabora
cd /opt/collabora

# Download project files (or clone from your repository)
# ...

# Run setup
./scripts/setup.sh
```

### Step 4: Configure Environment

Edit `.env` file to customize settings:

```bash
nano .env
```

Key settings:
- `DOMAIN` - Your domain name
- `COLLABORA_ADMIN_USER` - Admin username for Collabora
- `COLLABORA_ADMIN_PASSWORD` - Admin password (auto-generated)
- `MAX_UPLOAD_SIZE` - Maximum file upload size
- `STORAGE_QUOTA_PER_USER` - Storage quota per user (in bytes)

### Step 5: SSL Certificates

**For Production (Let's Encrypt):**

```bash
./scripts/ssl-letsencrypt.sh
```

**For Testing (Self-signed):**

The setup script generates self-signed certificates automatically.

### Step 6: Deploy

```bash
./scripts/deploy.sh
```

## 🎨 Customization

Customize the branding, logo, and appearance of your deployment. For complete details, see [CUSTOMIZATION.md](CUSTOMIZATION.md).

### Change Application Name

```bash
# In .env file
VITE_APP_NAME=My Company Docs
VITE_APP_TAGLINE=Collaborate with confidence
```

### Change Logo

1. Place your logo in `web-frontend/public/custom/` directory
2. Set the environment variable:

```bash
# In .env file
VITE_LOGO_URL=/custom/my-logo.png
```

**Supported formats:** PNG, SVG (recommended), JPG

### Other Branding Options

| Variable | Description |
|----------|-------------|
| `VITE_APP_NAME` | Application name displayed in header and login |
| `VITE_APP_TAGLINE` | Tagline shown on login page |
| `VITE_LOGO_URL` | Path to custom logo (e.g., `/custom/logo.svg`) |
| `VITE_SHOW_WELCOME_BANNER` | Show welcome banner on dashboard |
| `VITE_WELCOME_TITLE` | Welcome banner title |
| `VITE_WELCOME_MESSAGE` | Welcome banner message |
| `VITE_ALLOW_REGISTRATION` | Enable/disable public registration |
| `VITE_FOOTER_TEXT` | Custom footer text |

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DOMAIN` | Your domain name | - |
| `COLLABORA_ADMIN_USER` | Collabora admin username | admin |
| `COLLABORA_ADMIN_PASSWORD` | Collabora admin password | (generated) |
| `JWT_SECRET` | JWT signing secret | (generated) |
| `WOPI_SECRET` | WOPI token secret | (generated) |
| `POSTGRES_USER` | Database username | collabora |
| `POSTGRES_PASSWORD` | Database password | (generated) |
| `POSTGRES_DB` | Database name | collabora_db |
| `MAX_UPLOAD_SIZE` | Max upload size | 100M |
| `STORAGE_QUOTA_PER_USER` | User storage quota | 5368709120 (5GB) |
| `SESSION_TIMEOUT` | Session timeout (seconds) | 86400 |

### Collabora Settings

Additional Collabora settings can be configured via environment variables in `docker-compose.yml`:

```yaml
environment:
  - dictionaries=en_US,de_DE,fr_FR  # Spellcheck languages
  - extra_params=--o:ssl.enable=false --o:ssl.termination=true
```

## 📚 API Documentation

### Authentication

#### Register
```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securepassword",
  "displayName": "John Doe"
}
```

#### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}

# Response
{
  "user": { ... },
  "token": "jwt-token",
  "refreshToken": "refresh-token"
}
```

### Files

#### List Files
```bash
GET /api/files
Authorization: Bearer <token>

# Query params
?folderId=<uuid>  # Optional folder filter
&search=<query>   # Optional search
```

#### Upload File
```bash
POST /api/files/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <file>
folderId: <uuid>  # Optional
```

#### Create Document
```bash
POST /api/files/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Document",
  "type": "document|spreadsheet|presentation",
  "folderId": "<uuid>"  # Optional
}
```

#### Get Edit URL
```bash
GET /api/files/:id/edit
Authorization: Bearer <token>

# Response
{
  "editUrl": "https://domain/browser/<hash>/cool.html?WOPISrc=...",
  "accessToken": "...",
  "permission": "edit|view"
}
```

## 🔒 Security

### Recommendations for Production

1. **Use Let's Encrypt certificates**
   ```bash
   ./scripts/ssl-letsencrypt.sh
   ```

2. **Configure firewall**

   *Ubuntu/Debian (UFW):*
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

   *RHEL/CentOS/Fedora (firewalld):*
   ```bash
   sudo firewall-cmd --permanent --add-service=http
   sudo firewall-cmd --permanent --add-service=https
   sudo firewall-cmd --reload
   ```

3. **Change default admin credentials**
   Update `.env` with strong passwords

4. **Enable rate limiting**
   Already configured in Nginx and API

5. **Regular backups**
   ```bash
   # Add to crontab
   0 2 * * * /opt/collabora/scripts/backup.sh
   ```

6. **Keep containers updated**
   ```bash
   docker compose pull
   docker compose up -d
   ```

## 🛠️ Maintenance

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f collabora
docker compose logs -f wopi-server
```

### Backup

```bash
./scripts/backup.sh
```

Backups are stored in `./backups/` directory.

### Restore

```bash
# Restore database
gunzip -c backups/database_TIMESTAMP.sql.gz | docker compose exec -T postgres psql -U collabora collabora_db

# Restore documents
docker run --rm \
  -v collabora-standalone_document-storage:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/documents_TIMESTAMP.tar.gz -C /data
```

### Update

```bash
# Pull latest images
docker compose pull

# Rebuild custom images
docker compose build --no-cache

# Restart services
docker compose up -d
```

## 🐛 Troubleshooting

### Common Issues

**1. Collabora not loading documents**

Check WOPI server connectivity:
```bash
curl http://localhost:3000/health
curl http://localhost:9980/hosting/capabilities
```

**2. SSL certificate errors**

Verify certificates:
```bash
openssl x509 -in ssl/fullchain.pem -text -noout
```

**3. Database connection issues**

Check PostgreSQL:
```bash
docker compose exec postgres psql -U collabora -d collabora_db -c "SELECT 1"
```

**4. Permission denied errors**

Check volume permissions:
```bash
docker compose exec wopi-server ls -la /storage
```

### Debug Mode

Enable verbose logging:
```bash
# In .env
LOG_LEVEL=debug

# Restart
docker compose restart wopi-server
```

## 📄 License

This project is licensed under the MIT License. See LICENSE file for details.

Collabora Online is licensed under the Mozilla Public License v2.0.

## 🤝 Support

- **Documentation**: This README
- **Issues**: Create a GitHub issue
- **Collabora Documentation**: https://sdk.collaboraonline.com/

## 🙏 Acknowledgments

- [Collabora Online](https://www.collaboraoffice.com/)
- [LibreOffice](https://www.libreoffice.org/)
- [WOPI Protocol](https://docs.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/rest/)
