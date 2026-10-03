const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const { verifyStudentToken, verifyAdminToken } = require('../middleware/authMiddleware');
const { uploadScreenshot } = require('../middleware/uploadMiddleware');

// Student routes
router.post('/', verifyStudentToken, uploadScreenshot.single('screenshot'), submissionController.createSubmission);
router.get('/my', verifyStudentToken, submissionController.getMySubmissions);

// Single submission (either student participant or admin)
router.get('/:id', (req, res, next) => {
  // Check if admin or student header is provided
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  // Let controller handle access control check
  verifyStudentToken(req, res, (err) => {
    if (!err) return submissionController.getSubmissionById(req, res, next);
    verifyAdminToken(req, res, () => {
      submissionController.getSubmissionById(req, res, next);
    });
  });
});

// Admin routes
router.get('/admin/all', verifyAdminToken, submissionController.getAllSubmissionsAdmin);
router.put('/admin/:id/verify', verifyAdminToken, submissionController.verifySubmission);
router.put('/admin/:id/reject', verifyAdminToken, submissionController.rejectSubmission);
router.get('/admin/teams/all', verifyAdminToken, submissionController.getAllTeamsAdmin);

module.exports = router;
