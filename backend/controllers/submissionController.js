const fs = require('fs');
const { getPool, query } = require('../config/db');

const {
  fetchStudentFromProvider,
  normalizeRegisterNumber
} = require('./studentController');

const { cloudinary } = require('../middleware/uploadMiddleware');

/**
 * ============================================================
 * SCREENSHOT CLEANUP
 * ============================================================
 */

async function deleteUploadedScreenshot(file) {
  if (!file) {
    return;
  }

  const publicId = file.public_id || file.filename;

  // Delete from Cloudinary
  if (publicId && cloudinary) {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image'
      });
    } catch (error) {
      console.warn(
        '[CLOUDINARY] Could not delete uploaded screenshot:',
        error.message
      );
    }
  }

  // Delete local file if it exists
  if (file.path && fs.existsSync(file.path)) {
    try {
      fs.unlinkSync(file.path);
    } catch (error) {
      console.warn(
        '[UPLOAD] Could not delete local screenshot:',
        error.message
      );
    }
  }
}


/**
 * ============================================================
 * GENERATE UNIQUE SUBMISSION ID
 * ============================================================
 *
 * Format:
 * SUB-YYYY-XXXXXX
 *
 */

async function generateSubmissionId() {
  const year = new Date().getFullYear();
  const pool = getPool();

  const [rows] = await pool.query(
    'SELECT COUNT(id) AS total FROM submissions'
  );

  const count =
    (rows && rows[0] ? Number(rows[0].total) : 0) + 1;

  const randomSuffix = Math.floor(
    1000 + Math.random() * 9000
  );

  const sequentialStr = String(count).padStart(4, '0');

  return `SUB-${year}-${sequentialStr}${String(
    randomSuffix
  ).slice(-2)}`;
}


/**
 * ============================================================
 * CREATE SUBMISSION
 * ============================================================
 *
 * POST /api/submissions
 *
 * Student submits:
 * - Hackathon
 * - Screenshot proof
 * - Team members
 *
 */

async function createSubmission(req, res, next) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    const studentCaptainRegNo =
      req.student.registerNumber;

    const {
      hackathonId,
      membersData
    } = req.body;

    /**
     * --------------------------------------------------------
     * 1. Validate hackathon ID
     * --------------------------------------------------------
     */

    if (!hackathonId) {
      await deleteUploadedScreenshot(req.file);

      return res.status(400).json({
        success: false,
        message: 'Hackathon ID is required.'
      });
    }


    /**
     * --------------------------------------------------------
     * 2. Validate hackathon
     * --------------------------------------------------------
     */

    const [hackathons] = await connection.query(
      `
      SELECT *
      FROM hackathons
      WHERE id = ?
      `,
      [hackathonId]
    );

    if (!hackathons || hackathons.length === 0) {
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


    /**
     * --------------------------------------------------------
     * 3. Validate screenshot
     * --------------------------------------------------------
     */

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          'Please upload a valid registration screenshot proof (PNG, JPG, JPEG, WEBP under 5 MB).'
      });
    }


    /**
     * --------------------------------------------------------
     * 4. Parse team members
     * --------------------------------------------------------
     */

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


    if (
      !Array.isArray(members) ||
      members.length === 0
    ) {
      await deleteUploadedScreenshot(req.file);

      return res.status(400).json({
        success: false,
        message:
          `This hackathon requires between ${hackathon.min_team_size} and ${hackathon.max_team_size} team members.`
      });
    }


    /**
     * --------------------------------------------------------
     * 5. Validate team size
     * --------------------------------------------------------
     */

    const teamSize = members.length;

    if (
      teamSize < Number(hackathon.min_team_size) ||
      teamSize > Number(hackathon.max_team_size)
    ) {
      await deleteUploadedScreenshot(req.file);

      return res.status(400).json({
        success: false,
        message:
          `This hackathon requires ${hackathon.min_team_size}–${hackathon.max_team_size} team members (you provided ${teamSize}).`
      });
    }


    /**
     * --------------------------------------------------------
     * 6. Validate captain
     * --------------------------------------------------------
     */

    const captain = members[0];

    const normalizedCaptainRegNo =
      normalizeRegisterNumber(
        captain.registerNumber ||
        captain.regNo
      );

    if (
      normalizedCaptainRegNo !==
      normalizeRegisterNumber(studentCaptainRegNo)
    ) {
      await deleteUploadedScreenshot(req.file);

      return res.status(400).json({
        success: false,
        message:
          'Member 1 must be the verified student captain.'
      });
    }


    /**
     * --------------------------------------------------------
     * 7. Verify captain using Google Apps Script
     * --------------------------------------------------------
     */

    const captainInfo =
      await fetchStudentFromProvider(
        normalizedCaptainRegNo
      );

    if (
      !captainInfo ||
      !captainInfo.found ||
      !captainInfo.student
    ) {
      await deleteUploadedScreenshot(req.file);

      return res.status(400).json({
        success: false,
        message:
          'Captain register number not found in approved college student list.'
      });
    }


    /**
     * --------------------------------------------------------
     * 8. Validate all team members
     * --------------------------------------------------------
     */

    const seenCollegeRegNumbers = new Set();

    seenCollegeRegNumbers.add(
      normalizedCaptainRegNo
    );

    const validatedMembers = [
      {
        registerNumber:
          captainInfo.student.registerNumber,

        name:
          captainInfo.student.name,

        department:
          captainInfo.student.department,

        year:
          captainInfo.student.year,

        section:
          captainInfo.student.section,

        memberType: 'College',

        institution: 'College',

        email:
          captainInfo.student.email,

        isCaptain: true
      }
    ];


    /**
     * --------------------------------------------------------
     * 9. Validate remaining members
     * --------------------------------------------------------
     */

    for (let i = 1; i < members.length; i++) {
      const member = members[i];

      const isExternal =
        member.memberType === 'External' ||
        member.isExternal === true;


      /**
       * ------------------------------------------------------
       * External participant
       * ------------------------------------------------------
       */

      if (isExternal) {
        if (
          !hackathon.allow_external_participants
        ) {
          await deleteUploadedScreenshot(req.file);

          return res.status(400).json({
            success: false,
            message:
              'External participants are not permitted for this hackathon.'
          });
        }


        if (
          !member.name ||
          !String(member.name).trim() ||
          !member.institution ||
          !String(member.institution).trim()
        ) {
          await deleteUploadedScreenshot(req.file);

          return res.status(400).json({
            success: false,
            message:
              `External participant at position ${i + 1} requires both Full Name and Institution.`
          });
        }


        validatedMembers.push({
          registerNumber:
            member.registerNumber
              ? String(member.registerNumber).trim()
              : null,

          name:
            String(member.name).trim(),

          department:
            member.department
              ? String(member.department).trim()
              : null,

          year:
            member.year
              ? String(member.year).trim()
              : null,

          section: null,

          memberType: 'External',

          institution:
            String(member.institution).trim(),

          email:
            member.email
              ? String(member.email).trim()
              : null,

          isCaptain: false
        });

        continue;
      }


      /**
       * ------------------------------------------------------
       * College participant
       * ------------------------------------------------------
       */

      const regNo =
        normalizeRegisterNumber(
          member.registerNumber ||
          member.regNo
        );


      if (!regNo) {
        await deleteUploadedScreenshot(req.file);

        return res.status(400).json({
          success: false,
          message:
            `Please enter a valid register number for Member ${i + 1}.`
        });
      }


      /**
       * Duplicate check
       */

      if (seenCollegeRegNumbers.has(regNo)) {
        await deleteUploadedScreenshot(req.file);

        return res.status(400).json({
          success: false,
          message:
            `Student with Register Number ${regNo} is already part of this team (duplicate member detected).`
        });
      }

      seenCollegeRegNumbers.add(regNo);


      /**
       * Verify student using Apps Script
       */

      const memberLookup =
        await fetchStudentFromProvider(regNo);


      if (
        !memberLookup ||
        !memberLookup.found ||
        !memberLookup.student
      ) {
        await deleteUploadedScreenshot(req.file);

        return res.status(400).json({
          success: false,
          message:
            `Register Number ${regNo} (Member ${i + 1}) was not found in the approved student list.`
        });
      }


      validatedMembers.push({
        registerNumber:
          memberLookup.student.registerNumber,

        name:
          memberLookup.student.name,

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


    /**
     * --------------------------------------------------------
     * 10. Begin database transaction
     * --------------------------------------------------------
     */

    await connection.beginTransaction();


    try {
      /**
       * Generate submission ID
       */

      const submissionId =
        await generateSubmissionId();


      /**
       * Cloudinary / local screenshot URL
       */

      const screenshotPath =
        req.file.path ||
        req.file.secure_url ||
        req.file.url ||
        null;


      if (!screenshotPath) {
        throw new Error(
          'Uploaded screenshot path could not be determined.'
        );
      }


      /**
       * ------------------------------------------------------
       * Check duplicate submission
       * ------------------------------------------------------
       */

      const [existingSubmissions] =
        await connection.query(
          `
          SELECT id
          FROM submissions
          WHERE hackathon_id = ?
            AND student_register_number = ?
            AND status != 'Rejected'
          LIMIT 1
          `,
          [
            hackathonId,
            studentCaptainRegNo
          ]
        );


      if (
        existingSubmissions &&
        existingSubmissions.length > 0
      ) {
        await connection.rollback();

        await deleteUploadedScreenshot(req.file);

        return res.status(409).json({
          success: false,
          message:
            'You have already submitted registration proof for this hackathon.'
        });
      }


      /**
       * ------------------------------------------------------
       * Insert submission
       * ------------------------------------------------------
       *
       * IMPORTANT:
       * Status is explicitly 'Pending'.
       */

      const [submissionResult] =
        await connection.query(
          `
          INSERT INTO submissions
          (
            submission_id,
            hackathon_id,
            student_register_number,
            screenshot_path,
            status,
            rejection_reason
          )
          VALUES (?, ?, ?, ?, 'Pending', NULL)
          `,
          [
            submissionId,
            hackathonId,
            studentCaptainRegNo,
            screenshotPath
          ]
        );


      const submissionDbId =
        submissionResult.insertId;


      /**
       * ------------------------------------------------------
       * Create team
       * ------------------------------------------------------
       */

      const teamName =
        `Team - ${submissionId}`;


      const [teamResult] =
        await connection.query(
          `
          INSERT INTO teams
          (
            submission_id,
            team_name,
            team_size
          )
          VALUES (?, ?, ?)
          `,
          [
            submissionDbId,
            teamName,
            validatedMembers.length
          ]
        );


      const teamId =
        teamResult.insertId;


      /**
       * ------------------------------------------------------
       * Insert team members
       * ------------------------------------------------------
       */

      for (
        const member of validatedMembers
      ) {
        await connection.query(
          `
          INSERT INTO team_members
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
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            teamId,

            member.registerNumber,

            member.name,

            member.department,

            member.year,

            member.section,

            member.memberType,

            member.institution,

            member.email,

            member.isCaptain ? 1 : 0
          ]
        );
      }


      /**
       * Commit transaction
       */

      await connection.commit();


      /**
       * Response
       */

      return res.status(201).json({
        success: true,
        message:
          'Registration proof submitted successfully. Your submission is pending admin verification.',

        submission: {
          id: submissionDbId,

          submissionId,

          hackathonId,

          status: 'Pending',

          screenshotPath,

          teamSize:
            validatedMembers.length
        }
      });

    } catch (transactionError) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.warn(
          '[DB] Rollback failed:',
          rollbackError.message
        );
      }

      await deleteUploadedScreenshot(req.file);

      throw transactionError;
    }

  } catch (error) {
    next(error);

  } finally {
    connection.release();
  }
}


/**
 * ============================================================
 * GET ALL SUBMISSIONS
 * ============================================================
 *
 * Admin endpoint
 */

async function getAllSubmissions(req, res, next) {
  try {
    const submissions = await query(
      `
      SELECT
        s.id,
        s.submission_id,
        s.hackathon_id,
        s.student_register_number,
        s.screenshot_path,
        s.status,
        s.rejection_reason,
        s.created_at,
        s.updated_at,

        h.name AS hackathon_name,
        h.institution AS hackathon_institution,

        t.id AS team_id,
        t.team_name,
        t.team_size

      FROM submissions s

      LEFT JOIN hackathons h
        ON s.hackathon_id = h.id

      LEFT JOIN teams t
        ON s.id = t.submission_id

      ORDER BY s.created_at DESC
      `
    );

    const safeSubmissions =
      Array.isArray(submissions)
        ? submissions
        : [];

    return res.json({
      success: true,
      count: safeSubmissions.length,
      submissions: safeSubmissions
    });

  } catch (error) {
    next(error);
  }
}


/**
 * ============================================================
 * GET SUBMISSION BY ID
 * ============================================================
 */

async function getSubmissionById(req, res, next) {
  try {
    const { id } = req.params;


    /**
     * Get submission
     */

    const submissions = await query(
      `
      SELECT
        s.id,
        s.submission_id,
        s.hackathon_id,
        s.student_register_number,
        s.screenshot_path,
        s.status,
        s.rejection_reason,
        s.created_at,
        s.updated_at,

        h.name AS hackathon_name,
        h.institution AS hackathon_institution,
        h.description AS hackathon_description,
        h.start_date,
        h.end_date,
        h.registration_deadline,
        h.mode,
        h.location,
        h.registration_url

      FROM submissions s

      LEFT JOIN hackathons h
        ON s.hackathon_id = h.id

      WHERE s.id = ?
      LIMIT 1
      `,
      [id]
    );


    /**
     * IMPORTANT:
     * Always verify that the query returned an array.
     * This fixes:
     *
     * Cannot read properties of undefined
     * (reading 'length')
     */

    if (
      !Array.isArray(submissions) ||
      submissions.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found.'
      });
    }


    const submission =
      submissions[0];


    /**
     * Get team
     */

    const teams = await query(
      `
      SELECT
        id,
        submission_id,
        team_name,
        team_size
      FROM teams
      WHERE submission_id = ?
      ORDER BY id ASC
      LIMIT 1
      `,
      [id]
    );


    const safeTeams =
      Array.isArray(teams)
        ? teams
        : [];


    const team =
      safeTeams.length > 0
        ? safeTeams[0]
        : null;


    /**
     * Get team members
     */

    let teamMembers = [];


    if (team) {
      const members = await query(
        `
        SELECT
          id,
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
        FROM team_members
        WHERE team_id = ?
        ORDER BY
          is_captain DESC,
          id ASC
        `,
        [team.id]
      );


      teamMembers =
        Array.isArray(members)
          ? members
          : [];
    }


    return res.json({
      success: true,

      submission: {
        ...submission,

        team: team
          ? {
            ...team,
            members: teamMembers
          }
          : {
            id: null,
            submission_id: submission.id,
            team_name: null,
            team_size: 0,
            members: []
          }
      }
    });

  } catch (error) {
    next(error);
  }
}


/**
 * ============================================================
 * VERIFY SUBMISSION
 * ============================================================
 *
 * IMPORTANT FIX:
 *
 * WRONG:
 * status = "Verified"
 *
 * MySQL can interpret double quotes as identifiers depending
 * on SQL mode.
 *
 * CORRECT:
 * status = 'Verified'
 *
 */

async function verifySubmission(req, res, next) {
  try {
    const { id } = req.params;


    /**
     * Check submission exists
     */

    const existing = await query(
      `
      SELECT
        id,
        status
      FROM submissions
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );


    if (
      !Array.isArray(existing) ||
      existing.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found.'
      });
    }


    /**
     * Update status
     *
     * IMPORTANT:
     * Single quotes around Verified.
     */

    await query(
      `
      UPDATE submissions
      SET
        status = 'Verified',
        rejection_reason = NULL,
        updated_at = NOW()
      WHERE id = ?
      `,
      [id]
    );


    return res.json({
      success: true,
      message:
        'Submission verified successfully.'
    });

  } catch (error) {
    next(error);
  }
}


/**
 * ============================================================
 * REJECT SUBMISSION
 * ============================================================
 */

async function rejectSubmission(req, res, next) {
  try {
    const { id } = req.params;

    const rejectionReason =
      req.body &&
      (
        req.body.rejectionReason ||
        req.body.reason ||
        ''
      );


    /**
     * Check submission exists
     */

    const existing = await query(
      `
      SELECT
        id,
        status
      FROM submissions
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );


    if (
      !Array.isArray(existing) ||
      existing.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found.'
      });
    }


    /**
     * Reject submission
     */

    await query(
      `
      UPDATE submissions
      SET
        status = 'Rejected',
        rejection_reason = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        rejectionReason
          ? String(rejectionReason).trim()
          : null,
        id
      ]
    );


    return res.json({
      success: true,
      message:
        'Submission rejected successfully.'
    });

  } catch (error) {
    next(error);
  }
}


/**
 * ============================================================
 * GET STUDENT SUBMISSIONS
 * ============================================================
 *
 * Student endpoint
 */

async function getStudentSubmissions(req, res, next) {
  try {
    const registerNumber =
      req.student &&
        req.student.registerNumber
        ? req.student.registerNumber
        : req.params.registerNumber;


    if (!registerNumber) {
      return res.status(400).json({
        success: false,
        message:
          'Student register number is required.'
      });
    }


    const normalizedRegisterNumber =
      normalizeRegisterNumber(
        registerNumber
      );


    const submissions = await query(
      `
      SELECT
        s.id,
        s.submission_id,
        s.hackathon_id,
        s.student_register_number,
        s.screenshot_path,
        s.status,
        s.rejection_reason,
        s.created_at,
        s.updated_at,

        h.name AS hackathon_name,
        h.institution AS hackathon_institution,
        h.start_date,
        h.end_date,
        h.registration_deadline,

        t.id AS team_id,
        t.team_name,
        t.team_size

      FROM submissions s

      LEFT JOIN hackathons h
        ON s.hackathon_id = h.id

      LEFT JOIN teams t
        ON s.id = t.submission_id

      WHERE
        UPPER(
          REPLACE(
            REPLACE(
              REPLACE(
                s.student_register_number,
                ' ',
                ''
              ),
              '-',
              ''
            ),
            '/',
            ''
          )
        ) = ?

      ORDER BY s.created_at DESC
      `,
      [normalizedRegisterNumber]
    );


    const safeSubmissions =
      Array.isArray(submissions)
        ? submissions
        : [];


    return res.json({
      success: true,
      count: safeSubmissions.length,
      submissions: safeSubmissions
    });

  } catch (error) {
    next(error);
  }
}


/**
 * ============================================================
 * GET SUBMISSION STATS
 * ============================================================
 *
 * Admin dashboard statistics
 */

async function getSubmissionStats(req, res, next) {
  try {
    const rows = await query(
      `
      SELECT
        COUNT(id) AS total,

        COUNT(
          CASE
            WHEN status = 'Pending'
            THEN 1
          END
        ) AS pending,

        COUNT(
          CASE
            WHEN status = 'Verified'
            THEN 1
          END
        ) AS verified,

        COUNT(
          CASE
            WHEN status = 'Rejected'
            THEN 1
          END
        ) AS rejected

      FROM submissions
      `
    );


    const stats =
      Array.isArray(rows) &&
        rows.length > 0
        ? rows[0]
        : {
          total: 0,
          pending: 0,
          verified: 0,
          rejected: 0
        };


    return res.json({
      success: true,

      stats: {
        total:
          Number(stats.total || 0),

        pending:
          Number(stats.pending || 0),

        verified:
          Number(stats.verified || 0),

        rejected:
          Number(stats.rejected || 0)
      }
    });

  } catch (error) {
    next(error);
  }
}


/**
 * ============================================================
 * GET SUBMISSION TEAM
 * ============================================================
 */

async function getSubmissionTeam(req, res, next) {
  try {
    const { id } = req.params;


    /**
     * Get team
     */

    const teams = await query(
      `
      SELECT
        id,
        submission_id,
        team_name,
        team_size
      FROM teams
      WHERE submission_id = ?
      LIMIT 1
      `,
      [id]
    );


    const safeTeams =
      Array.isArray(teams)
        ? teams
        : [];


    if (safeTeams.length === 0) {
      return res.json({
        success: true,

        team: {
          id: null,
          submission_id: Number(id),
          team_name: null,
          team_size: 0,
          members: []
        }
      });
    }


    const team =
      safeTeams[0];


    /**
     * Get members
     */

    const members = await query(
      `
      SELECT
        id,
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
      FROM team_members
      WHERE team_id = ?
      ORDER BY
        is_captain DESC,
        id ASC
      `,
      [team.id]
    );


    const safeMembers =
      Array.isArray(members)
        ? members
        : [];


    return res.json({
      success: true,

      team: {
        ...team,
        members: safeMembers
      }
    });

  } catch (error) {
    next(error);
  }
}


/**
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
  createSubmission,
  getAllSubmissions,
  getSubmissionById,
  verifySubmission,
  rejectSubmission,
  getStudentSubmissions,
  getSubmissionStats,
  getSubmissionTeam
};