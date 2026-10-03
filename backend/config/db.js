const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const config = require('./config');

let activeEngine = 'mysql'; // 'mysql' or 'sqlite'
let mysqlPool = null;
let sqliteDb = null;

// Ensure data folder exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const sqliteFilePath = path.join(dataDir, 'portal.sqlite');

/**
 * Initializes SQLite database adapter if MySQL is unreachable
 */
function initSqliteAdapter() {
  return new Promise((resolve, reject) => {
    sqliteDb = new sqlite3.Database(sqliteFilePath, (err) => {
      if (err) return reject(err);
      activeEngine = 'sqlite';
      resolve(sqliteDb);
    });
  });
}

function sqliteRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ insertId: this.lastID, affectedRows: this.changes });
    });
  });
}

function sqliteAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

/**
 * Unified SQL query execution
 */
async function query(sql, params = []) {
  if (activeEngine === 'mysql' && mysqlPool) {
    const [results] = await mysqlPool.execute(sql, params);
    return results;
  }

  // SQLite execution
  const normalizedSql = sql
    .replace(/NOW\(\)/gi, "datetime('now')")
    .replace(/`([a-zA-Z0-9_]+)`/g, '"$1"');

  const trimmed = normalizedSql.trim().toUpperCase();

  if (trimmed.startsWith('SELECT')) {
    return await sqliteAll(normalizedSql, params);
  } else {
    return await sqliteRun(normalizedSql, params);
  }
}

/**
 * Transaction connection helper
 */
async function getConnection() {
  if (activeEngine === 'mysql' && mysqlPool) {
    const conn = await mysqlPool.getConnection();
    return {
      query: async (sql, params = []) => {
        const [results] = await conn.execute(sql, params);
        return [results];
      },
      beginTransaction: () => conn.beginTransaction(),
      commit: () => conn.commit(),
      rollback: () => conn.rollback(),
      release: () => conn.release()
    };
  }

  // SQLite transaction simulation
  return {
    query: async (sql, params = []) => {
      const res = await query(sql, params);
      return [res];
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
      const res = await query(sql, params);
      return [res];
    },
    getConnection
  };
}

/**
 * Initialize database schema and seeds
 */
async function initDatabase() {
  try {
    // 1. Attempt MySQL connection
    console.log(`[DB] Attempting connection to MySQL server at ${config.db.host}:${config.db.port}...`);
    
    let adminConn = null;
    try {
      adminConn = await mysql.createConnection({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        connectTimeout: 3000
      });
      await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await adminConn.end();

      mysqlPool = mysql.createPool({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        waitForConnections: config.db.waitForConnections,
        connectionLimit: config.db.connectionLimit,
        queueLimit: config.db.queueLimit,
        timezone: config.db.timezone,
        dateStrings: true
      });

      activeEngine = 'mysql';
      console.log('✓ [DB] Connected to MySQL successfully.');
    } catch (mysqlErr) {
      console.warn('⚠️  [DB] MySQL connection unsuccessful:', mysqlErr.message);
      console.log('ℹ️  [DB] Initializing embedded persistent relational database engine (SQLite)...');
      await initSqliteAdapter();
      console.log(`✓ [DB] Embedded database initialized at: ${sqliteFilePath}`);
    }

    // 2. Create tables
    if (activeEngine === 'mysql') {
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`admins\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`name\` VARCHAR(100) NOT NULL,
          \`email\` VARCHAR(150) NOT NULL UNIQUE,
          \`password_hash\` VARCHAR(255) NOT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`hackathons\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`name\` VARCHAR(255) NOT NULL,
          \`institution\` VARCHAR(255) NOT NULL,
          \`description\` TEXT,
          \`start_date\` DATE NOT NULL,
          \`end_date\` DATE NOT NULL,
          \`registration_deadline\` DATE NOT NULL,
          \`mode\` ENUM('Online', 'Offline', 'Hybrid') NOT NULL DEFAULT 'Offline',
          \`location\` VARCHAR(255),
          \`min_team_size\` INT NOT NULL DEFAULT 1,
          \`max_team_size\` INT NOT NULL DEFAULT 5,
          \`allow_external_participants\` BOOLEAN NOT NULL DEFAULT FALSE,
          \`registration_url\` TEXT NOT NULL,
          \`poster_path\` VARCHAR(255),
          \`is_active\` BOOLEAN NOT NULL DEFAULT TRUE,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_hackathon_active\` (\`is_active\`)
        ) ENGINE=InnoDB;
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`submissions\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`submission_id\` VARCHAR(50) NOT NULL UNIQUE,
          \`student_register_number\` VARCHAR(50) NOT NULL,
          \`student_name\` VARCHAR(150) NULL,
          \`student_email\` VARCHAR(150) NULL,
          \`hackathon_id\` INT NOT NULL,
          \`screenshot_path\` VARCHAR(255) NOT NULL,
          \`status\` ENUM('Pending', 'Verified', 'Rejected') NOT NULL DEFAULT 'Pending',
          \`rejection_reason\` TEXT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_sub_student_reg\` (\`student_register_number\`),
          INDEX \`idx_sub_student_email\` (\`student_email\`),
          INDEX \`idx_sub_hackathon\` (\`hackathon_id\`),
          INDEX \`idx_sub_status\` (\`status\`),
          CONSTRAINT \`fk_submission_hackathon\` FOREIGN KEY (\`hackathon_id\`) REFERENCES \`hackathons\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB;
      `);

      // Safe column migration for existing MySQL instances
      try {
        await mysqlPool.query('ALTER TABLE `submissions` ADD COLUMN `student_name` VARCHAR(150) NULL');
      } catch (e) {}
      try {
        await mysqlPool.query('ALTER TABLE `submissions` ADD COLUMN `student_email` VARCHAR(150) NULL');
      } catch (e) {}

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`teams\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`submission_id\` INT NOT NULL,
          \`team_size\` INT NOT NULL DEFAULT 1,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT \`fk_teams_submission\` FOREIGN KEY (\`submission_id\`) REFERENCES \`submissions\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB;
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`team_members\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`team_id\` INT NOT NULL,
          \`register_number\` VARCHAR(50) NULL,
          \`name\` VARCHAR(150) NOT NULL,
          \`department\` VARCHAR(100) NULL,
          \`year\` VARCHAR(10) NULL,
          \`section\` VARCHAR(10) NULL,
          \`member_type\` ENUM('College', 'External') NOT NULL DEFAULT 'College',
          \`institution\` VARCHAR(255) NULL,
          \`email\` VARCHAR(150) NULL,
          \`is_captain\` BOOLEAN NOT NULL DEFAULT FALSE,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX \`idx_tm_reg_no\` (\`register_number\`),
          INDEX \`idx_tm_type\` (\`member_type\`),
          CONSTRAINT \`fk_tm_team\` FOREIGN KEY (\`team_id\`) REFERENCES \`teams\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB;
      `);
    } else {
      // SQLite Schema
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

      // Safe column migration for SQLite
      try {
        await sqliteRun('ALTER TABLE submissions ADD COLUMN student_name TEXT');
      } catch (e) {}
      try {
        await sqliteRun('ALTER TABLE submissions ADD COLUMN student_email TEXT');
      } catch (e) {}

      await sqliteRun(`
        CREATE TABLE IF NOT EXISTS teams (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          submission_id INTEGER NOT NULL,
          team_size INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
        );
      `);

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
    }

    // 3. Seed Default Admin if missing
    const admins = await query('SELECT id FROM admins LIMIT 1');
    if (!admins || admins.length === 0) {
      const defaultPass = 'AdminPassword@123';
      const hash = await bcrypt.hash(defaultPass, 10);
      await query(
        'INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)',
        ['Portal Administrator', 'admin@college.edu', hash]
      );
      console.log('✓ Default Admin account initialized: admin@college.edu / AdminPassword@123');
    }

    // 4. Seed Initial Hackathons if missing
    const hacks = await query('SELECT id FROM hackathons LIMIT 1');
    if (!hacks || hacks.length === 0) {
      const sampleHackathons = [
        [
          'Hack Odyssey 4.0',
          'Kalasalingam Academy of Research and Education',
          'A flagship 24-hour national hackathon bringing together creative engineering minds to solve real-world problems in AI, Web3, Smart Healthcare, and Clean Energy.',
          '2026-10-25',
          '2026-10-26',
          '2026-10-20',
          'Offline',
          'Main Campus Auditorium, Block 4',
          3,
          5,
          1,
          'https://unstop.com/hackathons/hack-odyssey-4-0',
          'poster_sample_1.webp',
          1
        ],
        [
          'Smart India Innovation Sprint 2026',
          'Ministry of Education & Innovation Cell',
          'Solve challenging problem statements submitted by premier government departments, smart cities, and industry leaders.',
          '2026-11-10',
          '2026-11-12',
          '2026-11-01',
          'Hybrid',
          'Center for Excellence & Virtual Stage',
          4,
          6,
          0,
          'https://sih.gov.in',
          'poster_sample_2.webp',
          1
        ],
        [
          'DevHacks Global AI Challenge',
          'Google Cloud Student Developer Clubs',
          'Build and deploy cutting-edge multimodal AI agents, modern web applications, and cloud automations.',
          '2026-11-18',
          '2026-11-19',
          '2026-11-14',
          'Online',
          'Discord & Virtual DevPlatform',
          2,
          4,
          1,
          'https://devpost.com/hackathons/devhacks-ai',
          'poster_sample_3.webp',
          1
        ],
        [
          'GreenTech Cyberathon 2026',
          'Indian Institute of Information Technology',
          'Focusing on smart agriculture, environmental IoT monitoring, sustainable urban transit, and green computing architectures.',
          '2026-12-05',
          '2026-12-06',
          '2026-11-28',
          'Offline',
          'IIIT Incubation & Research Park',
          3,
          4,
          1,
          'https://unstop.com/hackathons/greentech-2026',
          'poster_sample_4.webp',
          1
        ]
      ];

      for (const h of sampleHackathons) {
        await query(
          `INSERT INTO hackathons (name, institution, description, start_date, end_date, registration_deadline, mode, location, min_team_size, max_team_size, allow_external_participants, registration_url, poster_path, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          h
        );
      }
      console.log('✓ Initial Hackathons seeded.');
    }

    console.log(`✓ Database ready. Active Engine: ${activeEngine.toUpperCase()}`);
    return true;
  } catch (error) {
    console.error('❌ Database Initialization Error:', error);
    return false;
  }
}

module.exports = {
  getPool,
  query,
  getConnection,
  initDatabase,
  getActiveEngine: () => activeEngine
};
