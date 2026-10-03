// =========================================================================
// NWBDCP SUPABASE DATA MIGRATION & VERIFICATION SCRIPT
// Reads /data/nwbdcp_db.json -> Verifies Supabase -> Migrates & Audits
// =========================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NWBDCP_DB_FILE = path.join(__dirname, '../data/nwbdcp_db.json');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

async function runMigration() {
  console.log('====================================================');
  console.log('🚀 STARTING NWBDCP SUPABASE DATA MIGRATION AUDIT');
  console.log('====================================================\n');

  // 1. Read Local DB
  if (!fs.existsSync(NWBDCP_DB_FILE)) {
    console.error('❌ /data/nwbdcp_db.json does not exist!');
    process.exit(1);
  }

  const raw = fs.readFileSync(NWBDCP_DB_FILE, 'utf8');
  const localDb = JSON.parse(raw);

  const localWaterSources = Array.isArray(localDb.waterSources) ? localDb.waterSources : [];
  const localDispatches = Array.isArray(localDb.sampleDispatches) ? localDb.sampleDispatches : [];
  const localResults = Array.isArray(localDb.sampleResults) ? localDb.sampleResults : [];
  const localRetests = Array.isArray(localDb.retests) ? localDb.retests : [];
  const localAuditLogs = Array.isArray(localDb.auditLogs) ? localDb.auditLogs : [];

  console.log('📁 LOCAL JSON RECORD COUNTS (/data/nwbdcp_db.json):');
  console.log(` - Water Sources:       ${localWaterSources.length}`);
  console.log(` - Sample Dispatches:   ${localDispatches.length}`);
  console.log(` - Sample Results:      ${localResults.length}`);
  console.log(` - Retests:             ${localRetests.length}`);
  console.log(` - Audit Logs:          ${localAuditLogs.length}\n`);

  // 2. Connect to Supabase
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Supabase credentials missing from environment (SUPABASE_URL / SUPABASE_ANON_KEY).');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log(`🌐 CONNECTED TO SUPABASE: ${SUPABASE_URL}\n`);

  // 3. Schema Pre-flight Check
  console.log('🔍 CHECKING SUPABASE TABLES EXISTENCE:');
  const requiredTables = [
    'NWBDCP_WaterSources',
    'NWBDCP_DispatchedSamples',
    'NWBDCP_SampleResults',
    'NWBDCP_Retests',
    'NWBDCP_AuditLogs',
    'nwbdcp_files',
    'nwbdcp_file_audit_logs',
    'nwbdcp_sync_queue'
  ];

  let allTablesExist = true;
  const tableStatus = {};

  for (const tbl of requiredTables) {
    try {
      const { data, error } = await supabase.from(tbl).select('*').limit(1);
      if (error) {
        allTablesExist = false;
        tableStatus[tbl] = `MISSING / ERROR (${error.message})`;
        console.log(`  ❌ Table [${tbl}]: ${error.message}`);
      } else {
        tableStatus[tbl] = `READY`;
        console.log(`  ✅ Table [${tbl}]: READY`);
      }
    } catch (err) {
      allTablesExist = false;
      tableStatus[tbl] = `EXCEPTION (${err.message})`;
      console.log(`  ❌ Table [${tbl}]: ${err.message}`);
    }
  }

  if (!allTablesExist) {
    console.log('\n⚠️ PHASE 15 FAILURE SAFETY TRIGGERED:');
    console.log('Supabase tables are not yet created in the PostgreSQL database.');
    console.log('To provision the tables, please run the SQL script located at:');
    console.log('👉 /scripts/nwbdcp_supabase_schema.sql in the Supabase SQL Editor.');
    console.log('\nMigration stopped safely without modifying /data/nwbdcp_db.json or application reads.');
    return {
      success: false,
      reason: 'SUPABASE_TABLES_MISSING',
      tableStatus,
      localCounts: {
        waterSources: localWaterSources.length,
        sampleDispatches: localDispatches.length,
        sampleResults: localResults.length,
        retests: localRetests.length,
        auditLogs: localAuditLogs.length
      }
    };
  }

  // 4. Migration Execution (If tables ready)
  console.log('\n🔄 RUNNING DATA MIGRATION...');
  let migratedSources = 0;
  let migratedDispatches = 0;

  // Migrate Water Sources
  for (const src of localWaterSources) {
    const record = {
      id: src.id,
      source_code: src.sourceCode || src.sourceId,
      source_id: src.sourceId || src.sourceCode,
      subcenter: src.subcenter,
      gram_panchayat: src.gramPanchayat || src.village,
      village: src.village,
      source_name: src.sourceName,
      source_type: src.sourceType,
      ownership: src.ownership || 'अज्ञात / Not Specified',
      status: src.status || 'Active',
      location: src.location || '',
      created_date: src.createdDate,
      updated_date: src.updatedDate,
      created_by: src.createdBy || 'System',
      updated_by: src.updatedBy || 'System'
    };
    const { error } = await supabase.from('NWBDCP_WaterSources').upsert([record], { onConflict: 'id' });
    if (!error) migratedSources++;
  }

  // Migrate Dispatches
  for (const d of localDispatches) {
    const record = {
      id: d.sampleId || d.id,
      sample_id: d.sampleId || d.id,
      source_id: d.sourceCode || d.sourceId || '',
      source_code: d.sourceCode || d.sourceId || '',
      subcenter: d.subcenter,
      gram_panchayat: d.gramPanchayat || d.village,
      village: d.village,
      source_name: d.sourceName,
      source_type: d.sourceType,
      ownership: d.ownership || 'शासकीय',
      location: d.location || '',
      collection_date: d.collectionDate || d.dispatchDate,
      dispatch_date: d.dispatchDate,
      lab_name: d.labName,
      dispatched_by: d.dispatchedBy,
      remarks: d.remarks || '',
      status: d.status || 'अहवाल अप्राप्त',
      result: d.result || 'अहवाल अप्राप्त',
      created_date: d.createdDate || new Date().toISOString(),
      created_by: d.createdBy || 'System',
      history: d.history || []
    };
    const { error } = await supabase.from('NWBDCP_DispatchedSamples').upsert([record], { onConflict: 'sample_id' });
    if (!error) migratedDispatches++;
  }

  console.log(`✅ Migrated ${migratedSources} Water Sources and ${migratedDispatches} Dispatches to Supabase.`);

  return {
    success: true,
    migratedSources,
    migratedDispatches
  };
}

runMigration().then(r => console.log('\nMigration result:', JSON.stringify(r, null, 2))).catch(console.error);
