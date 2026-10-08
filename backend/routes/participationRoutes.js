const express = require('express');
const router = express.Router();
const participationController = require('../controllers/participationController');
const { verifyAdminToken } = require('../middleware/authMiddleware');

// All participation reporting routes are admin protected
router.get('/reports/matrix', verifyAdminToken, participationController.getOverallParticipationMatrix);
router.get('/hackathon/:hackathonId/export-csv', verifyAdminToken, participationController.exportParticipationCsv);
router.get('/hackathon/:hackathonId', verifyAdminToken, participationController.getHackathonParticipation);

module.exports = router;
