# Customization Guide

This guide explains how to customize the branding, logo, and home page of your Collabora Standalone deployment.

## Quick Start

1. Copy `.env.example` to `.env` (if not already done)
2. Edit the branding variables in `.env`
3. Place custom logo in `web-frontend/public/custom/`
4. Restart the application

## Branding Options

### Application Name & Tagline

```bash
# In .env file
VITE_APP_NAME=My Company Docs
VITE_APP_TAGLINE=Collaborate with confidence
```

### Custom Logo

1. **Prepare your logo**: PNG, SVG, or JPG format (recommended: SVG for best quality)
2. **Place the file** in `web-frontend/public/custom/` directory
3. **Update the environment variable**:

```bash
VITE_LOGO_URL=/custom/my-logo.png
```

**Logo recommendations:**
- Use transparent background for best results
- Recommended height: 40-64 pixels
- SVG format for crisp display at any size

### Welcome Banner

The welcome banner appears on the dashboard for new users:

```bash
# Enable/disable the welcome banner
VITE_SHOW_WELCOME_BANNER=true

# Customize the welcome message
VITE_WELCOME_TITLE=Welcome to {appName}
VITE_WELCOME_MESSAGE=Start creating and editing documents right away.
```

**Note:** Use `{appName}` as a placeholder - it will be replaced with your `VITE_APP_NAME`.

### Login & Registration Pages

```bash
# Login page title
VITE_LOGIN_TITLE=Sign in to your account

# Registration page title
VITE_REGISTER_TITLE=Create your account

# Enable/disable public registration
VITE_ALLOW_REGISTRATION=true
```

### Footer

```bash
# Show/hide footer
VITE_SHOW_FOOTER=true

# Footer text (use {year} and {appName} placeholders)
VITE_FOOTER_TEXT=© {year} {appName}. All rights reserved.
```

## Advanced Customization

### Editing the Branding Configuration

For more advanced customization, edit the configuration file directly:

```
web-frontend/src/config/branding.js
```

This file contains:
- Default values for all branding options
- Feature highlights shown on login page
- Footer links configuration

### Custom Features List

Edit `branding.js` to customize the feature highlights:

```javascript
features: [
  {
    icon: 'FileText',
    title: 'Documents',
    description: 'Create and edit text documents'
  },
  {
    icon: 'FileSpreadsheet',
    title: 'Spreadsheets',
    description: 'Build powerful spreadsheets'
  },
  // Add more features...
]
```

### Custom Footer Links

Add footer links in `branding.js`:

```javascript
footerLinks: [
  { label: 'Privacy Policy', url: '/privacy' },
  { label: 'Terms of Service', url: '/terms' },
  { label: 'Contact', url: 'mailto:support@example.com' },
]
```

### Custom Favicon

Replace the favicon files in `web-frontend/public/`:
- `favicon.svg` - SVG favicon (modern browsers)
- `favicon.ico` - ICO fallback (older browsers)

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_APP_NAME` | Application name | Collabora Docs |
| `VITE_APP_TAGLINE` | Tagline on login page | Your documents, anywhere |
| `VITE_APP_DESCRIPTION` | Meta description | (default text) |
| `VITE_LOGO_URL` | Path to custom logo | null (uses icon) |
| `VITE_LOGO_ALT` | Logo alt text | Logo |
| `VITE_LOGO_HEIGHT` | Logo height in pixels | 40 |
| `VITE_PRIMARY_COLOR` | Primary brand color | #4f46e5 |
| `VITE_SHOW_WELCOME_BANNER` | Show welcome banner | true |
| `VITE_WELCOME_TITLE` | Welcome banner title | Welcome to {appName} |
| `VITE_WELCOME_MESSAGE` | Welcome banner message | (default text) |
| `VITE_LOGIN_TITLE` | Login page subtitle | Sign in to your account |
| `VITE_REGISTER_TITLE` | Register page title | Create your account |
| `VITE_ALLOW_REGISTRATION` | Allow public registration | true |
| `VITE_SHOW_FOOTER` | Show footer | true |
| `VITE_FOOTER_TEXT` | Footer text | © {year} {appName}... |
| `VITE_EMPTY_STATE_TITLE` | Empty dashboard title | No documents yet |
| `VITE_EMPTY_STATE_MESSAGE` | Empty dashboard message | Get started by... |

## Applying Changes

### Development
Changes to environment variables require a restart of the dev server:
```bash
# Stop the current server (Ctrl+C) then:
npm run dev
```

### Production (Docker)
Rebuild and restart the containers:
```bash
docker compose build web-frontend
docker compose up -d
```

## Examples

### Corporate Branding

```bash
VITE_APP_NAME=Acme Corp Documents
VITE_APP_TAGLINE=Enterprise document collaboration
VITE_LOGO_URL=/custom/acme-logo.svg
VITE_ALLOW_REGISTRATION=false
VITE_FOOTER_TEXT=© {year} Acme Corporation. Internal use only.
```

### Minimal Branding

```bash
VITE_APP_NAME=Docs
VITE_APP_TAGLINE=
VITE_SHOW_WELCOME_BANNER=false
VITE_SHOW_FOOTER=false
```

### Education Institution

```bash
VITE_APP_NAME=University Docs
VITE_APP_TAGLINE=Collaborate on your coursework
VITE_LOGO_URL=/custom/university-logo.png
VITE_WELCOME_TITLE=Welcome, Students!
VITE_WELCOME_MESSAGE=Create documents, spreadsheets, and presentations for your classes.
```

## Applying Customization to New Deployments

### Fresh Installation

When deploying to a new server, follow these steps to apply your customization:

#### Step 1: Clone the Repository

```bash
git clone https://github.com/rishablearn/collabora-standalone.git
cd collabora-standalone
```

#### Step 2: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your settings
nano .env
```

Add your branding settings:
```bash
# Domain and security settings
DOMAIN=docs.yourcompany.com

# Branding
VITE_APP_NAME=Your Company Docs
VITE_APP_TAGLINE=Your tagline here
VITE_LOGO_URL=/custom/your-logo.svg
```

#### Step 3: Add Custom Logo (Optional)

```bash
# Create the custom assets directory
mkdir -p web-frontend/public/custom

# Copy your logo file
cp /path/to/your-logo.svg web-frontend/public/custom/
```

#### Step 4: Run Setup and Deploy

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run setup (generates secrets, SSL certs)
./scripts/setup.sh

# Deploy
./scripts/deploy.sh
```

### Updating an Existing Deployment

To apply customization changes to an already running deployment:

#### Option 1: Environment Variable Changes Only

```bash
# Edit the .env file
nano .env

# Rebuild and restart only the frontend
docker compose up -d --build web-frontend
```

#### Option 2: Adding a New Logo

```bash
# Copy your new logo
cp /path/to/new-logo.svg web-frontend/public/custom/

# Update .env
echo "VITE_LOGO_URL=/custom/new-logo.svg" >> .env

# Rebuild frontend
docker compose up -d --build web-frontend
```

#### Option 3: Full Rebuild

```bash
# Pull latest changes (if updating from git)
git pull origin main

# Rebuild all containers
docker compose build --no-cache

# Restart services
docker compose up -d
```

### Deployment Checklist

Before deploying, ensure you have configured:

- [ ] `DOMAIN` - Your actual domain name
- [ ] `VITE_APP_NAME` - Your application name
- [ ] `VITE_LOGO_URL` - Path to your logo (if using custom logo)
- [ ] Logo file placed in `web-frontend/public/custom/`
- [ ] SSL certificates (run `./scripts/ssl-letsencrypt.sh` for production)
- [ ] Strong passwords generated (setup.sh does this automatically)

### Docker Compose Override (Advanced)

For persistent customization without modifying tracked files, create a `docker-compose.override.yml`:

```yaml
version: '3.8'

services:
  web-frontend:
    build:
      args:
        - VITE_APP_NAME=My Custom App
        - VITE_LOGO_URL=/custom/my-logo.svg
    volumes:
      - ./my-custom-assets:/app/public/custom:ro
```

This file is git-ignored and won't be overwritten when pulling updates.

### Verifying Your Customization

After deployment, verify your changes:

1. **Check the login page** - Logo and app name should appear
2. **Check the dashboard** - Welcome banner should show your message
3. **Check the browser tab** - Title should show your app name
4. **Check the header** - Logo and name in navigation

### Troubleshooting Deployment

**Logo not appearing:**
```bash
# Verify the file exists
ls -la web-frontend/public/custom/

# Check nginx logs
docker compose logs nginx
```

**Changes not taking effect:**
```bash
# Force rebuild without cache
docker compose build --no-cache web-frontend
docker compose up -d web-frontend

# Clear browser cache or use incognito mode
```

**Environment variables not loading:**
```bash
# Verify .env file is being read
docker compose config | grep VITE_
```
