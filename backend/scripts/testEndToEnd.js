/**
 * Comprehensive End-to-End Test Suite for Student Screenshot Portal
 * Tests:
 * 1. Health check
 * 2. Student Verification (Invalid reg no -> 404, Valid reg no 1300 -> JWT + student profile)
 * 3. Team Member Lookup (1301 -> Bhavya Srikanth, Invalid 9999 -> 404)
 * 4. Hackathon Listing & Details
 * 5. Student Proof Submission with FormData, Captain & Team Members
 * 6. Student "My Submissions" list
 * 7. Admin Authentication (Wrong password -> 401, Valid credentials -> JWT token)
 * 8. Admin Dashboard statistics
 * 9. Admin Submissions review & Verification
 * 10. Hackathon Participation metrics calculation (Total, Participated, Not Participated, Duplicate detection)
 * 11. Participation Matrix Report & CSV Export
 */

const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5000/api';

let studentToken = '';
let adminToken = '';
let testSubmissionId = '';
let testSubmissionDbId = '';

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

  // 2. Student Verification
  console.log('\n2. Testing Student Register Number Verification...');
  try {
    // 2a. Invalid Register Number
    const resInvalid = await fetch(`${API_BASE}/students/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registerNumber: '999999' })
    });
    const dataInvalid = await resInvalid.json();
    assert(resInvalid.status === 404 && dataInvalid.found === false, 'Invalid register number 999999 correctly rejected with 404 Not Found');

    // 2b. Valid Register Number (1300)
    const resValid = await fetch(`${API_BASE}/students/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registerNumber: '1300' })
    });
    const dataValid = await resValid.json();
    assert(resValid.status === 200 && dataValid.found === true && dataValid.student.registerNumber === '1300', 'Valid student 1300 verified successfully (Arjun Sundaram)');
    assert(Boolean(dataValid.token), 'Student session JWT token issued successfully');
    studentToken = dataValid.token;
  } catch (e) {
    assert(false, `Student verification failed: ${e.message}`);
  }

  // 3. Team Member Lookup
  console.log('\n3. Testing Team Member Lookup & Validation...');
  try {
    const resLookup = await fetch(`${API_BASE}/students/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({ registerNumber: '1301' })
    });
    const dataLookup = await resLookup.json();
    assert(resLookup.status === 200 && dataLookup.found === true && dataLookup.student.name === 'Bhavya Srikanth', 'Lookup 1301 correctly returns Bhavya Srikanth');

    const resLookupInvalid = await fetch(`${API_BASE}/students/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({ registerNumber: '8888' })
    });
    assert(resLookupInvalid.status === 404, 'Invalid team member lookup correctly rejected');
  } catch (e) {
    assert(false, `Member lookup failed: ${e.message}`);
  }

  // 4. Hackathon Listing
  console.log('\n4. Testing Hackathon Directory...');
  let hackathonId = 1;
  try {
    const resHacks = await fetch(`${API_BASE}/hackathons`);
    const dataHacks = await resHacks.json();
    assert(resHacks.status === 200 && Array.isArray(dataHacks.hackathons) && dataHacks.hackathons.length > 0, `Active hackathons listing returned ${dataHacks.hackathons?.length} events`);
    hackathonId = dataHacks.hackathons[0].id;

    const resSingle = await fetch(`${API_BASE}/hackathons/${hackathonId}`);
    const dataSingle = await resSingle.json();
    assert(resSingle.status === 200 && dataSingle.hackathon.id === hackathonId, `Hackathon ${hackathonId} details retrieved: ${dataSingle.hackathon?.name}`);
  } catch (e) {
    assert(false, `Hackathon listing failed: ${e.message}`);
  }

  // 5. Student Proof Submission
  console.log('\n5. Testing Hackathon Proof Submission with Screenshot & Team Members...');
  try {
    const screenshotPath = path.join(__dirname, '..', 'data', 'test_registration_screenshot.png');
    const fileBuffer = fs.readFileSync(screenshotPath);
    const fileBlob = new Blob([fileBuffer], { type: 'image/png' });

    const members = [
      {
        registerNumber: '1300',
        name: 'Arjun Sundaram',
        department: 'CSE',
        year: '2',
        section: 'A',
        memberType: 'College',
        institution: 'College',
        email: '1300@college.edu',
        isCaptain: true
      },
      {
        registerNumber: '1301',
        name: 'Bhavya Srikanth',
        department: 'CSE',
        year: '2',
        section: 'A',
        memberType: 'College',
        institution: 'College',
        email: '1301@college.edu',
        isCaptain: false
      },
      {
        registerNumber: '1302',
        name: 'Chirag Patel',
        department: 'CSE',
        year: '2',
        section: 'B',
        memberType: 'College',
        institution: 'College',
        email: '1302@college.edu',
        isCaptain: false
      }
    ];

    const formData = new FormData();
    formData.append('hackathonId', String(hackathonId));
    formData.append('membersData', JSON.stringify(members));
    formData.append('screenshot', fileBlob, 'test_registration_proof.png');

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

  // 6. Student "My Submissions"
  console.log('\n6. Testing Student "My Submissions" Tracking...');
  try {
    const resMy = await fetch(`${API_BASE}/submissions/my`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    const dataMy = await resMy.json();
    assert(resMy.status === 200 && Array.isArray(dataMy.submissions) && dataMy.submissions.length > 0, `My Submissions returned ${dataMy.submissions?.length} record(s)`);
    const foundSub = dataMy.submissions.find(s => s.submission_id === testSubmissionId);
    assert(Boolean(foundSub), `Submitted proof ${testSubmissionId} is present in student's list with status '${foundSub?.status}'`);
    if (foundSub) testSubmissionDbId = foundSub.id;
  } catch (e) {
    assert(false, `My submissions failed: ${e.message}`);
  }

  // 7. Admin Authentication
  console.log('\n7. Testing Admin Authentication...');
  try {
    // 7a. Wrong credentials
    const resWrong = await fetch(`${API_BASE}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@college.edu', password: 'WrongPassword123' })
    });
    assert(resWrong.status === 401, 'Incorrect admin password rejected with 401 Unauthorized');

    // 7b. Correct credentials
    const resAdmin = await fetch(`${API_BASE}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@college.edu', password: 'AdminPassword@123' })
    });
    const dataAdmin = await resAdmin.json();
    assert(resAdmin.status === 200 && dataAdmin.success === true && Boolean(dataAdmin.token), 'Admin logged in successfully and received JWT token');
    adminToken = dataAdmin.token;
  } catch (e) {
    assert(false, `Admin authentication failed: ${e.message}`);
  }

  // 8. Admin Dashboard & Metrics
  console.log('\n8. Testing Admin Dashboard Metrics...');
  try {
    const resDash = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dataDash = await resDash.json();
    assert(resDash.status === 200 && dataDash.stats.totalStudents > 0, `Dashboard stats retrieved: Total Students = ${dataDash.stats?.totalStudents}, Total Submissions = ${dataDash.stats?.totalSubmissions}, Pending = ${dataDash.stats?.pendingSubmissions}`);
  } catch (e) {
    assert(false, `Admin dashboard failed: ${e.message}`);
  }

  // 9. Admin Submission Verification
  console.log('\n9. Testing Admin Submission Verification Action...');
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

  // 10. Participation Calculation
  console.log('\n10. Testing Hackathon Participation Calculation...');
  try {
    const resPart = await fetch(`${API_BASE}/participation/hackathon/${hackathonId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dataPart = await resPart.json();
    assert(resPart.status === 200 && dataPart.success === true, `Participation computed for ${dataPart.hackathon?.name}`);
    assert(dataPart.summary?.participatedCount >= 3, `Verified team members counted as participating: ${dataPart.summary?.participatedCount} students (Turnout: ${dataPart.summary?.participationRate}%)`);
    assert(dataPart.summary?.notParticipatedCount > 0, `Nonparticipating approved students counted: ${dataPart.summary?.notParticipatedCount} students`);

    // Verify all 3 team members (1300, 1301, 1302) are in participated list
    const partRegs = dataPart.participatedStudents.map(s => s.registerNumber);
    const hasAllThree = ['1300', '1301', '1302'].every(r => partRegs.includes(r));
    assert(hasAllThree, 'All verified team members (1300, 1301, 1302) correctly listed in Participated Students');
  } catch (e) {
    assert(false, `Participation calculation failed: ${e.message}`);
  }

  // 11. Participation Matrix & CSV Export
  console.log('\n11. Testing Participation Matrix & CSV Export...');
  try {
    const resMatrix = await fetch(`${API_BASE}/participation/reports/matrix`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dataMatrix = await resMatrix.json();
    assert(resMatrix.status === 200 && Array.isArray(dataMatrix.matrix), `Cross-hackathon matrix built with ${dataMatrix.matrix?.length} students and ${dataMatrix.hackathons?.length} events`);

    const resCsv = await fetch(`${API_BASE}/participation/hackathon/${hackathonId}/export-csv`, {
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
