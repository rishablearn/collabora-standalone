const winston = require('winston');
const path = require('path');

// Custom format for detailed debugging
const debugFormat = winston.format.printf(({ level, message, timestamp, service, ...metadata }) => {
  let msg = `${timestamp} [${service}] ${level}: ${message}`;
  if (Object.keys(metadata).length > 0 && metadata.stack !== undefined) {
    msg += `\n${metadata.stack}`;
  } else if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata, null, 2)}`;
  }
  return msg;
});

// Determine log level from environment
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Create logger with enhanced debugging
const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'wopi-server' },
  transports: [
    // Console transport with colorized output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        debugFormat
      )
    })
  ]
});

// Add file transport in production for persistent logs
if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
  const logsDir = process.env.LOGS_DIR || '/app/logs';
  
  // Error log file
  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    tailable: true
  }));
  
  // Combined log file
  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    tailable: true
  }));
}

// Debug helper functions
logger.debugRequest = (req, message = 'Request received') => {
  logger.debug(message, {
    method: req.method,
    url: req.url,
    params: req.params,
    query: req.query,
    headers: {
      'content-type': req.headers['content-type'],
      'x-wopi-override': req.headers['x-wopi-override'],
      'authorization': req.headers['authorization'] ? '[PRESENT]' : '[MISSING]'
    },
    ip: req.ip
  });
};

logger.debugResponse = (res, data, message = 'Response sent') => {
  logger.debug(message, {
    statusCode: res.statusCode,
    data: typeof data === 'object' ? JSON.stringify(data).substring(0, 500) : data
  });
};

logger.debugDB = (query, params, message = 'Database query') => {
  logger.debug(message, {
    query: query.substring(0, 200),
    params: params ? params.map(p => typeof p === 'string' && p.length > 50 ? p.substring(0, 50) + '...' : p) : []
  });
};

// Startup info
logger.info(`Logger initialized with level: ${logLevel}`);

module.exports = logger;
