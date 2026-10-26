/**
 * ==============================================================================
 * STUDENT SCREENSHOT PORTAL - GOOGLE APPS SCRIPT API
 * ==============================================================================
 * 
 * Target Worksheet: "Elite Students" (with fallback to "Students" / first sheet)
 * Supported Operations:
 *   - verifyStudent (param: registerNumber or regNo)
 *   - getAllStudents
 *   - healthCheck
 * 
 * ==============================================================================
 */

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    let operation = (params.operation || '').trim();

    // Default operation detection if not explicitly specified
    if (!operation) {
      if (params.registerNumber || params.regNo) {
        operation = 'verifyStudent';
      } else {
        operation = 'getAllStudents';
      }
    }

    if (operation === 'healthCheck') {
      return jsonResponse({
        success: true,
        status: 'UP',
        service: 'Elite Students Verification Service',
        timestamp: new Date().toISOString()
      });
    }

    if (operation === 'verifyStudent') {
      const rawRegNo = params.registerNumber || params.regNo || '';
      const normalizedSearch = normalizeRegNo(rawRegNo);

      if (!normalizedSearch) {
        return jsonResponse({
          success: false,
          error: 'Register number parameter is required and cannot be empty.'
        });
      }

      const student = findStudentByRegisterNumber(normalizedSearch);
      if (student) {
        return jsonResponse({
          success: true,
          found: true,
          message: 'Student verified successfully.',
          student: student
        });
      } else {
        return jsonResponse({
          success: true,
          found: false,
          message: 'Register Number not found.'
        });
      }
    }

    if (operation === 'getAllStudents') {
      const students = fetchAllApprovedStudents();
      return jsonResponse({
        success: true,
        status: 'ok',
        service: 'Elite Students Verification Service',
        count: students.length,
        students: students
      });
    }

    return jsonResponse({
      success: false,
      error: 'Unknown operation. Supported operations: verifyStudent, getAllStudents, healthCheck'
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message || 'Internal server error while processing Google Sheet request.'
    });
  }
}

/**
 * Helper to safely resolve the authoritative worksheet.
 * Prioritizes 'Elite Students', then 'Students', then case-insensitive matching.
 */
function getTargetSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Unable to access active spreadsheet.');
  }

  // 1. Direct name match: 'Elite Students'
  let sheet = ss.getSheetByName('Elite Students');
  if (sheet) return sheet;

  // 2. Direct name match: 'Students' or 'Approved Students'
  sheet = ss.getSheetByName('Students') || ss.getSheetByName('Approved Students');
  if (sheet) return sheet;

  // 3. Case-insensitive search
  const sheets = ss.getSheets();
  for (let s of sheets) {
    const sName = s.getName().trim().toLowerCase();
    if (sName.includes('elite') || sName.includes('student') || sName.includes('approved')) {
      return s;
    }
  }

  // 4. Default to first sheet
  return sheets.length > 0 ? sheets[0] : null;
}

/**
 * Maps column indices dynamically from row 1 header values.
 */
function getColumnMapping(headerRow) {
  const headers = headerRow.map(h => String(h || '').trim().toLowerCase());

  const findIdx = (patterns) => {
    return headers.findIndex(h => patterns.some(p => p.test(h)));
  };

  const regNoIdx = findIdx([
    /^register\s*(number|no\.?)$/i,
    /register/i,
    /^reg\.?\s*(no\.?|number)?$/i,
    /roll\s*(no\.?|number)?/i,
    /htno/i,
    /^id$/i
  ]);

  const nameIdx = findIdx([
    /^student\s*name$/i,
    /^full\s*name$/i,
    /^name$/i,
    /student/i
  ]);

  const emailIdx = findIdx([
    /^e-?mail\s*(id|address)?$/i,
    /mail/i
  ]);

  const deptIdx = findIdx([
    /^department$/i,
    /^dept\.?$/i,
    /^branch$/i,
    /^course$/i
  ]);

  const yearIdx = findIdx([
    /^year$/i,
    /^yr\.?$/i,
    /^class$/i
  ]);

  const secIdx = findIdx([
    /^section$/i,
    /^sec\.?$/i
  ]);

  const statusIdx = findIdx([
    /^status$/i,
    /^state$/i,
    /^approval$/i
  ]);

  return { regNoIdx, nameIdx, emailIdx, deptIdx, yearIdx, secIdx, statusIdx };
}

/**
 * Searches the spreadsheet row-by-row for the specified normalized register number.
 */
function findStudentByRegisterNumber(normalizedSearch) {
  const sheet = getTargetSheet();
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return null;

  const mapping = getColumnMapping(data[0]);
  if (mapping.regNoIdx < 0) {
    // If no register number header was detected, fallback to column 0
    mapping.regNoIdx = 0;
  }

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const cellValue = row[mapping.regNoIdx];
    if (cellValue === undefined || cellValue === null || String(cellValue).trim() === '') {
      continue;
    }

    const rowRegNoNormalized = normalizeRegNo(cellValue);

    if (rowRegNoNormalized === normalizedSearch) {
      // Check status if status column exists
      let statusVal = 'Active';
      if (mapping.statusIdx >= 0 && row[mapping.statusIdx]) {
        statusVal = String(row[mapping.statusIdx]).trim();
      }

      const statusLower = statusVal.toLowerCase();
      if (
        statusLower === 'inactive' ||
        statusLower === 'blocked' ||
        statusLower === 'rejected' ||
        statusLower === 'unapproved' ||
        statusLower === 'disabled'
      ) {
        return null; // Explicitly inactive / unapproved
      }

      const rawName = mapping.nameIdx >= 0 && row[mapping.nameIdx] ? String(row[mapping.nameIdx]).trim() : '';
      const rawDept = mapping.deptIdx >= 0 && row[mapping.deptIdx] ? String(row[mapping.deptIdx]).trim() : '';
      const rawYear = mapping.yearIdx >= 0 && row[mapping.yearIdx] ? String(row[mapping.yearIdx]).trim() : '';
      const rawSec = mapping.secIdx >= 0 && row[mapping.secIdx] ? String(row[mapping.secIdx]).trim() : '';
      const rawEmail = mapping.emailIdx >= 0 && row[mapping.emailIdx] ? String(row[mapping.emailIdx]).trim() : '';

      return {
        registerNumber: String(cellValue).trim(),
        name: rawName || 'College Student',
        email: rawEmail || '',
        department: rawDept || 'CSE',
        year: rawYear || 'II',
        section: rawSec || 'A',
        status: statusVal || 'Active'
      };
    }
  }

  return null;
}

/**
 * Fetches all approved active students from the spreadsheet.
 */
function fetchAllApprovedStudents() {
  const sheet = getTargetSheet();
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return [];

  const mapping = getColumnMapping(data[0]);
  if (mapping.regNoIdx < 0) {
    mapping.regNoIdx = 0;
  }

  const students = [];
  const seenRegNos = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const cellValue = row[mapping.regNoIdx];
    if (cellValue === undefined || cellValue === null || String(cellValue).trim() === '') {
      continue;
    }

    const rowRegNo = String(cellValue).trim();
    const normalizedReg = normalizeRegNo(rowRegNo);
    if (!normalizedReg) continue;

    // Skip duplicates
    if (seenRegNos[normalizedReg]) {
      continue;
    }
    seenRegNos[normalizedReg] = true;

    // Check status
    let statusVal = 'Active';
    if (mapping.statusIdx >= 0 && row[mapping.statusIdx]) {
      statusVal = String(row[mapping.statusIdx]).trim();
    }

    const statusLower = statusVal.toLowerCase();
    if (
      statusLower === 'inactive' ||
      statusLower === 'blocked' ||
      statusLower === 'rejected' ||
      statusLower === 'unapproved' ||
      statusLower === 'disabled'
    ) {
      continue;
    }

    const rawName = mapping.nameIdx >= 0 && row[mapping.nameIdx] ? String(row[mapping.nameIdx]).trim() : '';
    const rawDept = mapping.deptIdx >= 0 && row[mapping.deptIdx] ? String(row[mapping.deptIdx]).trim() : '';
    const rawYear = mapping.yearIdx >= 0 && row[mapping.yearIdx] ? String(row[mapping.yearIdx]).trim() : '';
    const rawSec = mapping.secIdx >= 0 && row[mapping.secIdx] ? String(row[mapping.secIdx]).trim() : '';
    const rawEmail = mapping.emailIdx >= 0 && row[mapping.emailIdx] ? String(row[mapping.emailIdx]).trim() : '';

    students.push({
      registerNumber: rowRegNo,
      name: rawName || 'Student',
      email: rawEmail || '',
      department: rawDept || 'CSE',
      year: rawYear || 'II',
      section: rawSec || 'A',
      status: statusVal || 'Active'
    });
  }

  return students;
}

/**
 * Strict register-number normalization consistent across frontend, backend, and Apps Script.
 * Preserves leading digits and alphanumeric characters without precision loss.
 */
function normalizeRegNo(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
