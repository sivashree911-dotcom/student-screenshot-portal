const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const config = require('./config');

let activeEngine = 'mysql';
let mysqlPool = null;
let sqliteDb = null;

// ---------------------------------------------------------
// SQLite local data directory (Development Fallback Only)
// ---------------------------------------------------------
const dataDir = path.join(__dirname, '..', 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqliteFilePath = path.join(dataDir, 'portal.sqlite');

// ---------------------------------------------------------
// SQLite adapter
// ---------------------------------------------------------
function initSqliteAdapter() {
  return new Promise((resolve, reject) => {
    sqliteDb = new sqlite3.Database(sqliteFilePath, (err) => {
      if (err) {
        return reject(err);
      }

      activeEngine = 'sqlite';
      resolve(sqliteDb);
    });
  });
}

// ---------------------------------------------------------
// SQLite helpers
// ---------------------------------------------------------
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
// Unified SQL query
// ---------------------------------------------------------
async function query(sql, params = []) {
  if (activeEngine === 'mysql' && mysqlPool) {
    const [results] = await mysqlPool.execute(sql, params);
    if (Array.isArray(results)) {
      results.rows = results;
    }
    return results;
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
  if (activeEngine === 'mysql' && mysqlPool) {
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
    release: () => { }
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
  const isProduction = config.isProduction || process.env.NODE_ENV === 'production';

  if (isProduction) {
    console.log('[DB] Production database: MYSQL');
  }

  console.log(
    `[DB] Attempting MySQL connection at ${config.db.host}:${config.db.port}...`
  );

  let connectedToMysql = false;

  // -------------------------------------------------------
  // Try connecting to MySQL
  // -------------------------------------------------------
  try {
    const poolConfig = {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: config.db.waitForConnections !== undefined ? config.db.waitForConnections : true,
      connectionLimit: config.db.connectionLimit || 15,
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

    // Attempt direct pool connection with database name
    mysqlPool = mysql.createPool(poolConfig);

    try {
      const connTest = await mysqlPool.getConnection();
      connTest.release();
      connectedToMysql = true;
      activeEngine = 'mysql';
    } catch (poolErr) {
      // If error is code ER_BAD_DB_ERROR (database does not exist yet), try creating it (useful in local dev)
      if (poolErr.code === 'ER_BAD_DB_ERROR' || poolErr.errno === 1049) {
        console.log(`[DB] Database "${config.db.database}" not found. Attempting creation...`);
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

        // Retry connection
        const connTest = await mysqlPool.getConnection();
        connTest.release();
        connectedToMysql = true;
        activeEngine = 'mysql';
      } else {
        throw poolErr;
      }
    }

    console.log('[DB] Connected successfully');
  } catch (mysqlErr) {
    if (isProduction) {
      console.error(
        `❌ [DB] FATAL DATABASE ERROR: Could not connect to production MySQL at ${config.db.host}:${config.db.port}`
      );
      console.error(`❌ [DB] Error Details: ${mysqlErr.message}`);
      console.error('❌ [DB] Production requires external persistent MySQL (Aiven MySQL). Halting startup.');
      process.exit(1);
    }

    console.warn('⚠️ [DB] MySQL connection unsuccessful:', mysqlErr.message);
    console.log('ℹ️ [DB] Using SQLite fallback database.');

    await initSqliteAdapter();

    console.log(`✓ [DB] SQLite database initialized at: ${sqliteFilePath}`);
  }

  // =======================================================
  // 1. MYSQL SCHEMA INITIALIZATION
  // =======================================================
  if (activeEngine === 'mysql') {
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

    // Safe migrations for existing MySQL tables
    try {
      await mysqlPool.query('ALTER TABLE submissions MODIFY COLUMN screenshot_path VARCHAR(500) NOT NULL');
    } catch (e) { }

    try {
      await mysqlPool.query('ALTER TABLE hackathons MODIFY COLUMN poster_path VARCHAR(500) NULL');
    } catch (e) { }

    try {
      await mysqlPool.query('ALTER TABLE submissions ADD COLUMN student_name VARCHAR(150) NULL');
    } catch (e) { }

    try {
      await mysqlPool.query('ALTER TABLE submissions ADD COLUMN student_email VARCHAR(150) NULL');
    } catch (e) { }

    try {
      await mysqlPool.query('ALTER TABLE submissions ADD COLUMN rejection_reason TEXT NULL');
    } catch (e) { }
  }

  // =======================================================
  // 2. SQLITE SCHEMA INITIALIZATION (Development Fallback)
  // =======================================================
  else {
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
  // Admin is created/updated ONLY when environment variables are provided.
  // =======================================================
  const adminName = process.env.ADMIN_NAME;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminName && adminEmail && adminPassword) {
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
  }

  console.log('[DB] Database ready');
  return true;
}

module.exports = {
  getPool,
  query,
  getConnection,
  initDatabase,
  getActiveEngine: () => activeEngine
};