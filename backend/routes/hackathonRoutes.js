const express = require('express');
const router = express.Router();
const hackathonController = require('../controllers/hackathonController');
const { verifyAdminToken } = require('../middleware/authMiddleware');
const { uploadPoster } = require('../middleware/uploadMiddleware');

// =====================================================
// 1. PUBLIC / STUDENT ENDPOINTS
// =====================================================

// GET /api/hackathons (Active hackathons listing)
router.get('/', hackathonController.getActiveHackathons);

// =====================================================
// 2. ADMIN ENDPOINTS (MUST be defined before /:id wildcard)
// =====================================================

// GET /api/hackathons/admin/all (List all hackathons with stats)
router.get('/admin/all', verifyAdminToken, hackathonController.getAllHackathonsAdmin);

// POST /api/hackathons/admin (Create new hackathon)
router.post('/admin', verifyAdminToken, uploadPoster.single('poster'), hackathonController.createHackathon);

// PUT /api/hackathons/admin/:id (Update hackathon)
router.put('/admin/:id', verifyAdminToken, uploadPoster.single('poster'), hackathonController.updateHackathon);

// PATCH /api/hackathons/admin/:id/toggle-status (Toggle active status)
router.patch('/admin/:id/toggle-status', verifyAdminToken, hackathonController.toggleHackathonStatus);

// DELETE /api/hackathons/admin/:id (Delete hackathon)
router.delete('/admin/:id', verifyAdminToken, hackathonController.deleteHackathon);

// =====================================================
// 3. SINGLE HACKATHON BY ID (Wildcard - Placed Last)
// =====================================================

// GET /api/hackathons/:id (Get single hackathon details)
router.get('/:id', hackathonController.getHackathonById);

module.exports = router;
