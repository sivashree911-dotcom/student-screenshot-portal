const express = require('express');
const router = express.Router();
const hackathonController = require('../controllers/hackathonController');
const { verifyAdminToken, verifyStudentToken } = require('../middleware/authMiddleware');
const { uploadPoster } = require('../middleware/uploadMiddleware');

// Public / Student endpoints
router.get('/', hackathonController.getActiveHackathons);
router.get('/:id', hackathonController.getHackathonById);

// Admin endpoints
router.get('/admin/all', verifyAdminToken, hackathonController.getAllHackathonsAdmin);
router.post('/admin', verifyAdminToken, uploadPoster.single('poster'), hackathonController.createHackathon);
router.put('/admin/:id', verifyAdminToken, uploadPoster.single('poster'), hackathonController.updateHackathon);
router.patch('/admin/:id/toggle-status', verifyAdminToken, hackathonController.toggleHackathonStatus);
router.delete('/admin/:id', verifyAdminToken, hackathonController.deleteHackathon);

module.exports = router;
