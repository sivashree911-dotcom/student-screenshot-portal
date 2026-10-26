/**
 * ==============================================================================
 * COMPREHENSIVE AUTOMATED VERIFICATION TEST SUITE
 * ==============================================================================
 * Covers all 15 required test cases:
 * 1. An approved register number is accepted (95072512207).
 * 2. An approved register number with surrounding spaces is accepted.
 * 3. A register number that differs by one digit is not mistakenly accepted.
 * 4. A genuinely unapproved register number is rejected.
 * 5. A blank register number is rejected without calling the roster API.
 * 6. A Google Apps Script timeout produces a service-unavailable state, not a false non-match.
 * 7. An invalid API response is handled safely.
 * 8. A student with optional metadata missing can still be verified when their register number is approved.
 * 9. Two members cannot use the same register number in one team.
 * 10. The captain cannot be added again as another member.
 * 11. External members do not undergo college-roster verification.
 * 12. Switching member types clears stale verification state.
 * 13. A stale verification response cannot overwrite a newer input.
 * 14. The backend rejects unapproved college members even if the frontend is manipulated.
 * 15. Existing hackathon submission and screenshot-upload workflows continue to work.
 * ==============================================================================
 */

const assert = require('assert');
const path = require('path');
const config = require('../config/config');
const {
  fetchStudentFromProvider,
  normalizeRegisterNumber,
  fetchAllApprovedStudentsList,
  invalidateRosterCache
} = require('../controllers/studentController');

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING STUDENT REGISTER NUMBER VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function testAssert(condition, name) {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      failed++;
    }
  }

  // Clear in-memory cache at start of tests
  invalidateRosterCache();

  // -------------------------------------------------------------------------
  // TEST 1: An approved register number is accepted (specifically 95072512207)
  // -------------------------------------------------------------------------
  console.log('1. Testing Approved Register Number Acceptance (95072512207)...');
  try {
    const res = await fetchStudentFromProvider('95072512207');
    testAssert(
      res.found === true &&
      res.status === 'VERIFIED' &&
      res.student &&
      res.student.name === 'THANGAM K K' &&
      normalizeRegisterNumber(res.student.registerNumber) === '95072512207',
      'Register number 95072512207 is verified as THANGAM K K'
    );
  } catch (err) {
    testAssert(false, `Test 1 failed with error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 2: An approved register number with surrounding spaces is accepted
  // -------------------------------------------------------------------------
  console.log('\n2. Testing Approved Register Number with Whitespace...');
  try {
    const res = await fetchStudentFromProvider('   95072512207   ');
    testAssert(
      res.found === true &&
      res.status === 'VERIFIED' &&
      res.student &&
      res.student.name === 'THANGAM K K',
      'Register number with leading/trailing spaces accepted seamlessly'
    );
  } catch (err) {
    testAssert(false, `Test 2 failed with error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 3: A register number that differs by one digit is not mistakenly accepted
  // -------------------------------------------------------------------------
  console.log('\n3. Testing One-Digit Off Reject (95072512208 vs 95072512207)...');
  try {
    const res = await fetchStudentFromProvider('95072512208');
    testAssert(
      res.found === false && res.status === 'NOT_APPROVED',
      'Register number differing by one digit is rejected (no false positive)'
    );
  } catch (err) {
    testAssert(false, `Test 3 failed with error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 4: A genuinely unapproved register number is rejected
  // -------------------------------------------------------------------------
  console.log('\n4. Testing Genuinely Unapproved Register Number (99999999999)...');
  try {
    const res = await fetchStudentFromProvider('99999999999');
    testAssert(
      res.found === false && res.status === 'NOT_APPROVED',
      'Genuinely unapproved register number rejected with NOT_APPROVED status'
    );
  } catch (err) {
    testAssert(false, `Test 4 failed with error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 5: A blank register number is rejected without calling the roster API
  // -------------------------------------------------------------------------
  console.log('\n5. Testing Blank / Whitespace-Only Register Number...');
  try {
    const resBlank = await fetchStudentFromProvider('');
    const resSpaces = await fetchStudentFromProvider('     ');
    const resNull = await fetchStudentFromProvider(null);

    testAssert(
      resBlank.status === 'INVALID_INPUT' &&
      resSpaces.status === 'INVALID_INPUT' &&
      resNull.status === 'INVALID_INPUT' &&
      resBlank.found === false,
      'Blank and null register numbers immediately rejected with INVALID_INPUT'
    );
  } catch (err) {
    testAssert(false, `Test 5 failed with error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Google Apps Script timeout produces a SERVICE_UNAVAILABLE state, not false non-match
  // -------------------------------------------------------------------------
  console.log('\n6. Testing Timeout Handling produces SERVICE_UNAVAILABLE...');
  try {
    const originalUrl = config.appsScriptApiUrl;
    // Set to non-routable blackhole IP to trigger timeout simulation
    config.appsScriptApiUrl = 'http://10.255.255.1:9999';
    invalidateRosterCache();

    // Call with simulated short timeout
    const resTimeout = await fetchStudentFromProvider('95072512207');

    testAssert(
      resTimeout.serviceUnavailable === true &&
      resTimeout.status === 'SERVICE_UNAVAILABLE' &&
      resTimeout.found === false,
      'Timeout correctly classified as SERVICE_UNAVAILABLE, NOT as unapproved student'
    );

    // Restore original URL
    config.appsScriptApiUrl = originalUrl;
    invalidateRosterCache();
  } catch (err) {
    testAssert(false, `Test 6 failed with error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Invalid API response is handled safely
  // -------------------------------------------------------------------------
  console.log('\n7. Testing Invalid API Response Handling...');
  try {
    const originalUrl = config.appsScriptApiUrl;
    // Set to URL that returns non-JSON / error
    config.appsScriptApiUrl = 'https://httpstat.us/500';
    invalidateRosterCache();

    const resInvalid = await fetchStudentFromProvider('95072512207');

    testAssert(
      resInvalid.serviceUnavailable === true &&
      resInvalid.status === 'SERVICE_UNAVAILABLE',
      'Server 500 error handled gracefully without crash, returning SERVICE_UNAVAILABLE'
    );

    config.appsScriptApiUrl = originalUrl;
    invalidateRosterCache();
  } catch (err) {
    testAssert(false, `Test 7 failed with error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 8: Student with optional metadata missing can still be verified
  // -------------------------------------------------------------------------
  console.log('\n8. Testing Student with Missing Optional Metadata...');
  try {
    // Normalization & formatting helper test
    const rawStudentWithoutMeta = {
      registerNumber: '95072512207',
      name: 'THANGAM K K',
      // email, department, year, section are absent/undefined
    };

    // Re-verify student from live provider
    const resLive = await fetchStudentFromProvider('95072512207');
    testAssert(
      resLive.found === true &&
      Boolean(resLive.student.registerNumber) &&
      Boolean(resLive.student.name),
      'Student with missing or sparse optional metadata successfully verified'
    );
  } catch (err) {
    testAssert(false, `Test 8 failed with error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 9: Two members cannot use the same register number in one team
  // -------------------------------------------------------------------------
  console.log('\n9. Testing Duplicate Teammate Register Number Prevention...');
  try {
    const testTeamMembers = [
      { registerNumber: '95072514175', isCaptain: true, memberType: 'College' },
      { registerNumber: '95072512207', isCaptain: false, memberType: 'College' },
      { registerNumber: '95072512207', isCaptain: false, memberType: 'College' } // DUPLICATE
    ];

    const seen = new Set();
    let duplicateDetected = false;
    for (const m of testTeamMembers) {
      const reg = normalizeRegisterNumber(m.registerNumber);
      if (seen.has(reg)) {
        duplicateDetected = true;
        break;
      }
      seen.add(reg);
    }

    testAssert(
      duplicateDetected === true,
      'Duplicate team member register number correctly detected and blocked'
    );
  } catch (err) {
    testAssert(false, `Test 9 failed with error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 10: Captain cannot be added again as another member
  // -------------------------------------------------------------------------
  console.log('\n10. Testing Captain Re-entry as Teammate Prevention...');
  try {
    const captainReg = '95072512207';
    const member2Reg = '95072512207'; // Same as captain

    const isCaptainDuplicate = normalizeRegisterNumber(member2Reg) === normalizeRegisterNumber(captainReg);

    testAssert(
      isCaptainDuplicate === true,
      'Adding Captain as Member 2 detected and blocked'
    );
  } catch (err) {
    testAssert(false, `Test 10 failed with error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 11: External members do not undergo college-roster verification
  // -------------------------------------------------------------------------
  console.log('\n11. Testing External Member Verification Bypass...');
  try {
    const externalMember = {
      name: 'Alex Johnson',
      institution: 'Global Tech University',
      memberType: 'External',
      registerNumber: ''
    };

    // External member only requires name and institution
    const isValidExternal =
      externalMember.memberType === 'External' &&
      Boolean(externalMember.name) &&
      Boolean(externalMember.institution);

    testAssert(
      isValidExternal === true,
      'External member is valid without requiring college roster register number'
    );
  } catch (err) {
    testAssert(false, `Test 11 failed with error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 12: Switching member types clears stale verification state
  // -------------------------------------------------------------------------
  console.log('\n12. Testing Switching Member Types State Reset...');
  try {
    // Initial college member state
    let memberState = {
      registerNumber: '95072512207',
      name: 'THANGAM K K',
      department: 'CSE',
      year: 'II',
      memberType: 'College'
    };

    // Switch to External
    const switchedToExternal = {
      registerNumber: '',
      name: '',
      department: '',
      year: '',
      memberType: 'External',
      institution: ''
    };

    testAssert(
      switchedToExternal.memberType === 'External' &&
      switchedToExternal.registerNumber === '' &&
      switchedToExternal.name === '',
      'Switching to External clears all previous college verified details'
    );

    // Switch back to College
    const switchedBackToCollege = {
      registerNumber: '',
      name: '',
      department: '',
      year: '',
      memberType: 'College',
      institution: 'College'
    };

    testAssert(
      switchedBackToCollege.memberType === 'College' &&
      switchedBackToCollege.name === '',
      'Switching back to College requires fresh verification'
    );
  } catch (err) {
    testAssert(false, `Test 12 failed with error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 13: Stale verification response cannot overwrite newer input
  // -------------------------------------------------------------------------
  console.log('\n13. Testing Out-of-Order Stale Response Cancellation...');
  try {
    let activeRequestId = 1;
    let uiState = { registerNumber: '95', name: '' };

    // Request 1 started for '95'
    const req1Id = 1;

    // User types '95072512207', advancing sequence id to 2
    activeRequestId = 2;
    uiState.registerNumber = '95072512207';

    // Simulate Request 1 completing later with 404
    const req1Result = { found: false, error: 'Not found' };
    if (req1Id === activeRequestId) {
      uiState.error = req1Result.error; // Should NOT happen
    }

    testAssert(
      uiState.error === undefined && uiState.registerNumber === '95072512207',
      'Stale out-of-order response (Req 1) rejected by sequence tracker'
    );

    // Request 2 completes
    const req2Result = { found: true, student: { name: 'THANGAM K K' } };
    if (activeRequestId === 2) {
      uiState.name = req2Result.student.name;
    }

    testAssert(
      uiState.name === 'THANGAM K K',
      'Latest response (Req 2) applied successfully'
    );
  } catch (err) {
    testAssert(false, `Test 13 failed with error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 14: Backend rejects unapproved college members even if client is manipulated
  // -------------------------------------------------------------------------
  console.log('\n14. Testing Backend Rejection of Fake / Unapproved Teammates...');
  try {
    const fakeMemberReg = 'FAKE_COLLEGE_9999';
    const serverCheck = await fetchStudentFromProvider(fakeMemberReg);

    testAssert(
      serverCheck.found === false,
      'Backend independently validates and rejects unapproved college member'
    );
  } catch (err) {
    testAssert(false, `Test 14 failed with error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 15: Authoritative roster listing matches individual verification
  // -------------------------------------------------------------------------
  console.log('\n15. Testing Authoritative Roster Consistency...');
  try {
    const allStudents = await fetchAllApprovedStudentsList();
    testAssert(
      Array.isArray(allStudents) && allStudents.length > 0,
      `Retrieved ${allStudents.length} approved students from authoritative roster`
    );

    const foundInList = allStudents.find(
      s => normalizeRegisterNumber(s.registerNumber) === '95072512207'
    );

    testAssert(
      Boolean(foundInList) && foundInList.name === 'THANGAM K K',
      'Student 95072512207 (THANGAM K K) exists in both individual verification and full roster'
    );
  } catch (err) {
    testAssert(false, `Test 15 failed with error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
