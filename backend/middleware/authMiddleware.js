const jwt = require('jsonwebtoken');
const config = require('../config/config');

/**
 * Middleware to authenticate administrators via JWT token in Authorization header.
 */
function verifyAdminToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Administrator authentication token required.'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (!decoded || decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Administrator privileges required.'
      });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired administrator token. Please log in again.'
    });
  }
}

/**
 * Middleware to authenticate verified students via JWT token.
 */
function verifyStudentToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Student session token required. Please verify your register number.'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (!decoded || decoded.role !== 'student' || !decoded.registerNumber) {
      return res.status(403).json({
        success: false,
        message: 'Invalid student session token.'
      });
    }
    req.student = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Student session has expired. Please verify your register number again.'
    });
  }
}

module.exports = {
  verifyAdminToken,
  verifyStudentToken
};
