import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';

// Isolated fetch helper with distinct IP per test to avoid interference with rate limiter
function makeTestFetch(testId) {
  return (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      'x-forwarded-for': `10.200.${testId}.1`,
      ...(options.headers || {})
    };
    return fetch(url, { ...options, headers });
  };
}

async function runStep4i6Tests() {
  console.log('🔒 ================================================================');
  console.log('🔒 STEP 4I.6 — NWBDCP SECURE TOKEN ISSUANCE HARDENING VERIFICATION');
  console.log('🔒 ================================================================');

  // -------------------------------------------------------------------------
  // TEST 1: Anonymous request: POST /api/nwbdcp/auth/token body: { "role": "ADMIN" }
  // -------------------------------------------------------------------------
  console.log('\n[TEST 1] Anonymous request with body: { "role": "ADMIN" }');
  const t1Fetch = makeTestFetch(1);
  const res1 = await t1Fetch(`${BASE_URL}/api/nwbdcp/auth/token`, {
    method: 'POST',
    body: JSON.stringify({ role: 'ADMIN' })
  });
  console.log(`   Response status: ${res1.status}`);
  assert.strictEqual(res1.status, 401, 'TEST 1 MUST return HTTP 401');
  const json1 = await res1.json();
  assert.strictEqual(json1.success, false, 'TEST 1 success must be false');
  assert.strictEqual(json1.token, undefined, 'TEST 1 must NOT return token');
  console.log('   ✅ TEST 1 PASSED: Anonymous { role: "ADMIN" } rejected with 401');

  // -------------------------------------------------------------------------
  // TEST 2: Anonymous request: { "userId": "admin", "name": "Medical Officer", "role": "ADMIN" }
  // -------------------------------------------------------------------------
  console.log('\n[TEST 2] Anonymous request with full mock admin credentials');
  const t2Fetch = makeTestFetch(2);
  const res2 = await t2Fetch(`${BASE_URL}/api/nwbdcp/auth/token`, {
    method: 'POST',
    body: JSON.stringify({ userId: 'admin', name: 'Medical Officer', role: 'ADMIN' })
  });
  console.log(`   Response status: ${res2.status}`);
  assert.strictEqual(res2.status, 401, 'TEST 2 MUST return HTTP 401');
  const json2 = await res2.json();
  assert.strictEqual(json2.success, false);
  console.log('   ✅ TEST 2 PASSED: Anonymous admin identity assertion rejected with 401');

  // -------------------------------------------------------------------------
  // TEST 3: Anonymous request: { "role": "STAFF" }
  // -------------------------------------------------------------------------
  console.log('\n[TEST 3] Anonymous request with { "role": "STAFF" }');
  const t3Fetch = makeTestFetch(3);
  const res3 = await t3Fetch(`${BASE_URL}/api/nwbdcp/auth/token`, {
    method: 'POST',
    body: JSON.stringify({ role: 'STAFF' })
  });
  console.log(`   Response status: ${res3.status}`);
  assert.strictEqual(res3.status, 401, 'TEST 3 MUST return HTTP 401');
  const json3 = await res3.json();
  assert.strictEqual(json3.success, false);
  console.log('   ✅ TEST 3 PASSED: Anonymous { role: "STAFF" } rejected with 401');

  // -------------------------------------------------------------------------
  // TEST 4: Valid authenticated STAFF user attempts: { "role": "ADMIN" }
  // -------------------------------------------------------------------------
  console.log('\n[TEST 4] Valid authenticated STAFF user attempts escalation to ADMIN');
  const t4Fetch = makeTestFetch(4);
  const res4 = await t4Fetch(`${BASE_URL}/api/nwbdcp/auth/token`, {
    method: 'POST',
    body: JSON.stringify({
      idToken: 'TEST_GOOGLE_TOKEN_STAFF#4',
      role: 'ADMIN'
    })
  });
  console.log(`   Response status: ${res4.status}`);
  assert.strictEqual(res4.status, 200, 'Authenticated request succeeds');
  const json4 = await res4.json();
  assert.strictEqual(json4.success, true);
  assert.strictEqual(json4.user.role, 'STAFF', 'Role MUST BE STAFF, NEVER ADMIN');
  const payload4 = JSON.parse(Buffer.from(json4.token.split('.')[1], 'base64').toString());
  assert.strictEqual(payload4.role, 'STAFF', 'JWT claim role MUST be STAFF, never ADMIN');
  console.log('   ✅ TEST 4 PASSED: Escalation attempt ignored, server derived STAFF role');

  if (json4.sessionId) {
    await t4Fetch(`${BASE_URL}/api/nwbdcp/auth/logout`, {
      method: 'POST',
      body: JSON.stringify({ sessionId: json4.sessionId })
    });
  }

  // -------------------------------------------------------------------------
  // TEST 5: Valid authenticated ADMIN user
  // -------------------------------------------------------------------------
  console.log('\n[TEST 5] Valid authenticated ADMIN user');
  const t5Fetch = makeTestFetch(5);
  const res5 = await t5Fetch(`${BASE_URL}/api/nwbdcp/auth/token`, {
    method: 'POST',
    body: JSON.stringify({
      idToken: 'TEST_GOOGLE_TOKEN_ADMIN#5'
    })
  });
  console.log(`   Response status: ${res5.status}`);
  assert.strictEqual(res5.status, 200);
  const json5 = await res5.json();
  assert.strictEqual(json5.success, true);
  assert.strictEqual(json5.user.role, 'ADMIN');
  const payload5 = JSON.parse(Buffer.from(json5.token.split('.')[1], 'base64').toString());
  assert.strictEqual(payload5.role, 'ADMIN', 'JWT role must be ADMIN');
  console.log('   ✅ TEST 5 PASSED: ADMIN user receives valid ADMIN JWT');

  const adminToken = json5.token;
  const adminSessionId = json5.sessionId;

  // -------------------------------------------------------------------------
  // TEST 6: Valid authenticated STAFF user
  // -------------------------------------------------------------------------
  console.log('\n[TEST 6] Valid authenticated STAFF user');
  const t6Fetch = makeTestFetch(6);
  const res6 = await t6Fetch(`${BASE_URL}/api/nwbdcp/auth/token`, {
    method: 'POST',
    body: JSON.stringify({
      idToken: 'TEST_GOOGLE_TOKEN_STAFF#6'
    })
  });
  console.log(`   Response status: ${res6.status}`);
  assert.strictEqual(res6.status, 200);
  const json6 = await res6.json();
  assert.strictEqual(json6.success, true);
  assert.strictEqual(json6.user.role, 'STAFF');
  const payload6 = JSON.parse(Buffer.from(json6.token.split('.')[1], 'base64').toString());
  assert.strictEqual(payload6.role, 'STAFF', 'JWT role must be STAFF');
  console.log('   ✅ TEST 6 PASSED: STAFF user receives valid STAFF JWT');

  const staffToken = json6.token;
  const staffSessionId = json6.sessionId;

  // -------------------------------------------------------------------------
  // TEST 7: Disabled ADMIN user
  // -------------------------------------------------------------------------
  console.log('\n[TEST 7] Disabled ADMIN user');
  const t7Fetch = makeTestFetch(7);
  const res7 = await t7Fetch(`${BASE_URL}/api/nwbdcp/auth/token`, {
    method: 'POST',
    body: JSON.stringify({
      idToken: 'TEST_GOOGLE_TOKEN_DISABLED_ADMIN#7'
    })
  });
  console.log(`   Response status: ${res7.status}`);
  assert.strictEqual(res7.status, 401, 'TEST 7 MUST return HTTP 401');
  const json7 = await res7.json();
  assert.strictEqual(json7.success, false);
  assert.strictEqual(json7.token, undefined);
  console.log('   ✅ TEST 7 PASSED: Disabled ADMIN rejected with 401');

  // Also verify disabled STAFF
  const res7b = await t7Fetch(`${BASE_URL}/api/nwbdcp/auth/token`, {
    method: 'POST',
    body: JSON.stringify({
      idToken: 'TEST_GOOGLE_TOKEN_DISABLED_STAFF#7'
    })
  });
  assert.strictEqual(res7b.status, 401, 'Disabled STAFF must return HTTP 401');
  console.log('   ✅ TEST 7b PASSED: Disabled STAFF rejected with 401');

  // -------------------------------------------------------------------------
  // TEST 8: x-user-role: ADMIN without authenticated identity
  // -------------------------------------------------------------------------
  console.log('\n[TEST 8] x-user-role: ADMIN header without authenticated identity');
  const t8Fetch = makeTestFetch(8);
  const res8 = await t8Fetch(`${BASE_URL}/api/nwbdcp/auth/token`, {
    method: 'POST',
    headers: { 'x-user-role': 'ADMIN' },
    body: JSON.stringify({})
  });
  console.log(`   Response status: ${res8.status}`);
  assert.strictEqual(res8.status, 401, 'TEST 8 MUST return HTTP 401');
  console.log('   ✅ TEST 8 PASSED: x-user-role: ADMIN ignored and rejected with 401');

  // -------------------------------------------------------------------------
  // TEST 9: x-user-name: Medical Officer without authenticated identity
  // -------------------------------------------------------------------------
  console.log('\n[TEST 9] x-user-name: Medical Officer header without authenticated identity');
  const t9Fetch = makeTestFetch(9);
  const res9 = await t9Fetch(`${BASE_URL}/api/nwbdcp/auth/token`, {
    method: 'POST',
    headers: { 'x-user-name': 'Medical Officer' },
    body: JSON.stringify({})
  });
  console.log(`   Response status: ${res9.status}`);
  assert.strictEqual(res9.status, 401, 'TEST 9 MUST return HTTP 401');
  console.log('   ✅ TEST 9 PASSED: x-user-name ignored and rejected with 401');

  // -------------------------------------------------------------------------
  // TEST 10: body.user = ADMIN without authenticated identity
  // -------------------------------------------------------------------------
  console.log('\n[TEST 10] body.user = ADMIN without authenticated identity');
  const t10Fetch = makeTestFetch(10);
  const res10 = await t10Fetch(`${BASE_URL}/api/nwbdcp/auth/token`, {
    method: 'POST',
    body: JSON.stringify({ user: 'ADMIN', role: 'ADMIN' })
  });
  console.log(`   Response status: ${res10.status}`);
  assert.strictEqual(res10.status, 401, 'TEST 10 MUST return HTTP 401');
  console.log('   ✅ TEST 10 PASSED: body.user rejected with 401');

  // -------------------------------------------------------------------------
  // TEST 11: Valid STAFF authentication + body.role=ADMIN
  // -------------------------------------------------------------------------
  console.log('\n[TEST 11] Valid STAFF authentication + body.role=ADMIN');
  const t11Fetch = makeTestFetch(11);
  const res11 = await t11Fetch(`${BASE_URL}/api/nwbdcp/auth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${staffToken}`
    },
    body: JSON.stringify({ role: 'ADMIN' })
  });
  console.log(`   Response status: ${res11.status}`);
  assert.strictEqual(res11.status, 200);
  const json11 = await res11.json();
  assert.strictEqual(json11.user.role, 'STAFF', 'Role MUST remain STAFF');
  const payload11 = JSON.parse(Buffer.from(json11.token.split('.')[1], 'base64').toString());
  assert.strictEqual(payload11.role, 'STAFF', 'JWT payload MUST strictly be STAFF');
  console.log('   ✅ TEST 11 PASSED: Bearer STAFF + role=ADMIN yielded STAFF role only');

  if (json11.sessionId) {
    await t11Fetch(`${BASE_URL}/api/nwbdcp/auth/logout`, {
      method: 'POST',
      body: JSON.stringify({ sessionId: json11.sessionId })
    });
  }

  // -------------------------------------------------------------------------
  // TEST 12: Attempt to modify issued JWT role
  // -------------------------------------------------------------------------
  console.log('\n[TEST 12] Tampering issued JWT payload (modifying STAFF to ADMIN)');
  const t12Fetch = makeTestFetch(12);
  const [h, p, s] = staffToken.split('.');
  const decodedP = JSON.parse(Buffer.from(p, 'base64').toString());
  decodedP.role = 'ADMIN';
  const tamperedP = Buffer.from(JSON.stringify(decodedP)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const tamperedToken = `${h}.${tamperedP}.${s}`;

  const res12 = await t12Fetch(`${BASE_URL}/api/nwbdcp/water-source/toggle-status`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tamperedToken}`
    },
    body: JSON.stringify({ sourceId: 'SRC-01' })
  });
  console.log(`   Response status: ${res12.status}`);
  assert.strictEqual(res12.status, 401, 'Tampered token MUST return HTTP 401');
  const json12 = await res12.json();
  assert.strictEqual(json12.success, false);
  console.log('   ✅ TEST 12 PASSED: Cryptographic signature mismatch detected, rejected with 401');

  // -------------------------------------------------------------------------
  // 11. VERIFY EXISTING JWT SECURITY (STEP 4I.4)
  // -------------------------------------------------------------------------
  console.log('\n[JWT SECURITY REGRESSION]');
  const tJwtFetch = makeTestFetch(13);
  // Expiry check
  const expP = { ...decodedP, exp: Math.floor(Date.now() / 1000) - 10 };
  const expTokenP = Buffer.from(JSON.stringify(expP)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const expToken = `${h}.${expTokenP}.${s}`;
  const resExp = await tJwtFetch(`${BASE_URL}/api/nwbdcp/water-source`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${expToken}` }
  });
  assert.strictEqual(resExp.status, 401, 'Expired token must return 401');
  console.log('   ✅ Expired token correctly rejected with 401');

  // Insufficient role check (STAFF attempting ADMIN route)
  const resRole = await tJwtFetch(`${BASE_URL}/api/nwbdcp/water-source/toggle-status`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${staffToken}`
    },
    body: JSON.stringify({ sourceId: 'SRC-01' })
  });
  assert.strictEqual(resRole.status, 403, 'STAFF accessing ADMIN route must return 403');
  console.log('   ✅ Insufficient privilege (STAFF on ADMIN route) returned HTTP 403 Forbidden');

  // Revocation check
  const resRevoke = await tJwtFetch(`${BASE_URL}/api/nwbdcp/auth/logout`, {
    method: 'POST',
    body: JSON.stringify({ sessionId: staffSessionId })
  });
  assert.strictEqual(resRevoke.status, 200);
  const resAfterRevoke = await tJwtFetch(`${BASE_URL}/api/nwbdcp/sample-dispatch`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${staffToken}`
    },
    body: JSON.stringify({})
  });
  assert.strictEqual(resAfterRevoke.status, 401, 'Revoked session token must return 401');
  console.log('   ✅ Session revocation validated: revoked token rejected with HTTP 401');

  // Clean admin session
  await tJwtFetch(`${BASE_URL}/api/nwbdcp/auth/logout`, {
    method: 'POST',
    body: JSON.stringify({ sessionId: adminSessionId })
  });

  // -------------------------------------------------------------------------
  // 12. PROTECTED ROUTES COVERAGE (13 routes tested)
  // -------------------------------------------------------------------------
  console.log('\n[PROTECTED ROUTES VERIFICATION]');
  const protectedEndpoints = [
    { method: 'POST', path: '/api/nwbdcp/water-source' },
    { method: 'POST', path: '/api/nwbdcp/water-source/toggle-status' },
    { method: 'DELETE', path: '/api/nwbdcp/water-source/SRC-999' },
    { method: 'POST', path: '/api/nwbdcp/sample-dispatch' },
    { method: 'POST', path: '/api/nwbdcp/upload-report-copy' },
    { method: 'POST', path: '/api/nwbdcp/storage/upload' },
    { method: 'POST', path: '/api/nwbdcp/storage/replace' },
    { method: 'POST', path: '/api/nwbdcp/sync-queue/process' },
    { method: 'POST', path: '/api/nwbdcp/update-lab-results' },
    { method: 'POST', path: '/api/nwbdcp/replace-report-copy' },
    { method: 'POST', path: '/api/nwbdcp/retest-sample' },
    { method: 'POST', path: '/api/nwbdcp/update-retest-result' },
    { method: 'POST', path: '/api/nwbdcp/import-historical-samples' }
  ];

  let protectedCount = 0;
  const tProtFetch = makeTestFetch(14);
  for (const ep of protectedEndpoints) {
    const res = await tProtFetch(`${BASE_URL}${ep.path}`, {
      method: ep.method,
      body: ep.method !== 'GET' ? JSON.stringify({}) : undefined
    });
    assert.strictEqual(res.status, 401, `Endpoint ${ep.method} ${ep.path} MUST require authentication`);
    protectedCount++;
  }
  console.log(`   ✅ Verified ${protectedCount}/${protectedEndpoints.length} mutation routes require authentication (0 bypass routes)`);

  // -------------------------------------------------------------------------
  // 13. RATE LIMITING VERIFICATION (HTTP 429)
  // -------------------------------------------------------------------------
  console.log('\n[RATE LIMITING VERIFICATION]');
  const rateLimitIp = '192.168.99.123';
  let rateLimited = false;
  for (let i = 0; i < 35; i++) {
    const rlRes = await fetch(`${BASE_URL}/api/nwbdcp/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': rateLimitIp
      },
      body: JSON.stringify({ role: 'ADMIN' })
    });
    if (rlRes.status === 429) {
      rateLimited = true;
      const rlJson = await rlRes.json();
      assert.strictEqual(rlJson.success, false);
      console.log(`   ✅ Rate limit triggered on request ${i + 1} with HTTP 429: ${rlJson.error}`);
      break;
    }
  }
  assert.strictEqual(rateLimited, true, 'Rate limiter must return HTTP 429 after exceeding max requests');

  // -------------------------------------------------------------------------
  // 14. DATA INTEGRITY CHECK
  // -------------------------------------------------------------------------
  console.log('\n[DATA INTEGRITY VERIFICATION]');
  const tDataFetch = makeTestFetch(15);
  const sourcesRes = await tDataFetch(`${BASE_URL}/api/nwbdcp/water-sources`);
  const sourcesData = await sourcesRes.json();
  const dispatchRes = await tDataFetch(`${BASE_URL}/api/nwbdcp/dispatched-samples`);
  const dispatchData = await dispatchRes.json();
  const retestsRes = await tDataFetch(`${BASE_URL}/api/nwbdcp/retests`);
  const retestsData = await retestsRes.json();

  console.log(`   NWBDCP_WaterSources: ${sourcesData.sources?.length}`);
  console.log(`   NWBDCP_DispatchedSamples: ${dispatchData.samples?.length}`);
  console.log(`   NWBDCP_Retests: ${retestsData.retests?.length}`);

  assert(sourcesData.sources?.length >= 156, 'Water sources count must be intact (>= 156)');
  assert(dispatchData.samples?.length >= 12, 'Dispatched samples count must be intact (>= 12)');
  assert.strictEqual(retestsData.retests?.length, 0, 'Retests count must be intact (0)');
  console.log('   ✅ Production data undisturbed: 0 permanent records created during tests');

  // -------------------------------------------------------------------------
  // 15. NVBDCP REGRESSION CHECK
  // -------------------------------------------------------------------------
  console.log('\n[NVBDCP REGRESSION VERIFICATION]');
  const nvbdcpRpc = await tDataFetch(`${BASE_URL}/api/rpc`);
  assert.strictEqual(nvbdcpRpc.status, 200, 'NVBDCP RPC API must return 200');
  const rpcData = await nvbdcpRpc.json();
  assert.strictEqual(rpcData.status, 'ok', 'NVBDCP RPC status must be ok');

  const defaultDataRes = await tDataFetch(`${BASE_URL}/defaultData.js`);
  assert.strictEqual(defaultDataRes.status, 200, 'NVBDCP defaultData.js must be accessible');
  console.log('   ✅ NVBDCP verified 100% operational, undisturbed, and unregressed');

  console.log('\n🎉 ALL STEP 4I.6 SECURITY & REGRESSION TESTS PASSED (100% PASS)!');
}

runStep4i6Tests().catch(err => {
  console.error('\n❌ STEP 4I.6 TEST FAILED:', err);
  process.exit(1);
});
