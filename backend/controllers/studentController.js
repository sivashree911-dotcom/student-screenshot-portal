]const jwt = require('jsonwebtoken');
const config = require('../config/config');

// =========================================================
// Normalize register number
// =========================================================
function normalizeRegisterNumber(value) {
  if (!value) {
    return '';
  }

  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

// =========================================================
// Call Google Apps Script
// =========================================================
async function callAppsScript(url) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 10000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `Google Apps Script returned HTTP ${response.status}`
      );
    }

    const data = await response.json();

    return data;

  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// =========================================================
// Fetch one student from Google Sheet
// =========================================================
//
// IMPORTANT:
// There is NO local sampleStudents.json fallback.
//
// Google Sheet / Apps Script is the only student source.
// =========================================================
async function fetchStudentFromProvider(normalizedRegNo) {

  if (
    !config.appsScriptApiUrl ||
    !config.appsScriptApiUrl.startsWith('http')
  ) {
    return {
      found: false,
      serviceUnavailable: true,
      source: 'google_sheets'
    };
  }

  try {

    const url =
      `${config.appsScriptApiUrl}` +
      `?operation=verifyStudent` +
      `&registerNumber=${encodeURIComponent(normalizedRegNo)}`;

    const data = await callAppsScript(url);

    if (!data || data.success !== true) {
      return {
        found: false,
        serviceUnavailable: true,
        source: 'google_sheets'
      };
    }

    if (!data.found || !data.student) {
      return {
        found: false,
        serviceUnavailable: false,
        source: 'google_sheets'
      };
    }

    const student = data.student;

    return {
      found: true,
      serviceUnavailable: false,
      source: 'google_sheets',

      student: {
        registerNumber: String(
          student.registerNumber || normalizedRegNo
        ).trim(),

        name:
          student.name ||
          student.studentName ||
          'Student',

        email:
          student.email ||
          '',

        department:
          student.department ||
          'CSE',

        year:
          String(student.year || '2'),

        section:
          String(student.section || 'A'),

        status:
          student.status ||
          'Active'
      }
    };

  } catch (error) {

    console.error(
      '[Student Verification] Google Apps Script failed:',
      error.message
    );

    return {
      found: false,
      serviceUnavailable: true,
      source: 'google_sheets',
      error: error.message
    };
  }
}

// =========================================================
// Fetch all approved students
// =========================================================
//
// Used by Admin dashboard and participation reports.
// =========================================================
async function fetchAllApprovedStudentsList() {

  if (
    !config.appsScriptApiUrl ||
    !config.appsScriptApiUrl.startsWith('http')
  ) {
    return [];
  }

  try {

    const url =
      `${config.appsScriptApiUrl}` +
      `?operation=getAllStudents`;

    const data = await callAppsScript(url);

    if (
      !data ||
      data.success !== true ||
      !Array.isArray(data.students)
    ) {
      return [];
    }

    return data.students.map((student) => ({
      registerNumber:
        String(student.registerNumber || '').trim(),

      name:
        student.name ||
        student.studentName ||
        'Student',

      email:
        student.email ||
        '',

      department:
        student.department ||
        'CSE',

      year:
        String(student.year || '2'),

      section:
        String(student.section || 'A'),

      status:
        student.status ||
        'Active'
    }));

  } catch (error) {

    console.error(
      '[Student List] Google Apps Script failed:',
      error.message
    );

    return [];
  }
}

// =========================================================
// POST /api/students/verify
// =========================================================
//
// Student enters register number.
// Google Sheet verifies whether the student is approved.
// =========================================================
async function verifyStudent(req, res, next) {

  try {

    const rawRegNo =
      req.body.registerNumber ||
      req.body.regNo ||
      '';

    const normalizedRegNo =
      normalizeRegisterNumber(rawRegNo);

    if (!normalizedRegNo) {

      return res.status(400).json({
        success: false,
        message: 'Please enter a valid register number.'
      });
    }

    const result =
      await fetchStudentFromProvider(
        normalizedRegNo
      );

    // Google Apps Script unavailable
    if (result.serviceUnavailable) {

      return res.status(503).json({
        success: false,
        found: false,
        serviceUnavailable: true,
        message:
          'Student verification service is temporarily unavailable. Please try again later.'
      });
    }

    // Student not found in approved Google Sheet
    if (
      !result.found ||
      !result.student
    ) {

      return res.status(404).json({
        success: false,
        found: false,
        message:
          'Register Number not found in the approved student list. Please contact the administrator.'
      });
    }

    const student =
      result.student;

    // -----------------------------------------------------
    // Create JWT student session
    // -----------------------------------------------------
    const token =
      jwt.sign(
        {
          registerNumber:
            student.registerNumber,

          studentName:
            student.name,

          department:
            student.department,

          year:
            student.year,

          email:
            student.email,

          role:
            'student'
        },

        config.jwt.secret,

        {
          expiresIn:
            config.jwt.expiresIn
        }
      );

    return res.json({

      success: true,

      found: true,

      message:
        `Student verified successfully. Welcome, ${student.name}!`,

      token,

      student: {

        registerNumber:
          student.registerNumber,

        name:
          student.name,

        department:
          student.department,

        year:
          student.year,

        section:
          student.section,

        email:
          student.email
      }
    });

  } catch (error) {

    next(error);
  }
}

// =========================================================
// POST /api/students/lookup
// =========================================================
//
// Used when adding team members.
// =========================================================
async function lookupStudent(req, res, next) {

  try {

    const rawRegNo =
      req.body.registerNumber ||
      req.query.registerNumber ||
      '';

    const normalizedRegNo =
      normalizeRegisterNumber(rawRegNo);

    if (!normalizedRegNo) {

      return res.status(400).json({
        success: false,
        message:
          'Please provide a register number.'
      });
    }

    const result =
      await fetchStudentFromProvider(
        normalizedRegNo
      );

    if (result.serviceUnavailable) {

      return res.status(503).json({
        success: false,
        found: false,
        serviceUnavailable: true,
        message:
          'Student verification service is temporarily unavailable.'
      });
    }

    if (
      !result.found ||
      !result.student
    ) {

      return res.status(404).json({
        success: false,
        found: false,
        message:
          'This register number is not in the approved student list.'
      });
    }

    return res.json({

      success: true,

      found: true,

      student: {

        registerNumber:
          result.student.registerNumber,

        name:
          result.student.name,

        department:
          result.student.department,

        year:
          result.student.year,

        section:
          result.student.section,

        email:
          result.student.email
      }
    });

  } catch (error) {

    next(error);
  }
}

// =========================================================
// GET /api/admin/students
// =========================================================
//
// Admin dashboard student list.
// =========================================================
async function getApprovedStudents(req, res, next) {

  try {

    const {
      search,
      department,
      year
    } = req.query;

    let students =
      await fetchAllApprovedStudentsList();

    if (search) {

      const q =
        search
          .toLowerCase()
          .trim();

      students =
        students.filter(
          (student) =>

            student.registerNumber
              .toLowerCase()
              .includes(q)

            ||

            student.name
              .toLowerCase()
              .includes(q)

            ||

            (
              student.email &&
              student.email
                .toLowerCase()
                .includes(q)
            )
        );
    }

    if (
      department &&
      department !== 'All'
    ) {

      students =
        students.filter(
          (student) =>
            student.department === department
        );
    }

    if (
      year &&
      year !== 'All'
    ) {

      students =
        students.filter(
          (student) =>
            String(student.year) ===
            String(year)
        );
    }

    return res.json({

      success: true,

      total:
        students.length,

      students
    });

  } catch (error) {

    next(error);
  }
}

// =========================================================
// Exports
// =========================================================
module.exports = {

  verifyStudent,

  lookupStudent,

  getApprovedStudents,

  fetchStudentFromProvider,

  fetchAllApprovedStudentsList,

  normalizeRegisterNumber
};