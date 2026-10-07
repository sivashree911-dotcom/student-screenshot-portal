/**
 * Comprehensive End-to-End Test Suite for Student Screenshot Portal
 * Tests:
 * 1. Health check
 * 2. Admin Authentication
 * 3. Admin Hackathon Creation
 * 4. Public Hackathon Listing & Details
 * 5. Student Verification from Google Apps Script
 * 6. Team Member Lookup
 * 7. Student Proof Submission
 * 8. Student "My Submissions" list
 * 9. Admin Dashboard statistics
 * 10. Admin Submissions review & Verification
 * 11. Hackathon Participation metrics calculation
 * 12. Participation Matrix Report & CSV Export
 */

const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5000/api';

let studentToken = '';
let adminToken = '';
let testHackathonId = null;
let testSubmissionId = '';
let testSubmissionDbId = '';
let sampleStudents = [];

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE END-TO-END TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Health Check
  console.log('1. Testing System Health Check...');
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    assert(res.status === 200 && data.success === true, 'Health check endpoint returns 200 OK');
  } catch (e) {
    assert(false, `Health check failed: ${e.message}`);
  }

  // 2. Admin Authentication
  console.log('\n2. Testing Admin Authentication...');
  try {
    // 2a. Wrong credentials
    const resWrong = await fetch(`${API_BASE}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@college.edu', password: 'WrongPassword123' })
    });
    assert(resWrong.status === 401, 'Incorrect admin password rejected with 401 Unauthorized');

    // 2b. Correct credentials (set via createAdmin.js)
    const resAdmin = await fetch(`${API_BASE}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@college.edu', password: 'AdminSecret@123' })
    });
    const dataAdmin = await resAdmin.json();
    assert(resAdmin.status === 200 && dataAdmin.success === true && Boolean(dataAdmin.token), 'Admin logged in successfully and received JWT token');
    adminToken = dataAdmin.token;
  } catch (e) {
    assert(false, `Admin authentication failed: ${e.message}`);
  }

  // 3. Admin Hackathon Creation
  console.log('\n3. Testing Admin Hackathon Creation...');
  try {
    const newHackathon = {
      name: `Hackathon Test ${Date.now()}`,
      institution: 'National Tech Institute',
      description: 'Annual inter-college 24-hour hackathon for innovative software solutions.',
      startDate: '2026-11-15',
      endDate: '2026-11-16',
      registrationDeadline: '2026-11-10',
      mode: 'Offline',
      location: 'Main Auditorium, Campus 1',
      minTeamSize: '1',
      maxTeamSize: '4',
      allowExternalParticipants: 'true',
      registrationUrl: 'https://hackathon-test.example.com/register',
      isActive: 'true'
    };

    const resCreate = await fetch(`${API_BASE}/hackathons/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(newHackathon)
    });

    const dataCreate = await resCreate.json();
    assert(resCreate.status === 201 && dataCreate.success === true, `Admin created hackathon successfully (ID: ${dataCreate.hackathonId})`);
    testHackathonId = dataCreate.hackathonId;
  } catch (e) {
    assert(false, `Admin hackathon creation failed: ${e.message}`);
  }

  // 4. Hackathon Directory (Public)
  console.log('\n4. Testing Public Hackathon Directory...');
  try {
    const resHacks = await fetch(`${API_BASE}/hackathons`);
    const dataHacks = await resHacks.json();
    assert(resHacks.status === 200 && Array.isArray(dataHacks.hackathons) && dataHacks.hackathons.length > 0, `Active hackathons listing returned ${dataHacks.hackathons?.length} events`);

    const foundCreated = dataHacks.hackathons.find(h => h.id === testHackathonId);
    assert(Boolean(foundCreated), `Created hackathon ${testHackathonId} is listed in public directory`);
  } catch (e) {
    assert(false, `Hackathon listing failed: ${e.message}`);
  }

  // Fetch approved student list from Google Apps Script via Admin endpoint
  try {
    const resStudents = await fetch(`${API_BASE}/students/all`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dataStudents = await resStudents.json();
    if (dataStudents.success && Array.isArray(dataStudents.students) && dataStudents.students.length > 0) {
      sampleStudents = dataStudents.students;
      console.log(`ℹ️ Retrieved ${sampleStudents.length} approved students from Google Sheets.`);
    }
  } catch (e) {}

  const student1 = sampleStudents[0] || { registerNumber: '95072514175', name: 'YASODHA M' };
  const student2 = sampleStudents[1] || { registerNumber: '95072514086', name: 'MADHAVIVANESH R' };

  // 5. Student Verification
  console.log('\n5. Testing Student Register Number Verification...');
  try {
    // 5a. Invalid Register Number
    const resInvalid = await fetch(`${API_BASE}/students/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registerNumber: 'INVALID_999999' })
    });
    const dataInvalid = await resInvalid.json();
    assert(resInvalid.status === 404 && dataInvalid.found === false, 'Invalid register number correctly rejected with 404 Not Found');

    // 5b. Valid Register Number
    const resValid = await fetch(`${API_BASE}/students/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registerNumber: student1.registerNumber })
    });
    const dataValid = await resValid.json();
    assert(
      resValid.status === 200 && dataValid.found === true && dataValid.student.registerNumber === student1.registerNumber,
      `Valid student verified successfully (${student1.name} - ${student1.registerNumber})`
    );
    assert(Boolean(dataValid.token), 'Student session JWT token issued successfully');
    studentToken = dataValid.token;
  } catch (e) {
    assert(false, `Student verification failed: ${e.message}`);
  }

  // 6. Team Member Lookup
  console.log('\n6. Testing Team Member Lookup & Validation...');
  try {
    const resLookup = await fetch(`${API_BASE}/students/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({ registerNumber: student2.registerNumber })
    });
    const dataLookup = await resLookup.json();
    assert(
      resLookup.status === 200 && dataLookup.found === true,
      `Lookup ${student2.registerNumber} correctly returns ${student2.name}`
    );

    const resLookupInvalid = await fetch(`${API_BASE}/students/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({ registerNumber: 'NON_EXISTENT_8888' })
    });
    assert(resLookupInvalid.status === 404, 'Invalid team member lookup correctly rejected');
  } catch (e) {
    assert(false, `Member lookup failed: ${e.message}`);
  }

  // 7. Student Proof Submission
  console.log('\n7. Testing Hackathon Proof Submission with Screenshot & Team Members...');
  try {
    // Create sample PNG screenshot if not present
    const testScreenshotFile = path.join(__dirname, '..', 'data', 'test_proof.png');
    if (!fs.existsSync(testScreenshotFile)) {
      // 1x1 transparent PNG buffer
      const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      fs.writeFileSync(testScreenshotFile, pngBuffer);
    }
    const fileBuffer = fs.readFileSync(testScreenshotFile);
    const fileBlob = new Blob([fileBuffer], { type: 'image/png' });

    const members = [
      {
        registerNumber: student1.registerNumber,
        name: student1.name,
        department: student1.department || 'ECE',
        year: student1.year || '2',
        section: student1.section || 'A',
        memberType: 'College',
        institution: 'College',
        email: student1.email || '',
        isCaptain: true
      },
      {
        registerNumber: student2.registerNumber,
        name: student2.name,
        department: student2.department || 'ECE',
        year: student2.year || '2',
        section: student2.section || 'A',
        memberType: 'College',
        institution: 'College',
        email: student2.email || '',
        isCaptain: false
      }
    ];

    const formData = new FormData();
    formData.append('hackathonId', String(testHackathonId));
    formData.append('membersData', JSON.stringify(members));
    formData.append('screenshot', fileBlob, 'proof.png');

    const resSub = await fetch(`${API_BASE}/submissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${studentToken}`
      },
      body: formData
    });

    const dataSub = await resSub.json();
    assert(resSub.status === 201 && dataSub.success === true, `Proof submitted successfully. Status: ${dataSub.status}`);
    assert(Boolean(dataSub.submissionId && dataSub.submissionId.startsWith('SUB-')), `Generated unique Submission ID: ${dataSub.submissionId}`);
    testSubmissionId = dataSub.submissionId;
  } catch (e) {
    assert(false, `Submission creation failed: ${e.message}`);
  }

  // 8. Student "My Submissions"
  console.log('\n8. Testing Student "My Submissions" Tracking...');
  try {
    const resMy = await fetch(`${API_BASE}/submissions/my`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    const dataMy = await resMy.json();
    assert(resMy.status === 200 && Array.isArray(dataMy.submissions) && dataMy.submissions.length > 0, `My Submissions returned ${dataMy.submissions?.length} record(s)`);
    const foundSub = dataMy.submissions.find(s => s.submission_id === testSubmissionId);
    assert(Boolean(foundSub), `Submitted proof ${testSubmissionId} is present in student list with status '${foundSub?.status}'`);
    if (foundSub) testSubmissionDbId = foundSub.id;
  } catch (e) {
    assert(false, `My submissions failed: ${e.message}`);
  }

  // 9. Admin Dashboard Metrics
  console.log('\n9. Testing Admin Dashboard Metrics...');
  try {
    const resDash = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dataDash = await resDash.json();
    assert(resDash.status === 200 && dataDash.stats.totalSubmissions > 0, `Dashboard stats: Total Submissions = ${dataDash.stats?.totalSubmissions}, Active Hackathons = ${dataDash.stats?.activeHackathons}`);
  } catch (e) {
    assert(false, `Admin dashboard failed: ${e.message}`);
  }

  // 10. Admin Submission Verification Action
  console.log('\n10. Testing Admin Submission Verification Action...');
  try {
    const resVerify = await fetch(`${API_BASE}/submissions/admin/${testSubmissionDbId}/verify`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    const dataVerify = await resVerify.json();
    assert(resVerify.status === 200 && dataVerify.status === 'Verified', `Submission ${testSubmissionId} successfully marked as 'Verified' by Administrator`);
  } catch (e) {
    assert(false, `Submission verification failed: ${e.message}`);
  }

  // 11. Participation Calculation
  console.log('\n11. Testing Hackathon Participation Calculation...');
  try {
    const resPart = await fetch(`${API_BASE}/participation/hackathon/${testHackathonId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dataPart = await resPart.json();
    assert(resPart.status === 200 && dataPart.success === true, `Participation computed for ${dataPart.hackathon?.name}`);
    assert(dataPart.summary?.participatedCount >= 2, `Verified team members counted as participating: ${dataPart.summary?.participatedCount} students`);
    assert(dataPart.summary?.notParticipatedCount > 0, `Nonparticipating students counted: ${dataPart.summary?.notParticipatedCount} students`);
  } catch (e) {
    assert(false, `Participation calculation failed: ${e.message}`);
  }

  // 12. Participation Matrix & CSV Export
  console.log('\n12. Testing Participation Matrix & CSV Export...');
  try {
    const resMatrix = await fetch(`${API_BASE}/participation/reports/matrix`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dataMatrix = await resMatrix.json();
    assert(resMatrix.status === 200 && Array.isArray(dataMatrix.matrix), `Cross-hackathon matrix built with ${dataMatrix.matrix?.length} students and ${dataMatrix.hackathons?.length} events`);

    const resCsv = await fetch(`${API_BASE}/participation/hackathon/${testHackathonId}/export-csv`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const csvText = await resCsv.text();
    assert(resCsv.status === 200 && csvText.includes('Register Number') && csvText.includes('Participated'), 'Participation CSV export generated with valid CSV headers and records');
  } catch (e) {
    assert(false, `Matrix / CSV export failed: ${e.message}`);
  }

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed === 0) {
    console.log('🎉 ALL INTEGRATION & BUSINESS LOGIC TESTS PASSED PERFECTLY!');
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
