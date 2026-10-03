const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyAdminToken } = require('../middleware/authMiddleware');

router.get('/dashboard', verifyAdminToken, adminController.getDashboardOverview);
router.get('/health', verifyAdminToken, adminController.getSystemHealth);

module.exports = router;
