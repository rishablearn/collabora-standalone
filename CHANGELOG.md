# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-02-07

### Added

#### Core Features
- **Standalone Collabora Online deployment** - Full office suite (Writer, Calc, Impress) without requiring OwnCloud/NextCloud
- **Complete WOPI Protocol implementation** - Custom Node.js WOPI server with full file operations support
- **Built-in JWT Authentication** - Secure user registration, login, and session management
- **File Storage System** - Local file storage with quota management per user
- **Modern React Web UI** - Document manager with upload, create, and organize functionality

#### Infrastructure
- **Docker Compose deployment** - Fully containerized setup with all services
- **Nginx Reverse Proxy** - SSL/TLS termination, routing, and load balancing
- **PostgreSQL Database** - User data, file metadata, and session storage
- **Redis Cache** - Session management and performance optimization

#### Security
- **HTTPS/SSL support** - Self-signed certificates for testing, Let's Encrypt for production
- **Rate limiting** - Configured in both Nginx and API layer
- **Secure secrets generation** - Auto-generated JWT, WOPI, and database secrets
- **Helmet.js protection** - HTTP security headers

#### Developer Experience
- **Automated setup script** - Linux distribution auto-detection and configuration
- **Deployment script** - One-command deployment with health checks
- **Backup script** - Database and document backup automation
- **SSL certificate script** - Let's Encrypt integration

#### Documentation
- Comprehensive README with architecture diagrams
- API documentation with examples
- Deployment guide for production environments
- Troubleshooting guide for common issues

### Supported Platforms
- Ubuntu 20.04+, Debian 11+
- RHEL 8+, CentOS Stream 8+, Rocky Linux 8+, AlmaLinux 8+
- Fedora 37+
- openSUSE Leap 15+, SLES 15+
- Amazon Linux 2/2023

### Technical Stack
- **Backend**: Node.js 18+, Express.js 4.x
- **Frontend**: React 18, Vite 5, TailwindCSS 3
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Reverse Proxy**: Nginx
- **Container Runtime**: Docker 20.10+, Docker Compose v2

---

## [1.1.0] - 2026-02-10

### Added

#### Customization Features
- **Branding configuration** - Centralized branding via `src/config/branding.js`
- **Custom logo support** - Place logos in `public/custom/` directory
- **Environment variable overrides** - Configure branding via `VITE_*` variables
- **Welcome banner** - Customizable dashboard welcome message
- **CUSTOMIZATION.md** - Comprehensive customization guide

#### Security Improvements
- **SECURITY.md** - Complete security documentation
- **upgrade-security.sh** - Script to upgrade existing deployments
- **Required secrets validation** - Application fails fast if secrets not configured
- **No default passwords** - Removed all cleartext default passwords

### Changed
- `.env.example` now uses placeholder values instead of default passwords
- `docker-compose.yml` requires `COLLABORA_ADMIN_PASSWORD` (no fallback)
- `crypto.js` requires `WOPI_SECRET` environment variable (no fallback)

### Security
- **BREAKING**: Deployments using default passwords must run `./scripts/upgrade-security.sh`
- Removed `admin123` default Collabora admin password
- Removed `collabora_dev_password` default database password
- Removed `dev-jwt-secret-change-in-production` default JWT secret
- Removed `dev-wopi-secret-change-in-production` default WOPI secret
- Removed `'default-secret'` fallback in WOPI token generation

### Migration Guide for Existing Deployments

If you deployed before this version, you likely have insecure default passwords.

**Quick upgrade:**
```bash
git pull origin main
./scripts/upgrade-security.sh
```

**What this does:**
1. Backs up your current `.env` file
2. Generates new secure secrets
3. Updates your configuration
4. Restarts services

**Impact:**
- All users will be logged out (JWT secret changes)
- Active document sessions will end (WOPI secret changes)
- You'll receive a new Collabora admin password

See `SECURITY.md` for detailed manual upgrade steps.

---

## [Unreleased]

### Planned
- Multi-user collaboration improvements
- Document sharing and permissions
- Admin dashboard for user management
- Integration with external storage providers
- Mobile-responsive improvements
