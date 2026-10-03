const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// Helper to load sample students fallback
function getLocalApprovedStudents() {
  const filePath = path.join(__dirname, '..', 'data', 'sampleStudents.json');
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Error reading sample students file:', e);
    }
  }
  return [];
}

/**
 * Normalizes a register number for reliable comparison
 */
function normalizeRegisterNumber(val) {
  if (!val) return '';
  return String(val)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Verifies a single student against Google Apps Script or fallback dataset
 */
async function fetchStudentFromProvider(normalizedRegNo) {
  // 1. Try Google Apps Script API if configured
  if (config.appsScriptApiUrl && config.appsScriptApiUrl.startsWith('http')) {
    try {
      const url = `${config.appsScriptApiUrl}?operation=verifyStudent&registerNumber=${encodeURIComponent(normalizedRegNo)}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data && data.success) {
          if (data.found && data.student) {
            return {
              found: true,
              source: 'google_sheets',
              student: {
                registerNumber: String(data.student.registerNumber || normalizedRegNo).trim(),
                name: data.student.name || data.student.studentName || 'Student',
                email: data.student.email || '',
                department: data.student.department || 'CSE',
                year: String(data.student.year || '2'),
                section: String(data.student.section || 'A'),
                status: data.student.status || 'Active'
              }
            };
          } else {
            return { found: false, source: 'google_sheets' };
          }
        }
      }
    } catch (err) {
      console.warn('Google Apps Script request failed, attempting fallback:', err.message);
    }
  }

  // 2. Fallback to local approved dataset
  const localList = getLocalApprovedStudents();
  const found = localList.find(s => normalizeRegisterNumber(s.registerNumber) === normalizedRegNo);

  if (found) {
    if (found.status && String(found.status).toLowerCase() === 'inactive') {
      return { found: false, source: 'local_dataset', inactive: true };
    }
    return {
      found: true,
      source: 'local_dataset',
      student: {
        registerNumber: String(found.registerNumber).trim(),
        name: found.name,
        email: found.email || '',
        department: found.department || 'CSE',
        year: String(found.year || '2'),
        section: String(found.section || 'A'),
        status: found.status || 'Active'
      }
    };
  }

  return { found: false, source: 'local_dataset' };
}

/**
 * Fetches all approved students for Admin viewing and participation analytics
 */
async function fetchAllApprovedStudentsList() {
  if (config.appsScriptApiUrl && config.appsScriptApiUrl.startsWith('http')) {
    try {
      const url = `${config.appsScriptApiUrl}?operation=getAllStudents`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data && data.success && Array.isArray(data.students) && data.students.length > 0) {
          return data.students.map(s => ({
            registerNumber: String(s.registerNumber).trim(),
            name: s.name || 'Student',
            email: s.email || '',
            department: s.department || 'CSE',
            year: String(s.year || '2'),
            section: String(s.section || 'A'),
            status: s.status || 'Active'
          }));
        }
      }
    } catch (err) {
      console.warn('Google Apps Script getAllStudents failed, using fallback:', err.message);
    }
  }

  return getLocalApprovedStudents();
}

/**
 * POST /api/students/verify
 * Public endpoint for students to verify their register number
 */
async function verifyStudent(req, res, next) {
  try {
    const rawRegNo = req.body.registerNumber || req.body.regNo || '';
    const normalizedRegNo = normalizeRegisterNumber(rawRegNo);

    if (!normalizedRegNo) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid register number.'
      });
    }

    const result = await fetchStudentFromProvider(normalizedRegNo);

    if (!result.found || !result.student) {
      return res.status(404).json({
        success: false,
        found: false,
        message: 'Register Number not found.\n\nPlease contact the administrator.'
      });
    }

    const student = result.student;

    // Generate secure student session token
    const token = jwt.sign(
      {
        registerNumber: student.registerNumber,
        studentName: student.name,
        department: student.department,
        year: student.year,
        email: student.email,
        role: 'student'
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      success: true,
      found: true,
      message: `Student verified successfully. Welcome, ${student.name}!`,
      token,
      student: {
        registerNumber: student.registerNumber,
        name: student.name,
        department: student.department,
        year: student.year,
        section: student.section,
        email: student.email
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/students/lookup
 * Endpoint to validate team members by register number
 * Accessible by authenticated students during team member addition
 */
async function lookupStudent(req, res, next) {
  try {
    const rawRegNo = req.body.registerNumber || req.query.registerNumber || '';
    const normalizedRegNo = normalizeRegisterNumber(rawRegNo);

    if (!normalizedRegNo) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a register number.'
      });
    }

    const result = await fetchStudentFromProvider(normalizedRegNo);

    if (!result.found || !result.student) {
      return res.status(404).json({
        success: false,
        found: false,
        message: 'This register number is not in the approved student list.'
      });
    }

    res.json({
      success: true,
      found: true,
      student: {
        registerNumber: result.student.registerNumber,
        name: result.student.name,
        department: result.student.department,
        year: result.student.year,
        section: result.student.section,
        email: result.student.email
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/students
 * Admin endpoint to list and search approved students
 */
async function getApprovedStudents(req, res, next) {
  try {
    const { search, department, year } = req.query;
    let students = await fetchAllApprovedStudentsList();

    if (search) {
      const q = search.toLowerCase().trim();
      students = students.filter(s =>
        s.registerNumber.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q))
      );
    }

    if (department && department !== 'All') {
      students = students.filter(s => s.department === department);
    }

    if (year && year !== 'All') {
      students = students.filter(s => String(s.year) === String(year));
    }

    res.json({
      success: true,
      total: students.length,
      students
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  verifyStudent,
  lookupStudent,
  getApprovedStudents,
  fetchStudentFromProvider,
  fetchAllApprovedStudentsList,
  normalizeRegisterNumber
};
