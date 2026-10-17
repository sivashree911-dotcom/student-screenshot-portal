const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const config = require('./config');

let activeEngine = 'mysql';
let mysqlPool = null;
let sqliteDb = null;
let dbConnected = false;
let dbLastError = null;
let reconnectTimer = null;
let isInitializing = false;

// ---------------------------------------------------------
// SQLite local data directory (Development Fallback Only)
// ---------------------------------------------------------
const dataDir = path.join(__dirname, '..', 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqliteFilePath = path.join(dataDir, 'portal.sqlite');

// ---------------------------------------------------------
// SQLite adapter (Development only)
// ---------------------------------------------------------
function initSqliteAdapter() {
  return new Promise((resolve, reject) => {
    sqliteDb = new sqlite3.Database(sqliteFilePath, (err) => {
      if (err) {
        return reject(err);
      }

      activeEngine = 'sqlite';
      dbConnected = true;
      dbLastError = null;
      resolve(sqliteDb);
    });
  });
}

function sqliteRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function (err) {
      if (err) {
        return reject(err);
      }

      resolve({
        insertId: this.lastID,
        affectedRows: this.changes
      });
    });
  });
}

function sqliteAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) {
        return reject(err);
      }

      resolve(rows || []);
    });
  });
}

// ---------------------------------------------------------
// Diagnostic Error Logger
// ---------------------------------------------------------
function logDetailedDatabaseError(err, host, port) {
  console.error('================================================================');
  console.error(`❌ [DATABASE ERROR] Failed to connect to MySQL at ${host}:${port}`);
  console.error(`   Error Code:    ${err.code || 'UNKNOWN'}`);
  console.error(`   Error Message: ${err.message}`);

  if (config.db.isPlaceholder) {
    console.error('   🔎 DIAGNOSIS: Placeholder hostname detected ("your-aiven-db-hostname.aivencloud.com").');
    console.error('   👉 FIX: Replace DB_HOST in Render Environment Variables with your actual Aiven MySQL host.');
  } else if (err.code === 'ENOTFOUND') {
    console.error('   🔎 DIAGNOSIS: DNS host resolution failed (ENOTFOUND).');
    console.error('   Possible reasons:');
    console.error('   1. The Aiven MySQL service is Powered Off or Paused in console.aiven.io.');
    console.error('   2. The Aiven service was deleted or recreated with a new hostname, but Render has the old DB_HOST.');
    console.error('   3. There is a typo or extra characters in DB_HOST or DATABASE_URL in Render Environment Variables.');
    console.error('   👉 FIX: Open Aiven Console (console.aiven.io), ensure status is RUNNING, and verify DB_HOST / DB_PORT in Render.');
  } else if (err.code === 'ECONNREFUSED') {
    console.error('   🔎 DIAGNOSIS: Connection refused (ECONNREFUSED).');
    console.error(`   The host is reachable, but port ${port} refused the connection.`);
    console.error('   👉 FIX: Verify DB_PORT in Render. Note: Aiven assigns custom ports (e.g. 15234), not 3306.');
  } else if (err.code === 'ER_ACCESS_DENIED_ERROR' || err.errno === 1045) {
    console.error('   🔎 DIAGNOSIS: Access denied / Bad credentials (1045).');
    console.error('   👉 FIX: Verify DB_USER (typically "avnadmin") and DB_PASSWORD in Render Environment Variables.');
  } else if (err.code === 'ETIMEDOUT' || err.code === 'CONNECT_TIMEOUT') {
    console.error('   🔎 DIAGNOSIS: Connection timed out.');
    console.error('   👉 FIX: Check firewall / IP allowances on database provider and ensure service is active.');
  } else if (err.code === 'HANDSHAKE_ERROR' || (err.message && err.message.toLowerCase().includes('ssl'))) {
    console.error('   🔎 DIAGNOSIS: SSL/TLS negotiation error.');
    console.error('   👉 FIX: Ensure DB_SSL is set to "true" in Render Environment Variables.');
  }
  console.error('================================================================');
}

// ---------------------------------------------------------
// Background Reconnection Scheduler
// ---------------------------------------------------------
function scheduleReconnect() {
  if (reconnectTimer) return;

  const retrySeconds = 20;
  console.log(`⏳ [DB] Background reconnect scheduled in ${retrySeconds}s...`);

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    console.log('🔄 [DB] Attempting scheduled database reconnection...');
    try {
      await initDatabase();
    } catch (e) {
      // Errors logged within initDatabase
    }
  }, retrySeconds * 1000);
}

// ---------------------------------------------------------
// Unified SQL query
// ---------------------------------------------------------
async function query(sql, params = []) {
  const isProduction = config.isProduction || process.env.NODE_ENV === 'production';

  if (activeEngine === 'mysql') {
    if (!mysqlPool || !dbConnected) {
      const err = new Error(
        `Database service is currently unavailable. Persistent MySQL is not connected${
          dbLastError ? ` (${dbLastError.code || dbLastError.message})` : ''
        }.`
      );
      err.status = 503;
      err.code = dbLastError ? dbLastError.code : 'DB_DISCONNECTED';
      throw err;
    }

    try {
      const [results] = await mysqlPool.execute(sql, params);
      if (Array.isArray(results)) {
        results.rows = results;
      }
      return results;
    } catch (queryErr) {
      // Detect disconnection during active queries and schedule healing
      if (
        queryErr.code === 'PROTOCOL_CONNECTION_LOST' ||
        queryErr.code === 'ECONNRESET' ||
        queryErr.code === 'ETIMEDOUT' ||
        queryErr.code === 'EPIPE'
      ) {
        console.warn(`⚠️ [DB] Connection dropped during query execution: ${queryErr.code}`);
        dbConnected = false;
        dbLastError = queryErr;
        scheduleReconnect();
      }
      throw queryErr;
    }
  }

  // In production, strictly enforce persistent external MySQL (never silent SQLite fallback)
  if (isProduction) {
    const err = new Error(
      'Database service is currently unavailable. Production requires an active persistent MySQL connection.'
    );
    err.status = 503;
    throw err;
  }

  // Development SQLite fallback query handling
  if (!sqliteDb) {
    await initSqliteAdapter();
  }

  const normalizedSql = sql
    .replace(/NOW\(\)/gi, "datetime('now')")
    .replace(/`([a-zA-Z0-9_]+)`/g, '"$1"');

  const trimmed = normalizedSql.trim().toUpperCase();

  if (
    trimmed.startsWith('SELECT') ||
    trimmed.startsWith('PRAGMA') ||
    trimmed.startsWith('SHOW')
  ) {
    const rows = await sqliteAll(normalizedSql, params);
    if (Array.isArray(rows)) {
      rows.rows = rows;
    }
    return rows;
  }

  return await sqliteRun(normalizedSql, params);
}

// ---------------------------------------------------------
// Transaction & Connection helpers
// ---------------------------------------------------------
async function getConnection() {
  const isProduction = config.isProduction || process.env.NODE_ENV === 'production';

  if (activeEngine === 'mysql') {
    if (!mysqlPool || !dbConnected) {
      const err = new Error(
        `Database service is currently unavailable. Persistent MySQL is not connected${
          dbLastError ? ` (${dbLastError.code || dbLastError.message})` : ''
        }.`
      );
      err.status = 503;
      throw err;
    }

    const conn = await mysqlPool.getConnection();

    return {
      query: async (sql, params = []) => {
        const [results] = await conn.execute(sql, params);
        if (Array.isArray(results)) {
          results.rows = results;
        }
        return results;
      },
      beginTransaction: () => conn.beginTransaction(),
      commit: () => conn.commit(),
      rollback: () => conn.rollback(),
      release: () => conn.release()
    };
  }

  if (isProduction) {
    const err = new Error(
      'Database service is currently unavailable. Production requires an active persistent MySQL connection.'
    );
    err.status = 503;
    throw err;
  }

  return {
    query: async (sql, params = []) => {
      const result = await query(sql, params);
      return result;
    },
    beginTransaction: async () => {
      await sqliteRun('BEGIN TRANSACTION');
    },
    commit: async () => {
      await sqliteRun('COMMIT');
    },
    rollback: async () => {
      await sqliteRun('ROLLBACK');
    },
    release: () => {}
  };
}

function getPool() {
  return {
    query: async (sql, params = []) => {
      const result = await query(sql, params);
      return result;
    },
    getConnection
  };
}

// ---------------------------------------------------------
// Database initialization
// ---------------------------------------------------------
async function initDatabase() {
  if (isInitializing) {
    return dbConnected;
  }

  isInitializing = true;
  const isProduction = config.isProduction || process.env.NODE_ENV === 'production';

  console.log(`[DB] Engine target: ${isProduction ? 'Production MySQL' : 'MySQL with dev fallback'}`);
  console.log(`[DB] Connecting to MySQL at ${config.db.host}:${config.db.port} (database: "${config.db.database}")...`);

  try {
    const poolConfig = {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: config.db.waitForConnections !== undefined ? config.db.waitForConnections : true,
      connectionLimit: config.db.connectionLimit || 10,
      queueLimit: config.db.queueLimit || 0,
      timezone: config.db.timezone || '+00:00',
      dateStrings: true,
      connectTimeout: 10000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    };

    if (config.db.ssl) {
      poolConfig.ssl = config.db.ssl;
    }

    // Close any previous pool before re-creating
    if (mysqlPool) {
      try {
        await mysqlPool.end();
      } catch (e) {
        // Ignore pool close error
      }
    }

    mysqlPool = mysql.createPool(poolConfig);

    try {
      const connTest = await mysqlPool.getConnection();
      connTest.release();
      dbConnected = true;
      dbLastError = null;
      activeEngine = 'mysql';
    } catch (poolErr) {
      // If code is ER_BAD_DB_ERROR, attempt database creation if permissions allow
      if (poolErr.code === 'ER_BAD_DB_ERROR' || poolErr.errno === 1049) {
        console.log(`[DB] Database "${config.db.database}" not found. Attempting creation...`);
        try {
          const rootConn = await mysql.createConnection({
            host: config.db.host,
            port: config.db.port,
            user: config.db.user,
            password: config.db.password,
            ssl: config.db.ssl,
            connectTimeout: 10000
          });

          await rootConn.query(
            `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\`
             CHARACTER SET utf8mb4
             COLLATE utf8mb4_unicode_ci;`
          );
          await rootConn.end();

          const connTest2 = await mysqlPool.getConnection();
          connTest2.release();
          dbConnected = true;
          dbLastError = null;
          activeEngine = 'mysql';
        } catch (createErr) {
          throw poolErr;
        }
      } else {
        throw poolErr;
      }
    }

    console.log(`✓ [DB] Connected successfully to MySQL (${config.db.host}:${config.db.port}/${config.db.database})`);

    // If a reconnect timer was active, clear it
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

  } catch (mysqlErr) {
    dbConnected = false;
    dbLastError = mysqlErr;

    logDetailedDatabaseError(mysqlErr, config.db.host, config.db.port);

    if (isProduction) {
      console.warn('⚠️ [DB] Server will keep running and retry connecting in background.');
      scheduleReconnect();
      isInitializing = false;
      return false;
    }

    // In local development, fall back to SQLite
    console.warn('⚠️ [DB] MySQL unavailable in development. Initializing local SQLite fallback...');
    try {
      await initSqliteAdapter();
      console.log(`✓ [DB] SQLite fallback database active at: ${sqliteFilePath}`);
    } catch (sqliteErr) {
      console.error('❌ [DB] SQLite initialization failed:', sqliteErr.message);
      isInitializing = false;
      return false;
    }
  }

  // =======================================================
  // 1. MYSQL SCHEMA INITIALIZATION
  // =======================================================
  if (activeEngine === 'mysql' && dbConnected) {
    try {
      // 1. Administrators
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS admins (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(150) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
      `);

      // 2. Students (Reference table)
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS students (
          id INT AUTO_INCREMENT PRIMARY KEY,
          register_number VARCHAR(50) NOT NULL UNIQUE,
          name VARCHAR(150) NOT NULL,
          email VARCHAR(150),
          department VARCHAR(100),
          year VARCHAR(10),
          section VARCHAR(10),
          status VARCHAR(50) DEFAULT 'Active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_students_reg (register_number)
        ) ENGINE=InnoDB;
      `);

      // 3. Hackathons
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS hackathons (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          institution VARCHAR(255) NOT NULL,
          description TEXT,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          registration_deadline DATE NOT NULL,
          mode ENUM('Online', 'Offline', 'Hybrid') NOT NULL DEFAULT 'Offline',
          location VARCHAR(255),
          min_team_size INT NOT NULL DEFAULT 1,
          max_team_size INT NOT NULL DEFAULT 5,
          allow_external_participants BOOLEAN NOT NULL DEFAULT FALSE,
          registration_url TEXT NOT NULL,
          poster_path VARCHAR(500),
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_hackathon_active (is_active),
          INDEX idx_hackathon_dates (start_date, end_date, registration_deadline)
        ) ENGINE=InnoDB;
      `);

      // 4. Submissions
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS submissions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          submission_id VARCHAR(50) NOT NULL UNIQUE,
          student_register_number VARCHAR(50) NOT NULL,
          student_name VARCHAR(150) NULL,
          student_email VARCHAR(150) NULL,
          hackathon_id INT NOT NULL,
          screenshot_path VARCHAR(500) NOT NULL,
          status ENUM('Pending', 'Verified', 'Rejected') NOT NULL DEFAULT 'Pending',
          rejection_reason TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_sub_student_reg (student_register_number),
          INDEX idx_sub_student_email (student_email),
          INDEX idx_sub_hackathon (hackathon_id),
          INDEX idx_sub_status (status),
          CONSTRAINT fk_submission_hackathon
            FOREIGN KEY (hackathon_id)
            REFERENCES hackathons(id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB;
      `);

      // 5. Teams
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS teams (
          id INT AUTO_INCREMENT PRIMARY KEY,
          submission_id INT NOT NULL,
          team_size INT NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_teams_submission
            FOREIGN KEY (submission_id)
            REFERENCES submissions(id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB;
      `);

      // 6. Team Members
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS team_members (
          id INT AUTO_INCREMENT PRIMARY KEY,
          team_id INT NOT NULL,
          register_number VARCHAR(50) NULL,
          name VARCHAR(150) NOT NULL,
          department VARCHAR(100),
          year VARCHAR(10),
          section VARCHAR(10),
          member_type ENUM('College', 'External') NOT NULL DEFAULT 'College',
          institution VARCHAR(255),
          email VARCHAR(150),
          is_captain BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_tm_reg_no (register_number),
          INDEX idx_tm_type (member_type),
          INDEX idx_tm_captain (is_captain),
          CONSTRAINT fk_tm_team
            FOREIGN KEY (team_id)
            REFERENCES teams(id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB;
      `);

      // 7. Settings
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          setting_key VARCHAR(100) NOT NULL UNIQUE,
          setting_value TEXT NULL,
          description VARCHAR(255) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
      `);

      // Safe non-destructive column migrations for existing databases
      try {
        await mysqlPool.query('ALTER TABLE submissions MODIFY COLUMN screenshot_path VARCHAR(500) NOT NULL');
      } catch (e) {}

      try {
        await mysqlPool.query('ALTER TABLE hackathons MODIFY COLUMN poster_path VARCHAR(500) NULL');
      } catch (e) {}

      try {
        await mysqlPool.query('ALTER TABLE submissions ADD COLUMN student_name VARCHAR(150) NULL');
      } catch (e) {}

      try {
        await mysqlPool.query('ALTER TABLE submissions ADD COLUMN student_email VARCHAR(150) NULL');
      } catch (e) {}

      try {
        await mysqlPool.query('ALTER TABLE submissions ADD COLUMN rejection_reason TEXT NULL');
      } catch (e) {}

    } catch (schemaErr) {
      console.error('❌ [DB] Error during MySQL schema verification:', schemaErr.message);
    }
  }

  // =======================================================
  // 2. SQLITE SCHEMA INITIALIZATION (Development Fallback Only)
  // =======================================================
  else if (activeEngine === 'sqlite' && dbConnected) {
    // 1. Admins
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Students
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        register_number TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        email TEXT,
        department TEXT,
        year TEXT,
        section TEXT,
        status TEXT DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Hackathons
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS hackathons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        institution TEXT NOT NULL,
        description TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        registration_deadline TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'Offline',
        location TEXT,
        min_team_size INTEGER NOT NULL DEFAULT 1,
        max_team_size INTEGER NOT NULL DEFAULT 5,
        allow_external_participants INTEGER NOT NULL DEFAULT 0,
        registration_url TEXT NOT NULL,
        poster_path TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Submissions
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id TEXT NOT NULL UNIQUE,
        student_register_number TEXT NOT NULL,
        student_name TEXT,
        student_email TEXT,
        hackathon_id INTEGER NOT NULL,
        screenshot_path TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending',
        rejection_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE
      );
    `);

    // 5. Teams
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL,
        team_size INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
      );
    `);

    // 6. Team Members
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS team_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL,
        register_number TEXT,
        name TEXT NOT NULL,
        department TEXT,
        year TEXT,
        section TEXT,
        member_type TEXT NOT NULL DEFAULT 'College',
        institution TEXT,
        email TEXT,
        is_captain INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
      );
    `);

    // 7. Settings
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT NOT NULL UNIQUE,
        setting_value TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // =======================================================
  // ADMIN SETUP
  // Auto-configured only when environment variables are provided
  // =======================================================
  if (dbConnected) {
    const adminName = (config.admin && config.admin.name) || process.env.ADMIN_NAME;
    const adminEmail = (config.admin && config.admin.email) || process.env.ADMIN_EMAIL;
    const adminPassword = (config.admin && config.admin.password) || process.env.ADMIN_PASSWORD;

    if (adminName && adminEmail && adminPassword) {
      try {
        const existingAdmins = await query(
          'SELECT id FROM admins WHERE email = ? LIMIT 1',
          [adminEmail]
        );

        const passwordHash = await bcrypt.hash(adminPassword, 12);

        if (existingAdmins.length === 0) {
          await query(
            `INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)`,
            [adminName, adminEmail, passwordHash]
          );
          console.log(`✓ [DB] Admin account created: ${adminEmail}`);
        } else {
          await query(
            `UPDATE admins SET name = ?, password_hash = ? WHERE email = ?`,
            [adminName, passwordHash, adminEmail]
          );
          console.log(`✓ [DB] Admin account updated: ${adminEmail}`);
        }
      } catch (adminErr) {
        console.error('⚠️ [DB] Warning: Could not auto-create admin account:', adminErr.message);
      }
    }
  }

  isInitializing = false;
  if (dbConnected) {
    console.log('[DB] Database ready');
  }
  return dbConnected;
}

// ---------------------------------------------------------
// Helper for Health Checks
// ---------------------------------------------------------
function getDbStatus() {
  const hostDisplay = config.db.host
    ? String(config.db.host).replace(/^(.*?)(\.[^.]+\.[^.]+)$/, '***$2')
    : 'not-configured';

  return {
    connected: dbConnected,
    engine: activeEngine,
    host: hostDisplay,
    port: config.db.port,
    database: config.db.database,
    error: dbLastError ? (dbLastError.code || dbLastError.message) : null,
    isProduction: config.isProduction
  };
}

module.exports = {
  getPool,
  query,
  getConnection,
  initDatabase,
  getActiveEngine: () => activeEngine,
  getDbStatus
};