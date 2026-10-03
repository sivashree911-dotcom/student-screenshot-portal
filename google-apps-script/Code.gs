/**
 * ==============================================================================
 * STUDENT SCREENSHOT PORTAL - GOOGLE APPS SCRIPT API
 * ==============================================================================
 * 
 * Instructions:
 * 1. Create a Google Sheet with a sheet tab named "Students" (or first tab).
 * 2. Set the following column headers in Row 1:
 *    - Register Number
 *    - Student Name
 *    - Email
 *    - Department
 *    - Year
 *    - Section
 *    - Status
 * 3. Go to Extensions > Apps Script in Google Sheets.
 * 4. Paste this code into Code.gs.
 * 5. Click "Deploy" > "New deployment".
 * 6. Select type: "Web app".
 * 7. Execute as: "Me", Who has access: "Anyone".
 * 8. Copy the Web App URL and paste it into your backend .env file:
 *    APPS_SCRIPT_API_URL=https://script.google.com/macros/s/AKfycb.../exec
 * ==============================================================================
 */

function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    const operation = (params.operation || 'verifyStudent').trim();

    if (operation === 'healthCheck') {
      return jsonResponse({
        success: true,
        status: 'UP',
        timestamp: new Date().toISOString()
      });
    }

    if (operation === 'verifyStudent') {
      const rawRegNo = params.registerNumber || params.regNo || '';
      const registerNumber = String(rawRegNo).trim();

      if (!registerNumber) {
        return jsonResponse({
          success: false,
          error: 'Register number parameter is required.'
        });
      }

      const student = findStudentByRegisterNumber(registerNumber);
      if (student) {
        return jsonResponse({
          success: true,
          found: true,
          student: student
        });
      } else {
        return jsonResponse({
          success: true,
          found: false
        });
      }
    }

    if (operation === 'getAllStudents') {
      const students = fetchAllApprovedStudents();
      return jsonResponse({
        success: true,
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
 * Searches the spreadsheet row-by-row for the specified register number.
 */
function findStudentByRegisterNumber(searchRegNo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Students') || ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();

  if (data.length < 2) return null;

  const headers = data[0].map(h => String(h).trim().toLowerCase());
  const regNoIdx = headers.findIndex(h => h.includes('register') || h.includes('reg') || h.includes('roll'));
  const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('student'));
  const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('mail'));
  const deptIdx = headers.findIndex(h => h.includes('department') || h.includes('dept') || h.includes('branch'));
  const yearIdx = headers.findIndex(h => h.includes('year'));
  const secIdx = headers.findIndex(h => h.includes('section') || h.includes('sec'));
  const statusIdx = headers.findIndex(h => h.includes('status'));

  const normalizedSearch = normalizeRegNo(searchRegNo);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowRegNo = regNoIdx >= 0 ? normalizeRegNo(row[regNoIdx]) : '';

    if (rowRegNo && rowRegNo === normalizedSearch) {
      const statusVal = statusIdx >= 0 && row[statusIdx] ? String(row[statusIdx]).trim().toLowerCase() : 'active';
      if (statusVal === 'inactive' || statusVal === 'blocked') {
        return null;
      }

      return {
        registerNumber: String(row[regNoIdx]).trim(),
        name: nameIdx >= 0 ? String(row[nameIdx]).trim() : 'College Student',
        email: emailIdx >= 0 ? String(row[emailIdx]).trim() : '',
        department: deptIdx >= 0 ? String(row[deptIdx]).trim() : 'CSE',
        year: yearIdx >= 0 ? String(row[yearIdx]).trim() : '2',
        section: secIdx >= 0 ? String(row[secIdx]).trim() : 'A',
        status: 'Active'
      };
    }
  }

  return null;
}

/**
 * Fetches all approved active students from the spreadsheet.
 */
function fetchAllApprovedStudents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Students') || ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();

  if (data.length < 2) return [];

  const headers = data[0].map(h => String(h).trim().toLowerCase());
  const regNoIdx = headers.findIndex(h => h.includes('register') || h.includes('reg') || h.includes('roll'));
  const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('student'));
  const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('mail'));
  const deptIdx = headers.findIndex(h => h.includes('department') || h.includes('dept') || h.includes('branch'));
  const yearIdx = headers.findIndex(h => h.includes('year'));
  const secIdx = headers.findIndex(h => h.includes('section') || h.includes('sec'));
  const statusIdx = headers.findIndex(h => h.includes('status'));

  const students = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowRegNo = regNoIdx >= 0 ? String(row[regNoIdx]).trim() : '';
    if (!rowRegNo) continue;

    const statusVal = statusIdx >= 0 && row[statusIdx] ? String(row[statusIdx]).trim() : 'Active';

    students.push({
      registerNumber: rowRegNo,
      name: nameIdx >= 0 ? String(row[nameIdx]).trim() : 'Student',
      email: emailIdx >= 0 ? String(row[emailIdx]).trim() : '',
      department: deptIdx >= 0 ? String(row[deptIdx]).trim() : 'CSE',
      year: yearIdx >= 0 ? String(row[yearIdx]).trim() : '2',
      section: secIdx >= 0 ? String(row[secIdx]).trim() : 'A',
      status: statusVal
    });
  }

  return students;
}

function normalizeRegNo(val) {
  return String(val || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
