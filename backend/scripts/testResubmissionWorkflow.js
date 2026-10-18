/**
 * Comprehensive Automated Verification Suite for
 * Hackathon Submission Rejection & Resubmission Workflow
 */

const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5000/api';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🚀 TESTING SUBMISSION REJECTION & RESUBMISSION WORKFLOW');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${details ? '--> ' + details : ''}`);
      failed++;
    }
  }

  // 1. Health check
  console.log('Step 1: Checking API Health...');
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    assert(res.status === 200 && data.success === true, 'API is operational');
  } catch (err) {
    console.error('Fatal: Backend is not running on port 5000:', err.message);
    process.exit(1);
  }

  // 2. Admin Authentication
  console.log('\nStep 2: Authenticating as Administrator...');
  let adminToken = '';
  try {
    let res = await fetch(`${API_BASE}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@college.edu', password: 'AdminPassword@123' })
    });
    if (res.status === 401) {
      res = await fetch(`${API_BASE}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@college.edu', password: 'AdminSecret@123' })
      });
    }
    const data = await res.json();
    assert(res.status === 200 && Boolean(data.token), 'Admin logged in and received JWT token');
    adminToken = data.token;
  } catch (e) {
    assert(false, 'Admin login failed', e.message);
  }

  // 3. Authenticate Student
  console.log('\nStep 3: Authenticating Student (Captain)...');
  let studentToken = '';
  const testStudent = {
    registerNumber: '95072514175',
    name: 'YASODHA M',
    department: 'ECE',
    year: '2'
  };

  try {
    const res = await fetch(`${API_BASE}/students/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registerNumber: testStudent.registerNumber })
    });
    const data = await res.json();
    assert(res.status === 200 && data.found === true, `Student ${testStudent.registerNumber} verified`);
    studentToken = data.token;
  } catch (e) {
    assert(false, 'Student verification failed', e.message);
  }

  // 4. Create or obtain active hackathon
  console.log('\nStep 4: Ensuring Active Hackathon for Testing...');
  let hackathonId = null;
  try {
    const resCreate = await fetch(`${API_BASE}/hackathons/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: `Resubmission Test Hackathon ${Date.now()}`,
        institution: 'Cyber Security Research Lab',
        description: 'Test hackathon for verifying submission rejection and resubmission lifecycle.',
        startDate: '2026-11-20',
        endDate: '2026-11-21',
        registrationDeadline: '2026-11-19',
        mode: 'Online',
        location: 'Virtual',
        minTeamSize: '1',
        maxTeamSize: '4',
        allowExternalParticipants: 'true',
        registrationUrl: 'https://example.com/register',
        isActive: 'true'
      })
    });
    const dataCreate = await resCreate.json();
    assert(resCreate.status === 201 && Boolean(dataCreate.hackathonId), `Created test hackathon (ID: ${dataCreate.hackathonId})`);
    hackathonId = dataCreate.hackathonId;
  } catch (e) {
    assert(false, 'Failed creating test hackathon', e.message);
  }

  // Prepare dummy screenshots
  const dummyPngV1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const dummyPngV2 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

  let submissionDbId = null;
  let submissionFormattedId = null;
  let initialScreenshotPath = '';
  let updatedScreenshotPath = '';

  // 5. Initial Submission (Participant submits file)
  console.log('\nStep 5: Testing Initial Proof Submission (Participant uploads proof)...');
  try {
    const fileBlobV1 = new Blob([dummyPngV1], { type: 'image/png' });
    const members = [
      {
        registerNumber: testStudent.registerNumber,
        name: testStudent.name,
        department: testStudent.department,
        year: testStudent.year,
        memberType: 'College',
        institution: 'College',
        isCaptain: true
      }
    ];

    const form = new FormData();
    form.append('hackathonId', String(hackathonId));
    form.append('membersData', JSON.stringify(members));
    form.append('screenshot', fileBlobV1, 'initial_proof.png');

    const res = await fetch(`${API_BASE}/submissions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${studentToken}` },
      body: form
    });
    const data = await res.json();
    assert(res.status === 201 && data.success === true, 'Initial submission created successfully');
    assert(data.status === 'Pending', `Submission initial status is 'Pending' (got: ${data.status})`);
    assert(Boolean(data.submissionId), `Generated submission ID: ${data.submissionId}`);
    submissionDbId = data.id;
    submissionFormattedId = data.submissionId;
    initialScreenshotPath = data.screenshotPath || '';
  } catch (e) {
    assert(false, 'Initial submission failed', e.message);
  }

  // 6. Test duplicate submission while Pending (Requirement 8)
  console.log('\nStep 6: Testing Duplicate Submission Prevention while Pending Review...');
  try {
    const fileBlobDup = new Blob([dummyPngV1], { type: 'image/png' });
    const formDup = new FormData();
    formDup.append('hackathonId', String(hackathonId));
    formDup.append('membersData', JSON.stringify([{ registerNumber: testStudent.registerNumber, name: testStudent.name, isCaptain: true }]));
    formDup.append('screenshot', fileBlobDup, 'dup_proof.png');

    const resDup = await fetch(`${API_BASE}/submissions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${studentToken}` },
      body: formDup
    });
    const dataDup = await resDup.json();
    assert(resDup.status === 409 && dataDup.success === false, 'Duplicate submission blocked with 409 Conflict while status is Pending');
    assert(dataDup.message.includes('already submitted') || dataDup.message.includes('pending'), `Conflict message explains status: "${dataDup.message}"`);
  } catch (e) {
    assert(false, 'Duplicate prevention test failed', e.message);
  }

  // 7. Admin Rejection Workflow (Requirement 1)
  console.log('\nStep 7: Admin Reviews and Rejects Submission with Reason...');
  const testRejectionReason = 'Proof screenshot is blurry and does not display team member names.';
  try {
    // 7a. Try rejecting without reason -> should fail
    const resNoReason = await fetch(`${API_BASE}/submissions/admin/${submissionDbId}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ rejectionReason: '' })
    });
    assert(resNoReason.status === 400, 'Rejection without reason correctly rejected with 400 Bad Request');

    // 7b. Reject with valid reason
    const resReject = await fetch(`${API_BASE}/submissions/admin/${submissionDbId}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ rejectionReason: testRejectionReason })
    });
    const dataReject = await resReject.json();
    assert(resReject.status === 200 && dataReject.status === 'Rejected', 'Submission rejected successfully with 200 OK');

    // 7c. Verify submission is still present in database and admin history
    const resAdminCheck = await fetch(`${API_BASE}/submissions/${submissionDbId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dataAdminCheck = await resAdminCheck.json();
    assert(
      dataAdminCheck.submission.status === 'Rejected' &&
      dataAdminCheck.submission.rejection_reason === testRejectionReason,
      'Rejected submission preserved in DB with correct status & rejection reason'
    );
  } catch (e) {
    assert(false, 'Admin rejection failed', e.message);
  }

  // 8. Participant Views Rejected Submission (Requirement 1 & 3)
  console.log('\nStep 8: Participant Checks Submission Status & Rejection Reason...');
  try {
    const resMy = await fetch(`${API_BASE}/submissions/my`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    const dataMy = await resMy.json();
    const mySub = dataMy.submissions.find(s => s.id === submissionDbId);
    assert(Boolean(mySub), 'Rejected submission found in participant history');
    assert(mySub.status === 'Rejected', `Status is 'Rejected' (got: ${mySub.status})`);
    assert(mySub.rejection_reason === testRejectionReason, `Rejection reason displayed accurately: "${mySub.rejection_reason}"`);
  } catch (e) {
    assert(false, 'Participant status view failed', e.message);
  }

  // 9. Participant Resubmission (Requirement 2 & 3)
  console.log('\nStep 9: Participant Uploads Corrected Proof for the Same Hackathon...');
  try {
    const fileBlobV2 = new Blob([dummyPngV2], { type: 'image/png' });
    const correctedMembers = [
      {
        registerNumber: testStudent.registerNumber,
        name: testStudent.name,
        department: testStudent.department,
        year: testStudent.year,
        memberType: 'College',
        institution: 'College',
        isCaptain: true
      },
      {
        registerNumber: '',
        name: 'Sarah Connor',
        department: 'External University',
        year: '3',
        memberType: 'External',
        institution: 'External Tech Institute',
        isCaptain: false
      }
    ];

    const formResubmit = new FormData();
    formResubmit.append('hackathonId', String(hackathonId));
    formResubmit.append('membersData', JSON.stringify(correctedMembers));
    formResubmit.append('screenshot', fileBlobV2, 'corrected_proof.png');

    const resResubmit = await fetch(`${API_BASE}/submissions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${studentToken}` },
      body: formResubmit
    });
    const dataResubmit = await resResubmit.json();

    assert(resResubmit.status === 200 && dataResubmit.success === true, 'Resubmission accepted with 200 OK without duplicate-key errors');
    assert(dataResubmit.status === 'Pending', `Status transitioned to 'Pending' (got: ${dataResubmit.status})`);
    assert(dataResubmit.isResubmission === true, 'Response flags isResubmission = true');
    assert(dataResubmit.id === submissionDbId, `Updated existing submission record in-place (Record ID: ${dataResubmit.id})`);

    updatedScreenshotPath = dataResubmit.screenshotPath || '';

    // Verify database record details
    const resVerifyDb = await fetch(`${API_BASE}/submissions/${submissionDbId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dataVerifyDb = await resVerifyDb.json();
    const updatedSub = dataVerifyDb.submission;

    assert(updatedSub.status === 'Pending', `DB Status is 'Pending'`);
    assert(updatedSub.rejection_reason === null || updatedSub.rejection_reason === '', 'Active rejection_reason was cleared for new review');
    assert(
      updatedSub.previous_rejection_reason === testRejectionReason || updatedSub.previous_rejection_reason === undefined,
      `Historical rejection reason preserved if supported: "${updatedSub.previous_rejection_reason}"`
    );
    assert(updatedSub.team_members?.length === 2, `Team members refreshed in database (count: ${updatedSub.team_members?.length})`);
    assert(Boolean(updatedSub.screenshot_path), `File reference updated: ${updatedSub.screenshot_path}`);

    // Verify safe file cleanup
    if (initialScreenshotPath && updatedScreenshotPath && initialScreenshotPath !== updatedScreenshotPath) {
      const uploadsDir = path.join(__dirname, '..', 'uploads', 'screenshots');
      const oldFileOnDisk = path.join(uploadsDir, initialScreenshotPath);
      const newFileOnDisk = path.join(uploadsDir, updatedScreenshotPath);
      assert(!fs.existsSync(oldFileOnDisk), 'Old screenshot file was safely cleaned up from disk');
      assert(fs.existsSync(newFileOnDisk), 'New screenshot file exists on disk');
    }
  } catch (e) {
    assert(false, 'Resubmission workflow failed', e.message);
  }

  // 10. Prevention of resubmission while 'Pending' (Requirement 8)
  console.log('\nStep 10: Testing Duplicate Prevention while Submission is in Pending Status...');
  try {
    const fileBlobV3 = new Blob([dummyPngV2], { type: 'image/png' });
    const formV3 = new FormData();
    formV3.append('hackathonId', String(hackathonId));
    formV3.append('membersData', JSON.stringify([{ registerNumber: testStudent.registerNumber, name: testStudent.name, isCaptain: true }]));
    formV3.append('screenshot', fileBlobV3, 'proof3.png');

    const resV3 = await fetch(`${API_BASE}/submissions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${studentToken}` },
      body: formV3
    });
    const dataV3 = await resV3.json();
    assert(resV3.status === 409, 'Resubmission blocked with 409 Conflict while Pending');
    assert(dataV3.message.toLowerCase().includes('review'), `Error message indicates review in progress: "${dataV3.message}"`);
  } catch (e) {
    assert(false, 'Prevention during Pending status failed', e.message);
  }

  // 11. Admin Reviews Resubmission (Requirement 7)
  console.log('\nStep 11: Admin Inspects Resubmitted Proof & Historical Reason...');
  try {
    // 11a. Ensure submission is returned in Admin 'Pending' filter
    const resPendingList = await fetch(`${API_BASE}/submissions/admin/all?status=Pending`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dataPendingList = await resPendingList.json();
    const foundInPending = dataPendingList.submissions.find(s => s.id === submissionDbId);
    assert(Boolean(foundInPending), "Submission with 'Pending' appears in Admin Pending list");

    // 11b. Admin verifies the corrected resubmission
    const resVerify = await fetch(`${API_BASE}/submissions/admin/${submissionDbId}/verify`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    const dataVerify = await resVerify.json();
    assert(resVerify.status === 200 && dataVerify.status === 'Verified', "Admin verified the resubmission successfully (status: 'Verified')");
  } catch (e) {
    assert(false, 'Admin inspection & verify failed', e.message);
  }

  // 12. Prevention of resubmission while 'Verified' (Requirement 8)
  console.log('\nStep 12: Testing Duplicate Prevention after Verification...');
  try {
    const fileBlobV4 = new Blob([dummyPngV2], { type: 'image/png' });
    const formV4 = new FormData();
    formV4.append('hackathonId', String(hackathonId));
    formV4.append('membersData', JSON.stringify([{ registerNumber: testStudent.registerNumber, name: testStudent.name, isCaptain: true }]));
    formV4.append('screenshot', fileBlobV4, 'proof4.png');

    const resV4 = await fetch(`${API_BASE}/submissions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${studentToken}` },
      body: formV4
    });
    const dataV4 = await resV4.json();
    assert(resV4.status === 409, 'Resubmission blocked with 409 Conflict after submission is Verified');
    assert(dataV4.message.includes('already been verified'), `Error message indicates already verified: "${dataV4.message}"`);
  } catch (e) {
    assert(false, 'Prevention after Verified failed', e.message);
  }

  // 13. Participation metrics and database integrity (Requirement 4 & 9)
  console.log('\nStep 13: Verifying Participation Metrics & Data Integrity...');
  try {
    const resPart = await fetch(`${API_BASE}/participation/hackathon/${hackathonId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dataPart = await resPart.json();
    assert(resPart.status === 200 && dataPart.success === true, 'Participation analytics computed correctly');
    assert(dataPart.summary?.participatedCount >= 1, `Verified participant counted in participation stats (count: ${dataPart.summary?.participatedCount})`);

    const resDash = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dataDash = await resDash.json();
    assert(resDash.status === 200 && dataDash.stats?.verifiedSubmissions > 0, `Admin dashboard reflects verified submission count: ${dataDash.stats?.verifiedSubmissions}`);
  } catch (e) {
    assert(false, 'Metrics check failed', e.message);
  }

  console.log('\n================================================================');
  console.log(`🏁 RESUBMISSION WORKFLOW RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed === 0) {
    console.log('🎉 ALL 13 VERIFICATION CRITERIA PASSED WITHOUT ERRORS!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
