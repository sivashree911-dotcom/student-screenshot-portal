/**
 * Automated Verification Script for Team-Size Validation:
 * Tests 2-member, 3-member, and 4-member teams when maximum team size is 3.
 */

const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5000/api';

async function runTeamValidationTests() {
  console.log('================================================================');
  console.log('🧪 TESTING TEAM-SIZE VALIDATION (MAX TEAM SIZE = 3)');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, detail = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message} ${detail ? '--> ' + detail : ''}`);
      failed++;
    }
  }

  // 1. Admin login
  console.log('1. Authenticating Admin...');
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
    assert(res.status === 200 && Boolean(data.token), 'Admin logged in');
    adminToken = data.token;
  } catch (e) {
    assert(false, 'Admin authentication failed', e.message);
    process.exit(1);
  }

  // 2. Student login (Captain)
  console.log('\n2. Authenticating Student (Captain)...');
  let studentToken = '';
  const captain = {
    registerNumber: '95072514175',
    name: 'YASODHA M',
    department: 'ECE',
    year: '2'
  };

  try {
    const res = await fetch(`${API_BASE}/students/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registerNumber: captain.registerNumber })
    });
    const data = await res.json();
    assert(res.status === 200 && data.found === true, `Captain ${captain.registerNumber} authenticated`);
    studentToken = data.token;
  } catch (e) {
    assert(false, 'Student authentication failed', e.message);
    process.exit(1);
  }

  // Dummy screenshot buffer
  const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

  // Helper to create a hackathon with max_team_size = 3
  async function createHackathonWithMax3(nameSuffix) {
    const res = await fetch(`${API_BASE}/hackathons/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: `TeamSize Max 3 Event - ${nameSuffix}`,
        institution: 'Engineering Campus',
        description: 'Event with strict max team size 3',
        startDate: '2026-12-01',
        endDate: '2026-12-02',
        registrationDeadline: '2026-11-28',
        mode: 'Online',
        location: 'Virtual',
        minTeamSize: '1',
        maxTeamSize: '3',
        allowExternalParticipants: 'true',
        registrationUrl: 'https://example.com/reg',
        isActive: 'true'
      })
    });
    const data = await res.json();
    return data.hackathonId;
  }

  // TEST 1: Team with 2 members (Captain + 1 teammate)
  console.log('\n3. Testing Registration with 2 Members (allowed, <= 3)...');
  try {
    const hackId2 = await createHackathonWithMax3('2 Members');
    const members2 = [
      {
        registerNumber: captain.registerNumber,
        name: captain.name,
        department: captain.department,
        year: captain.year,
        memberType: 'College',
        isCaptain: true
      },
      {
        registerNumber: '',
        name: 'Teammate Two',
        memberType: 'External',
        institution: 'External Institute',
        isCaptain: false
      }
    ];

    const form2 = new FormData();
    form2.append('hackathonId', String(hackId2));
    form2.append('teamSize', '2');
    form2.append('membersData', JSON.stringify(members2));
    form2.append('screenshot', new Blob([dummyPng], { type: 'image/png' }), 'proof2.png');

    const res2 = await fetch(`${API_BASE}/submissions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${studentToken}` },
      body: form2
    });
    const data2 = await res2.json();

    assert(res2.status === 201 && data2.success === true, 'Team with 2 members registered successfully (status: 201)');
    assert(data2.teamSize === 2, `Reported team size is exactly 2 (got: ${data2.teamSize})`);

    // Verify team members count in database
    const resCheck2 = await fetch(`${API_BASE}/submissions/${data2.id}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const checkData2 = await resCheck2.json();
    assert(checkData2.submission?.team_members?.length === 2, `DB has exactly 2 members saved (got: ${checkData2.submission?.team_members?.length})`);
    const captainEntries2 = checkData2.submission?.team_members?.filter(m => m.is_captain);
    assert(captainEntries2?.length === 1, 'Captain is saved and counted exactly once');
  } catch (e) {
    assert(false, '2-member test failed', e.message);
  }

  // TEST 2: Team with exactly 3 members (Captain + 2 teammates)
  console.log('\n4. Testing Registration with exactly 3 Members (allowed, == 3)...');
  try {
    const hackId3 = await createHackathonWithMax3('3 Members');
    const members3 = [
      {
        registerNumber: captain.registerNumber,
        name: captain.name,
        department: captain.department,
        year: captain.year,
        memberType: 'College',
        isCaptain: true
      },
      {
        registerNumber: '',
        name: 'Teammate Two',
        memberType: 'External',
        institution: 'External Institute',
        isCaptain: false
      },
      {
        registerNumber: '',
        name: 'Teammate Three',
        memberType: 'External',
        institution: 'External Institute',
        isCaptain: false
      }
    ];

    const form3 = new FormData();
    form3.append('hackathonId', String(hackId3));
    form3.append('teamSize', '3');
    form3.append('membersData', JSON.stringify(members3));
    form3.append('screenshot', new Blob([dummyPng], { type: 'image/png' }), 'proof3.png');

    const res3 = await fetch(`${API_BASE}/submissions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${studentToken}` },
      body: form3
    });
    const data3 = await res3.json();

    assert(res3.status === 201 && data3.success === true, 'Team with exactly 3 members registered successfully (status: 201)');
    assert(data3.teamSize === 3, `Reported team size is exactly 3 (got: ${data3.teamSize})`);

    // Verify team members count in database
    const resCheck3 = await fetch(`${API_BASE}/submissions/${data3.id}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const checkData3 = await resCheck3.json();
    assert(checkData3.submission?.team_members?.length === 3, `DB has exactly 3 members saved (got: ${checkData3.submission?.team_members?.length})`);
    const captainEntries3 = checkData3.submission?.team_members?.filter(m => m.is_captain);
    assert(captainEntries3?.length === 1, 'Captain is saved and counted exactly once in 3-member team');
  } catch (e) {
    assert(false, '3-member test failed', e.message);
  }

  // TEST 3: Team with 4 members (Captain + 3 teammates) -> Exceeds max 3, MUST BE BLOCKED
  console.log('\n5. Testing Registration with 4 Members (blocked, 4 > 3)...');
  try {
    const hackId4 = await createHackathonWithMax3('4 Members');
    const members4 = [
      {
        registerNumber: captain.registerNumber,
        name: captain.name,
        department: captain.department,
        year: captain.year,
        memberType: 'College',
        isCaptain: true
      },
      {
        registerNumber: '',
        name: 'Teammate Two',
        memberType: 'External',
        institution: 'External Institute',
        isCaptain: false
      },
      {
        registerNumber: '',
        name: 'Teammate Three',
        memberType: 'External',
        institution: 'External Institute',
        isCaptain: false
      },
      {
        registerNumber: '',
        name: 'Teammate Four',
        memberType: 'External',
        institution: 'External Institute',
        isCaptain: false
      }
    ];

    const form4 = new FormData();
    form4.append('hackathonId', String(hackId4));
    form4.append('teamSize', '4');
    form4.append('membersData', JSON.stringify(members4));
    form4.append('screenshot', new Blob([dummyPng], { type: 'image/png' }), 'proof4.png');

    const res4 = await fetch(`${API_BASE}/submissions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${studentToken}` },
      body: form4
    });
    const data4 = await res4.json();

    assert(res4.status === 400 && data4.success === false, 'Team with 4 members correctly blocked with 400 Bad Request');
    assert(data4.message === 'Maximum team size is 3', `Error message correctly displays: "${data4.message}"`);
  } catch (e) {
    assert(false, '4-member test failed', e.message);
  }

  // TEST 4: Deduplication test (captain passed twice in membersData array)
  console.log('\n6. Testing Captain Deduplication (Captain entered twice by mistake)...');
  try {
    const hackIdDedup = await createHackathonWithMax3('Dedup Event');
    const membersWithDupCaptain = [
      {
        registerNumber: captain.registerNumber,
        name: captain.name,
        department: captain.department,
        year: captain.year,
        memberType: 'College',
        isCaptain: true
      },
      {
        registerNumber: captain.registerNumber, // Captain passed again
        name: captain.name,
        memberType: 'College',
        isCaptain: true
      },
      {
        registerNumber: '',
        name: 'Teammate Two',
        memberType: 'External',
        institution: 'External Institute',
        isCaptain: false
      },
      {
        registerNumber: '',
        name: 'Teammate Three',
        memberType: 'External',
        institution: 'External Institute',
        isCaptain: false
      }
    ];

    const formDedup = new FormData();
    formDedup.append('hackathonId', String(hackIdDedup));
    formDedup.append('membersData', JSON.stringify(membersWithDupCaptain));
    formDedup.append('screenshot', new Blob([dummyPng], { type: 'image/png' }), 'proof_dedup.png');

    const resDedup = await fetch(`${API_BASE}/submissions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${studentToken}` },
      body: formDedup
    });
    const dataDedup = await resDedup.json();

    assert(resDedup.status === 201 && dataDedup.success === true, 'Duplicate captain entry deduplicated; team with 3 unique members accepted');
    assert(dataDedup.teamSize === 3, `Deduplicated team size is 3 (got: ${dataDedup.teamSize})`);
  } catch (e) {
    assert(false, 'Deduplication test failed', e.message);
  }

  console.log('\n================================================================');
  console.log(`🏁 TEAM-SIZE VALIDATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed === 0) {
    console.log('🎉 ALL TEAM-SIZE VALIDATION REQUIREMENTS VERIFIED SUCCESSFULLY!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTeamValidationTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
