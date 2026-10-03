import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  supabaseClient,
  syncSubcenterToSupabase,
  syncVillageToSupabase,
  syncEmployeeToSupabase,
  syncMonthMasterToSupabase,
  syncBsDataToSupabase,
  syncVillageDetailsToSupabase
} from '../services/nvbdcpSupabase.js';
import {
  subcenterMaster,
  villagesMaster,
  employeeMaster,
  monthMaster,
  bsDataEntry,
  villageDetails,
  transferHistory,
  dengueChikungunyaEntries
} from '../data/store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('===============================================================');
  console.log('🚀 STEP 4O-H: NVBDCP SUPABASE DATA MIGRATION');
  console.log('===============================================================');

  if (!supabaseClient) {
    console.error('❌ Supabase client not initialized. Missing environment variables.');
    process.exit(1);
  }

  // 1. Verify existing NWBDCP counts before migration
  console.log('\n--- VERIFYING NWBDCP PRE-MIGRATION COUNTS ---');
  const nwTables = [
    'NWBDCP_WaterSources',
    'NWBDCP_DispatchedSamples',
    'NWBDCP_SampleResults',
    'NWBDCP_Retests',
    'NWBDCP_AuditLogs'
  ];
  for (const t of nwTables) {
    const { count, error } = await supabaseClient.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.error(`❌ Error checking NWBDCP table ${t}:`, error.message);
    } else {
      console.log(`✅ ${t}: ${count}`);
    }
  }

  // 2. Migrate Subcenters
  console.log(`\n--- MIGRATING SUBCENTERS (${subcenterMaster.length} records) ---`);
  let scSuccess = 0;
  for (const sc of subcenterMaster) {
    const res = await syncSubcenterToSupabase(sc);
    if (res.success) scSuccess++;
    else console.error(`❌ Failed migrating subcenter ${sc.name}:`, res.error);
  }
  console.log(`✅ Subcenters migrated: ${scSuccess}/${subcenterMaster.length}`);

  // 3. Migrate Villages
  console.log(`\n--- MIGRATING VILLAGES (${villagesMaster.length} records) ---`);
  let vSuccess = 0;
  for (const v of villagesMaster) {
    const res = await syncVillageToSupabase(v);
    if (res.success) vSuccess++;
    else console.error(`❌ Failed migrating village ${v.villageName}:`, res.error);
  }
  console.log(`✅ Villages migrated: ${vSuccess}/${villagesMaster.length}`);

  // 4. Migrate Employees
  console.log(`\n--- MIGRATING EMPLOYEES (${employeeMaster.length} records) ---`);
  let empSuccess = 0;
  for (const emp of employeeMaster) {
    const res = await syncEmployeeToSupabase(emp);
    if (res.success) empSuccess++;
    else console.error(`❌ Failed migrating employee ${emp.employeeName}:`, res.error);
  }
  console.log(`✅ Employees migrated: ${empSuccess}/${employeeMaster.length}`);

  // 5. Migrate Month Master
  console.log(`\n--- MIGRATING MONTH MASTER (${monthMaster.length} records) ---`);
  let mmSuccess = 0;
  for (const m of monthMaster) {
    const res = await syncMonthMasterToSupabase(m);
    if (res.success) mmSuccess++;
    else console.error(`❌ Failed migrating month ${m.name}:`, res.error);
  }
  console.log(`✅ MonthMaster migrated: ${mmSuccess}/${monthMaster.length}`);

  // 6. Migrate BsDataEntry
  console.log(`\n--- MIGRATING BS DATA ENTRY (${bsDataEntry.length} records) ---`);
  const bsRes = await syncBsDataToSupabase(bsDataEntry);
  if (bsRes.success) {
    console.log(`✅ BsDataEntry batch migrated successfully (${bsRes.count} records).`);
  } else {
    console.error('❌ Failed migrating BsDataEntry:', bsRes.error);
  }

  // 7. Migrate VillageDetails with deterministic ID preservation
  console.log(`\n--- MIGRATING VILLAGE DETAILS (${villageDetails.length} records) ---`);
  // Format each village details with deterministic unique IDs: VD_${bs_id}_${village}_${index}
  const formattedVd = villageDetails.map((vd, idx) => {
    if (Array.isArray(vd)) {
      const bsId = String(vd[0] || '').trim();
      const vName = String(vd[3] || '').trim();
      return {
        _id: `VD_${bsId}_${vName}_${idx}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
        bs_id: bsId,
        employee_name: vd[1] || '',
        date: vd[2] ? new Date(vd[2]).toISOString() : new Date().toISOString(),
        village_name: vName,
        sample_count: Number(vd[4]) || 0,
        male_count: Number(vd[5]) || 0,
        female_count: Number(vd[6]) || 0,
        upkendra: vd[7] || ''
      };
    }
    return vd;
  });

  const vdRes = await syncVillageDetailsToSupabase(formattedVd);
  if (vdRes.success) {
    console.log(`✅ VillageDetails batch migrated successfully (${vdRes.count} records).`);
  } else {
    console.error('❌ Failed migrating VillageDetails:', vdRes.error);
  }

  // 8. Query LIVE Supabase post-migration counts
  console.log('\n===============================================================');
  console.log('🔍 LIVE POST-MIGRATION SUPABASE VERIFICATION');
  console.log('===============================================================');

  const nvTables = [
    'NVBDCP_Subcenters',
    'NVBDCP_Villages',
    'NVBDCP_Employees',
    'NVBDCP_MonthMaster',
    'NVBDCP_BsDataEntry',
    'NVBDCP_VillageDetails',
    'NVBDCP_TransferHistory',
    'NVBDCP_DengueChikungunya'
  ];

  for (const t of nvTables) {
    const { count, error } = await supabaseClient.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`❌ ${t}: ERROR ->`, error.message);
    } else {
      console.log(`✅ ${t}: Live Row Count = ${count}`);
    }
  }

  console.log('\n--- VERIFYING NWBDCP POST-MIGRATION COUNTS (NO MUTATIONS) ---');
  for (const t of nwTables) {
    const { count, error } = await supabaseClient.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.error(`❌ Error checking NWBDCP table ${t}:`, error.message);
    } else {
      console.log(`✅ ${t}: Live Row Count = ${count}`);
    }
  }

  console.log('\n🎉 Migration execution completed.');
}

runMigration().catch(err => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
