const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config/config');
const { initDatabase } = require('./config/db');
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
      return callback(null, origin);
    }

    // Default to allow the request origin with reflection for credentials support
    return callback(null, origin);
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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin/auth', authRoutes);
app.use('/api/auth/admin', authRoutes); // alias
app.use('/api/students', studentRoutes);
app.use('/api/hackathons', hackathonRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/participation', participationRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Student Screenshot Portal API is operational',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString()
  });
});

// Centralized error handling
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.port;

async function startServer() {
  try {
    // Initialize MySQL tables and default seed data
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Student Screenshot Portal Backend Running`);
      console.log(`📡 URL: http://localhost:${PORT}`);
      console.log(`📁 Uploads Directory: ${uploadsPath}`);
      console.log(`🔒 Environment: ${config.nodeEnv}`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('❌ [SERVER] Fatal startup error:', error.message);
    process.exit(1);
  }
}

startServer();
