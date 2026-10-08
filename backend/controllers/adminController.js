const { query } = require('../config/db');
const { fetchAllApprovedStudentsList, normalizeRegisterNumber } = require('./studentController');
const config = require('../config/config');

/**
 * GET /api/admin/dashboard
 * Aggregates all KPI statistics and activity feeds for the Admin Dashboard
 */
async function getDashboardOverview(req, res, next) {
  try {
    // 1. Fetch approved students count
    const approvedStudents = await fetchAllApprovedStudentsList();
    const totalApprovedStudents = approvedStudents.length;

    // 2. Aggregate Hackathon and Submission metrics
    const hacksCountRows = await query(
      'SELECT COUNT(id) AS total_active FROM hackathons WHERE is_active = 1'
    );

    const totalHacksRows = await query(
      'SELECT COUNT(id) AS total FROM hackathons'
    );

    const submissionStatsRows = await query(`
      SELECT
        COUNT(id) AS total_submissions,
        COUNT(CASE WHEN status = 'Pending' THEN 1 END) AS pending_submissions,
        COUNT(CASE WHEN status = 'Verified' THEN 1 END) AS verified_submissions,
        COUNT(CASE WHEN status = 'Rejected' THEN 1 END) AS rejected_submissions
      FROM submissions
    `);

    const hacksCount = hacksCountRows[0] || {};
    const totalHacks = totalHacksRows[0] || {};
    const submissionStats = submissionStatsRows[0] || {};

    // 3. Overall unique participated students across all verified submissions
    const verifiedDistinctStudents = await query(`
      SELECT DISTINCT tm.register_number
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      JOIN submissions s ON (t.submission_id = s.id OR t.submission_id = s.submission_id)
      WHERE s.status = 'Verified'
        AND tm.member_type = 'College'
        AND tm.register_number IS NOT NULL
        AND tm.register_number != ''
    `);

    const approvedSet = new Set(
      approvedStudents.map(student =>
        normalizeRegisterNumber(student.registerNumber)
      )
    );

    let uniqueParticipatedCount = 0;

    for (const row of verifiedDistinctStudents) {
      const norm = normalizeRegisterNumber(row.register_number);

      if (approvedSet.has(norm)) {
        uniqueParticipatedCount++;
      }
    }

    const uniqueNotParticipatedCount = Math.max(
      0,
      totalApprovedStudents - uniqueParticipatedCount
    );

    const overallParticipationRate =
      totalApprovedStudents > 0
        ? parseFloat(
          (
            (uniqueParticipatedCount / totalApprovedStudents) *
            100
          ).toFixed(1)
        )
        : 0;

    // 4. Hackathon breakdown
    // Fully sql_mode=only_full_group_by compliant via subquery aggregation
    const hackathonsBreakdown = await query(`
      SELECT
        h.id,
        h.name,
        h.institution,
        h.start_date,
        h.end_date,
        h.registration_deadline,
        h.is_active,
        h.created_at,
        COALESCE(stats.total_submissions, 0) AS total_submissions,
        COALESCE(stats.verified_submissions, 0) AS verified_submissions,
        COALESCE(stats.pending_submissions, 0) AS pending_submissions,
        COALESCE(stats.rejected_submissions, 0) AS rejected_submissions
      FROM hackathons h
      LEFT JOIN (
        SELECT
          hackathon_id,
          COUNT(id) AS total_submissions,
          COUNT(CASE WHEN status = 'Verified' THEN 1 END) AS verified_submissions,
          COUNT(CASE WHEN status = 'Pending' THEN 1 END) AS pending_submissions,
          COUNT(CASE WHEN status = 'Rejected' THEN 1 END) AS rejected_submissions
        FROM submissions
        GROUP BY hackathon_id
      ) stats ON h.id = stats.hackathon_id
      ORDER BY h.created_at DESC
      LIMIT 6
    `);

    // 5. Recent submissions
    const recentSubmissions = await query(`
      SELECT
        s.id,
        s.submission_id,
        s.student_register_number,
        s.status,
        s.created_at,
        h.name AS hackathon_name
      FROM submissions s
      JOIN hackathons h
        ON s.hackathon_id = h.id
      ORDER BY s.created_at DESC
      LIMIT 8
    `);

    res.json({
      success: true,

      stats: {
        totalStudents: totalApprovedStudents,
        activeHackathons: hacksCount.total_active || 0,
        totalHackathons: totalHacks.total || 0,

        totalSubmissions:
          submissionStats.total_submissions || 0,

        pendingSubmissions:
          submissionStats.pending_submissions || 0,

        verifiedSubmissions:
          submissionStats.verified_submissions || 0,

        rejectedSubmissions:
          submissionStats.rejected_submissions || 0,

        participatedStudents:
          uniqueParticipatedCount,

        notParticipatedStudents:
          uniqueNotParticipatedCount,

        participationRate:
          overallParticipationRate
      },

      hackathons: hackathonsBreakdown,
      recentSubmissions
    });

  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/health
 * System diagnostics for admin
 */
async function getSystemHealth(req, res, next) {
  try {
    let appsScriptStatus = 'Not Configured';

    if (config.appsScriptApiUrl) {
      appsScriptStatus = 'Configured';
    }

    res.json({
      success: true,
      database: 'Connected',
      appsScriptStatus,
      nodeVersion: process.version,
      uptime: process.uptime()
    });

  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboardOverview,
  getSystemHealth
};