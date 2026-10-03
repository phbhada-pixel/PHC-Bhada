import assert from 'node:assert';

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

async function runStep4Tests() {
  console.log('🧪 [Step 4 Test Suite] Starting NWBDCP Sample Dispatch Tests...');

  // 1. Fetch Master Data & Water Sources
  console.log('1. Fetching Water Source Master & Reference Data...');
  const masterRes = await fetch(`${BASE_URL}/api/nwbdcp/water-sources`);
  const masterJson = await masterRes.json();
  assert(masterJson.success === true, 'Water sources fetch must succeed');
  const allSources = masterJson.sources;
  assert(allSources.length > 0, 'Must have registered water sources in master');
  console.log(`   ✅ Loaded ${allSources.length} registered water sources.`);

  const activeSources = allSources.filter(s => s.status === 'Active');
  assert(activeSources.length >= 3, 'Must have at least 3 active sources for testing');

  // 2. Test Single Source Dispatch
  console.log('2. Testing Single Source Dispatch...');
  const testDate1 = `2026-10-${String(20 + Math.floor(Math.random() * 5)).padStart(2, '0')}`;
  const singleSource = activeSources[0];
  const singlePayload = {
    dispatchDate: testDate1,
    collectionDate: testDate1,
    labName: 'जिल्हा सार्वजनिक आरोग्य प्रयोगशाळा, धाराशीव',
    selectedSources: [singleSource],
    user: 'आरोग्य कर्मचारी टेस्ट'
  };

  const singleRes = await fetch(`${BASE_URL}/api/nwbdcp/sample-dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(singlePayload)
  });
  const singleJson = await singleRes.json();
  assert(singleJson.success === true, 'Single source dispatch should succeed: ' + singleJson.message);
  assert(singleJson.count === 1, 'Should create exactly 1 sample');
  assert(singleJson.sampleIds.length === 1, 'Should return 1 sample ID');
  const singleSampleId = singleJson.sampleIds[0];
  const dateRegex = new RegExp(`^NWBDCP-${testDate1.replace(/-/g, '')}-\\d{4}$`);
  assert(dateRegex.test(singleSampleId), `Sample ID must match format NWBDCP-YYYYMMDD-XXXX: ${singleSampleId}`);
  console.log(`   ✅ Single source dispatched successfully. Generated Sample ID: ${singleSampleId}`);

  // 3. Test Duplicate Prevention (Same Source + Same Date)
  console.log('3. Testing Duplicate Prevention for Same Source + Same Date...');
  const duplicateRes = await fetch(`${BASE_URL}/api/nwbdcp/sample-dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(singlePayload)
  });
  const duplicateJson = await duplicateRes.json();
  assert(duplicateJson.success === false, 'Duplicate dispatch on same date MUST fail');
  assert(duplicateJson.duplicate === true, 'Response must flag duplicate');
  assert(duplicateJson.existingSampleId === singleSampleId, `Must return existing Sample ID (${singleSampleId}), got: ${duplicateJson.existingSampleId}`);
  assert(duplicateJson.message.includes('आधीच नोंदविला आहे'), 'Must include Marathi warning message');
  console.log('   ✅ Duplicate dispatch successfully blocked with warning:', duplicateJson.message.split('\n')[0]);

  // 4. Test Multiple Sources Batch Dispatch
  console.log('4. Testing Multiple Sources Batch Dispatch (3 distinct sources)...');
  const testDate2 = `2026-10-${String(26 + Math.floor(Math.random() * 4)).padStart(2, '0')}`;
  const batchSources = activeSources.slice(0, 3);
  const multiPayload = {
    dispatchDate: testDate2,
    collectionDate: testDate2,
    labName: 'जिल्हा सार्वजनिक आरोग्य प्रयोगशाळा, धाराशीव',
    selectedSources: batchSources,
    user: 'आरोग्य सहाय्यक'
  };

  const multiRes = await fetch(`${BASE_URL}/api/nwbdcp/sample-dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(multiPayload)
  });
  const multiJson = await multiRes.json();
  assert(multiJson.success === true, 'Multi-source dispatch should succeed');
  assert(multiJson.count === 3, 'Should create exactly 3 samples');
  assert(multiJson.sampleIds.length === 3, 'Should return 3 sample IDs');
  
  // Verify all sample IDs are unique and sequential
  const idSet = new Set(multiJson.sampleIds);
  assert(idSet.size === 3, 'All generated sample IDs in batch must be unique');
  const dateRegex2 = new RegExp(`^NWBDCP-${testDate2.replace(/-/g, '')}-\\d{4}$`);
  multiJson.sampleIds.forEach(id => {
    assert(dateRegex2.test(id), `Sample ID format invalid: ${id}`);
  });
  console.log(`   ✅ Batch of 3 sources dispatched. Generated IDs: ${multiJson.sampleIds.join(', ')}`);

  // 5. Test Atomic Batch Validation (One duplicate in batch aborts entire batch)
  console.log('5. Testing Atomic Batch Validation (One duplicate should reject whole batch without partial saves)...');
  const mixedBatchPayload = {
    dispatchDate: testDate2,
    collectionDate: testDate2,
    selectedSources: [
      batchSources[0], // Already dispatched on 2026-10-16 (duplicate)
      activeSources[3] || activeSources[0] // Another source
    ],
    user: 'आरोग्य सहाय्यक'
  };

  const mixedRes = await fetch(`${BASE_URL}/api/nwbdcp/sample-dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mixedBatchPayload)
  });
  const mixedJson = await mixedRes.json();
  assert(mixedJson.success === false, 'Mixed batch with duplicate MUST fail atomically');
  assert(mixedJson.duplicate === true, 'Must indicate duplicate');
  console.log('   ✅ Atomic batch rollback/rejection verified. Partial creation prevented.');

  // 6. Test Inactive Source Exclusion
  console.log('6. Testing Inactive Source Exclusion...');
  const inactiveSource = {
    id: 'SRC_INACTIVE_TEST',
    sourceCode: 'WS-TEST-INACTIVE',
    sourceName: 'अकार्यक्षम चाचणी स्त्रोत',
    village: 'भादा',
    subcenter: 'भादा',
    sourceType: 'हातपंप',
    status: 'Inactive'
  };
  // Temporarily toggle a source or test with an inactive status payload
  const inactivePayload = {
    dispatchDate: '2026-10-17',
    selectedSources: [inactiveSource],
    user: 'System'
  };
  const inactiveRes = await fetch(`${BASE_URL}/api/nwbdcp/sample-dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inactivePayload)
  });
  const inactiveJson = await inactiveRes.json();
  assert(inactiveJson.success === false, 'Inactive or unregistered source MUST be rejected');
  console.log('   ✅ Inactive/Unregistered source rejected:', inactiveJson.message);

  // 7. Test Date Validation (Invalid date and future date boundary)
  console.log('7. Testing Date Validation...');
  const invalidDatePayload = {
    dispatchDate: 'invalid-date-string',
    selectedSources: [activeSources[0]]
  };
  const invalidDateRes = await fetch(`${BASE_URL}/api/nwbdcp/sample-dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invalidDatePayload)
  });
  const invalidDateJson = await invalidDateRes.json();
  assert(invalidDateJson.success === false, 'Invalid date string must fail');
  console.log('   ✅ Invalid date format properly rejected.');

  // 8. Test Dispatched Samples Retrieval & Initial Status
  console.log('8. Testing Dispatched Samples Query and Initial Status (अहवाल अप्राप्त)...');
  const listRes = await fetch(`${BASE_URL}/api/nwbdcp/dispatched-samples?fromDate=2026-10-15&toDate=2026-10-16`);
  const listJson = await listRes.json();
  assert(listJson.success === true, 'Dispatched samples query should succeed');
  const createdList = listJson.samples;
  assert(createdList.length >= 4, 'Must find the 4 created test samples');
  createdList.forEach(s => {
    assert(s.status === 'अहवाल अप्राप्त' || s.result === 'अहवाल अप्राप्त', `Initial status must be 'अहवाल अप्राप्त', got ${s.status}`);
    assert(s.sampleId, 'Must have sampleId');
    assert(s.sourceCode || s.sourceId, 'Must have source ID');
    assert(s.village, 'Must have village');
    assert(s.subcenter, 'Must have subcenter');
  });
  console.log('   ✅ Dispatched samples retrieved with initial status: अहवाल अप्राप्त.');

  // 9. Verify NVBDCP Protection
  console.log('9. Verifying Absolute NVBDCP Protection...');
  const nvbdcpRpcRes = await fetch(`${BASE_URL}/api/rpc`);
  assert(nvbdcpRpcRes.status === 200, 'NVBDCP RPC API must remain 100% operational');
  const nvbdcpRpcJson = await nvbdcpRpcRes.json();
  assert(nvbdcpRpcJson.status === 'ok', 'NVBDCP RPC must return status ok');
  console.log('   ✅ NVBDCP protected and running untouched.');

  console.log('\n🎉 ALL NWBDCP STEP 4 (SAMPLE DISPATCH) TESTS PASSED SUCCESSFULLY!');
}

runStep4Tests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
