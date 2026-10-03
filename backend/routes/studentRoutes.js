const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { verifyStudentToken, verifyAdminToken } = require('../middleware/authMiddleware');

// POST /api/students/verify (Public - Initial Student Verification)
router.post('/verify', studentController.verifyStudent);

// POST /api/students/lookup (Protected - Student or Admin validating additional team member)
router.post('/lookup', verifyStudentToken, studentController.lookupStudent);

// GET /api/students/all (Protected - Admin only for viewing approved student list)
router.get('/all', verifyAdminToken, studentController.getApprovedStudents);

module.exports = router;
