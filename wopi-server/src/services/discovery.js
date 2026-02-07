/**
 * Collabora Discovery Service
 * Fetches and caches the WOPI discovery information from Collabora
 */
const logger = require('../utils/logger');

let discoveryCache = null;
let discoveryCacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

/**
 * Parse the discovery XML and extract action URLs for each file type
 */
function parseDiscoveryXML(xml) {
  const actions = {};
  
  // Extract app entries with their actions
  const appRegex = /<app\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/app>/gi;
  let appMatch;
  
  while ((appMatch = appRegex.exec(xml)) !== null) {
    const appName = appMatch[1];
    const appContent = appMatch[2];
    
    // Extract action entries
    const actionRegex = /<action\s+([^>]+)\/>/gi;
    let actionMatch;
    
    while ((actionMatch = actionRegex.exec(appContent)) !== null) {
      const attrs = actionMatch[1];
      
      // Parse attributes
      const nameMatch = attrs.match(/name="([^"]+)"/);
      const extMatch = attrs.match(/ext="([^"]+)"/);
      const urlsrcMatch = attrs.match(/urlsrc="([^"]+)"/);
      
      if (nameMatch && urlsrcMatch) {
        const actionName = nameMatch[1];
        const urlsrc = urlsrcMatch[1];
        const ext = extMatch ? extMatch[1] : null;
        
        if (!actions[actionName]) {
          actions[actionName] = {};
        }
        
        if (ext) {
          actions[actionName][ext] = urlsrc;
        }
        
        // Store by app name as fallback
        actions[actionName][appName] = urlsrc;
      }
    }
  }
  
  return actions;
}

/**
 * Get the editor URL template from discovery
 */
async function getEditorUrl(extension, action = 'edit') {
  const discovery = await fetchDiscovery();
  
  if (!discovery || !discovery.actions) {
    // Fallback to default URL pattern
    logger.warn('Discovery not available, using fallback URL');
    return null;
  }
  
  const actionUrls = discovery.actions[action];
  if (!actionUrls) {
    logger.warn(`Action '${action}' not found in discovery`);
    return null;
  }
  
  // Try to find URL for specific extension
  const ext = extension.replace('.', '').toLowerCase();
  if (actionUrls[ext]) {
    return actionUrls[ext];
  }
  
  // Map extensions to Collabora application names
  const appMappings = {
    // Writer (documents)
    'odt': 'writer', 'doc': 'writer', 'docx': 'writer',
    'rtf': 'writer', 'txt': 'writer', 'html': 'writer',
    // Calc (spreadsheets)
    'ods': 'calc', 'xls': 'calc', 'xlsx': 'calc', 'csv': 'calc',
    // Impress (presentations)
    'odp': 'impress', 'ppt': 'impress', 'pptx': 'impress',
    // Draw (graphics)
    'odg': 'draw', 'vsd': 'draw', 'vsdx': 'draw',
  };
  
  const appName = appMappings[ext];
  if (appName && actionUrls[appName]) {
    return actionUrls[appName];
  }
  
  // Return first available URL as fallback
  const urls = Object.values(actionUrls);
  return urls.length > 0 ? urls[0] : null;
}

/**
 * Fetch discovery from Collabora
 */
async function fetchDiscovery() {
  const now = Date.now();
  
  // Return cached if still valid
  if (discoveryCache && (now - discoveryCacheTime) < CACHE_TTL) {
    return discoveryCache;
  }
  
  const collaboraUrl = process.env.COLLABORA_URL || 'http://collabora:9980';
  
  try {
    logger.info(`Fetching discovery from ${collaboraUrl}/hosting/discovery`);
    
    const response = await fetch(`${collaboraUrl}/hosting/discovery`, {
      timeout: 10000
    });
    
    if (!response.ok) {
      throw new Error(`Discovery fetch failed: ${response.status}`);
    }
    
    const xml = await response.text();
    logger.debug('Discovery XML received', { length: xml.length });
    
    const actions = parseDiscoveryXML(xml);
    
    discoveryCache = {
      xml,
      actions,
      fetchedAt: now
    };
    discoveryCacheTime = now;
    
    logger.info('Discovery cached successfully', { 
      actionCount: Object.keys(actions).length 
    });
    
    return discoveryCache;
  } catch (error) {
    logger.error('Failed to fetch discovery:', error.message);
    
    // Return stale cache if available
    if (discoveryCache) {
      logger.warn('Using stale discovery cache');
      return discoveryCache;
    }
    
    return null;
  }
}

/**
 * Build the full Collabora editor URL for a file
 * @param {string} fileId - The file ID
 * @param {string} fileName - The file name (used to determine extension)
 * @param {string} accessToken - The access token for WOPI authentication
 * @param {string} permission - 'edit' or 'view'
 * @returns {Promise<string>} The editor URL
 */
async function buildEditorUrl(fileId, fileName, accessToken, permission = 'edit') {
  const domain = process.env.DOMAIN || 'localhost';
  // WOPISrc must be the URL that Collabora will call back to get file info
  // This needs to be accessible from Collabora's network perspective
  const wopiSrc = `https://${domain}/wopi/files/${fileId}`;
  const encodedWopiSrc = encodeURIComponent(wopiSrc);
  
  logger.debug('Building editor URL', { fileId, fileName, permission, wopiSrc });
  
  // Get extension from filename
  const ext = fileName.split('.').pop().toLowerCase();
  
  // Try to get URL from discovery
  const action = permission === 'view' ? 'view' : 'edit';
  let editorUrlTemplate = await getEditorUrl(ext, action);
  
  // If no edit action, try view
  if (!editorUrlTemplate && action === 'edit') {
    editorUrlTemplate = await getEditorUrl(ext, 'view');
  }
  
  if (editorUrlTemplate) {
    // Discovery URL format: http://collabora:9980/browser/hash/cool.html?WOPISrc=<placeholder>&...
    // We need to:
    // 1. Replace the internal URL with external domain
    // 2. Strip existing query params (they have placeholders)
    // 3. Add our own WOPISrc and access_token
    
    const collaboraUrl = process.env.COLLABORA_URL || 'http://collabora:9980';
    
    // Get base URL (everything before ?)
    let baseUrl = editorUrlTemplate.split('?')[0];
    
    // Replace internal Collabora URL with external domain
    baseUrl = baseUrl.replace(collaboraUrl, `https://${domain}`);
    baseUrl = baseUrl.replace(/http:\/\/[^\/]+:9980/g, `https://${domain}`);
    baseUrl = baseUrl.replace(/http:\/\/localhost:9980/g, `https://${domain}`);
    
    // Build final URL with required parameters
    const editorUrl = `${baseUrl}?WOPISrc=${encodedWopiSrc}&access_token=${encodeURIComponent(accessToken)}`;
    
    logger.debug('Built editor URL from discovery', { 
      template: editorUrlTemplate,
      baseUrl,
      wopiSrc,
      editorUrl 
    });
    return editorUrl;
  }
  
  // Fallback: construct URL manually using /browser/dist/cool.html path
  logger.warn('Using fallback editor URL construction');
  return `https://${domain}/browser/dist/cool.html?WOPISrc=${encodedWopiSrc}&access_token=${encodeURIComponent(accessToken)}`;
}

/**
 * Clear the discovery cache (useful for testing or when Collabora restarts)
 */
function clearCache() {
  discoveryCache = null;
  discoveryCacheTime = 0;
  logger.info('Discovery cache cleared');
}

module.exports = {
  fetchDiscovery,
  getEditorUrl,
  buildEditorUrl,
  clearCache,
  parseDiscoveryXML
};
