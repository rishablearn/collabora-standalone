/**
 * Frontend Logger Utility
 * Provides consistent logging with debug levels for troubleshooting
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Get log level from environment or localStorage
const getLogLevel = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('LOG_LEVEL');
    if (stored && LOG_LEVELS[stored.toUpperCase()] !== undefined) {
      return LOG_LEVELS[stored.toUpperCase()];
    }
  }
  // Default to INFO in production, DEBUG in development
  return import.meta.env.MODE === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;
};

let currentLevel = getLogLevel();

const formatMessage = (level, message, data) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  return { prefix, message, data };
};

const logger = {
  setLevel: (level) => {
    if (LOG_LEVELS[level.toUpperCase()] !== undefined) {
      currentLevel = LOG_LEVELS[level.toUpperCase()];
      if (typeof window !== 'undefined') {
        localStorage.setItem('LOG_LEVEL', level.toUpperCase());
      }
    }
  },

  error: (message, data = null) => {
    if (currentLevel >= LOG_LEVELS.ERROR) {
      const { prefix } = formatMessage('ERROR', message, data);
      if (data) {
        console.error(`${prefix} ${message}`, data);
      } else {
        console.error(`${prefix} ${message}`);
      }
    }
  },

  warn: (message, data = null) => {
    if (currentLevel >= LOG_LEVELS.WARN) {
      const { prefix } = formatMessage('WARN', message, data);
      if (data) {
        console.warn(`${prefix} ${message}`, data);
      } else {
        console.warn(`${prefix} ${message}`);
      }
    }
  },

  info: (message, data = null) => {
    if (currentLevel >= LOG_LEVELS.INFO) {
      const { prefix } = formatMessage('INFO', message, data);
      if (data) {
        console.info(`${prefix} ${message}`, data);
      } else {
        console.info(`${prefix} ${message}`);
      }
    }
  },

  debug: (message, data = null) => {
    if (currentLevel >= LOG_LEVELS.DEBUG) {
      const { prefix } = formatMessage('DEBUG', message, data);
      if (data) {
        console.log(`${prefix} ${message}`, data);
      } else {
        console.log(`${prefix} ${message}`);
      }
    }
  },

  // API request/response logging
  apiRequest: (method, url, data = null) => {
    logger.debug(`API Request: ${method} ${url}`, data);
  },

  apiResponse: (method, url, status, data = null) => {
    if (status >= 400) {
      logger.error(`API Error: ${method} ${url} - Status ${status}`, data);
    } else {
      logger.debug(`API Response: ${method} ${url} - Status ${status}`, data);
    }
  },

  // Auth logging
  auth: (action, details = null) => {
    logger.info(`Auth: ${action}`, details);
  },

  // File operations logging
  file: (action, details = null) => {
    logger.debug(`File: ${action}`, details);
  },

  // Editor/Collabora logging
  editor: (action, details = null) => {
    logger.debug(`Editor: ${action}`, details);
  },
};

// Make logger available globally for debugging in console
if (typeof window !== 'undefined') {
  window.appLogger = logger;
  window.setLogLevel = logger.setLevel;
}

export default logger;
