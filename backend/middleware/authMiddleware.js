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
      isAuthError: true,
      errorCategory: 'AUTH_REQUIRED',
      message: 'Access denied. Administrator authentication token required.'
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
    return res.status(401).json({
      success: false,
      isAuthError: true,
      errorCategory: 'AUTH_REQUIRED',
      message: 'Access denied. Administrator authentication token required.'
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (!decoded || decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        isAuthError: true,
        errorCategory: 'FORBIDDEN',
        message: 'Forbidden. Administrator privileges required.'
      });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    const isExpired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      isAuthError: true,
      isExpired,
      errorCategory: isExpired ? 'SESSION_EXPIRED' : 'INVALID_TOKEN',
      message: isExpired
        ? 'Administrator session has expired. Please log in again.'
        : 'Invalid or expired administrator token. Please log in again.'
    });
  }
}

/**
 * Middleware to authenticate verified students (Captain) via JWT token.
 * Also accommodates administrators validating students.
 */
function verifyStudentToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      isAuthError: true,
      errorCategory: 'AUTH_REQUIRED',
      message: 'Access denied. Student session token required. Please verify your register number.'
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
    return res.status(401).json({
      success: false,
      isAuthError: true,
      errorCategory: 'AUTH_REQUIRED',
      message: 'Access denied. Student session token required. Please verify your register number.'
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded.role === 'admin') {
      req.admin = decoded;
      req.student = { role: 'admin', registerNumber: 'ADMIN' };
      return next();
    }

    if (decoded.role === 'student' && decoded.registerNumber) {
      req.student = decoded;
      return next();
    }

    return res.status(403).json({
      success: false,
      isAuthError: true,
      errorCategory: 'FORBIDDEN',
      message: 'Forbidden. Valid student session token required.'
    });
  } catch (err) {
    const isExpired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      isAuthError: true,
      isExpired,
      errorCategory: isExpired ? 'SESSION_EXPIRED' : 'INVALID_TOKEN',
      message: isExpired
        ? 'Student session has expired. Please verify your register number again.'
        : 'Invalid or expired student session. Please verify your register number again.'
    });
  }
}

module.exports = {
  verifyAdminToken,
  verifyStudentToken
};
