const { query } = require('../config/db');
const fs = require('fs');
const path = require('path');
const { postersDir } = require('../middleware/uploadMiddleware');

/**
 * GET /api/hackathons
 * Public / Student endpoint to get active hackathons
 */
async function getActiveHackathons(req, res, next) {
  try {
    const hackathons = await query(`
      SELECT
        id,
        name,
        institution,
        description,
        start_date,
        end_date,
        registration_deadline,
        mode,
        location,
        min_team_size,
        max_team_size,
        allow_external_participants,
        registration_url,
        poster_path,
        is_active,
        created_at
      FROM hackathons
      WHERE is_active = 1
      ORDER BY registration_deadline ASC, start_date ASC
    `);

    res.json({
      success: true,
      count: hackathons.length,
      hackathons
    });

  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/hackathons/:id
 * Get single hackathon details
 */
async function getHackathonById(req, res, next) {
  try {
    const { id } = req.params;

    const hackathons = await query(`
      SELECT
        id,
        name,
        institution,
        description,
        start_date,
        end_date,
        registration_deadline,
        mode,
        location,
        min_team_size,
        max_team_size,
        allow_external_participants,
        registration_url,
        poster_path,
        is_active,
        created_at
      FROM hackathons
      WHERE id = ?
    `, [id]);

    if (hackathons.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hackathon not found.'
      });
    }

    res.json({
      success: true,
      hackathon: hackathons[0]
    });

  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/hackathons
 * Admin endpoint to list all hackathons with submission statistics
 */
async function getAllHackathonsAdmin(req, res, next) {
  try {
    /*
     * IMPORTANT:
     * Do not use SELECT h.* with GROUP BY h.id under MySQL
     * ONLY_FULL_GROUP_BY.
     *
     * Explicitly select every hackathon column that is needed
     * and include those columns in GROUP BY.
     */
    const hackathons = await query(`
      SELECT
        h.id,
        h.name,
        h.institution,
        h.description,
        h.start_date,
        h.end_date,
        h.registration_deadline,
        h.mode,
        h.location,
        h.min_team_size,
        h.max_team_size,
        h.allow_external_participants,
        h.registration_url,
        h.poster_path,
        h.is_active,
        h.created_at,

        COUNT(DISTINCT s.id) AS total_submissions,

        COUNT(
          DISTINCT CASE
            WHEN s.status = 'Verified' THEN s.id
          END
        ) AS verified_submissions,

        COUNT(
          DISTINCT CASE
            WHEN s.status = 'Pending' THEN s.id
          END
        ) AS pending_submissions,

        COUNT(
          DISTINCT CASE
            WHEN s.status = 'Rejected' THEN s.id
          END
        ) AS rejected_submissions

      FROM hackathons h

      LEFT JOIN submissions s
        ON h.id = s.hackathon_id

      GROUP BY
        h.id,
        h.name,
        h.institution,
        h.description,
        h.start_date,
        h.end_date,
        h.registration_deadline,
        h.mode,
        h.location,
        h.min_team_size,
        h.max_team_size,
        h.allow_external_participants,
        h.registration_url,
        h.poster_path,
        h.is_active,
        h.created_at

      ORDER BY h.created_at DESC
    `);

    res.json({
      success: true,
      count: hackathons.length,
      hackathons
    });

  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/hackathons
 * Admin endpoint to create a new hackathon
 */
async function createHackathon(req, res, next) {
  try {
    const {
      name,
      institution,
      description,
      startDate,
      endDate,
      registrationDeadline,
      mode,
      location,
      minTeamSize,
      maxTeamSize,
      allowExternalParticipants,
      registrationUrl,
      isActive
    } = req.body;

    if (
      !name ||
      !institution ||
      !startDate ||
      !endDate ||
      !registrationDeadline ||
      !registrationUrl
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Please provide all required hackathon fields (name, institution, dates, registration URL).'
      });
    }

    const minTeam = parseInt(minTeamSize || '1', 10);
    const maxTeam = parseInt(maxTeamSize || '5', 10);

    if (minTeam <= 0 || maxTeam < minTeam) {
      return res.status(400).json({
        success: false,
        message:
          'Minimum team size must be at least 1, and maximum must be greater than or equal to minimum.'
      });
    }

    let posterPath = null;

    if (req.file) {
      posterPath = req.file.filename;
    }

    const result = await query(
      `INSERT INTO hackathons
       (
         name,
         institution,
         description,
         start_date,
         end_date,
         registration_deadline,
         mode,
         location,
         min_team_size,
         max_team_size,
         allow_external_participants,
         registration_url,
         poster_path,
         is_active
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        institution.trim(),
        description ? description.trim() : '',
        startDate,
        endDate,
        registrationDeadline,
        mode || 'Offline',
        location ? location.trim() : '',
        minTeam,
        maxTeam,
        allowExternalParticipants === 'true' ||
          allowExternalParticipants === true
          ? 1
          : 0,
        registrationUrl.trim(),
        posterPath,
        isActive === 'false' || isActive === false
          ? 0
          : 1
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Hackathon created successfully.',
      hackathonId: result.insertId
    });

  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/admin/hackathons/:id
 * Admin endpoint to update an existing hackathon
 */
async function updateHackathon(req, res, next) {
  try {
    const { id } = req.params;

    const {
      name,
      institution,
      description,
      startDate,
      endDate,
      registrationDeadline,
      mode,
      location,
      minTeamSize,
      maxTeamSize,
      allowExternalParticipants,
      registrationUrl,
      isActive
    } = req.body;

    const existing = await query(
      'SELECT * FROM hackathons WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hackathon not found.'
      });
    }

    let posterPath = existing[0].poster_path;

    if (req.file) {
      posterPath = req.file.filename;

      // Remove old poster if it was custom
      if (
        existing[0].poster_path &&
        !existing[0].poster_path.startsWith('poster_sample_')
      ) {
        const oldPath = path.join(
          postersDir,
          existing[0].poster_path
        );

        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (e) {
            console.warn(
              'Could not delete old poster:',
              e
            );
          }
        }
      }
    }

    await query(
      `UPDATE hackathons SET
         name = ?,
         institution = ?,
         description = ?,
         start_date = ?,
         end_date = ?,
         registration_deadline = ?,
         mode = ?,
         location = ?,
         min_team_size = ?,
         max_team_size = ?,
         allow_external_participants = ?,
         registration_url = ?,
         poster_path = ?,
         is_active = ?
       WHERE id = ?`,
      [
        name !== undefined
          ? name.trim()
          : existing[0].name,

        institution !== undefined
          ? institution.trim()
          : existing[0].institution,

        description !== undefined
          ? description.trim()
          : existing[0].description,

        startDate || existing[0].start_date,

        endDate || existing[0].end_date,

        registrationDeadline ||
        existing[0].registration_deadline,

        mode || existing[0].mode,

        location !== undefined
          ? location.trim()
          : existing[0].location,

        minTeamSize !== undefined
          ? parseInt(minTeamSize, 10)
          : existing[0].min_team_size,

        maxTeamSize !== undefined
          ? parseInt(maxTeamSize, 10)
          : existing[0].max_team_size,

        allowExternalParticipants !== undefined
          ? (
            allowExternalParticipants === 'true' ||
              allowExternalParticipants === true
              ? 1
              : 0
          )
          : existing[0].allow_external_participants,

        registrationUrl !== undefined
          ? registrationUrl.trim()
          : existing[0].registration_url,

        posterPath,

        isActive !== undefined
          ? (
            isActive === 'false' ||
              isActive === false ||
              isActive === 0
              ? 0
              : 1
          )
          : existing[0].is_active,

        id
      ]
    );

    res.json({
      success: true,
      message: 'Hackathon updated successfully.'
    });

  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/hackathons/:id/toggle-status
 */
async function toggleHackathonStatus(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await query(
      'SELECT id, is_active FROM hackathons WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hackathon not found.'
      });
    }

    const newStatus = existing[0].is_active ? 0 : 1;

    await query(
      'UPDATE hackathons SET is_active = ? WHERE id = ?',
      [newStatus, id]
    );

    res.json({
      success: true,
      message: `Hackathon is now ${newStatus ? 'Active' : 'Inactive'
        }.`,
      isActive: Boolean(newStatus)
    });

  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/admin/hackathons/:id
 */
async function deleteHackathon(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await query(
      'SELECT id, poster_path FROM hackathons WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hackathon not found.'
      });
    }

    await query(
      'DELETE FROM hackathons WHERE id = ?',
      [id]
    );

    // Delete poster file if present
    if (
      existing[0].poster_path &&
      !existing[0].poster_path.startsWith('poster_sample_')
    ) {
      const pPath = path.join(
        postersDir,
        existing[0].poster_path
      );

      if (fs.existsSync(pPath)) {
        try {
          fs.unlinkSync(pPath);
        } catch (e) {
          // Ignore file deletion errors
        }
      }
    }

    res.json({
      success: true,
      message: 'Hackathon deleted successfully.'
    });

  } catch (error) {
    next(error);
  }
}

module.exports = {
  getActiveHackathons,
  getHackathonById,
  getAllHackathonsAdmin,
  createHackathon,
  updateHackathon,
  toggleHackathonStatus,
  deleteHackathon
};