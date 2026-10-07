const fs = require('fs');
const { getPool, query } = require('../config/db');
const {
  fetchStudentFromProvider,
  normalizeRegisterNumber
} = require('./studentController');
const { cloudinary } = require('../middleware/uploadMiddleware');

/**
 * Delete a screenshot from Cloudinary or disk if validation fails.
 */
async function deleteUploadedScreenshot(file) {
  if (!file) return;

  const publicId = file.public_id || file.filename;

  if (publicId && cloudinary) {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image'
      });
    } catch (error) {
      // Cloudinary destroy attempt
    }
  }

  if (file.path && fs.existsSync(file.path)) {
    try {
      fs.unlinkSync(file.path);
    } catch (error) {
      // Local cleanup attempt
    }
  }
}

/**
 * Generates a unique Submission ID formatted as SUB-YYYY-XXXXXX
 */
async function generateSubmissionId() {
  const year = new Date().getFullYear();
  const pool = getPool();

  const [rows] = await pool.query(
    'SELECT COUNT(id) as total FROM submissions'
  );

  const count = (rows[0] ? rows[0].total : 0) + 1;

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);

  const sequentialStr = String(count).padStart(4, '0');

  return `SUB-${year}-${sequentialStr}${randomSuffix
    .toString()
    .slice(-2)}`;
}

/**
 * POST /api/submissions
 *
 * Student endpoint to create a new hackathon proof submission.
 */
async function createSubmission(req, res, next) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    const studentCaptainRegNo = req.student.registerNumber;

    const { hackathonId, membersData } = req.body;

    // ---------------------------------------------------------
    // 1. Validate Hackathon
    // ---------------------------------------------------------

    if (!hackathonId) {
      await deleteUploadedScreenshot(req.file);

      return res.status(400).json({
        success: false,
        message: 'Hackathon ID is required.'
      });
    }

    const [hackathons] = await connection.query(
      'SELECT * FROM hackathons WHERE id = ?',
      [hackathonId]
    );

    if (hackathons.length === 0) {
      await deleteUploadedScreenshot(req.file);

      return res.status(404).json({
        success: false,
        message: 'Selected hackathon not found.'
      });
    }

    const hackathon = hackathons[0];

    if (!hackathon.is_active) {
      await deleteUploadedScreenshot(req.file);

      return res.status(400).json({
        success: false,
        message:
          'Registration is closed for this hackathon as it is currently inactive.'
      });
    }

    // ---------------------------------------------------------
    // 2. Validate Screenshot File
    // ---------------------------------------------------------

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          'Please upload a valid registration screenshot proof (PNG, JPG, JPEG, WEBP under 5 MB).'
      });
    }

    // ---------------------------------------------------------
    // 3. Parse and Validate Team Members
    // ---------------------------------------------------------

    let members = [];

    try {
      members =
        typeof membersData === 'string'
          ? JSON.parse(membersData)
          : membersData || [];
    } catch (error) {
      await deleteUploadedScreenshot(req.file);

      return res.status(400).json({
        success: false,
        message: 'Invalid team members data format.'
      });
    }

    if (!Array.isArray(members) || members.length === 0) {
      await deleteUploadedScreenshot(req.file);

      return res.status(400).json({
        success: false,
        message: `This hackathon requires between ${hackathon.min_team_size} and ${hackathon.max_team_size} team members.`
      });
    }

    const teamSize = members.length;

    if (
      teamSize < hackathon.min_team_size ||
      teamSize > hackathon.max_team_size
    ) {
      await deleteUploadedScreenshot(req.file);

      return res.status(400).json({
        success: false,
        message: `This hackathon requires ${hackathon.min_team_size}–${hackathon.max_team_size} team members (you provided ${teamSize}).`
      });
    }

    // ---------------------------------------------------------
    // 4. Verify Captain (Member 1)
    // ---------------------------------------------------------

    const captain = members[0];

    const normalizedCaptainRegNo = normalizeRegisterNumber(
      captain.registerNumber || captain.regNo
    );

    if (
      normalizedCaptainRegNo !==
      normalizeRegisterNumber(studentCaptainRegNo)
    ) {
      await deleteUploadedScreenshot(req.file);

      return res.status(400).json({
        success: false,
        message: 'Member 1 must be the verified student captain.'
      });
    }

    // Check captain against approved list
    const captainInfo = await fetchStudentFromProvider(
      normalizedCaptainRegNo
    );

    if (!captainInfo.found || !captainInfo.student) {
      await deleteUploadedScreenshot(req.file);

      return res.status(400).json({
        success: false,
        message:
          'Captain register number not found in approved college student list.'
      });
    }

    // ---------------------------------------------------------
    // 5. Validate All Team Members
    // ---------------------------------------------------------

    const seenCollegeRegNumbers = new Set();

    seenCollegeRegNumbers.add(normalizedCaptainRegNo);

    const validatedMembers = [
      {
        registerNumber: captainInfo.student.registerNumber,
        name: captainInfo.student.name,
        department: captainInfo.student.department,
        year: captainInfo.student.year,
        section: captainInfo.student.section,
        memberType: 'College',
        institution: 'College',
        email: captainInfo.student.email,
        isCaptain: true
      }
    ];

    for (let i = 1; i < members.length; i++) {
      const m = members[i];

      const isExternal =
        m.memberType === 'External' ||
        m.isExternal === true;

      // -------------------------------------------------------
      // External Member
      // -------------------------------------------------------

      if (isExternal) {
        if (!hackathon.allow_external_participants) {
          await deleteUploadedScreenshot(req.file);

          return res.status(400).json({
            success: false,
            message:
              'External participants are not permitted for this hackathon.'
          });
        }

        if (
          !m.name ||
          !m.name.trim() ||
          !m.institution ||
          !m.institution.trim()
        ) {
          await deleteUploadedScreenshot(req.file);

          return res.status(400).json({
            success: false,
            message: `External participant at position ${i + 1
              } requires both Full Name and Institution.`
          });
        }

        validatedMembers.push({
          registerNumber: m.registerNumber
            ? String(m.registerNumber).trim()
            : null,

          name: m.name.trim(),

          department: m.department
            ? m.department.trim()
            : null,

          year: m.year
            ? String(m.year).trim()
            : null,

          section: null,

          memberType: 'External',

          institution: m.institution.trim(),

          email: m.email
            ? m.email.trim()
            : null,

          isCaptain: false
        });
      }

      // -------------------------------------------------------
      // College Student Member
      // -------------------------------------------------------

      else {
        const regNo = normalizeRegisterNumber(
          m.registerNumber || m.regNo
        );

        if (!regNo) {
          await deleteUploadedScreenshot(req.file);

          return res.status(400).json({
            success: false,
            message: `Please enter a valid register number for Member ${i + 1
              }.`
          });
        }

        // Check duplicate register numbers
        if (seenCollegeRegNumbers.has(regNo)) {
          await deleteUploadedScreenshot(req.file);

          return res.status(400).json({
            success: false,
            message: `Student with Register Number ${regNo} is already part of this team (duplicate member detected).`
          });
        }

        seenCollegeRegNumbers.add(regNo);

        // Verify student against Google Apps Script
        const memberLookup =
          await fetchStudentFromProvider(regNo);

        if (
          !memberLookup.found ||
          !memberLookup.student
        ) {
          await deleteUploadedScreenshot(req.file);

          return res.status(400).json({
            success: false,
            message: `Register Number ${regNo} (Member ${i + 1
              }) was not found in the approved student list.`
          });
        }

        validatedMembers.push({
          registerNumber:
            memberLookup.student.registerNumber,

          name: memberLookup.student.name,

          department:
            memberLookup.student.department,

          year:
            memberLookup.student.year,

          section:
            memberLookup.student.section,

          memberType: 'College',

          institution: 'College',

          email:
            memberLookup.student.email,

          isCaptain: false
        });
      }
    }

    // ---------------------------------------------------------
    // 6. Execute Database Transaction
    // ---------------------------------------------------------

    await connection.beginTransaction();

    const submissionId =
      await generateSubmissionId();

    /*
     * IMPORTANT:
     *
     * With Cloudinary storage, req.file.path contains
     * the permanent Cloudinary HTTPS URL.
     *
     * Example:
     * https://res.cloudinary.com/....../image/upload/....
     *
     * We save that URL directly into screenshot_path.
     */

    const screenshotUrl =
      req.file.path ||
      req.file.secure_url ||
      req.file.url ||
      req.file.filename;

    const [subResult] = await connection.query(
      `INSERT INTO submissions
       (
         submission_id,
         student_register_number,
         student_name,
         student_email,
         hackathon_id,
         screenshot_path,
         status
       )
       VALUES (?, ?, ?, ?, ?, ?, 'Pending')`,
      [
        submissionId,
        studentCaptainRegNo,
        captainInfo.student?.name || null,
        captainInfo.student?.email || null,
        hackathonId,
        screenshotUrl
      ]
    );

    const submissionDbId =
      subResult.insertId;

    // ---------------------------------------------------------
    // Create Team
    // ---------------------------------------------------------

    const [teamResult] = await connection.query(
      `INSERT INTO teams
       (
         submission_id,
         team_size
       )
       VALUES (?, ?)`,
      [
        submissionDbId,
        validatedMembers.length
      ]
    );

    const teamDbId =
      teamResult.insertId;

    // ---------------------------------------------------------
    // Insert Team Members
    // ---------------------------------------------------------

    for (const mem of validatedMembers) {
      await connection.query(
        `INSERT INTO team_members
         (
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
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          teamDbId,
          mem.registerNumber,
          mem.name,
          mem.department,
          mem.year,
          mem.section,
          mem.memberType,
          mem.institution,
          mem.email,
          mem.isCaptain ? 1 : 0
        ]
      );
    }

    // ---------------------------------------------------------
    // Commit
    // ---------------------------------------------------------

    await connection.commit();

    return res.status(201).json({
      success: true,
      message:
        'Registration proof submitted successfully.',

      submissionId,

      status:
        'Pending Verification',

      hackathonName:
        hackathon.name,

      teamSize:
        validatedMembers.length,

      submittedAt:
        new Date().toISOString()
    });

  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error(
        'Transaction rollback failed:',
        rollbackError.message
      );
    }

    await deleteUploadedScreenshot(req.file);

    next(error);

  } finally {
    connection.release();
  }
}

/**
 * GET /api/submissions/my
 *
 * Student endpoint to list their submitted proofs.
 */
async function getMySubmissions(req, res, next) {
  try {
    const studentRegNo =
      req.student.registerNumber;

    const submissions = await query(
      `SELECT
         s.id,
         s.submission_id,
         s.student_register_number,
         s.hackathon_id,
         s.screenshot_path,
         s.status,
         s.rejection_reason,
         s.created_at,

         h.name AS hackathon_name,
         h.institution AS hackathon_institution,
         h.start_date,
         h.end_date,
         h.registration_deadline,
         h.poster_path,

         t.id AS team_id,
         t.team_size

       FROM submissions s

       JOIN hackathons h
         ON s.hackathon_id = h.id

       JOIN teams t
         ON t.submission_id = s.id

       JOIN team_members tm
         ON tm.team_id = t.id

       WHERE
         tm.register_number = ?
         OR s.student_register_number = ?

       GROUP BY s.id

       ORDER BY s.created_at DESC`,
      [
        studentRegNo,
        studentRegNo
      ]
    );

    // Fetch team members
    for (const sub of submissions) {
      if (sub.team_id) {
        const members = await query(
          `SELECT
             id,
             register_number,
             name,
             department,
             year,
             member_type,
             institution,
             email,
             is_captain

           FROM team_members

           WHERE team_id = ?

           ORDER BY
             is_captain DESC,
             id ASC`,
          [sub.team_id]
        );

        sub.team_members = members;
      } else {
        sub.team_members = [];
      }
    }

    return res.json({
      success: true,
      count: submissions.length,
      submissions
    });

  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/submissions/:id
 *
 * Get single submission details.
 */
async function getSubmissionById(req, res, next) {
  try {
    const { id } = req.params;

    const submissions = await query(
      `SELECT
         s.id,
         s.submission_id,
         s.student_register_number,
         s.hackathon_id,
         s.screenshot_path,
         s.status,
         s.rejection_reason,
         s.created_at,
         s.updated_at,

         h.name AS hackathon_name,
         h.institution AS hackathon_institution,
         h.mode,
         h.location,
         h.start_date,
         h.end_date,

         t.id AS team_id,
         t.team_size

       FROM submissions s

       JOIN hackathons h
         ON s.hackathon_id = h.id

       LEFT JOIN teams t
         ON t.submission_id = s.id

       WHERE
         s.id = ?
         OR s.submission_id = ?`,
      [
        id,
        id
      ]
    );

    if (submissions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found.'
      });
    }

    const sub = submissions[0];

    // -------------------------------------------------------
    // Security check
    // -------------------------------------------------------

    if (!req.admin) {
      const studentRegNo =
        req.student.registerNumber;

      const isAuthorized =
        sub.student_register_number === studentRegNo;

      if (!isAuthorized) {
        const [isMem] = await query(
          `SELECT id
           FROM team_members
           WHERE team_id = ?
           AND register_number = ?`,
          [
            sub.team_id,
            studentRegNo
          ]
        );

        if (isMem.length === 0) {
          return res.status(403).json({
            success: false,
            message:
              'You are not authorized to view this submission.'
          });
        }
      }
    }

    // -------------------------------------------------------
    // Fetch team members
    // -------------------------------------------------------

    if (sub.team_id) {
      const members = await query(
        `SELECT
           id,
           register_number,
           name,
           department,
           year,
           member_type,
           institution,
           email,
           is_captain

         FROM team_members

         WHERE team_id = ?

         ORDER BY
           is_captain DESC,
           id ASC`,
        [sub.team_id]
      );

      sub.team_members = members;
    } else {
      sub.team_members = [];
    }

    return res.json({
      success: true,
      submission: sub
    });

  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/submissions
 *
 * Admin endpoint to list all submissions.
 */
async function getAllSubmissionsAdmin(req, res, next) {
  try {
    const {
      status,
      hackathonId,
      search
    } = req.query;

    let sql = `
      SELECT
        s.id,
        s.submission_id,
        s.student_register_number,
        s.hackathon_id,
        s.screenshot_path,
        s.status,
        s.rejection_reason,
        s.created_at,

        h.name AS hackathon_name,
        h.institution AS hackathon_institution,

        t.id AS team_id,
        t.team_size

      FROM submissions s

      JOIN hackathons h
        ON s.hackathon_id = h.id

      LEFT JOIN teams t
        ON t.submission_id = s.id

      WHERE 1=1
    `;

    const params = [];

    // Status filter
    if (
      status &&
      status !== 'All'
    ) {
      sql += ' AND s.status = ?';

      params.push(status);
    }

    // Hackathon filter
    if (
      hackathonId &&
      hackathonId !== 'All'
    ) {
      sql += ' AND s.hackathon_id = ?';

      params.push(hackathonId);
    }

    // Search
    if (search) {
      sql += `
        AND (
          s.submission_id LIKE ?
          OR s.student_register_number LIKE ?
          OR h.name LIKE ?
        )
      `;

      const term =
        `%${search.trim()}%`;

      params.push(
        term,
        term,
        term
      );
    }

    sql += `
      ORDER BY s.created_at DESC
    `;

    const submissions =
      await query(sql, params);

    // -------------------------------------------------------
    // Attach team members
    // -------------------------------------------------------

    for (const sub of submissions) {
      if (sub.team_id) {
        const members = await query(
          `SELECT
             id,
             register_number,
             name,
             department,
             year,
             member_type,
             institution,
             is_captain

           FROM team_members

           WHERE team_id = ?

           ORDER BY
             is_captain DESC,
             id ASC`,
          [sub.team_id]
        );

        sub.team_members = members;
      } else {
        sub.team_members = [];
      }
    }

    return res.json({
      success: true,
      count: submissions.length,
      submissions
    });

  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/admin/submissions/:id/verify
 *
 * Admin endpoint to verify a submission.
 */
async function verifySubmission(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await query(
      `SELECT id, status
       FROM submissions
       WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found.'
      });
    }

    await query(
      `UPDATE submissions
       SET
         status = "Verified",
         rejection_reason = NULL,
         updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    return res.json({
      success: true,
      message:
        'Submission has been successfully verified.',
      status: 'Verified'
    });

  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/admin/submissions/:id/reject
 *
 * Admin endpoint to reject a submission.
 */
async function rejectSubmission(req, res, next) {
  try {
    const { id } = req.params;

    const {
      rejectionReason,
      reason
    } = req.body;

    const finalReason =
      (
        rejectionReason ||
        reason ||
        ''
      ).trim();

    if (!finalReason) {
      return res.status(400).json({
        success: false,
        message:
          'A clear reason for rejection is required.'
      });
    }

    const existing = await query(
      `SELECT id, status
       FROM submissions
       WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found.'
      });
    }

    await query(
      `UPDATE submissions
       SET
         status = "Rejected",
         rejection_reason = ?,
         updated_at = NOW()
       WHERE id = ?`,
      [
        finalReason,
        id
      ]
    );

    return res.json({
      success: true,
      message:
        'Submission has been marked as Rejected.',
      status: 'Rejected',
      rejectionReason: finalReason
    });

  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/teams
 *
 * Admin endpoint to view all teams.
 */
async function getAllTeamsAdmin(req, res, next) {
  try {
    const {
      hackathonId,
      search
    } = req.query;

    let sql = `
      SELECT
        t.id AS team_id,
        t.team_size,
        t.created_at,

        s.id AS submission_db_id,
        s.submission_id,
        s.status AS submission_status,
        s.screenshot_path,

        h.id AS hackathon_id,
        h.name AS hackathon_name

      FROM teams t

      JOIN submissions s
        ON t.submission_id = s.id

      JOIN hackathons h
        ON s.hackathon_id = h.id

      WHERE 1=1
    `;

    const params = [];

    // Hackathon filter
    if (
      hackathonId &&
      hackathonId !== 'All'
    ) {
      sql += ' AND h.id = ?';

      params.push(hackathonId);
    }

    sql += `
      ORDER BY t.created_at DESC
    `;

    const teams =
      await query(sql, params);

    // -------------------------------------------------------
    // Attach members
    // -------------------------------------------------------

    for (const team of teams) {
      const members = await query(
        `SELECT
           id,
           register_number,
           name,
           department,
           year,
           section,
           member_type,
           institution,
           email,
           is_captain

         FROM team_members

         WHERE team_id = ?

         ORDER BY
           is_captain DESC,
           id ASC`,
        [team.team_id]
      );

      team.members = members;

      team.captain =
        members.find(
          m => m.is_captain
        ) ||
        members[0] ||
        null;

      team.college_count =
        members.filter(
          m =>
            m.member_type === 'College'
        ).length;

      team.external_count =
        members.filter(
          m =>
            m.member_type === 'External'
        ).length;
    }

    // -------------------------------------------------------
    // Search filtering
    // -------------------------------------------------------

    let filtered = teams;

    if (search) {
      const q =
        search
          .toLowerCase()
          .trim();

      filtered =
        teams.filter(team => {
          const submissionMatch =
            team.submission_id &&
            team.submission_id
              .toLowerCase()
              .includes(q);

          const hackathonMatch =
            team.hackathon_name &&
            team.hackathon_name
              .toLowerCase()
              .includes(q);

          const captainMatch =
            team.captain &&
            (
              (
                team.captain.name &&
                team.captain.name
                  .toLowerCase()
                  .includes(q)
              ) ||
              (
                team.captain.register_number &&
                team.captain.register_number
                  .toLowerCase()
                  .includes(q)
              )
            );

          const memberMatch =
            team.members.some(member =>
              (
                member.name &&
                member.name
                  .toLowerCase()
                  .includes(q)
              ) ||
              (
                member.register_number &&
                member.register_number
                  .toLowerCase()
                  .includes(q)
              )
            );

          return (
            submissionMatch ||
            hackathonMatch ||
            captainMatch ||
            memberMatch
          );
        });
    }

    return res.json({
      success: true,
      count: filtered.length,
      teams: filtered
    });

  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------

module.exports = {
  createSubmission,
  getMySubmissions,
  getSubmissionById,
  getAllSubmissionsAdmin,
  verifySubmission,
  rejectSubmission,
  getAllTeamsAdmin
};