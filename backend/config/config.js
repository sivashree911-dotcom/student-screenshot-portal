const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const isProduction = process.env.NODE_ENV === 'production';
const sslEnabled =
  process.env.DB_SSL === 'true' ||
  process.env.DB_SSL === '1' ||
  process.env.DB_SSL === true;

module.exports = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'student_screenshot_portal',
    ssl: sslEnabled
      ? { rejectUnauthorized: false }
      : isProduction && process.env.DB_SSL !== 'false'
      ? { rejectUnauthorized: false }
      : undefined,
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    timezone: '+00:00'
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || ''
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'portal_jwt_fallback_secret_key_2026',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  appsScriptApiUrl: process.env.APPS_SCRIPT_API_URL || '',
  uploadDir: path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads'),
  admin: {
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD
  }
};

