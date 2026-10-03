import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';

async function runHardeningTests() {
  console.log('🚀 [Hardening Suite] Starting Production Hardening Verification Tests...');

  // 1. Storage Status
  console.log('1. Checking Storage Status...');
  const statusRes = await fetch(`${BASE_URL}/api/nwbdcp/storage/status`);
  const status = await statusRes.json();
  assert(status.success === true, 'Storage status endpoint must succeed');
  console.log('   ✅ Storage Status:', status);

  // 2. Storage Integrity Check
  console.log('2. Testing Read-Only Storage Integrity Check...');
  const integrityRes = await fetch(`${BASE_URL}/api/nwbdcp/storage/integrity-check`);
  const integrity = await integrityRes.json();
  assert(integrity.success === true, 'Integrity check must return success');
  assert(integrity.issues.multipleActiveFilesSameDocument.length === 0, 'No duplicate active files for same document');
  console.log('   ✅ Integrity check passed: 0 conflicting active references detected.');

  // Obtain authenticated STAFF token for storage tests
  const tokenRes = await fetch(`${BASE_URL}/api/nwbdcp/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: 'TEST_GOOGLE_TOKEN_STAFF#hardening' })
  });
  const tokenData = await tokenRes.json();
  assert(tokenData.success === true, 'Must obtain valid staff token');
  const staffAuthHeader = { 'Authorization': `Bearer ${tokenData.token}` };

  // 3. Reject corrupted / spoofed file (e.g. text file disguised as .pdf)
  console.log('3. Testing Magic Bytes / Header Validation (Spoofed PDF)...');
  const fakePdfPayload = {
    sampleId: 'NWBDCP-20260930-FAKE01',
    module: 'laboratory_reports',
    fileName: 'Malicious_Spoofed.pdf',
    fileData: 'data:application/pdf;base64,' + Buffer.from('NOT_A_REAL_PDF_FILE_HEADER').toString('base64'),
    user: 'Attacker'
  };

  const fakeRes = await fetch(`${BASE_URL}/api/nwbdcp/storage/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...staffAuthHeader },
    body: JSON.stringify(fakePdfPayload)
  });
  assert(fakeRes.status === 400, 'Spoofed PDF must be rejected with HTTP 400');
  const fakeJson = await fakeRes.json();
  assert(fakeJson.success === false, 'Spoofed file upload must fail');
  console.log('   ✅ Spoofed file header successfully rejected:', fakeJson.error);

  // 4. Valid PDF Upload
  console.log('4. Testing Valid PDF Upload & Metadata Sanitation...');
  const validPdfBase64 = 'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwgL0xlbmd0aCA1IDAgUiAvRmlsdGVyIC9GbGF0ZURlY29kZSA+PgpzdHJlYW0KeJzLzcxL1UgsSi3KycxLVTA0MDAAAA3wBTEKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjE5CmVuZG9iagoxIDAgb2JqCjw8IC9UeXBlIC9DYXRhbG9nIC9QYWdlcyAyIDAgUiA+PgplbmRvYmoKMiAwIG9iago8PCAvVHlwZSAvUGFnZXMgL0tpZHMgWyAzIDAgUiBdIC9Db3VudCAxID4+CmVuZG9iagozIDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDEzMiAwMDAwMCBuIAowMDAwMDAwMTgzIDAwMDAwIG4gCjAwMDAwMDAyNDQgMDAwMDAgbiAKMDAwMDAwMDAxOSAwMDAwMCBuIAowMDAwMDAwMTEzIDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKMzQ1CiUlRU9GCg==';

  const uploadPayload = {
    sampleId: 'NWBDCP-20260930-SEC01',
    module: 'laboratory_reports',
    fileName: 'Official_Lab_Report_01.pdf',
    fileData: `data:application/pdf;base64,${validPdfBase64}`,
    user: 'Medical Officer Dr. Patil'
  };

  const uploadRes = await fetch(`${BASE_URL}/api/nwbdcp/storage/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...staffAuthHeader },
    body: JSON.stringify(uploadPayload)
  });
  const uploadJson = await uploadRes.json();
  assert(uploadJson.success === true, 'Upload must succeed');
  assert(uploadJson.file.googleDriveFileId, 'Must have Drive ID');
  const validDriveId = uploadJson.file.googleDriveFileId;
  console.log('   ✅ Valid PDF upload succeeded. Google Drive ID:', validDriveId);

  // 5. Test Lazy-Loading (Fetch metadata only, verify NO binary in metadata)
  console.log('5. Verifying Metadata Purity (No binary or base64)...');
  const metaRes = await fetch(`${BASE_URL}/api/nwbdcp/storage/files/NWBDCP-20260930-SEC01`);
  const metaJson = await metaRes.json();
  assert(metaJson.success === true, 'Metadata retrieval must succeed');
  assert(metaJson.activeFile.fileData === undefined, 'No fileData in metadata');
  assert(metaJson.activeFile.fileBuffer === undefined, 'No fileBuffer in metadata');
  assert(metaJson.activeFile.base64 === undefined, 'No base64 in metadata');
  console.log('   ✅ Metadata contains strictly references, Google Drive links, and metadata.');

  // 6. Test Security Rejection on Tampered File ID
  console.log('6. Testing Unauthorized Access Rejection on Tampered File ID...');
  const tamperRes = await fetch(`${BASE_URL}/api/nwbdcp/storage/serve/TAMPERED_INJECTED_ID_888`);
  assert(tamperRes.status === 403, 'Tampered ID must return HTTP 403');
  const tamperJson = await tamperRes.json();
  assert(tamperJson.success === false, 'Access must be blocked');
  console.log('   ✅ Unauthorized request blocked with HTTP 403 Forbidden.');

  // 7. Test Authorized File Serving
  console.log('7. Testing Authorized File Serving...');
  const serveRes = await fetch(`${BASE_URL}/api/nwbdcp/storage/serve/${validDriveId}`, { redirect: 'manual' });
  assert(serveRes.status === 200 || serveRes.status === 302, 'Valid file serving must return HTTP 200 or 302 redirect');
  if (serveRes.status === 302) {
    assert(serveRes.headers.get('location').includes('drive.google.com'), 'Must redirect to Google Drive');
    console.log('   ✅ Authorized file redirected with HTTP 302 to Google Drive URL.');
  } else {
    assert(serveRes.headers.get('content-type').includes('pdf'), 'Content-Type must be PDF');
    console.log('   ✅ Authorized file served with HTTP 200 and Content-Type application/pdf.');
  }

  // 8. Test NVBDCP Regression (Zero impact on NVBDCP)
  console.log('8. Testing NVBDCP Absolute Protection & Regression...');
  const nvbdcpRpc = await fetch(`${BASE_URL}/api/rpc`);
  assert(nvbdcpRpc.status === 200, 'NVBDCP RPC API must return 200');
  const rpcData = await nvbdcpRpc.json();
  assert(rpcData.status === 'ok', 'NVBDCP RPC status must be ok');

  const defaultDataRes = await fetch(`${BASE_URL}/defaultData.js`);
  assert(defaultDataRes.status === 200, 'NVBDCP defaultData.js must be accessible');
  console.log('   ✅ NVBDCP verified 100% operational and undisturbed.');

  console.log('\n🎉 ALL PRODUCTION HARDENING TESTS PASSED!');
}

runHardeningTests().catch(err => {
  console.error('❌ Hardening test failed:', err);
  process.exit(1);
});
