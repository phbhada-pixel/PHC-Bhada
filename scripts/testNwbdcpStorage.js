import assert from 'node:assert';

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

async function runTests() {
  console.log('🧪 [Test Suite] Starting NWBDCP Supabase + Google Drive Storage Tests...');

  // 1. Check Storage Status Endpoint
  console.log('1. Testing /api/nwbdcp/storage/status...');
  const statusRes = await fetch(`${BASE_URL}/api/nwbdcp/storage/status`);
  const statusJson = await statusRes.json();
  assert(statusJson.success === true, 'Status response should be successful');
  console.log('   ✅ Storage status checked:', statusJson);

  // 2. Test File Upload (Sample PDF Laboratory Report)
  console.log('2. Testing PDF Report Upload to Google Drive + Supabase...');
  const samplePdfBase64 = 'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwgL0xlbmd0aCA1IDAgUiAvRmlsdGVyIC9GbGF0ZURlY29kZSA+PgpzdHJlYW0KeJzLzcxL1UgsSi3KycxLVTA0MDAAAA3wBTEKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjE5CmVuZG9iagoxIDAgb2JqCjw8IC9UeXBlIC9DYXRhbG9nIC9QYWdlcyAyIDAgUiA+PgplbmRvYmoKMiAwIG9iago8PCAvVHlwZSAvUGFnZXMgL0tpZHMgWyAzIDAgUiBdIC9Db3VudCAxID4+CmVuZG9iagozIDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDEzMiAwMDAwMCBuIAowMDAwMDAwMTgzIDAwMDAwIG4gCjAwMDAwMDAyNDQgMDAwMDAgbiAKMDAwMDAwMDAxOSAwMDAwMCBuIAowMDAwMDAwMTEzIDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKMzQ1CiUlRU9GCg==';

  const uploadPayload = {
    sampleId: 'NWBDCP-20260930-TEST01',
    module: 'laboratory_reports',
    fileName: 'Lab_Report_Bhada_Sample_01.pdf',
    fileData: `data:application/pdf;base64,${samplePdfBase64}`,
    user: 'Lab Tech Dr. Kulkarni'
  };

  const uploadRes = await fetch(`${BASE_URL}/api/nwbdcp/storage/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(uploadPayload)
  });

  const uploadJson = await uploadRes.json();
  assert(uploadJson.success === true, 'Upload should succeed');
  assert(uploadJson.file.googleDriveFileId, 'Must have Google Drive File ID');
  assert(uploadJson.file.googleDriveUrl, 'Must have Google Drive URL');
  assert(uploadJson.file.folderPath.includes('NWBDCP/LaboratoryReports'), 'Must be in LaboratoryReports folder');
  console.log('   ✅ Uploaded PDF to Google Drive. File ID:', uploadJson.file.googleDriveFileId);

  const initialDriveFileId = uploadJson.file.googleDriveFileId;

  // 3. Test Lazy Loading Metadata Retrieval
  console.log('3. Testing Lazy-loaded Metadata Retrieval from Supabase...');
  const metaRes = await fetch(`${BASE_URL}/api/nwbdcp/storage/files/NWBDCP-20260930-TEST01`);
  const metaJson = await metaRes.json();
  assert(metaJson.success === true, 'Metadata retrieval should succeed');
  assert(metaJson.activeFile.google_drive_file_id === initialDriveFileId, 'Active file Google Drive ID should match');
  console.log('   ✅ Metadata retrieved without downloading full binary content.');

  // 4. Test Secure File Serving / Proxy
  console.log('4. Testing Secure File Serving Endpoint...');
  const serveRes = await fetch(`${BASE_URL}/api/nwbdcp/storage/serve/${initialDriveFileId}`);
  assert(serveRes.status === 200, 'File serving should return HTTP 200');
  const contentType = serveRes.headers.get('content-type');
  assert(contentType.includes('pdf'), 'Content-Type should be PDF');
  console.log('   ✅ File served securely with Content-Type:', contentType);

  // 5. Test Unauthorized Access Prevention
  console.log('5. Testing Unauthorized Access Prevention with Invalid File ID...');
  const unauthRes = await fetch(`${BASE_URL}/api/nwbdcp/storage/serve/INVALID_TAMPERED_ID_9999`);
  assert(unauthRes.status === 403, 'Unauthorized access must return HTTP 403');
  console.log('   ✅ Unauthorized access successfully blocked with HTTP 403.');

  // 6. Test File Replacement & Audit Log
  console.log('6. Testing File Replacement (New Version + History Preservation)...');
  const replacePayload = {
    sampleId: 'NWBDCP-20260930-TEST01',
    module: 'laboratory_reports',
    fileName: 'Lab_Report_Bhada_Sample_01_CORRECTED.pdf',
    fileData: `data:application/pdf;base64,${samplePdfBase64}`,
    replacementReason: 'सुधारित प्रयोगशाळा स्वाक्षरी प्रत',
    user: 'Medical Officer Dr. Patil'
  };

  const replaceRes = await fetch(`${BASE_URL}/api/nwbdcp/storage/replace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(replacePayload)
  });

  const replaceJson = await replaceRes.json();
  assert(replaceJson.success === true, 'Replacement should succeed');
  assert(replaceJson.file.googleDriveFileId !== initialDriveFileId, 'New file must have its own Drive File ID');
  assert(replaceJson.auditLog.old_file_id === initialDriveFileId, 'Audit log must record old Drive File ID');
  console.log('   ✅ Replacement recorded in Supabase audit trail. New Drive File ID:', replaceJson.file.googleDriveFileId);

  // 7. Verify History contains both versions
  console.log('7. Verifying Version History in Supabase...');
  const historyRes = await fetch(`${BASE_URL}/api/nwbdcp/storage/files/NWBDCP-20260930-TEST01`);
  const historyJson = await historyRes.json();
  assert(historyJson.history.length >= 2, 'History must have at least 2 versions');
  console.log(`   ✅ Complete version history preserved (${historyJson.history.length} versions).`);

  // 8. Verify NVBDCP Protection
  console.log('8. Verifying NVBDCP Protection...');
  const nvbdcpRpcRes = await fetch(`${BASE_URL}/api/rpc`);
  assert(nvbdcpRpcRes.status === 200, 'NVBDCP RPC API must remain fully operational');
  const nvbdcpRpcJson = await nvbdcpRpcRes.json();
  assert(nvbdcpRpcJson.status === 'ok', 'NVBDCP RPC status must be ok');

  const defaultDataRes = await fetch(`${BASE_URL}/defaultData.js`);
  assert(defaultDataRes.status === 200, 'NVBDCP defaultData.js must be accessible');
  console.log('   ✅ NVBDCP protected and running untouched.');

  console.log('\n🎉 ALL NWBDCP SUPABASE + GOOGLE DRIVE STORAGE TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
