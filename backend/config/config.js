const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'student_screenshot_portal',
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    timezone: '+00:00'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'portal_jwt_fallback_secret_key_2026',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  appsScriptApiUrl: process.env.APPS_SCRIPT_API_URL || '',
  uploadDir: path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads')
};
