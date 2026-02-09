/**
 * ============================================================================
 * BRANDING CONFIGURATION
 * ============================================================================
 * 
 * This file controls the appearance and branding of your Collabora Docs instance.
 * 
 * HOW TO CUSTOMIZE:
 * -----------------
 * Option 1: Environment Variables (Recommended for deployment)
 *   - Edit your .env file and set VITE_* variables
 *   - See .env.example for all available options
 * 
 * Option 2: Edit This File (For permanent changes)
 *   - Modify the default values in the 'branding' object below
 * 
 * ============================================================================
 * CHANGING THE APPLICATION NAME
 * ============================================================================
 * 
 * In .env file:
 *   VITE_APP_NAME=My Company Docs
 *   VITE_APP_TAGLINE=Your tagline here
 * 
 * Or edit the 'appName' and 'tagline' values below.
 * 
 * ============================================================================
 * CHANGING THE LOGO
 * ============================================================================
 * 
 * Step 1: Prepare your logo file
 *   - Supported formats: PNG, SVG (recommended), JPG
 *   - Recommended size: 40-64px height
 *   - Use transparent background for best results
 * 
 * Step 2: Place the logo file
 *   - Copy your logo to: web-frontend/public/custom/
 *   - Example: web-frontend/public/custom/my-logo.svg
 * 
 * Step 3: Configure the logo path
 *   In .env file:
 *     VITE_LOGO_URL=/custom/my-logo.svg
 *   
 *   Or edit 'logoUrl' below:
 *     logoUrl: '/custom/my-logo.svg',
 * 
 * Step 4: Restart the application
 *   Development: npm run dev
 *   Production: docker compose up -d --build
 * 
 * ============================================================================
 * OTHER CUSTOMIZATION OPTIONS
 * ============================================================================
 * 
 * Welcome Banner (Dashboard):
 *   VITE_SHOW_WELCOME_BANNER=true
 *   VITE_WELCOME_TITLE=Welcome to {appName}
 *   VITE_WELCOME_MESSAGE=Your custom message here
 * 
 * Login Page:
 *   VITE_LOGIN_TITLE=Sign in to your account
 *   VITE_ALLOW_REGISTRATION=true
 * 
 * Footer:
 *   VITE_SHOW_FOOTER=true
 *   VITE_FOOTER_TEXT=© {year} {appName}. All rights reserved.
 * 
 * See CUSTOMIZATION.md for complete documentation.
 * ============================================================================
 */

const branding = {
  // Application Identity
  appName: import.meta.env.VITE_APP_NAME || 'Collabora Docs',
  tagline: import.meta.env.VITE_APP_TAGLINE || 'Your documents, anywhere',
  description: import.meta.env.VITE_APP_DESCRIPTION || 'Create, edit, and collaborate on documents with our powerful online office suite.',
  
  // Logo Configuration
  // Set to null to use default icon, or provide path to custom logo
  // Example: '/custom/my-logo.png' (place file in public/custom/my-logo.png)
  logoUrl: import.meta.env.VITE_LOGO_URL || null,
  logoAlt: import.meta.env.VITE_LOGO_ALT || 'Logo',
  logoHeight: import.meta.env.VITE_LOGO_HEIGHT || '40', // in pixels
  
  // Favicon (place in public/ directory)
  faviconUrl: import.meta.env.VITE_FAVICON_URL || '/favicon.svg',
  
  // Colors (used for dynamic theming)
  primaryColor: import.meta.env.VITE_PRIMARY_COLOR || '#4f46e5', // indigo-600
  
  // Home Page / Dashboard Customization
  showWelcomeBanner: import.meta.env.VITE_SHOW_WELCOME_BANNER !== 'false',
  welcomeTitle: import.meta.env.VITE_WELCOME_TITLE || 'Welcome to {appName}',
  welcomeMessage: import.meta.env.VITE_WELCOME_MESSAGE || 'Start creating and editing documents right away.',
  
  // Feature highlights shown on login/register pages
  features: [
    {
      icon: 'FileText',
      title: 'Documents',
      description: 'Create and edit text documents with rich formatting'
    },
    {
      icon: 'FileSpreadsheet', 
      title: 'Spreadsheets',
      description: 'Build powerful spreadsheets with formulas and charts'
    },
    {
      icon: 'Presentation',
      title: 'Presentations',
      description: 'Design stunning presentations with ease'
    }
  ],
  
  // Footer
  showFooter: import.meta.env.VITE_SHOW_FOOTER !== 'false',
  footerText: import.meta.env.VITE_FOOTER_TEXT || '© {year} {appName}. All rights reserved.',
  footerLinks: [
    // Add custom footer links here
    // { label: 'Privacy Policy', url: '/privacy' },
    // { label: 'Terms of Service', url: '/terms' },
  ],
  
  // Login Page Customization
  loginTitle: import.meta.env.VITE_LOGIN_TITLE || 'Sign in to your account',
  registerTitle: import.meta.env.VITE_REGISTER_TITLE || 'Create your account',
  allowRegistration: import.meta.env.VITE_ALLOW_REGISTRATION !== 'false',
  
  // Dashboard Customization
  emptyStateTitle: import.meta.env.VITE_EMPTY_STATE_TITLE || 'No documents yet',
  emptyStateMessage: import.meta.env.VITE_EMPTY_STATE_MESSAGE || 'Get started by creating a new document or uploading a file',
};

// Helper function to replace placeholders
export function formatText(text) {
  if (!text) return '';
  return text
    .replace(/{appName}/g, branding.appName)
    .replace(/{year}/g, new Date().getFullYear().toString());
}

export default branding;
