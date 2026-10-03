const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const config = require('../config/config');

/**
 * Admin Login endpoint
 * Accepts: email/username and password
 * Validates credentials and returns JWT token + admin info
 */
async function adminLogin(req, res, next) {
  try {
    const { email, username, password } = req.body;
    const identifier = (email || username || '').trim();

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email/username and password.'
      });
    }

    const admins = await query(
      'SELECT id, name, email, password_hash FROM admins WHERE email = ? LIMIT 1',
      [identifier]
    );

    if (admins.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid administrator credentials.'
      });
    }

    const admin = admins[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid administrator credentials.'
      });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: 'admin'
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      success: true,
      message: 'Administrator authenticated successfully.',
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current admin profile
 */
async function getAdminProfile(req, res, next) {
  try {
    const admins = await query(
      'SELECT id, name, email, created_at FROM admins WHERE id = ?',
      [req.admin.id]
    );

    if (admins.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Administrator account not found.'
      });
    }

    res.json({
      success: true,
      admin: admins[0]
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Change Admin Password
 */
async function changeAdminPassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both current and new password.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.'
      });
    }

    const admins = await query(
      'SELECT id, password_hash FROM admins WHERE id = ?',
      [req.admin.id]
    );

    if (admins.length === 0) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, admins[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password does not match.'
      });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE admins SET password_hash = ? WHERE id = ?', [newHash, req.admin.id]);

    res.json({
      success: true,
      message: 'Password updated successfully.'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  adminLogin,
  getAdminProfile,
  changeAdminPassword
};
