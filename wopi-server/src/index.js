require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/auth');
const wopiRoutes = require('./routes/wopi');
const filesRoutes = require('./routes/files');
const usersRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

// Redis client setup
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => logger.error('Redis Client Error', err));
redisClient.on('connect', () => logger.info('Connected to Redis'));

// Initialize Redis connection
(async () => {
  await redisClient.connect();
})();

// Session store
const redisStore = new RedisStore({
  client: redisClient,
  prefix: 'collabora:sess:'
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.DOMAIN ? `https://${process.env.DOMAIN}` : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-WOPI-Override', 'X-WOPI-Lock', 'X-WOPI-OldLock', 'X-WOPI-Timestamp']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 1000 || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_REQUESTS) || 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging - use 'dev' format in development for more readable output
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, { stream: { write: message => logger.info(message.trim()) } }));

// Debug middleware - log all requests in debug mode
if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    logger.debugRequest(req);
    next();
  });
}

// Session middleware
app.use(session({
  store: redisStore,
  secret: process.env.JWT_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_TIMEOUT) * 1000 || 24 * 60 * 60 * 1000
  }
}));

// Health check endpoint
app.get('/health', async (req, res) => {
  const pool = require('./db/pool');
  let dbStatus = 'unknown';
  let tablesExist = false;
  
  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
    
    // Check if tables exist
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      )
    `);
    tablesExist = tableCheck.rows[0].exists;
  } catch (err) {
    dbStatus = `error: ${err.message}`;
  }
  
  res.json({ 
    status: dbStatus === 'connected' && tablesExist ? 'healthy' : 'degraded', 
    timestamp: new Date().toISOString(),
    service: 'wopi-server',
    database: dbStatus,
    tablesInitialized: tablesExist
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/users', usersRoutes);

// WOPI Routes (must not have /api prefix for Collabora compatibility)
app.use('/wopi', wopiRoutes);

// Discovery endpoint for Collabora - proxies discovery XML
const { fetchDiscovery, clearCache } = require('./services/discovery');

app.get('/hosting/discovery', async (req, res) => {
  try {
    const discovery = await fetchDiscovery();
    if (discovery && discovery.xml) {
      res.set('Content-Type', 'application/xml');
      res.send(discovery.xml);
    } else {
      // Fallback to direct fetch
      const collaboraUrl = process.env.COLLABORA_URL || 'http://collabora:9980';
      const response = await fetch(`${collaboraUrl}/hosting/discovery`);
      const xml = await response.text();
      res.set('Content-Type', 'application/xml');
      res.send(xml);
    }
  } catch (error) {
    logger.error('Discovery fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch discovery' });
  }
});

// Debug endpoint to check Collabora connectivity
app.get('/api/debug/collabora', async (req, res) => {
  const collaboraUrl = process.env.COLLABORA_URL || 'http://collabora:9980';
  const domain = process.env.DOMAIN || 'localhost';
  const results = {
    collaboraUrl,
    domain,
    wopiBaseUrl: `https://${domain}/wopi/files`,
    checks: {}
  };

  // Check discovery
  try {
    const discovery = await fetchDiscovery();
    results.checks.discovery = {
      success: !!discovery,
      actionCount: discovery?.actions ? Object.keys(discovery.actions).length : 0,
      sampleActions: discovery?.actions ? Object.keys(discovery.actions).slice(0, 5) : []
    };
    
    // Show a sample URL template
    if (discovery?.actions?.edit) {
      const sampleExt = Object.keys(discovery.actions.edit)[0];
      results.checks.discovery.sampleUrlTemplate = discovery.actions.edit[sampleExt];
    }
  } catch (error) {
    results.checks.discovery = { success: false, error: error.message };
  }

  // Check capabilities
  try {
    const capResponse = await fetch(`${collaboraUrl}/hosting/capabilities`);
    const capabilities = await capResponse.json();
    results.checks.capabilities = { success: true, data: capabilities };
  } catch (error) {
    results.checks.capabilities = { success: false, error: error.message };
  }

  // Test building an editor URL
  try {
    const { buildEditorUrl } = require('./services/discovery');
    const testUrl = await buildEditorUrl('test-file-id', 'test.odt', 'test-token', 'edit');
    results.checks.editorUrl = { success: true, sampleUrl: testUrl };
  } catch (error) {
    results.checks.editorUrl = { success: false, error: error.message };
  }

  res.json(results);
});

// Clear discovery cache endpoint
app.post('/api/debug/clear-discovery-cache', (req, res) => {
  clearCache();
  res.json({ message: 'Discovery cache cleared' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await redisClient.quit();
  process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`WOPI Server running on port ${PORT}`);
});

module.exports = app;
