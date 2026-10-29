import { dbPool } from './db.js';
import { signSession } from './auth.js';
import type { RowDataPacket } from 'mysql2';

const API_BASE = 'http://localhost:4000/api';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('====================================================');
  console.log('SAUDA BACKEND WORKSPACE & SECURITY INTEGRATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  }

  // 1. Unauthenticated checks
  console.log('--- 1. UNAUTHENTICATED ACCESS CONTROLS ---');
  const resViewer = await fetch(`${API_BASE}/startups`);
  assert(resViewer.status === 200, 'Viewer / public can access /api/startups');

  const resFounderNoAuth = await fetch(`${API_BASE}/founder/pitches`);
  assert(resFounderNoAuth.status === 401, 'Unauthenticated /api/founder/pitches returns 401');

  const resInvestorNoAuth = await fetch(`${API_BASE}/investor/dashboard`);
  assert(resInvestorNoAuth.status === 401, 'Unauthenticated /api/investor/dashboard returns 401');

  const resConnNoAuth = await fetch(`${API_BASE}/connections`);
  assert(resConnNoAuth.status === 401, 'Unauthenticated /api/connections returns 401');

  // Setup test users in test database
  console.log('\n--- 2. PROVISIONING TEST IDENTITIES ---');
  const now = Math.floor(Date.now() / 1000);

  // Helper to create or fetch test user
  async function getOrCreateTestUser(email: string, fullName: string) {
    const [rows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT user_id, full_name, email FROM app_user WHERE email = ?`,
      [email],
    );
    if (rows.length > 0) return rows[0];

    const googleSubject = `sub_${Buffer.from(email).toString('hex').slice(0, 24)}`;
    const [res] = await dbPool.execute<any>(
      `INSERT INTO app_user (full_name, email, google_subject, account_status) VALUES (?, ?, ?, 'ACTIVE')`,
      [fullName, email, googleSubject],
    );
    const userId = res.insertId;
    // Default VIEWER role
    await dbPool.execute(`INSERT IGNORE INTO user_role (user_id, role_id) VALUES (?, 1)`, [userId]);
    return { user_id: userId, full_name: fullName, email };
  }

  const founderUser: any = await getOrCreateTestUser('test_founder_d@sauda.test', 'Dev Founder');
  const investorUser: any = await getOrCreateTestUser('test_investor_d@sauda.test', 'Dev Investor');
  const intruderUser: any = await getOrCreateTestUser('test_intruder_d@sauda.test', 'Dev Intruder');

  const fId = Number(founderUser.user_id || founderUser.userId);
  const invId = Number(investorUser.user_id || investorUser.userId);
  const intId = Number(intruderUser.user_id || intruderUser.userId);

  console.log('Test identities IDs:', { fId, invId, intId });

  const founderCookie = `sauda_session=${signSession({ userId: fId, email: founderUser.email, iat: now, exp: now + 3600 })}`;
  const investorCookie = `sauda_session=${signSession({ userId: invId, email: investorUser.email, iat: now, exp: now + 3600 })}`;
  const intruderCookie = `sauda_session=${signSession({ userId: intId, email: intruderUser.email, iat: now, exp: now + 3600 })}`;

  // 3. Role Escalation Prevention: Attempt to self-assign ADMIN
  console.log('\n--- 3. ROLE ESCALATION PREVENTION ---');
  const adminAssignRes = await fetch(`${API_BASE}/user/roles/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: founderCookie },
    body: JSON.stringify({ role: 'ADMIN' }),
  });
  assert(adminAssignRes.status === 403, 'Self-assignment of ADMIN role is strictly forbidden (403)');
  const adminJson = await adminAssignRes.json();
  assert(adminJson.error === 'ROLE_ACTIVATION_FORBIDDEN', 'Error code is ROLE_ACTIVATION_FORBIDDEN');

  // 4. Role Activation: Founder and Investor
  console.log('\n--- 4. SELF-SERVICE WORKSPACE ROLE ACTIVATION ---');
  const founderActRes = await fetch(`${API_BASE}/user/roles/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: founderCookie },
    body: JSON.stringify({ role: 'FOUNDER' }),
  });
  const founderActText = await founderActRes.text();
  console.log('Founder activation response:', founderActRes.status, founderActText);
  let founderActJson: any = {};
  try { founderActJson = JSON.parse(founderActText); } catch {}
  assert(founderActRes.status === 200, 'Founder role activated successfully (200)');
  assert(Boolean(founderActJson.roles && founderActJson.roles.includes('FOUNDER')), 'Updated roles contains FOUNDER');

  const investorActRes = await fetch(`${API_BASE}/user/roles/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: investorCookie },
    body: JSON.stringify({ role: 'INVESTOR' }),
  });
  assert(investorActRes.status === 200, 'Investor role activated successfully (200)');
  const investorActJson = await investorActRes.json();
  assert(investorActJson.roles.includes('INVESTOR'), 'Updated roles contains INVESTOR');

  // Verify persistence in MySQL
  const [fRolesInDb] = await dbPool.execute<RowDataPacket[]>(
    `SELECT r.role_name FROM user_role ur JOIN app_role r ON r.role_id = ur.role_id WHERE ur.user_id = ?`,
    [founderUser.user_id],
  );
  assert(fRolesInDb.some((r) => r.role_name === 'FOUNDER'), 'FOUNDER role persisted in MySQL user_role');

  // 5. Multi-Role account test
  console.log('\n--- 5. MULTI-ROLE ACCOUNT CAPABILITY ---');
  // Activate INVESTOR on founder account as well
  const multiActRes = await fetch(`${API_BASE}/user/roles/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: founderCookie },
    body: JSON.stringify({ role: 'INVESTOR' }),
  });
  assert(multiActRes.status === 200, 'Multi-role activation succeeded');
  const multiJson = await multiActRes.json();
  assert(
    multiJson.roles.includes('FOUNDER') && multiJson.roles.includes('INVESTOR'),
    'User now legitimately holds both FOUNDER and INVESTOR roles',
  );

  // 6. Founder Workspace Lifecycle
  console.log('\n--- 6. FOUNDER WORKSPACE & OWNERSHIP CHECKS ---');
  // Unauthorized intruder attempting founder endpoint
  const intruderFounderRes = await fetch(`${API_BASE}/founder/pitches`, {
    headers: { Cookie: intruderCookie },
  });
  assert(intruderFounderRes.status === 403, 'Intruder without FOUNDER role rejected (403)');

  // A valid stage is required before a pitch can be submitted for review
  const [stageRows] = await dbPool.execute<RowDataPacket[]>(`SELECT stage_id FROM startup_stage ORDER BY stage_id LIMIT 1`);
  const testStageId = Number(stageRows[0]?.stage_id ?? 1);

  // Founder create pitch (DRAFT)
  const createDraftRes = await fetch(`${API_BASE}/founder/pitches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: founderCookie },
    body: JSON.stringify({
      brandName: 'Quantum Solar Tech',
      legalBusinessName: 'Quantum Solar Private Limited',
      industryId: 4, // Sustainable Packaging / Clean Energy
      stageId: testStageId,
      pitchHook: 'Next-generation solid-state solar thermal cells with 42% efficiency.',
      businessModel: 'B2B Enterprise',
      originalAskAmount: 7500000, // 75 Lakhs
      originalAskEquityPct: 5.0,
      headquartersCity: 'Bengaluru',
      headquartersState: 'Karnataka',
      pitchStatus: 'DRAFT',
    }),
  });
  assert(createDraftRes.status === 201, 'Founder created DRAFT pitch (201)');
  const createDraftJson = await createDraftRes.json();
  const testPitchId = createDraftJson.pitchId;
  assert(typeof testPitchId === 'number', `Created pitchId: ${testPitchId}`);

  // Update pitch to SUBMITTED
  const updatePitchRes = await fetch(`${API_BASE}/founder/pitches/${testPitchId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: founderCookie },
    body: JSON.stringify({
      pitchHook: 'Updated: Next-gen solar cells with proven lab benchmarks.',
      pitchStatus: 'SUBMITTED',
    }),
  });
  assert(updatePitchRes.status === 200, 'Founder updated pitch to SUBMITTED (200)');
  const updateJson = await updatePitchRes.json();
  assert(updateJson.pitch.pitchStatus === 'SUBMITTED', 'Pitch status updated to SUBMITTED');

  // Intruder attempting to modify founder's pitch
  const intruderEditRes = await fetch(`${API_BASE}/founder/pitches/${testPitchId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: intruderCookie },
    body: JSON.stringify({ brandName: 'Hacked Brand' }),
  });
  assert(intruderEditRes.status === 403, 'Unauthorized user cannot edit another founder pitch (403)');

  // Attempt to edit SHOW TV pitch
  const [showPitch] = await dbPool.execute<RowDataPacket[]>(
    `SELECT pitch_id FROM pitch WHERE pitch_type = 'SHOW' LIMIT 1`,
  );
  if (showPitch.length > 0) {
    const editShowRes = await fetch(`${API_BASE}/founder/pitches/${showPitch[0].pitch_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: founderCookie },
      body: JSON.stringify({ brandName: 'Tampered Show Pitch' }),
    });
    assert(editShowRes.status === 403, 'Historical SHOW pitch cannot be modified (403)');
  }

  // 7. Investor Workspace & Watchlist
  console.log('\n--- 7. INVESTOR WORKSPACE & DISCOVERY INTEGRITY ---');
  // Investor dashboard metrics
  const invDashRes = await fetch(`${API_BASE}/investor/dashboard`, {
    headers: { Cookie: investorCookie },
  });
  assert(invDashRes.status === 200, 'Investor dashboard metrics loaded (200)');
  const invDashJson = await invDashRes.json();
  assert(typeof invDashJson.metrics.totalPublishedCount === 'number', 'Derived real metric from MySQL');

  // Check that unpublished pitch is NOT visible in investor pitches
  const invPitchesRes = await fetch(`${API_BASE}/investor/pitches`, {
    headers: { Cookie: investorCookie },
  });
  assert(invPitchesRes.status === 200, 'Investor pitches fetched (200)');
  const invPitchesJson = await invPitchesRes.json();
  const leakCheck = invPitchesJson.data.some((p: any) => p.pitchId === testPitchId);
  assert(!leakCheck, 'Unpublished SUBMITTED draft pitch is NOT exposed in investor deal room');

  // Mark test pitch as PUBLISHED in test DB so connection request can be tested
  await dbPool.execute(`UPDATE pitch SET pitch_status = 'PUBLISHED' WHERE pitch_id = ?`, [testPitchId]);

  // Now verify it is visible
  const invPitchesAfterPublish = await fetch(`${API_BASE}/investor/pitches`, {
    headers: { Cookie: investorCookie },
  });
  const invPitchesAfterJson = await invPitchesAfterPublish.json();
  const publishedVisible = invPitchesAfterJson.data.some((p: any) => p.pitchId === testPitchId);
  assert(publishedVisible, 'Published platform pitch is visible in investor deal room');

  // Watchlist toggle
  const watchToggle1 = await fetch(`${API_BASE}/investor/watchlist/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: investorCookie },
    body: JSON.stringify({ pitchId: testPitchId }),
  });
  const watchJson1 = await watchToggle1.json();
  assert(watchJson1.saved === true, 'Pitch added to investor watchlist (user_saved_pitch)');

  const watchToggle2 = await fetch(`${API_BASE}/investor/watchlist/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: investorCookie },
    body: JSON.stringify({ pitchId: testPitchId }),
  });
  const watchJson2 = await watchToggle2.json();
  assert(watchJson2.saved === false, 'Pitch removed from investor watchlist');

  // 8. Connection & Messaging Lifecycle
  console.log('\n--- 8. CONNECTION & MESSAGING LIFECYCLE ---');
  // Clean any prior test request between these two
  await dbPool.execute(
    `DELETE FROM connection_request WHERE investor_user_id = ? AND founder_user_id = ?`,
    [investorUser.user_id, founderUser.user_id],
  );

  // Investor sends connection request
  const connReqRes = await fetch(`${API_BASE}/connections/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: investorCookie },
    body: JSON.stringify({
      pitchId: testPitchId,
      initialMessage: 'Interested in leading your Seed round. Let us discuss terms.',
    }),
  });
  assert(connReqRes.status === 201, 'Connection request initiated (201)');
  const connReqJson = await connReqRes.json();
  const requestId = connReqJson.requestId;
  assert(typeof requestId === 'number', `Created connection requestId: ${requestId}`);

  // Duplicate request check (must be rejected)
  const dupReqRes = await fetch(`${API_BASE}/connections/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: investorCookie },
    body: JSON.stringify({
      pitchId: testPitchId,
      initialMessage: 'Duplicate request test.',
    }),
  });
  assert(dupReqRes.status === 409, 'Duplicate active connection request rejected with 409 Conflict');

  // Founder checks incoming connections
  const founderConnRes = await fetch(`${API_BASE}/connections`, {
    headers: { Cookie: founderCookie },
  });
  const founderConnJson = await founderConnRes.json();
  const incomingReq = founderConnJson.incoming.find((r: any) => r.requestId === requestId);
  assert(Boolean(incomingReq), 'Founder sees incoming request in connections hub');

  // Unauthorized intruder attempts to accept founder request
  const intruderAcceptRes = await fetch(`${API_BASE}/connections/${requestId}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: intruderCookie },
    body: JSON.stringify({ action: 'ACCEPT' }),
  });
  assert(intruderAcceptRes.status === 403, 'Intruder cannot respond to founder connection request (403)');

  // Founder accepts request -> conversation opened!
  const founderAcceptRes = await fetch(`${API_BASE}/connections/${requestId}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: founderCookie },
    body: JSON.stringify({ action: 'ACCEPT' }),
  });
  assert(founderAcceptRes.status === 200, 'Founder accepted connection request (200)');
  const founderAcceptJson = await founderAcceptRes.json();
  assert(founderAcceptJson.request.requestStatus === 'ACCEPTED', 'Request status is ACCEPTED');
  const conversationId = founderAcceptJson.request.conversationId;
  assert(typeof conversationId === 'number', `Created conversationId: ${conversationId}`);

  // Investor checks messages in conversation
  const getMsgsRes = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    headers: { Cookie: investorCookie },
  });
  assert(getMsgsRes.status === 200, 'Investor fetched conversation messages (200)');
  const msgsJson = await getMsgsRes.json();
  assert(msgsJson.messages.length >= 1, 'Initial message was captured in conversation history');

  // Intruder attempts to read conversation messages
  const intruderMsgsRes = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    headers: { Cookie: intruderCookie },
  });
  assert(intruderMsgsRes.status === 403, 'Non-participant cannot read conversation messages (403)');

  // Founder sends reply message
  const sendReplyRes = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: founderCookie },
    body: JSON.stringify({ messageBody: 'Thank you for connecting! We are scheduling pitch calls this week.' }),
  });
  assert(sendReplyRes.status === 201, 'Founder sent reply message in conversation (201)');

  // Intruder attempts to send message
  const intruderSendRes = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: intruderCookie },
    body: JSON.stringify({ messageBody: 'Unauthorized message' }),
  });
  assert(intruderSendRes.status === 403, 'Non-participant cannot send message in conversation (403)');

  // End connection
  const endConnRes = await fetch(`${API_BASE}/connections/${requestId}/end`, {
    method: 'POST',
    headers: { Cookie: investorCookie },
  });
  assert(endConnRes.status === 200, 'Connection ended by participant (200)');
  const endJson = await endConnRes.json();
  assert(endJson.request.requestStatus === 'ENDED', 'Connection status is ENDED');

  // Attempt to send message after connection ended -> must fail!
  const sendAfterEndRes = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: founderCookie },
    body: JSON.stringify({ messageBody: 'Late message' }),
  });
  assert(sendAfterEndRes.status === 403, 'Message send rejected in ended/read-only conversation (403)');

  // Messages retained in read-only conversation
  const retainedMsgsRes = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    headers: { Cookie: founderCookie },
  });
  const retainedMsgsJson = await retainedMsgsRes.json();
  assert(retainedMsgsJson.conversationStatus === 'READ_ONLY', 'Conversation status is READ_ONLY');
  assert(retainedMsgsJson.messages.length === 2, 'All historical messages retained after connection ended');

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  await dbPool.end();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
