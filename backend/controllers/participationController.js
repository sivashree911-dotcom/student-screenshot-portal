const { query } = require('../config/db');
const { fetchAllApprovedStudentsList, normalizeRegisterNumber } = require('./studentController');

/**
 * GET /api/admin/participation/:hackathonId
 * Calculates participation metrics for a specific hackathon
 */
async function getHackathonParticipation(req, res, next) {
  try {
    const { hackathonId } = req.params;

    // 1. Fetch Hackathon details
    const hackathons = await query(
      'SELECT id, name, institution, start_date, end_date, is_active FROM hackathons WHERE id = ?',
      [hackathonId]
    );

    if (hackathons.length === 0) {
      return res.status(404).json({ success: false, message: 'Hackathon not found.' });
    }

    const hackathon = hackathons[0];

    // 2. Fetch all approved college students (source of truth)
    const approvedStudents = await fetchAllApprovedStudentsList();
    const totalApprovedCount = approvedStudents.length;

    // Map approved students by normalized register number for fast lookup
    const approvedStudentMap = new Map();
    for (const student of approvedStudents) {
      const norm = normalizeRegisterNumber(student.registerNumber);
      if (norm) {
        approvedStudentMap.set(norm, student);
      }
    }

    // 3. Query all team members in VERIFIED submissions for this hackathon
    const verifiedMembers = await query(
      `SELECT tm.register_number, tm.name, tm.department, tm.year, tm.is_captain,
              s.id AS submission_db_id, s.submission_id, s.created_at AS submission_date,
              t.id AS team_id
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       JOIN submissions s ON t.submission_id = s.id
       WHERE s.hackathon_id = ?
         AND s.status = 'Verified'
         AND tm.member_type = 'College'
         AND tm.register_number IS NOT NULL AND tm.register_number != ''`,
      [hackathonId]
    );

    // 4. Query all members across ALL submissions (including Pending/Rejected) to detect duplicate submissions
    const allMembersForHackathon = await query(
      `SELECT tm.register_number, tm.name, tm.is_captain,
              s.id AS submission_db_id, s.submission_id, s.status AS submission_status,
              t.id AS team_id
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       JOIN submissions s ON t.submission_id = s.id
       WHERE s.hackathon_id = ?
         AND tm.member_type = 'College'
         AND tm.register_number IS NOT NULL AND tm.register_number != ''`,
      [hackathonId]
    );

    // Track participation with distinct set of normalized register numbers
    const participatedStudentMap = new Map();
    const participationOccurrences = new Map(); // regNo -> array of submission info

    for (const row of verifiedMembers) {
      const norm = normalizeRegisterNumber(row.register_number);
      if (!norm) continue;

      // Get official student record if available, else use record from member
      const officialInfo = approvedStudentMap.get(norm);
      const studentRecord = {
        registerNumber: row.register_number,
        name: officialInfo ? officialInfo.name : row.name,
        department: officialInfo ? officialInfo.department : (row.department || 'CSE'),
        year: officialInfo ? officialInfo.year : (row.year || '2'),
        section: officialInfo ? officialInfo.section : 'A',
        submissionId: row.submission_id,
        teamId: row.team_id,
        isCaptain: Boolean(row.is_captain),
        submissionDate: row.submission_date
      };

      participatedStudentMap.set(norm, studentRecord);
    }

    // Detect duplicate participation across all submissions for this hackathon
    for (const row of allMembersForHackathon) {
      const norm = normalizeRegisterNumber(row.register_number);
      if (!norm) continue;

      if (!participationOccurrences.has(norm)) {
        participationOccurrences.set(norm, []);
      }
      participationOccurrences.get(norm).push({
        submissionId: row.submission_id,
        teamId: row.team_id,
        status: row.submission_status,
        name: row.name,
        isCaptain: Boolean(row.is_captain)
      });
    }

    const duplicateParticipations = [];
    for (const [norm, occurrences] of participationOccurrences.entries()) {
      if (occurrences.length > 1) {
        const official = approvedStudentMap.get(norm);
        duplicateParticipations.push({
          registerNumber: occurrences[0].registerNumber || (official ? official.registerNumber : norm),
          studentName: official ? official.name : occurrences[0].name,
          department: official ? official.department : '',
          occurrenceCount: occurrences.length,
          submissions: occurrences
        });
      }
    }

    // 5. Calculate Not Participated Students
    const participatedList = Array.from(participatedStudentMap.values());
    const notParticipatedList = [];

    for (const student of approvedStudents) {
      const norm = normalizeRegisterNumber(student.registerNumber);
      if (!participatedStudentMap.has(norm)) {
        notParticipatedList.push({
          registerNumber: student.registerNumber,
          name: student.name,
          department: student.department || 'CSE',
          year: student.year || '2',
          section: student.section || 'A',
          email: student.email || '',
          participationStatus: 'Not Participated'
        });
      }
    }

    const participatedCount = participatedList.length;
    const notParticipatedCount = notParticipatedList.length;
    const participationRate = totalApprovedCount > 0
      ? parseFloat(((participatedCount / totalApprovedCount) * 100).toFixed(1))
      : 0;

    res.json({
      success: true,
      hackathon: {
        id: hackathon.id,
        name: hackathon.name,
        institution: hackathon.institution,
        startDate: hackathon.start_date,
        endDate: hackathon.end_date
      },
      summary: {
        totalStudents: totalApprovedCount,
        participatedCount,
        notParticipatedCount,
        participationRate,
        duplicateCount: duplicateParticipations.length
      },
      participatedStudents: participatedList,
      notParticipatedStudents: notParticipatedList,
      duplicateParticipations
    });

  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/reports/matrix
 * Generates overall participation matrix for all approved students across all active hackathons
 */
async function getOverallParticipationMatrix(req, res, next) {
  try {
    const approvedStudents = await fetchAllApprovedStudentsList();
    const hackathons = await query(
      'SELECT id, name, institution, start_date FROM hackathons ORDER BY start_date ASC'
    );

    // Get all verified participations
    const verifiedRows = await query(`
      SELECT tm.register_number, s.hackathon_id, s.submission_id
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      JOIN submissions s ON t.submission_id = s.id
      WHERE s.status = 'Verified'
        AND tm.member_type = 'College'
        AND tm.register_number IS NOT NULL
    `);

    // Map: normRegNo -> Set of hackathonIds participated in
    const studentHackathonParticipation = new Map();
    for (const row of verifiedRows) {
      const norm = normalizeRegisterNumber(row.register_number);
      if (!norm) continue;

      if (!studentHackathonParticipation.has(norm)) {
        studentHackathonParticipation.set(norm, new Set());
      }
      studentHackathonParticipation.get(norm).add(row.hackathon_id);
    }

    const matrix = approvedStudents.map(student => {
      const norm = normalizeRegisterNumber(student.registerNumber);
      const studentHacks = studentHackathonParticipation.get(norm) || new Set();

      const hackathonStatusMap = {};
      let totalEventsParticipated = 0;

      for (const h of hackathons) {
        const participated = studentHacks.has(h.id);
        hackathonStatusMap[h.id] = participated;
        if (participated) totalEventsParticipated++;
      }

      return {
        registerNumber: student.registerNumber,
        name: student.name,
        department: student.department || 'CSE',
        year: student.year || '2',
        section: student.section || 'A',
        totalEventsParticipated,
        hackathons: hackathonStatusMap
      };
    });

    res.json({
      success: true,
      hackathons: hackathons.map(h => ({ id: h.id, name: h.name })),
      totalStudents: approvedStudents.length,
      matrix
    });

  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/participation/:hackathonId/export-csv
 * Generates CSV download for a hackathon's participation report
 */
async function exportParticipationCsv(req, res, next) {
  try {
    const { hackathonId } = req.params;

    const hackathons = await query('SELECT name FROM hackathons WHERE id = ?', [hackathonId]);
    if (hackathons.length === 0) {
      return res.status(404).json({ success: false, message: 'Hackathon not found.' });
    }
    const hackathonName = hackathons[0].name;

    const approvedStudents = await fetchAllApprovedStudentsList();
    const verifiedMembers = await query(
      `SELECT tm.register_number, s.submission_id, s.status, s.created_at
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       JOIN submissions s ON t.submission_id = s.id
       WHERE s.hackathon_id = ?
         AND s.status = 'Verified'
         AND tm.member_type = 'College'`,
      [hackathonId]
    );

    const verifiedMap = new Map();
    for (const row of verifiedMembers) {
      const norm = normalizeRegisterNumber(row.register_number);
      if (norm) {
        verifiedMap.set(norm, row);
      }
    }

    const csvRows = [
      ['Register Number', 'Student Name', 'Department', 'Year', 'Section', 'Hackathon', 'Participation Status', 'Submission ID', 'Submission Status']
    ];

    for (const st of approvedStudents) {
      const norm = normalizeRegisterNumber(st.registerNumber);
      const verified = verifiedMap.get(norm);

      csvRows.push([
        `"${st.registerNumber}"`,
        `"${st.name.replace(/"/g, '""')}"`,
        `"${st.department || 'CSE'}"`,
        `"${st.year || '2'}"`,
        `"${st.section || 'A'}"`,
        `"${hackathonName.replace(/"/g, '""')}"`,
        `"${verified ? 'Participated' : 'Not Participated'}"`,
        `"${verified ? verified.submission_id : '-'}"`,
        `"${verified ? 'Verified' : '-'}"`
      ]);
    }

    const csvContent = csvRows.map(r => r.join(',')).join('\n');
    const safeFilename = `participation_${hackathonName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.send(csvContent);

  } catch (error) {
    next(error);
  }
}

module.exports = {
  getHackathonParticipation,
  getOverallParticipationMatrix,
  exportParticipationCsv
};
