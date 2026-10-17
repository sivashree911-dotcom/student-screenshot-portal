const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const isProduction = process.env.NODE_ENV === 'production';

// Helper to strip surrounding quotes and whitespace from environment variables
function cleanString(val) {
  if (val === undefined || val === null) return '';
  return String(val)
    .trim()
    .replace(/^['"`]+|['"`]+$/g, '')
    .trim();
}

// Helper to safely parse database connection URI (e.g. Aiven Service URI or DATABASE_URL)
function parseDatabaseUrl(uri) {
  if (!uri || typeof uri !== 'string') {
    return null;
  }

  const cleaned = cleanString(uri);
  if (!cleaned.includes('://')) {
    return null;
  }

  try {
    const parsed = new URL(cleaned);
    return {
      host: cleanString(parsed.hostname),
      port: parsed.port ? parseInt(cleanString(parsed.port), 10) : 3306,
      user: decodeURIComponent(cleanString(parsed.username) || 'root'),
      password: decodeURIComponent(parsed.password || ''),
      database: parsed.pathname ? cleanString(parsed.pathname.replace(/^\//, '')) : 'defaultdb',
      sslRequired:
        parsed.searchParams.get('ssl-mode') === 'REQUIRED' ||
        parsed.searchParams.get('ssl') === 'true' ||
        parsed.searchParams.get('sslmode') === 'require'
    };
  } catch (err) {
    console.warn('[CONFIG] Failed to parse database URL:', err.message);
    return null;
  }
}

// Check for single database URL strings across common environment variable names
const connectionUri = cleanString(
  process.env.DATABASE_URL ||
  process.env.MYSQL_URL ||
  process.env.MYSQL_URI ||
  process.env.AIVEN_DATABASE_URL ||
  ''
);

const parsedUri = parseDatabaseUrl(connectionUri);

// Determine database host and check for embedded port/protocol
let rawHost = cleanString(
  (parsedUri && parsedUri.host) ||
  process.env.DB_HOST ||
  process.env.MYSQL_HOST ||
  ''
);

// If user pasted a full URI into DB_HOST (e.g. mysql://avnadmin:...@mysql-xxxx.aivencloud.com:15234/defaultdb)
let hostUriParsed = null;
if (rawHost.includes('://')) {
  hostUriParsed = parseDatabaseUrl(rawHost);
  if (hostUriParsed && hostUriParsed.host) {
    rawHost = hostUriParsed.host;
  }
}

// Strip any protocol prefixes like mysql://, http://, or tcp://
rawHost = rawHost.replace(/^[a-zA-Z0-9_-]+:\/\//, '');

// Strip any path segments like /defaultdb
let extractedDatabaseFromHost = null;
if (rawHost.includes('/')) {
  const parts = rawHost.split('/');
  rawHost = parts[0];
  if (parts[1] && cleanString(parts[1])) {
    extractedDatabaseFromHost = cleanString(parts[1]);
  }
}

// Strip and extract port if user specified host as "hostname:port" (e.g. mysql-xxxx.aivencloud.com:15234)
let extractedPortFromHost = null;
if (rawHost.includes(':')) {
  const parts = rawHost.split(':');
  rawHost = parts[0];
  if (parts[1] && !isNaN(parseInt(parts[1], 10))) {
    extractedPortFromHost = parseInt(parts[1], 10);
  }
}

const dbHost = rawHost || 'localhost';

// Determine database port
const rawPort = cleanString(
  (hostUriParsed && hostUriParsed.port) ||
  (parsedUri && parsedUri.port) ||
  extractedPortFromHost ||
  process.env.DB_PORT ||
  process.env.MYSQL_PORT ||
  '3306'
);
const dbPort = parseInt(rawPort, 10) || 3306;

// Determine database user
const rawUser = cleanString(
  (hostUriParsed && hostUriParsed.user) ||
  (parsedUri && parsedUri.user) ||
  process.env.DB_USER ||
  process.env.MYSQL_USER ||
  (isProduction ? 'avnadmin' : 'root')
);
const dbUser = rawUser || (isProduction ? 'avnadmin' : 'root');

// Determine database password
let dbPassword = '';
if (hostUriParsed && hostUriParsed.password !== undefined) {
  dbPassword = hostUriParsed.password;
} else if (parsedUri && parsedUri.password !== undefined) {
  dbPassword = parsedUri.password;
} else if (process.env.DB_PASSWORD !== undefined) {
  // Strip enclosing quotes only, preserving any whitespace within password
  dbPassword = String(process.env.DB_PASSWORD).replace(/^['"`]+|['"`]+$/g, '');
} else if (process.env.MYSQL_PASSWORD !== undefined) {
  dbPassword = String(process.env.MYSQL_PASSWORD).replace(/^['"`]+|['"`]+$/g, '');
}

// Determine database name
const rawDatabase = cleanString(
  (hostUriParsed && hostUriParsed.database) ||
  (parsedUri && parsedUri.database) ||
  extractedDatabaseFromHost ||
  process.env.DB_NAME ||
  process.env.MYSQL_DATABASE ||
  (isProduction ? 'defaultdb' : 'student_screenshot_portal')
);
const dbName = rawDatabase || (isProduction ? 'defaultdb' : 'student_screenshot_portal');

// Determine SSL setting
const explicitSsl = cleanString(
  process.env.DB_SSL !== undefined ? process.env.DB_SSL : process.env.MYSQL_SSL
).toLowerCase();

const sslDisabled = explicitSsl === 'false' || explicitSsl === '0';

// Aiven MySQL and cloud databases require SSL
const isAivenHost = dbHost.includes('aivencloud.com') || dbHost.includes('aiven');

const sslEnabled =
  (parsedUri && parsedUri.sslRequired) ||
  (hostUriParsed && hostUriParsed.sslRequired) ||
  explicitSsl === 'true' ||
  explicitSsl === '1' ||
  isAivenHost ||
  (isProduction && !sslDisabled);

const sslConfig = sslEnabled ? { rejectUnauthorized: false } : undefined;

// Check if placeholder hostname from documentation was inadvertently copied
const isPlaceholderHost = dbHost === 'your-aiven-db-hostname.aivencloud.com';

module.exports = {
  port: parseInt(cleanString(process.env.PORT) || '5000', 10),
  nodeEnv: cleanString(process.env.NODE_ENV) || 'development',
  isProduction,
  db: {
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    ssl: sslConfig,
    isPlaceholder: isPlaceholderHost,
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    timezone: '+00:00'
  },
  cloudinary: {
    cloudName: cleanString(process.env.CLOUDINARY_CLOUD_NAME),
    apiKey: cleanString(process.env.CLOUDINARY_API_KEY),
    apiSecret: cleanString(process.env.CLOUDINARY_API_SECRET)
  },
  jwt: {
    secret: cleanString(process.env.JWT_SECRET) || 'portal_jwt_fallback_secret_key_2026',
    expiresIn: cleanString(process.env.JWT_EXPIRES_IN) || '7d'
  },
  appsScriptApiUrl: cleanString(process.env.APPS_SCRIPT_API_URL),
  uploadDir: path.join(__dirname, '..', cleanString(process.env.UPLOAD_DIR) || 'uploads'),
  admin: {
    name: cleanString(process.env.ADMIN_NAME),
    email: cleanString(process.env.ADMIN_EMAIL),
    password: process.env.ADMIN_PASSWORD
      ? String(process.env.ADMIN_PASSWORD).replace(/^['"`]+|['"`]+$/g, '')
      : ''
  }
};
