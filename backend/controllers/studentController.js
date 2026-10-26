const jwt = require('jsonwebtoken');
const config = require('../config/config');

// =========================================================
// Consistent Register Number Normalization
// =========================================================
function normalizeRegisterNumber(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

// =========================================================
// In-Memory Authoritative Roster Cache & Stampede Protection
// =========================================================
const rosterCache = {
  students: [],
  studentsMap: new Map(), // normalizedRegNo -> student object
  lastFetched: 0,
  ttlMs: 5 * 60 * 1000, // 5 minutes cache TTL
  inFlightPromise: null
};

/**
 * Invalidate or refresh the in-memory roster cache.
 */
function invalidateRosterCache() {
  rosterCache.lastFetched = 0;
  rosterCache.students = [];
  rosterCache.studentsMap.clear();
  rosterCache.inFlightPromise = null;
}

// =========================================================
// Call Google Apps Script with timeout
// =========================================================
async function callAppsScript(url, timeoutMs = 12000) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

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
    if (error.name === 'AbortError') {
      throw new Error(`Google Apps Script request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Normalizes a raw student record into standard portal format
 */
function formatStudentRecord(student, fallbackRegNo = '') {
  if (!student) return null;

  const rawReg = student.registerNumber || student.regNo || fallbackRegNo;
  const regNo = String(rawReg || '').trim();
  const normalizedReg = normalizeRegisterNumber(regNo);

  if (!normalizedReg) return null;

  return {
    registerNumber: regNo,
    normalizedRegisterNumber: normalizedReg,
    name: String(student.name || student.studentName || 'Student').trim(),
    email: String(student.email || '').trim(),
    department: String(student.department || student.dept || 'CSE').trim(),
    year: String(student.year || 'II').trim(),
    section: String(student.section || 'A').trim(),
    status: String(student.status || 'Active').trim()
  };
}

// =========================================================
// Authoritative Roster Retrieval
// =========================================================
async function getOrFetchRoster(forceRefresh = false) {
  const now = Date.now();

  // Return existing cache if still fresh and not empty
  if (
    !forceRefresh &&
    rosterCache.lastFetched > 0 &&
    now - rosterCache.lastFetched < rosterCache.ttlMs &&
    rosterCache.students.length > 0
  ) {
    return rosterCache.students;
  }

  // Stampede protection: reuse in-flight fetch promise if one is already running
  if (rosterCache.inFlightPromise) {
    return await rosterCache.inFlightPromise;
  }

  if (
    !config.appsScriptApiUrl ||
    !config.appsScriptApiUrl.startsWith('http')
  ) {
    throw new Error('Google Apps Script API URL is not configured or invalid.');
  }

  rosterCache.inFlightPromise = (async () => {
    try {
      const url = `${config.appsScriptApiUrl}?operation=getAllStudents`;
      const data = await callAppsScript(url, 12000);

      if (
        !data ||
        data.success !== true ||
        !Array.isArray(data.students)
      ) {
        throw new Error(data?.error || 'Invalid or unsuccessful roster response from Google Apps Script.');
      }

      const formattedStudents = [];
      const newMap = new Map();

      for (const raw of data.students) {
        const student = formatStudentRecord(raw);
        if (student && student.normalizedRegisterNumber) {
          // If status is inactive/blocked, do not add to approved list
          const st = student.status.toLowerCase();
          if (st === 'inactive' || st === 'blocked' || st === 'rejected' || st === 'unapproved') {
            continue;
          }

          formattedStudents.push(student);
          newMap.set(student.normalizedRegisterNumber, student);
        }
      }

      rosterCache.students = formattedStudents;
      rosterCache.studentsMap = newMap;
      rosterCache.lastFetched = Date.now();

      return formattedStudents;
    } finally {
      rosterCache.inFlightPromise = null;
    }
  })();

  return await rosterCache.inFlightPromise;
}

// =========================================================
// Fetch one student from Provider (Roster Cache + Live Fallback)
// =========================================================
async function fetchStudentFromProvider(rawRegNo, options = {}) {
  const normalizedRegNo = normalizeRegisterNumber(rawRegNo);

  if (!normalizedRegNo) {
    return {
      found: false,
      serviceUnavailable: false,
      status: 'INVALID_INPUT',
      message: 'Register number cannot be empty.',
      source: 'google_sheets'
    };
  }

  if (
    !config.appsScriptApiUrl ||
    !config.appsScriptApiUrl.startsWith('http')
  ) {
    return {
      found: false,
      serviceUnavailable: true,
      status: 'SERVICE_UNAVAILABLE',
      message: 'Google Apps Script API URL is not configured.',
      source: 'google_sheets'
    };
  }

  let rosterError = null;

  // 1. Try authoritative roster cache first
  try {
    await getOrFetchRoster(options.forceRefresh || false);
    const cachedStudent = rosterCache.studentsMap.get(normalizedRegNo);

    if (cachedStudent) {
      return {
        found: true,
        serviceUnavailable: false,
        status: 'VERIFIED',
        source: 'google_sheets',
        student: cachedStudent
      };
    }
  } catch (err) {
    rosterError = err;
    console.warn('[Student Verification] Roster fetch warning:', err.message);
  }

  // 2. Query individual verification endpoint directly
  try {
    const url =
      `${config.appsScriptApiUrl}` +
      `?operation=verifyStudent` +
      `&registerNumber=${encodeURIComponent(normalizedRegNo)}`;

    const data = await callAppsScript(url, 12000);

    if (!data || data.success !== true) {
      // If data is returned with success === false, it is a service/script error
      return {
        found: false,
        serviceUnavailable: true,
        status: 'SERVICE_UNAVAILABLE',
        message: data?.error || 'Google Apps Script returned an unsuccessful response.',
        source: 'google_sheets'
      };
    }

    if (data.found && data.student) {
      const student = formatStudentRecord(data.student, normalizedRegNo);

      if (student) {
        // Exclude records that are explicitly inactive or unapproved
        const st = student.status.toLowerCase();
        if (st === 'inactive' || st === 'blocked' || st === 'rejected' || st === 'unapproved') {
          return {
            found: false,
            serviceUnavailable: false,
            status: 'NOT_APPROVED',
            message: 'Student record is inactive or unapproved.',
            source: 'google_sheets'
          };
        }

        // Add to cache so subsequent lookups are instant
        rosterCache.studentsMap.set(student.normalizedRegisterNumber, student);
        if (!rosterCache.students.some(s => s.normalizedRegisterNumber === student.normalizedRegisterNumber)) {
          rosterCache.students.push(student);
        }

        return {
          found: true,
          serviceUnavailable: false,
          status: 'VERIFIED',
          source: 'google_sheets',
          student
        };
      }
    }

    // Genuinely not found in spreadsheet
    return {
      found: false,
      serviceUnavailable: false,
      status: 'NOT_APPROVED',
      message: 'This register number was not found in the approved student list.',
      source: 'google_sheets'
    };

  } catch (error) {
    console.error(
      '[Student Verification] Google Apps Script individual query failed:',
      error.message
    );

    // If both roster fetch and individual query failed, return SERVICE_UNAVAILABLE
    return {
      found: false,
      serviceUnavailable: true,
      status: 'SERVICE_UNAVAILABLE',
      message: 'Student verification service is temporarily unavailable. Please try again.',
      source: 'google_sheets',
      error: error.message
    };
  }
}

// =========================================================
// Fetch all approved students
// Used by Admin dashboard, participation reports, and roster cache
// =========================================================
async function fetchAllApprovedStudentsList(forceRefresh = false) {
  try {
    const students = await getOrFetchRoster(forceRefresh);
    return students;
  } catch (error) {
    console.error(
      '[Student List] Failed to fetch approved students list:',
      error.message
    );
    // Return existing cached students if available, otherwise empty array
    return rosterCache.students || [];
  }
}

// =========================================================
// POST /api/students/verify
// Student enters register number for initial portal login.
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
        status: 'INVALID_INPUT',
        message: 'Please enter a valid register number.'
      });
    }

    const result =
      await fetchStudentFromProvider(normalizedRegNo);

    // Google Apps Script unavailable
    if (result.serviceUnavailable) {
      return res.status(503).json({
        success: false,
        found: false,
        serviceUnavailable: true,
        status: 'SERVICE_UNAVAILABLE',
        message:
          'Student verification service is temporarily unavailable. Please try again later.'
      });
    }

    // Student not found in approved Google Sheet
    if (!result.found || !result.student) {
      return res.status(404).json({
        success: false,
        found: false,
        serviceUnavailable: false,
        status: 'NOT_APPROVED',
        message:
          'Register Number not found in the approved student list. Please contact the administrator.'
      });
    }

    const student = result.student;

    // Create JWT student session
    const token = jwt.sign(
      {
        registerNumber: student.registerNumber,
        normalizedRegisterNumber: student.normalizedRegisterNumber,
        studentName: student.name,
        department: student.department,
        year: student.year,
        email: student.email,
        role: 'student'
      },
      config.jwt.secret,
      {
        expiresIn: config.jwt.expiresIn
      }
    );

    return res.json({
      success: true,
      found: true,
      status: 'VERIFIED',
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

// =========================================================
// POST /api/students/lookup
// Used when adding team members during hackathon registration.
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
        status: 'INVALID_INPUT',
        message: 'Please provide a valid register number.'
      });
    }

    const result =
      await fetchStudentFromProvider(normalizedRegNo);

    if (result.serviceUnavailable) {
      return res.status(503).json({
        success: false,
        found: false,
        serviceUnavailable: true,
        status: 'SERVICE_UNAVAILABLE',
        message:
          'Student verification service is temporarily unavailable. Please try again.'
      });
    }

    if (!result.found || !result.student) {
      return res.status(404).json({
        success: false,
        found: false,
        serviceUnavailable: false,
        status: 'NOT_APPROVED',
        message:
          'This register number was not found in the approved student list.'
      });
    }

    return res.json({
      success: true,
      found: true,
      status: 'VERIFIED',
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

// =========================================================
// GET /api/admin/students
// Admin dashboard student list with search, filter, and refresh.
// =========================================================
async function getApprovedStudents(req, res, next) {
  try {
    const {
      search,
      department,
      year,
      refresh
    } = req.query;

    const forceRefresh = refresh === 'true' || refresh === '1';
    let students = await fetchAllApprovedStudentsList(forceRefresh);

    if (search) {
      const q = search.toLowerCase().trim();
      students = students.filter(
        (student) =>
          student.registerNumber.toLowerCase().includes(q) ||
          student.name.toLowerCase().includes(q) ||
          (student.email && student.email.toLowerCase().includes(q))
      );
    }

    if (department && department !== 'All') {
      students = students.filter(
        (student) => student.department === department
      );
    }

    if (year && year !== 'All') {
      students = students.filter(
        (student) => String(student.year).toLowerCase() === String(year).toLowerCase()
      );
    }

    return res.json({
      success: true,
      total: students.length,
      cachedAt: new Date(rosterCache.lastFetched).toISOString(),
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
  normalizeRegisterNumber,
  invalidateRosterCache
};