const express = require('express');
const router = express.Router();

const submissionController = require('../controllers/submissionController');

const {
  verifyStudentToken,
  verifyAdminToken
} = require('../middleware/authMiddleware');

const {
  uploadScreenshot
} = require('../middleware/uploadMiddleware');

// =====================================================
// 1. STUDENT ROUTES
// =====================================================

// POST /api/submissions (Student submits screenshot proof)
router.post(
  '/',
  verifyStudentToken,
  uploadScreenshot.single('screenshot'),
  submissionController.createSubmission
);

// GET /api/submissions/my (Student views own submissions)
router.get(
  '/my',
  verifyStudentToken,
  submissionController.getMySubmissions
);

// =====================================================
// 2. ADMIN ROUTES (MUST be declared before /:id wildcard)
// =====================================================

// GET /api/submissions/stats (Admin dashboard submission statistics)
router.get(
  '/stats',
  verifyAdminToken,
  submissionController.getSubmissionStats
);

// GET /api/submissions/admin/all (Admin views all submissions)
router.get(
  '/admin/all',
  verifyAdminToken,
  submissionController.getAllSubmissionsAdmin
);

// GET /api/submissions/admin/teams/all (Admin views all teams)
router.get(
  '/admin/teams/all',
  verifyAdminToken,
  submissionController.getAllTeamsAdmin
);

// GET /api/submissions/admin/teams/:id (Admin views team members for one submission)
router.get(
  '/admin/teams/:id',
  verifyAdminToken,
  submissionController.getSubmissionTeam
);

// PUT /api/submissions/admin/:id/verify (Admin marks submission as Verified)
router.put(
  '/admin/:id/verify',
  verifyAdminToken,
  submissionController.verifySubmission
);

// PUT /api/submissions/admin/:id/reject (Admin marks submission as Rejected)
router.put(
  '/admin/:id/reject',
  verifyAdminToken,
  submissionController.rejectSubmission
);

// =====================================================
// 3. SINGLE SUBMISSION BY ID (Wildcard Route - Placed Last)
// =====================================================

router.get(
  '/:id',
  (req, res, next) => {
    const auth = req.headers.authorization;

    if (!auth) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to view submission details.'
      });
    }

    // Try student auth first, then fallback to admin auth
    verifyStudentToken(req, res, (studentError) => {
      if (!studentError) {
        return submissionController.getSubmissionById(req, res, next);
      }

      verifyAdminToken(req, res, (adminError) => {
        if (!adminError) {
          return submissionController.getSubmissionById(req, res, next);
        }

        return res.status(401).json({
          success: false,
          message: 'Invalid authentication credentials.'
        });
      });
    });
  }
);

module.exports = router;