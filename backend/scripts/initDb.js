/**
 * Database Initialization Script
 * Runs migrations, creates tables, and inserts initial seed data
 */

const { initDatabase } = require('../config/db');

async function run() {
  console.log('Initializing Student Screenshot Portal database...');
  const success = await initDatabase();
  if (success) {
    console.log('✓ Database setup completed successfully.');
    process.exit(0);
  } else {
    console.error('❌ Database setup encountered an error.');
    process.exit(1);
  }
}

run();
