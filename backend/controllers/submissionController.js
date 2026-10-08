const { query, getConnection } = require('../config/db');
const { fetchStudentFromProvider } = require('./studentController');
const path = require('path');
const crypto = require('crypto');

/**
 * Helper to safely extract array of rows from DB query result
 */
function getRows(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.rows)) return result.rows;
  return [];
}

/**
 * Generate a unique submission ID
 */
function generateSubmissionId() {
  return `SUB-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/**
 * Get register number from authenticated student or request
 */
function getRegisterNumber(req) {
  return (
    req.user?.registerNumber ||
    req.user?.register_number ||
    req.student?.registerNumber ||
    req.student?.register_number ||
    req.body?.registerNumber ||
    ''
  )
    .toString()
    .trim()
    .toUpperCase();
}

/**
 * Create a new screenshot submission
 */
async function createSubmission(req, res, next) {
  let connection;

  try {
    const registerNumber = getRegisterNumber(req);

    if (!registerNumber) {
      return res.status(400).json({
        success: false,
        message: 'Student register number is required'
      });
    }

    const {
      hackathonId,
      teamSize,
      teamMembers
    } = req.body;

    if (!hackathonId) {
      return res.status(400).json({
        success: false,
        message: 'Hackathon ID is required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Registration proof screenshot is required'
      });
    }

    // 1. Verify student from database or Google Apps Script provider
    let studentResult = await query(
      `
      SELECT *
      FROM students
      WHERE UPPER(register_number) = ?
      LIMIT 1
      `,
      [registerNumber]
    );

    let studentRows = getRows(studentResult);
    let student = studentRows[0];

    if (!student) {
      const studentLookup = await fetchStudentFromProvider(registerNumber);
      if (studentLookup && studentLookup.found && studentLookup.student) {
        student = studentLookup.student;
        try {
          await query(
            `INSERT INTO students (register_number, name, email, department, year, section, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              student.registerNumber || registerNumber,
              student.name || '',
              student.email || '',
              student.department || 'CSE',
              student.year || '2',
              student.section || 'A',
              student.status || 'Active'
            ]
          );
        } catch (insertErr) {
          // Ignore cache insertion error
        }
      } else {
        return res.status(404).json({
          success: false,
          message: 'Student not found in approved list'
        });
      }
    }

    // 2. Check hackathon
    const hackathonResult = await query(
      `
      SELECT *
      FROM hackathons
      WHERE id = ?
      LIMIT 1
      `,
      [hackathonId]
    );

    const hackathonRows = getRows(hackathonResult);
    if (hackathonRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hackathon not found'
      });
    }

    const hackathon = hackathonRows[0];

    if (
      hackathon.is_active !== undefined &&
      !Number(hackathon.is_active)
    ) {
      return res.status(400).json({
        success: false,
        message: 'This hackathon is not active'
      });
    }

    // 3. Prevent duplicate submission
    const existingResult = await query(
      `
      SELECT *
      FROM submissions
      WHERE UPPER(student_register_number) = ?
      AND hackathon_id = ?
      LIMIT 1
      `,
      [registerNumber, hackathonId]
    );

    const existingRows = getRows(existingResult);
    if (existingRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted proof for this hackathon'
      });
    }

    // 4. Parse team members
    let parsedTeamMembers = [];

    if (teamMembers) {
      try {
        parsedTeamMembers =
          typeof teamMembers === 'string'
            ? JSON.parse(teamMembers)
            : teamMembers;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid team members data'
        });
      }
    }

    if (!Array.isArray(parsedTeamMembers)) {
      parsedTeamMembers = [];
    }

    const parsedTeamSize = Number(teamSize) || (parsedTeamMembers.length + 1) || 1;

    if (parsedTeamSize < 1) {
      return res.status(400).json({
        success: false,
        message: 'Team size must be at least 1'
      });
    }

    if (
      hackathon.min_team_size &&
      parsedTeamSize < Number(hackathon.min_team_size)
    ) {
      return res.status(400).json({
        success: false,
        message: `Minimum team size is ${hackathon.min_team_size}`
      });
    }

    if (
      hackathon.max_team_size &&
      parsedTeamSize > Number(hackathon.max_team_size)
    ) {
      return res.status(400).json({
        success: false,
        message: `Maximum team size is ${hackathon.max_team_size}`
      });
    }

    // 5. Start transaction
    connection = await getConnection();
    await connection.beginTransaction();

    const submissionId = generateSubmissionId();

    const screenshotPath = req.file.path
      ? (req.file.path.startsWith('http') ? req.file.path : path.relative(process.cwd(), req.file.path))
      : req.file.filename;

    // Insert submission
    const subResult = await connection.query(
      `
      INSERT INTO submissions (
        submission_id,
        student_register_number,
        student_name,
        student_email,
        hackathon_id,
        screenshot_path,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        submissionId,
        registerNumber,
        student.name || '',
        student.email || '',
        hackathonId,
        screenshotPath,
        'Pending'
      ]
    );

    const subDbId = subResult.insertId || subResult[0]?.insertId;

    // Insert team
    const teamResult = await connection.query(
      `
      INSERT INTO teams (
        submission_id,
        team_size
      )
      VALUES (?, ?)
      `,
      [
        subDbId || submissionId,
        parsedTeamSize
      ]
    );

    const teamId =
      teamResult.insertId ||
      teamResult[0]?.insertId;

    // Add captain/student
    await connection.query(
      `
      INSERT INTO team_members (
        team_id,
        register_number,
        name,
        department,
        year,
        section,
        member_type,
        institution,
        email,
        is_captain
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        teamId,
        student.registerNumber || student.register_number || registerNumber,
        student.name || '',
        student.department || '',
        student.year || '',
        student.section || '',
        'College',
        'College',
        student.email || '',
        1
      ]
    );

    // Add additional team members
    for (const member of parsedTeamMembers) {
      if (!member) continue;

      const memberRegisterNumber = (
        member.registerNumber ||
        member.register_number ||
        ''
      )
        .toString()
        .trim()
        .toUpperCase();

      // Don't add captain twice
      if (
        memberRegisterNumber &&
        memberRegisterNumber === registerNumber
      ) {
        continue;
      }

      const memberType =
        member.memberType ||
        member.member_type ||
        'College';

      await connection.query(
        `
        INSERT INTO team_members (
          team_id,
          register_number,
          name,
          department,
          year,
          section,
          member_type,
          institution,
          email,
          is_captain
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          teamId,
          memberRegisterNumber,
          member.name || '',
          member.department || '',
          member.year || '',
          member.section || '',
          memberType,
          member.institution || 'College',
          member.email || '',
          0
        ]
      );
    }

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Screenshot proof submitted successfully',
      submission: {
        id: subDbId,
        submissionId,
        hackathonId,
        registerNumber,
        status: 'Pending'
      }
    });

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }

    console.error('Create submission error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create submission',
      error: process.env.NODE_ENV === 'development'
        ? error.message
        : undefined
    });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (error) {
        // Ignore release errors
      }
    }
  }
}

/**
 * Get submissions of logged-in student
 */
async function getMySubmissions(req, res, next) {
  try {
    const registerNumber = getRegisterNumber(req);

    if (!registerNumber) {
      return res.status(400).json({
        success: false,
        message: 'Student register number is required'
      });
    }

    const result = await query(
      `
      SELECT
        s.*,
        h.name AS hackathon_name,
        h.institution,
        h.start_date,
        h.end_date
      FROM submissions s
      LEFT JOIN hackathons h
        ON h.id = s.hackathon_id
      WHERE UPPER(s.student_register_number) = ?
      ORDER BY s.created_at DESC
      `,
      [registerNumber]
    );

    const submissions = getRows(result);

    return res.json({
      success: true,
      submissions
    });

  } catch (error) {
    console.error('Get my submissions error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions'
    });
  }
}

/**
 * Alias for getMySubmissions
 */
async function getStudentSubmissions(req, res, next) {
  return getMySubmissions(req, res, next);
}

/**
 * Get a single submission by numeric ID or SUB-... UUID
 */
async function getSubmissionById(req, res, next) {
  try {
    const { id } = req.params;

    const result = await query(
      `
      SELECT
        s.*,
        h.name AS hackathon_name,
        h.institution,
        h.description,
        h.start_date,
        h.end_date,
        h.registration_url
      FROM submissions s
      LEFT JOIN hackathons h
        ON h.id = s.hackathon_id
      WHERE s.id = ?
         OR s.submission_id = ?
      LIMIT 1
      `,
      [id, id]
    );

    const rows = getRows(result);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    return res.json({
      success: true,
      submission: rows[0]
    });

  } catch (error) {
    console.error('Get submission error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch submission'
    });
  }
}

/**
 * Get all submissions for admin with optional filtering
 */
async function getAllSubmissionsAdmin(req, res, next) {
  try {
    const { hackathonId, status, search } = req.query || {};

    let sql = `
      SELECT
        s.*,
        h.name AS hackathon_name,
        h.institution,
        h.start_date,
        h.end_date
      FROM submissions s
      LEFT JOIN hackathons h
        ON h.id = s.hackathon_id
      WHERE 1=1
    `;
    const params = [];

    if (hackathonId && hackathonId !== 'All') {
      sql += ` AND s.hackathon_id = ?`;
      params.push(hackathonId);
    }

    if (status && status !== 'All') {
      sql += ` AND s.status = ?`;
      params.push(status);
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ` AND (s.submission_id LIKE ? OR s.student_register_number LIKE ? OR s.student_name LIKE ?)`;
      params.push(q, q, q);
    }

    sql += ` ORDER BY s.created_at DESC`;

    const result = await query(sql, params);
    const submissions = getRows(result);

    return res.json({
      success: true,
      submissions
    });

  } catch (error) {
    console.error('Get all submissions error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions'
    });
  }
}

/**
 * Alias for getAllSubmissionsAdmin
 */
async function getAllSubmissions(req, res, next) {
  return getAllSubmissionsAdmin(req, res, next);
}

/**
 * Verify a submission (SQL uses single quotes 'Verified')
 */
async function verifySubmission(req, res, next) {
  try {
    const { id } = req.params;

    await query(
      `
      UPDATE submissions
      SET status = 'Verified',
          rejection_reason = NULL,
          updated_at = NOW()
      WHERE id = ?
         OR submission_id = ?
      `,
      [id, id]
    );

    return res.json({
      success: true,
      message: 'Submission verified successfully',
      status: 'Verified'
    });

  } catch (error) {
    console.error('Verify submission error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to verify submission'
    });
  }
}

/**
 * Reject a submission (SQL uses single quotes 'Rejected')
 */
async function rejectSubmission(req, res, next) {
  try {
    const { id } = req.params;

    const rejectionReason =
      req.body?.rejectionReason ||
      req.body?.rejection_reason ||
      'Registration proof was rejected';

    await query(
      `
      UPDATE submissions
      SET status = 'Rejected',
          rejection_reason = ?,
          updated_at = NOW()
      WHERE id = ?
         OR submission_id = ?
      `,
      [
        rejectionReason,
        id,
        id
      ]
    );

    return res.json({
      success: true,
      message: 'Submission rejected successfully',
      status: 'Rejected'
    });

  } catch (error) {
    console.error('Reject submission error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to reject submission'
    });
  }
}

/**
 * Get team members for one submission
 */
async function getSubmissionTeam(req, res, next) {
  try {
    const { id } = req.params;

    const submissionResult = await query(
      `
      SELECT id, submission_id
      FROM submissions
      WHERE id = ?
         OR submission_id = ?
      LIMIT 1
      `,
      [id, id]
    );

    const submissionRows = getRows(submissionResult);
    if (submissionRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    const submission = submissionRows[0];

    const teamResult = await query(
      `
      SELECT
        tm.*,
        t.team_size
      FROM team_members tm
      INNER JOIN teams t
        ON t.id = tm.team_id
      WHERE t.submission_id = ?
         OR t.submission_id = ?
      ORDER BY tm.is_captain DESC, tm.id ASC
      `,
      [submission.id, submission.submission_id]
    );

    const members = getRows(teamResult);

    return res.json({
      success: true,
      members
    });

  } catch (error) {
    console.error('Get submission team error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch team members'
    });
  }
}

/**
 * Get all teams for admin
 */
async function getAllTeamsAdmin(req, res, next) {
  try {
    const { hackathonId, status, search } = req.query || {};

    let sql = `
      SELECT
        t.id AS team_id,
        t.team_size,
        s.id AS submission_id,
        s.submission_id AS submission_code,
        s.student_register_number AS captain_register_number,
        s.student_name AS captain_name,
        s.status,
        h.id AS hackathon_id,
        h.name AS hackathon_name,
        tm.register_number,
        tm.name AS member_name,
        tm.department,
        tm.year,
        tm.section,
        tm.member_type,
        tm.institution,
        tm.email,
        tm.is_captain
      FROM teams t
      INNER JOIN submissions s
        ON (s.id = t.submission_id OR s.submission_id = t.submission_id)
      INNER JOIN hackathons h
        ON h.id = s.hackathon_id
      LEFT JOIN team_members tm
        ON tm.team_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (hackathonId && hackathonId !== 'All') {
      sql += ` AND s.hackathon_id = ?`;
      params.push(hackathonId);
    }

    if (status && status !== 'All') {
      sql += ` AND s.status = ?`;
      params.push(status);
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ` AND (s.submission_id LIKE ? OR s.student_register_number LIKE ? OR tm.register_number LIKE ? OR tm.name LIKE ?)`;
      params.push(q, q, q, q);
    }

    sql += `
      ORDER BY
        h.name ASC,
        t.id ASC,
        tm.is_captain DESC
    `;

    const result = await query(sql, params);
    const teams = getRows(result);

    return res.json({
      success: true,
      teams
    });

  } catch (error) {
    console.error('Get all teams error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch teams'
    });
  }
}

/**
 * Alias for getAllTeamsAdmin
 */
async function getAllTeams(req, res, next) {
  return getAllTeamsAdmin(req, res, next);
}

/**
 * Get overall submission statistics
 */
async function getSubmissionStats(req, res, next) {
  try {
    const statsResult = await query(`
      SELECT
        COUNT(id) AS total,
        COUNT(CASE WHEN status = 'Pending' THEN 1 END) AS pending,
        COUNT(CASE WHEN status = 'Verified' THEN 1 END) AS verified,
        COUNT(CASE WHEN status = 'Rejected' THEN 1 END) AS rejected
      FROM submissions
    `);

    const statsRows = getRows(statsResult);
    const stats = statsRows[0] || {
      total: 0,
      pending: 0,
      verified: 0,
      rejected: 0
    };

    return res.json({
      success: true,
      stats: {
        total: Number(stats.total) || 0,
        pending: Number(stats.pending) || 0,
        verified: Number(stats.verified) || 0,
        rejected: Number(stats.rejected) || 0
      }
    });

  } catch (error) {
    console.error('Get submission stats error:', error);
    if (next) return next(error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch submission statistics'
    });
  }
}

module.exports = {
  createSubmission,

  getMySubmissions,
  getStudentSubmissions,

  getSubmissionById,

  getAllSubmissionsAdmin,
  getAllSubmissions,

  verifySubmission,
  rejectSubmission,

  getSubmissionTeam,
  getAllTeamsAdmin,
  getAllTeams,

  getSubmissionStats
};