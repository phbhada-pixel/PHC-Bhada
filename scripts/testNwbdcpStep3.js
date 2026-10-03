import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';

async function runStep3Tests() {
  console.log('💧 [NWBDCP Step 3 Suite] Starting Water Source Master Verification Tests...');

  // 1. Fetch NVBDCP Read-Only Master Reference
  console.log('1. Testing Read-Only NVBDCP Master Reference...');
  const refRes = await fetch(`${BASE_URL}/api/nwbdcp/master-data`);
  const refJson = await refRes.json();
  assert(refJson.success === true, 'Master data reference must return success');
  assert(Array.isArray(refJson.subcenters) && refJson.subcenters.length > 0, 'Must contain subcenters');
  assert(Array.isArray(refJson.villages) && refJson.villages.length > 0, 'Must contain villages');
  console.log(`   ✅ Read-only reference loaded: ${refJson.subcenters.length} subcenters, ${refJson.villages.length} villages.`);

  // 2. Test Subcenter-Village Dependency Rejection
  console.log('2. Testing Subcenter-Village Dependency Rejection...');
  const invalidDepPayload = {
    subcenter: 'भादा',
    village: 'आलमला', // Alamla belongs to Subcenter Alamla, not Bhada
    sourceName: 'अनधिकृत गाव स्त्रोत',
    sourceType: 'विहीर',
    ownership: 'शासकीय'
  };

  const invalidDepRes = await fetch(`${BASE_URL}/api/nwbdcp/water-source`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invalidDepPayload)
  });
  const invalidDepJson = await invalidDepRes.json();
  assert(invalidDepJson.success === false, 'Mismatched subcenter-village must be rejected');
  console.log('   ✅ Subcenter-Village dependency mismatch successfully rejected:', invalidDepJson.message);

  // 3. Add Valid Water Source
  console.log('3. Testing Add Valid Water Source...');
  const validPayload = {
    subcenter: 'भादा',
    village: 'भादा',
    sourceName: 'भादा नवीन RO प्लांट जि.प. शाळा परिसर',
    sourceType: 'RO Plant',
    ownership: 'शासकीय',
    location: 'जि.प. प्राथमिक शाळा, भादा'
  };

  const addRes = await fetch(`${BASE_URL}/api/nwbdcp/water-source`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload)
  });
  const addJson = await addRes.json();
  assert(addJson.success === true, 'Add valid water source must succeed');
  assert(addJson.source.sourceCode.startsWith('WS-BHD-RO-'), 'Source ID must follow standard format');
  assert(addJson.source.status === 'Active', 'New source must default to Active');
  console.log('   ✅ Valid source created:', addJson.source.sourceName, '[ID:', addJson.source.sourceCode, ']');

  const newSourceObj = addJson.source;

  // 4. Test Duplicate Source Warning
  console.log('4. Testing Duplicate Source Detection Warning...');
  const dupRes = await fetch(`${BASE_URL}/api/nwbdcp/water-source`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload)
  });
  const dupJson = await dupRes.json();
  assert(dupJson.success === false, 'Duplicate source without allowDuplicate must return false');
  assert(dupJson.isDuplicate === true, 'Must set isDuplicate flag');
  console.log('   ✅ Duplicate source detected and warning triggered:', dupJson.message.split('\n')[0]);

  // 5. Test Duplicate Source with User Force Confirmation
  console.log('5. Testing Duplicate Source Save with User Override (allowDuplicate: true)...');
  const overrideRes = await fetch(`${BASE_URL}/api/nwbdcp/water-source`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...validPayload, allowDuplicate: true })
  });
  const overrideJson = await overrideRes.json();
  assert(overrideJson.success === true, 'Allowed duplicate must succeed');
  assert(overrideJson.source.sourceCode !== newSourceObj.sourceCode, 'Duplicate must get a unique permanent Source ID');
  console.log('   ✅ Duplicate created with distinct permanent Source ID:', overrideJson.source.sourceCode);

  // 6. Test Edit Water Source (Source ID Immutability)
  console.log('6. Testing Edit Water Source (Source ID Immutability)...');
  const editPayload = {
    id: newSourceObj.id,
    sourceCode: 'WS-MODIFIED-SHOULD-BE-IGNORED',
    subcenter: 'भादा',
    village: 'भादा',
    sourceName: 'भादा सुधारित RO प्लांट (अद्ययावत माहिती)',
    sourceType: 'RO Plant',
    ownership: 'खाजगी',
    status: 'Active'
  };

  const editRes = await fetch(`${BASE_URL}/api/nwbdcp/water-source`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(editPayload)
  });
  const editJson = await editRes.json();
  assert(editJson.success === true, 'Edit water source must succeed');
  assert(editJson.source.sourceCode === newSourceObj.sourceCode, 'Source ID must remain immutable');
  assert(editJson.source.ownership === 'खाजगी', 'Ownership must update to खाजगी');
  console.log('   ✅ Source edited. Source ID preserved immutably:', editJson.source.sourceCode);

  // 7. Test Soft Delete / Status Toggle (Active <-> Inactive)
  console.log('7. Testing Status Toggle (Active ➔ Inactive ➔ Active)...');
  const toggleRes1 = await fetch(`${BASE_URL}/api/nwbdcp/water-source/toggle-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: newSourceObj.id })
  });
  const toggleJson1 = await toggleRes1.json();
  assert(toggleJson1.success === true, 'Toggle status must succeed');
  assert(toggleJson1.source.status === 'Inactive', 'Status must become Inactive');

  const toggleRes2 = await fetch(`${BASE_URL}/api/nwbdcp/water-source/toggle-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: newSourceObj.id })
  });
  const toggleJson2 = await toggleRes2.json();
  assert(toggleJson2.success === true, 'Re-toggle status must succeed');
  assert(toggleJson2.source.status === 'Active', 'Status must return to Active');
  console.log('   ✅ Status toggle tested: Active ➔ Inactive ➔ Active.');

  // 8. Test Hard Delete Rejection for Sources with Sample History
  console.log('8. Testing Hard Delete Rejection for Source with History...');
  // Pick an existing initial seed source that has dispatch history
  const sourcesRes = await fetch(`${BASE_URL}/api/nwbdcp/water-sources?status=ALL`);
  const sourcesJson = await sourcesRes.json();
  const seedSourceWithHistory = sourcesJson.sources.find(s => s.id === 'SRC_1001' || s.sourceCode === 'WS-BHD-TAP-001');

  if (seedSourceWithHistory) {
    const delRes = await fetch(`${BASE_URL}/api/nwbdcp/water-source/${seedSourceWithHistory.id}`, { method: 'DELETE' });
    const delJson = await delRes.json();
    assert(delJson.success === false, 'Hard delete for source with sample history must be rejected');
    assert(delJson.hasHistory === true, 'Must indicate historical sample records exist');
    console.log('   ✅ Hard delete rejected as expected. Soft-delete / Inactive required:', delJson.message);
  }

  // 9. Search and Filter Tests
  console.log('9. Testing Water Source Search and Filters...');
  const filterRes = await fetch(`${BASE_URL}/api/nwbdcp/water-sources?subcenter=भादा&sourceType=RO Plant&status=Active`);
  const filterJson = await filterRes.json();
  assert(filterJson.success === true, 'Filtered fetch must succeed');
  assert(filterJson.sources.every(s => s.subcenter === 'भादा' && s.sourceType === 'RO Plant'), 'All returned sources must match filters');
  console.log(`   ✅ Search & Filter verified (${filterJson.sources.length} matching sources found).`);

  // 10. NVBDCP Regression Verification
  console.log('10. Verifying NVBDCP Protection & RPC Health...');
  const rpcRes = await fetch(`${BASE_URL}/api/rpc`);
  assert(rpcRes.status === 200, 'NVBDCP RPC API must return 200');
  const rpcData = await rpcRes.json();
  assert(rpcData.status === 'ok', 'NVBDCP RPC status must be ok');

  const defaultDataRes = await fetch(`${BASE_URL}/defaultData.js`);
  assert(defaultDataRes.status === 200, 'NVBDCP defaultData.js must be accessible');
  console.log('   ✅ NVBDCP verified 100% operational and undisturbed.');

  console.log('\n🎉 ALL NWBDCP STEP 3 WATER SOURCE MASTER TESTS PASSED SUCCESSFULLY!');
}

runStep3Tests().catch(err => {
  console.error('❌ Step 3 test failed:', err);
  process.exit(1);
});
