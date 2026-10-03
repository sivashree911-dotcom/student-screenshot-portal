/**
 * Standalone CLI Script to create or update an Admin user
 * Usage:
 *   node backend/scripts/createAdmin.js [name] [email] [password]
 * Example:
 *   node backend/scripts/createAdmin.js "Portal Admin" "admin@college.edu" "AdminSecret@123"
 */

const bcrypt = require('bcryptjs');
const { initDatabase, query } = require('../config/db');

async function createAdmin() {
  const args = process.argv.slice(2);
  const name = args[0] || 'Portal Administrator';
  const email = args[1] || 'admin@college.edu';
  const password = args[2] || 'AdminPassword@123';

  console.log('--- Administrator Account Setup ---');
  console.log(`Setting up Admin: ${name} (${email})`);

  await initDatabase();

  const hash = await bcrypt.hash(password, 10);

  const existing = await query('SELECT id FROM admins WHERE email = ?', [email]);

  if (existing.length > 0) {
    await query('UPDATE admins SET name = ?, password_hash = ? WHERE email = ?', [name, hash, email]);
    console.log(`✓ Existing Admin account updated: ${email}`);
  } else {
    await query('INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)', [name, email, hash]);
    console.log(`✓ New Admin account created: ${email}`);
  }

  console.log('Login credentials:');
  console.log(`Email/Username: ${email}`);
  console.log(`Password: ${password}`);
  console.log('-----------------------------------');
  process.exit(0);
}

createAdmin().catch(err => {
  console.error('Error creating admin:', err);
  process.exit(1);
});
