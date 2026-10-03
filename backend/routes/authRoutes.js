const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyAdminToken } = require('../middleware/authMiddleware');

// POST /api/admin/auth/login or /api/auth/admin/login
router.post('/login', authController.adminLogin);

// Protected routes
router.get('/me', verifyAdminToken, authController.getAdminProfile);
router.post('/change-password', verifyAdminToken, authController.changeAdminPassword);

module.exports = router;
