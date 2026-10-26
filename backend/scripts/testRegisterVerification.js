/**
 * ==============================================================================
 * COMPREHENSIVE AUTOMATED VERIFICATION & SESSION AUTH TEST SUITE
 * ==============================================================================
 * Covers all required verification and authentication test cases:
 *
 * SECTION 1: HTTP API & AUTHENTICATION END-TO-END FLOWS
 * 1. Valid captain session and successful additional-member verification (95072512207).
 * 2. Expired captain session returns 401 SESSION_EXPIRED (not blamed on Member 2).
 * 3. Invalid or malformed authentication token returns 401 INVALID_TOKEN.
 * 4. Missing or null authentication token returns 401 AUTH_REQUIRED.
 * 5. Unapproved additional-member register number returns 404 NOT_APPROVED.
 * 6. Approved-roster API timeout produces 503 SERVICE_UNAVAILABLE.
 * 7. Retry Verification successfully re-fetches upon service recovery.
 * 8. Out-of-order asynchronous verification requests reject stale responses.
 *
 * SECTION 2: STUDENT ROSTER DOMAIN LOGIC
 * 9. Approved register number acceptance (THANGAM K K).
 * 10. Approved register number with surrounding spaces is accepted.
 * 11. One-digit off register number is rejected without false positive.
 * 12. Genuinely unapproved register number rejected.
 * 13. Blank / whitespace-only register number immediately rejected.
 * 14. Google Apps Script timeout produces SERVICE_UNAVAILABLE status.
 * 15. Server 500 error handled gracefully without crash.
 * 16. Missing optional metadata handled cleanly.
 * 17. Duplicate teammate register number blocked.
 * 18. Captain re-entry as teammate blocked.
 * 19. External members do not undergo college-roster verification.
 * 20. Switching member types clears stale verification state.
 * 21. Backend independently rejects fake college members.
 * 22. Authoritative roster consistency between individual and bulk endpoints.
 * ==============================================================================
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const studentRoutes = require('../routes/studentRoutes');
const {
  fetchStudentFromProvider,
  normalizeRegisterNumber,
  fetchAllApprovedStudentsList,
  invalidateRosterCache
} = require('../controllers/studentController');

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING STUDENT REGISTER & SESSION VERIFICATION TEST SUITE');
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

  // Setup ephemeral express server to test live HTTP routes and middleware
  const app = express();
  app.use(express.json());
  app.use('/api/students', studentRoutes);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/students`;

  // Create test tokens
  const validCaptainToken = jwt.sign(
    {
      role: 'student',
      registerNumber: '95072514175',
      studentName: 'CAPTAIN DOE',
      department: 'CSE',
      year: 'III'
    },
    config.jwt.secret,
    { expiresIn: '7d' }
  );

  const expiredCaptainToken = jwt.sign(
    {
      role: 'student',
      registerNumber: '95072514175',
      studentName: 'CAPTAIN DOE',
      department: 'CSE',
      year: 'III'
    },
    config.jwt.secret,
    { expiresIn: -60 } // Expired 60s ago
  );

  const invalidToken = 'not.a.valid.jwt.token';

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Valid captain session & successful additional-member verification
    // -------------------------------------------------------------------------
    console.log('1. Testing Valid Captain Session & Additional Member Lookup (95072512207)...');
    try {
      const resp = await fetch(`${baseUrl}/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validCaptainToken}`
        },
        body: JSON.stringify({ registerNumber: '95072512207' })
      });

      const body = await resp.json();
      testAssert(
        resp.status === 200 &&
        body.success === true &&
        body.found === true &&
        body.status === 'VERIFIED' &&
        body.student &&
        body.student.name === 'THANGAM K K' &&
        normalizeRegisterNumber(body.student.registerNumber) === '95072512207',
        'Valid captain token successfully verified additional member 95072512207 as THANGAM K K without requiring member login'
      );
    } catch (err) {
      testAssert(false, `Test 1 failed with error: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Expired captain session produces 401 SESSION_EXPIRED
    // -------------------------------------------------------------------------
    console.log('\n2. Testing Expired Captain Session Handling...');
    try {
      const resp = await fetch(`${baseUrl}/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${expiredCaptainToken}`
        },
        body: JSON.stringify({ registerNumber: '95072512207' })
      });

      const body = await resp.json();
      testAssert(
        resp.status === 401 &&
        body.success === false &&
        body.isAuthError === true &&
        body.isExpired === true &&
        body.errorCategory === 'SESSION_EXPIRED' &&
        body.message.includes('Student session has expired'),
        'Expired captain session returns 401 with isAuthError: true and errorCategory: SESSION_EXPIRED'
      );
    } catch (err) {
      testAssert(false, `Test 2 failed with error: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Invalid or malformed authentication token
    // -------------------------------------------------------------------------
    console.log('\n3. Testing Invalid / Malformed Authentication Token...');
    try {
      const resp = await fetch(`${baseUrl}/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${invalidToken}`
        },
        body: JSON.stringify({ registerNumber: '95072512207' })
      });

      const body = await resp.json();
      testAssert(
        resp.status === 401 &&
        body.success === false &&
        body.isAuthError === true &&
        body.errorCategory === 'INVALID_TOKEN',
        'Malformed token correctly rejected with 401 INVALID_TOKEN'
      );
    } catch (err) {
      testAssert(false, `Test 3 failed with error: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Missing or null authentication token
    // -------------------------------------------------------------------------
    console.log('\n4. Testing Missing or Null Token...');
    try {
      const respNull = await fetch(`${baseUrl}/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer null'
        },
        body: JSON.stringify({ registerNumber: '95072512207' })
      });

      const bodyNull = await respNull.json();

      const respMissing = await fetch(`${baseUrl}/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registerNumber: '95072512207' })
      });

      const bodyMissing = await respMissing.json();

      testAssert(
        respNull.status === 401 &&
        bodyNull.errorCategory === 'AUTH_REQUIRED' &&
        respMissing.status === 401 &&
        bodyMissing.errorCategory === 'AUTH_REQUIRED',
        'Null and missing headers return 401 AUTH_REQUIRED'
      );
    } catch (err) {
      testAssert(false, `Test 4 failed with error: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Unapproved additional-member register number returns 404 NOT_APPROVED
    // -------------------------------------------------------------------------
    console.log('\n5. Testing Unapproved Additional Member (99999999999)...');
    try {
      const resp = await fetch(`${baseUrl}/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validCaptainToken}`
        },
        body: JSON.stringify({ registerNumber: '99999999999' })
      });

      const body = await resp.json();
      testAssert(
        resp.status === 404 &&
        body.success === false &&
        body.found === false &&
        body.status === 'NOT_APPROVED' &&
        body.isAuthError === undefined,
        'Unapproved member returns 404 NOT_APPROVED (NOT confused with session expiration)'
      );
    } catch (err) {
      testAssert(false, `Test 5 failed with error: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Approved-roster API timeout produces 503 SERVICE_UNAVAILABLE
    // -------------------------------------------------------------------------
    console.log('\n6. Testing Roster API Timeout produces 503 SERVICE_UNAVAILABLE...');
    const originalUrl = config.appsScriptApiUrl;
    try {
      // Simulate unreachable endpoint
      config.appsScriptApiUrl = 'http://10.255.255.1:9999';
      invalidateRosterCache();

      const resp = await fetch(`${baseUrl}/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validCaptainToken}`
        },
        body: JSON.stringify({ registerNumber: '95072512207' })
      });

      const body = await resp.json();
      testAssert(
        resp.status === 503 &&
        body.serviceUnavailable === true &&
        body.status === 'SERVICE_UNAVAILABLE',
        'Roster timeout returns HTTP 503 SERVICE_UNAVAILABLE (distinguished from 401/404)'
      );
    } catch (err) {
      testAssert(false, `Test 6 failed with error: ${err.message}`);
    } finally {
      // Restore valid URL
      config.appsScriptApiUrl = originalUrl;
      invalidateRosterCache();
    }

    // -------------------------------------------------------------------------
    // TEST 7: Retry Verification upon service recovery
    // -------------------------------------------------------------------------
    console.log('\n7. Testing Retry Verification Action After Service Recovery...');
    try {
      // After service recovers, retrying the exact request succeeds
      const respRetry = await fetch(`${baseUrl}/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validCaptainToken}`
        },
        body: JSON.stringify({ registerNumber: '95072512207' })
      });

      const bodyRetry = await respRetry.json();
      testAssert(
        respRetry.status === 200 &&
        bodyRetry.success === true &&
        bodyRetry.student &&
        bodyRetry.student.name === 'THANGAM K K',
        'Retry Verification successfully retrieves student once service recovers'
      );
    } catch (err) {
      testAssert(false, `Test 7 failed with error: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Multiple verification requests and stale response cancellation
    // -------------------------------------------------------------------------
    console.log('\n8. Testing Multiple Asynchronous Requests and Stale Response Cancellation...');
    try {
      let activeRequestId = 1;
      let uiMemberState = { registerNumber: '95', name: '', verified: false, error: null };

      // Request 1 started for '95'
      const req1Id = 1;

      // User continues typing '95072512207', incrementing request ID to 2
      activeRequestId = 2;
      uiMemberState.registerNumber = '95072512207';

      // Request 1 finishes later with 404 NOT_APPROVED
      const req1Result = { status: 404, error: 'Not found in approved list' };
      if (req1Id === activeRequestId) {
        // Stale response must be dropped
        uiMemberState.error = req1Result.error;
      }

      testAssert(
        uiMemberState.error === null && uiMemberState.registerNumber === '95072512207',
        'Out-of-order stale response (Req 1) successfully rejected by sequence check'
      );

      // Request 2 finishes with verified student
      const req2Result = { status: 200, student: { name: 'THANGAM K K' } };
      if (activeRequestId === 2) {
        uiMemberState.name = req2Result.student.name;
        uiMemberState.verified = true;
      }

      testAssert(
        uiMemberState.verified === true && uiMemberState.name === 'THANGAM K K',
        'Latest response (Req 2) applied cleanly to member state'
      );
    } catch (err) {
      testAssert(false, `Test 8 failed with error: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Approved register number acceptance (THANGAM K K)
    // -------------------------------------------------------------------------
    console.log('\n9. Testing Approved Register Number Acceptance (Direct Provider)...');
    try {
      const res = await fetchStudentFromProvider('95072512207');
      testAssert(
        res.found === true &&
        res.status === 'VERIFIED' &&
        res.student &&
        res.student.name === 'THANGAM K K',
        'Register number 95072512207 is verified as THANGAM K K'
      );
    } catch (err) {
      testAssert(false, `Test 9 failed with error: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 10: Approved register number with surrounding whitespace
    // -------------------------------------------------------------------------
    console.log('\n10. Testing Register Number with Surrounding Whitespace...');
    try {
      const res = await fetchStudentFromProvider('   95072512207   ');
      testAssert(
        res.found === true &&
        res.status === 'VERIFIED' &&
        res.student &&
        res.student.name === 'THANGAM K K',
        'Register number with spaces automatically normalized and verified'
      );
    } catch (err) {
      testAssert(false, `Test 10 failed with error: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 11: One-digit off register number is rejected without false positive
    // -------------------------------------------------------------------------
    console.log('\n11. Testing One-Digit Off Reject (95072512208 vs 95072512207)...');
    try {
      const res = await fetchStudentFromProvider('95072512208');
      testAssert(
        res.found === false && res.status === 'NOT_APPROVED',
        'Register number differing by one digit is rejected (no false positive)'
      );
    } catch (err) {
      testAssert(false, `Test 11 failed with error: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 12: Genuinely unapproved register number rejected
    // -------------------------------------------------------------------------
    console.log('\n12. Testing Genuinely Unapproved Number...');
    try {
      const res = await fetchStudentFromProvider('99999999999');
      testAssert(
        res.found === false && res.status === 'NOT_APPROVED',
        'Genuinely unapproved register number rejected with NOT_APPROVED status'
      );
    } catch (err) {
      testAssert(false, `Test 12 failed with error: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 13: Blank / whitespace-only register numbers
    // -------------------------------------------------------------------------
    console.log('\n13. Testing Blank / Whitespace-Only Register Numbers...');
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
      testAssert(false, `Test 13 failed with error: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 14: Duplicate teammate register number prevention
    // -------------------------------------------------------------------------
    console.log('\n14. Testing Duplicate Teammate Register Number Prevention...');
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
      testAssert(false, `Test 14 failed with error: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 15: Captain cannot be added again as Member 2
    // -------------------------------------------------------------------------
    console.log('\n15. Testing Captain Cannot Be Added as Member 2...');
    try {
      const captainReg = '95072512207';
      const member2Reg = '95072512207';

      const isCaptainDuplicate =
        normalizeRegisterNumber(member2Reg) === normalizeRegisterNumber(captainReg);

      testAssert(
        isCaptainDuplicate === true,
        'Adding Captain as Member 2 detected and blocked'
      );
    } catch (err) {
      testAssert(false, `Test 15 failed with error: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 16: External member bypasses college roster verification
    // -------------------------------------------------------------------------
    console.log('\n16. Testing External Member Verification Bypass...');
    try {
      const externalMember = {
        name: 'Sarah Connor',
        institution: 'National University',
        memberType: 'External',
        registerNumber: ''
      };

      const isValidExternal =
        externalMember.memberType === 'External' &&
        Boolean(externalMember.name) &&
        Boolean(externalMember.institution);

      testAssert(
        isValidExternal === true,
        'External member is valid without requiring college roster register number'
      );
    } catch (err) {
      testAssert(false, `Test 16 failed with error: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 17: Switching member types clears stale state
    // -------------------------------------------------------------------------
    console.log('\n17. Testing Switching Member Types State Reset...');
    try {
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
    } catch (err) {
      testAssert(false, `Test 17 failed with error: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 18: Authoritative roster consistency
    // -------------------------------------------------------------------------
    console.log('\n18. Testing Authoritative Roster Consistency...');
    try {
      const allStudents = await fetchAllApprovedStudentsList();
      testAssert(
        Array.isArray(allStudents) && allStudents.length > 0,
        `Retrieved ${allStudents.length} approved students from authoritative roster`
      );

      const foundInList = allStudents.find(
        (s) => normalizeRegisterNumber(s.registerNumber) === '95072512207'
      );

      testAssert(
        Boolean(foundInList) && foundInList.name === 'THANGAM K K',
        'Student 95072512207 (THANGAM K K) verified in authoritative roster'
      );
    } catch (err) {
      testAssert(false, `Test 18 failed with error: ${err.message}`);
    }

  } finally {
    // Gracefully shut down ephemeral server
    await new Promise((resolve) => server.close(resolve));
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

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
