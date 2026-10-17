const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config/config');
const { initDatabase, getDbStatus } = require('./config/db');
const { errorHandler, notFoundHandler } = require('./middleware/errorMiddleware');

// Route imports
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const hackathonRoutes = require('./routes/hackathonRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const participationRoutes = require('./routes/participationRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Allowed origins for CORS in development and production
const allowedOrigins = [
  'https://student-screenshot-portal-frontend.onrender.com',
  'https://student-screenshot-portal.onrender.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5000'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (such as mobile apps, server-to-server, curl)
    if (!origin) return callback(null, true);

    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.onrender.com') ||
      config.nodeEnv !== 'production'
    ) {
      return callback(null, true);
    }

    // Default to allow the request origin with reflection for credentials support
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control'
  ],
  exposedHeaders: ['Content-Disposition'],
  optionsSuccessStatus: 200
};

// Enable CORS middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file hosting for uploaded posters and screenshots
const uploadsPath = config.uploadDir;
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Health check endpoint handler
function handleHealthCheck(req, res) {
  const dbStatus = getDbStatus();
  const isHealthy = dbStatus.connected;

  const responsePayload = {
    success: isHealthy,
    status: isHealthy ? 'healthy' : 'degraded',
    server: 'running',
    environment: config.nodeEnv,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      connected: dbStatus.connected,
      engine: dbStatus.engine,
      host: dbStatus.host,
      port: dbStatus.port,
      database: dbStatus.database,
      error: dbStatus.error || null
    },
    appsScript: {
      configured: Boolean(config.appsScriptApiUrl)
    },
    message: isHealthy
      ? 'Student Screenshot Portal API is fully operational'
      : 'Server process is active, but persistent MySQL connection is not established yet.'
  };

  // Always respond with HTTP 200 for health probes so container orchestrators (like Render)
  // keep the service running rather than terminating the container prematurely
  return res.status(200).json(responsePayload);
}

// Lightweight ping endpoint handler
function handlePing(req, res) {
  res.status(200).json({
    status: 'ok',
    server: 'running',
    timestamp: new Date().toISOString()
  });
}

// Register health check and ping routes with and without /api prefix
app.get('/api/health', handleHealthCheck);
app.get('/health', handleHealthCheck);
app.get('/api/health/live', handlePing);
app.get('/api/health/ready', handleHealthCheck);
app.get('/api/ping', handlePing);
app.get('/ping', handlePing);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin/auth', authRoutes);
app.use('/api/auth/admin', authRoutes); // alias
app.use('/api/students', studentRoutes);
app.use('/api/hackathons', hackathonRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/participation', participationRoutes);
app.use('/api/admin', adminRoutes);

// Helper to locate compiled frontend dist folder across standard monorepo layouts
function resolveFrontendDist() {
  const candidatePaths = [
    path.resolve(__dirname, '..', 'frontend', 'dist'),
    path.resolve(process.cwd(), 'frontend', 'dist'),
    path.resolve(__dirname, 'public'),
    path.resolve(process.cwd(), 'dist')
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return null;
}

const frontendDistPath = resolveFrontendDist();

if (frontendDistPath) {
  console.log(`✓ [SERVER] Serving frontend build from: ${frontendDistPath}`);

  // 1. Static asset hosting (JS, CSS, images, etc.)
  app.use(
    express.static(frontendDistPath, {
      maxAge: '1d',
      setHeaders: (res, filePath) => {
        // Prevent caching of index.html so releases and updates take effect immediately
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    })
  );

  // 2. Client-Side SPA Fallback
  // Serves index.html for all non-API/non-upload GET & HEAD requests
  // Guarantees:
  // - Root student portal at /
  // - Admin portal at /admin and /admin/login
  // - Student routes at /hackathons, /my-submissions
  // - Query strings like /?utm_source=chatgpt.com render index.html cleanly
  app.get('*', (req, res, next) => {
    // Pass API and uploads requests through to error handlers or endpoints
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }

    // If an asset with a file extension was requested but not found, return 404
    // to avoid MIME-type syntax errors in browser (e.g. "Unexpected token '<'")
    if (path.extname(req.path)) {
      return res.status(404).json({
        success: false,
        message: `Asset ${req.path} not found.`
      });
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  console.warn('⚠️ [SERVER] Frontend dist directory not found. Server running in API-only mode.');

  // Friendly root endpoint when frontend dist is not built
  app.get('/', (req, res) => {
    const dbStatus = getDbStatus();
    res.status(200).json({
      success: true,
      service: 'Student Screenshot Portal API',
      status: 'operational',
      environment: config.nodeEnv,
      database: {
        connected: dbStatus.connected,
        engine: dbStatus.engine
      },
      message: 'Student Screenshot Portal Backend is running. Frontend static files (dist/) were not found on this server. Run "npm run build" to build both frontend and backend for unified hosting.',
      endpoints: {
        health: '/api/health',
        ping: '/api/ping',
        hackathons: '/api/hackathons',
        studentVerification: '/api/students/verify',
        adminLogin: '/api/auth/login'
      }
    });
  });

  app.get('/admin', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Admin portal frontend is not built on this server. Run "npm run build" to generate frontend/dist, or access your separate frontend service.'
    });
  });
}

// Centralized error handling
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.port;
const HOST = '0.0.0.0';

async function startServer() {
  try {
    // 1. Start HTTP server immediately and bind to 0.0.0.0 so Render detects port readiness
    app.listen(PORT, HOST, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Student Screenshot Portal Backend Running`);
      console.log(`📡 URL: http://${HOST}:${PORT}`);
      console.log(`📁 Uploads Directory: ${uploadsPath}`);
      console.log(`🔒 Environment: ${config.nodeEnv}`);
      console.log(`=======================================================`);
    });

    // 2. Initialize database connection and schemas in background
    initDatabase()
      .then((connected) => {
        if (connected) {
          console.log('✓ [SERVER] Database initialized and fully operational.');
        } else {
          console.warn('⚠️ [SERVER] Database not connected. Retrying in background.');
        }
      })
      .catch((error) => {
        console.error('❌ [SERVER] Initial database connection error:', error.message);
      });

  } catch (error) {
    console.error('❌ [SERVER] Fatal server error:', error.message);
    process.exit(1);
  }
}

startServer();
