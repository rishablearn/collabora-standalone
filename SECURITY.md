# Security Guide

This document outlines the security measures implemented in Collabora Standalone and provides guidance for secure deployment.

## Password Security

### User Passwords

User passwords are **never stored in cleartext**. The system uses industry-standard password hashing:

- **Algorithm**: bcrypt with cost factor 12
- **Salt**: Automatically generated per-password
- **Storage**: Only the hash is stored in the database (`password_hash` column)

```javascript
// Password hashing (auth.js)
const passwordHash = await bcrypt.hash(password, 12);

// Password verification
const validPassword = await bcrypt.compare(password, user.password_hash);
```

### Environment Secrets

All sensitive credentials must be configured via environment variables. **Never commit actual secrets to version control.**

#### Required Secrets

| Variable | Purpose | Generation Command |
|----------|---------|-------------------|
| `JWT_SECRET` | JWT token signing | `openssl rand -hex 32` |
| `WOPI_SECRET` | WOPI token encryption | `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | Database access | `openssl rand -hex 16` |
| `COLLABORA_ADMIN_PASSWORD` | Collabora admin console | `openssl rand -base64 12` |

#### Generating Secure Secrets

**Option 1: Use the setup script (recommended)**
```bash
./scripts/setup.sh
```
This automatically generates all required secrets.

**Option 2: Generate manually**
```bash
# Generate JWT and WOPI secrets (64 character hex strings)
openssl rand -hex 32

# Generate database password (32 character hex string)
openssl rand -hex 16

# Generate admin password (16 character base64 string)
openssl rand -base64 12
```

**Option 3: Using /dev/urandom**
```bash
# Alternative method
head -c 32 /dev/urandom | xxd -p -c 64
```

## Encryption

### WOPI Access Tokens

WOPI access tokens are encrypted using AES-256:

- **Algorithm**: AES (via CryptoJS)
- **Key**: Derived from `WOPI_SECRET` environment variable
- **Token expiry**: 24 hours
- **Contents**: File ID, User ID, permissions, timestamp, nonce

```javascript
// Token generation (crypto.js)
const encrypted = CryptoJS.AES.encrypt(JSON.stringify(payload), secret).toString();
return Buffer.from(encrypted).toString('base64url');
```

### JWT Tokens

Authentication tokens use JSON Web Tokens (JWT):

- **Algorithm**: HS256 (HMAC-SHA256)
- **Key**: `JWT_SECRET` environment variable
- **Access token expiry**: Configurable via `SESSION_TIMEOUT` (default: 24 hours)
- **Refresh token expiry**: 7 days

## Secure Deployment Checklist

### Before Deployment

- [ ] Run `./scripts/setup.sh` to generate secure secrets
- [ ] Verify `.env` file contains generated secrets (not placeholder values)
- [ ] Ensure `.env` is in `.gitignore` (it is by default)
- [ ] Review and update `DOMAIN` setting

### SSL/TLS Configuration

- [ ] Use Let's Encrypt for production: `./scripts/ssl-letsencrypt.sh`
- [ ] Or provide your own certificates in `ssl/` directory
- [ ] Self-signed certificates are for testing only

### Network Security

- [ ] Only expose ports 80 and 443 via nginx
- [ ] Internal services communicate on private Docker network
- [ ] Database is not exposed externally

### Application Security

- [ ] Set `NODE_ENV=production` in production
- [ ] Disable debug logging: `LOG_LEVEL=info` or `LOG_LEVEL=warn`
- [ ] Configure rate limiting appropriately
- [ ] Review `ALLOW_REGISTRATION` setting

## Verifying Security Configuration

### Check for Placeholder Passwords

```bash
# This should return NO matches in a properly configured .env
grep -E "CHANGE_ME|admin123|dev-.*-secret" .env
```

### Verify Secrets Are Set

```bash
# Check that all required secrets are configured
source .env
[ -z "$JWT_SECRET" ] && echo "WARNING: JWT_SECRET not set"
[ -z "$WOPI_SECRET" ] && echo "WARNING: WOPI_SECRET not set"
[ -z "$POSTGRES_PASSWORD" ] && echo "WARNING: POSTGRES_PASSWORD not set"
[ -z "$COLLABORA_ADMIN_PASSWORD" ] && echo "WARNING: COLLABORA_ADMIN_PASSWORD not set"
```

### Test Secret Strength

```bash
# Secrets should be at least 32 characters for JWT/WOPI
source .env
[ ${#JWT_SECRET} -lt 32 ] && echo "WARNING: JWT_SECRET too short"
[ ${#WOPI_SECRET} -lt 32 ] && echo "WARNING: WOPI_SECRET too short"
```

## Changing Passwords

### User Password Change

Users can change their password via the Settings page or API:

```bash
PUT /api/auth/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "old-password",
  "newPassword": "new-secure-password"
}
```

### Rotating Secrets

To rotate secrets in production:

1. **Generate new secrets**
   ```bash
   NEW_JWT_SECRET=$(openssl rand -hex 32)
   NEW_WOPI_SECRET=$(openssl rand -hex 32)
   ```

2. **Update .env file**
   ```bash
   # Backup current .env
   cp .env .env.backup
   
   # Update secrets
   sed -i "s/JWT_SECRET=.*/JWT_SECRET=${NEW_JWT_SECRET}/" .env
   sed -i "s/WOPI_SECRET=.*/WOPI_SECRET=${NEW_WOPI_SECRET}/" .env
   ```

3. **Restart services**
   ```bash
   docker compose down
   docker compose up -d
   ```

**Note**: Rotating JWT_SECRET will invalidate all existing user sessions. Rotating WOPI_SECRET will invalidate all active document editing sessions.

### Database Password Change

1. **Update PostgreSQL password**
   ```bash
   # Connect to database
   docker compose exec postgres psql -U collabora -d collabora_db
   
   # Change password
   ALTER USER collabora WITH PASSWORD 'new-secure-password';
   ```

2. **Update .env file**
   ```bash
   sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=new-secure-password/" .env
   ```

3. **Restart wopi-server**
   ```bash
   docker compose restart wopi-server
   ```

## Security Best Practices

### For Administrators

1. **Never share `.env` file** - It contains all secrets
2. **Use strong, unique passwords** - Generated secrets are recommended
3. **Keep software updated** - Regularly pull latest images
4. **Monitor logs** - Check for suspicious activity
5. **Backup securely** - Encrypt backups containing sensitive data

### For Users

1. **Use strong passwords** - Minimum 8 characters (enforced)
2. **Don't reuse passwords** - Use unique password for this service
3. **Log out on shared computers** - Sessions persist until timeout
4. **Report suspicious activity** - Contact administrator

## Upgrading Existing Deployments

If you have an existing deployment with older (potentially insecure) passwords, follow these steps to upgrade:

### Quick Upgrade (Recommended)

Run the security upgrade script:
```bash
./scripts/upgrade-security.sh
```

This script will:
1. Back up your current `.env` file
2. Generate new secure secrets
3. Update your configuration
4. Restart services

### Manual Upgrade Steps

#### Step 1: Back Up Current Configuration

```bash
# Create backup
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
```

#### Step 2: Check for Insecure Passwords

```bash
# Check if you have any default/weak passwords
grep -E "admin123|collabora_dev_password|dev-.*-secret|CHANGE_ME" .env

# If any matches found, you need to update those values
```

#### Step 3: Generate New Secure Secrets

```bash
# Generate new secrets
NEW_JWT_SECRET=$(openssl rand -hex 32)
NEW_WOPI_SECRET=$(openssl rand -hex 32)
NEW_POSTGRES_PASSWORD=$(openssl rand -hex 16)
NEW_COLLABORA_ADMIN_PASSWORD=$(openssl rand -base64 12)

# Display them (save these!)
echo "New JWT_SECRET: $NEW_JWT_SECRET"
echo "New WOPI_SECRET: $NEW_WOPI_SECRET"
echo "New POSTGRES_PASSWORD: $NEW_POSTGRES_PASSWORD"
echo "New COLLABORA_ADMIN_PASSWORD: $NEW_COLLABORA_ADMIN_PASSWORD"
```

#### Step 4: Update Environment File

```bash
# Update each secret in .env
sed -i "s/JWT_SECRET=.*/JWT_SECRET=${NEW_JWT_SECRET}/" .env
sed -i "s/WOPI_SECRET=.*/WOPI_SECRET=${NEW_WOPI_SECRET}/" .env
sed -i "s/COLLABORA_ADMIN_PASSWORD=.*/COLLABORA_ADMIN_PASSWORD=${NEW_COLLABORA_ADMIN_PASSWORD}/" .env
```

#### Step 5: Update Database Password (if changing)

**Important**: Changing the database password requires updating PostgreSQL first.

```bash
# 1. Connect to PostgreSQL and change password
docker compose exec postgres psql -U collabora -d collabora_db -c \
  "ALTER USER collabora WITH PASSWORD '${NEW_POSTGRES_PASSWORD}';"

# 2. Update .env file
sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${NEW_POSTGRES_PASSWORD}/" .env
```

#### Step 6: Restart Services

```bash
# Stop all services
docker compose down

# Start with new configuration
docker compose up -d
```

#### Step 7: Verify Services Are Running

```bash
# Check all containers are healthy
docker compose ps

# Test the application
curl -k https://localhost/health
```

### What Changes After Upgrade

| Change | Impact |
|--------|--------|
| JWT_SECRET changed | All users will be logged out |
| WOPI_SECRET changed | Active document editing sessions will end |
| POSTGRES_PASSWORD changed | No user impact (internal) |
| COLLABORA_ADMIN_PASSWORD changed | New password for admin console |

### Rollback Procedure

If something goes wrong:

```bash
# Stop services
docker compose down

# Restore backup
cp .env.backup.YYYYMMDD_HHMMSS .env

# If you changed database password, restore it
docker compose up -d postgres
docker compose exec postgres psql -U collabora -d collabora_db -c \
  "ALTER USER collabora WITH PASSWORD 'old-password-from-backup';"

# Restart all services
docker compose up -d
```

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** open a public GitHub issue
2. Contact the maintainers privately
3. Provide detailed information about the vulnerability
4. Allow reasonable time for a fix before disclosure

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Internet (HTTPS only)                     │
└─────────────────────────┬───────────────────────────────────┘
                          │ TLS 1.2+
┌─────────────────────────▼───────────────────────────────────┐
│                    Nginx Reverse Proxy                       │
│            (SSL termination, rate limiting)                  │
└──────┬──────────────────────────────────────────────────────┘
       │ Private Docker Network
       ▼
┌──────────────────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Web Frontend │  │ WOPI Server  │  │ Collabora Online │   │
│  │   (React)    │  │  (Node.js)   │  │     (CODE)       │   │
│  └──────────────┘  └──────┬───────┘  └──────────────────┘   │
│                           │                                  │
│            ┌──────────────┴──────────────┐                   │
│            ▼                             ▼                   │
│     ┌──────────────┐              ┌──────────────┐          │
│     │  PostgreSQL  │              │    Redis     │          │
│     │  (Encrypted  │              │  (Sessions)  │          │
│     │   at rest)   │              │              │          │
│     └──────────────┘              └──────────────┘          │
│                                                              │
│                    Internal Network Only                     │
└──────────────────────────────────────────────────────────────┘
```

## Compliance Notes

- Passwords are hashed using bcrypt (OWASP recommended)
- JWT tokens follow RFC 7519 standards
- HTTPS enforced for all external communications
- Audit logging for security-relevant events
- Session management with configurable timeouts
