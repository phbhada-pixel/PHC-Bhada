import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  supabaseClient,
  syncBsDataToSupabase,
  syncVillageDetailsToSupabase,
  syncVillageToSupabase
} from '../services/nvbdcpSupabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to parse CSV line safely
function parseCsvRows(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    if (vals.length === 0 || (vals.length === 1 && !vals[0])) continue;
    const obj = {};
    header.forEach((h, idx) => {
      obj[h.trim()] = vals[idx] !== undefined ? vals[idx].trim() : '';
    });
    rows.push(obj);
  }
  return { header, rows };
}

function parseCsvLine(line) {
  const values = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      values.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  values.push(cur);
  return values;
}

export async function migrateDeltaFiles() {
  console.log('===============================================================');
  console.log('🚀 STEP 4O-J: NVBDCP DELTA FILE RECONCILIATION & IMPORT');
  console.log('===============================================================');

  if (!supabaseClient) {
    console.error('❌ Supabase client not initialized.');
    return { success: false, error: 'Supabase client not initialized' };
  }

  const bsCsvFile = path.join(rootDir, 'BsDataEntry_PHC_Bhada (1).csv');
  const vdCsvFile = path.join(rootDir, 'VillageDetails_PHC_Bhada (2).csv');
  const vmCsvFile = path.join(rootDir, 'VillagesMaster_PHC_Bhada.csv');

  const filesAvailable = {
    bs: fs.existsSync(bsCsvFile),
    vd: fs.existsSync(vdCsvFile),
    vm: fs.existsSync(vmCsvFile)
  };

  console.log('File availability:', filesAvailable);

  if (!filesAvailable.bs || !filesAvailable.vd) {
    console.warn('⚠️ One or more authoritative delta CSV files are not present in root directory.');
    return {
      success: false,
      status: 'AUTHORITATIVE SOURCE FILES NOT AVAILABLE',
      missingFiles: [
        !filesAvailable.bs ? 'BsDataEntry_PHC_Bhada (1).csv' : null,
        !filesAvailable.vd ? 'VillageDetails_PHC_Bhada (2).csv' : null,
        !filesAvailable.vm ? 'VillagesMaster_PHC_Bhada.csv' : null
      ].filter(Boolean)
    };
  }

  // 1. Process VillagesMaster if present
  if (filesAvailable.vm) {
    const vmContent = fs.readFileSync(vmCsvFile, 'utf8');
    const { rows: vmRows } = parseCsvRows(vmContent);
    console.log(`VillagesMaster source rows: ${vmRows.length}`);
  }

  // 2. Process BsDataEntry delta
  const bsContent = fs.readFileSync(bsCsvFile, 'utf8');
  const { rows: bsRows } = parseCsvRows(bsContent);
  console.log(`Authoritative BsDataEntry rows: ${bsRows.length}`);

  // Fetch existing IDs from Supabase
  const { data: existingBs, error: bsFetchErr } = await supabaseClient
    .from('NVBDCP_BsDataEntry')
    .select('id');
  if (bsFetchErr) throw bsFetchErr;

  const existingBsIdSet = new Set((existingBs || []).map(r => r.id));
  console.log(`Existing Supabase BsDataEntry count: ${existingBsIdSet.size}`);

  const missingBsRows = [];
  bsRows.forEach(row => {
    const id = row.BS_ID || row.id || row['नोंदणी क्र.'] || row.bs_id;
    if (id && !existingBsIdSet.has(id)) {
      missingBsRows.push({
        id: id,
        date: row.date || row['तारीख'] || new Date().toISOString(),
        upkendra: row.upkendra || row['उपकेंद्र'] || '',
        employee_name: row.employee_name || row['कर्मचाऱ्याचे नाव'] || row.employeeName || '',
        designation: row.designation || row['पदनाम'] || '',
        bs_code: row.bs_code || row['BS Code'] || row.bsCode || '',
        bundle_number: row.bundle_number || row['Bundle Number'] || row.bundleNumber || '',
        pasun: Number(row.pasun || row['पासून'] || 0),
        paraynt: Number(row.paraynt || row['पर्यंत'] || 0),
        total: Number(row.total || row['एकूण नमुने'] || 0)
      });
    }
  });

  console.log(`Identified missing BsDataEntry rows: ${missingBsRows.length}`);
  let bsInserted = 0;
  if (missingBsRows.length > 0) {
    const syncRes = await syncBsDataToSupabase(missingBsRows);
    if (syncRes.success) bsInserted = missingBsRows.length;
  }

  // 3. Process VillageDetails delta
  const vdContent = fs.readFileSync(vdCsvFile, 'utf8');
  const { rows: vdRows } = parseCsvRows(vdContent);
  console.log(`Authoritative VillageDetails rows: ${vdRows.length}`);

  const { data: existingVd, error: vdFetchErr } = await supabaseClient
    .from('NVBDCP_VillageDetails')
    .select('id');
  if (vdFetchErr) throw vdFetchErr;

  const existingVdIdSet = new Set((existingVd || []).map(r => r.id));
  console.log(`Existing Supabase VillageDetails count: ${existingVdIdSet.size}`);

  const missingVdRows = [];
  vdRows.forEach((row, idx) => {
    const bsId = row.bs_id || row.BS_ID || row.bsId || row['नोंदणी क्र.'];
    const vName = row.village_name || row['गावाचे नाव'] || row.villageName || '';
    const detId = row.id || `VD_${bsId}_${vName}_${idx}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!existingVdIdSet.has(detId)) {
      missingVdRows.push({
        id: detId,
        bs_id: bsId,
        employee_name: row.employee_name || row['कर्मचाऱ्याचे नाव'] || row.employeeName || '',
        date: row.date || row['तारीख'] || new Date().toISOString(),
        village_name: vName,
        sample_count: Number(row.sample_count || row['नमुने संख्या'] || 0),
        male_count: Number(row.male_count || row['पुरुष'] || 0),
        female_count: Number(row.female_count || row['स्त्री'] || 0),
        upkendra: row.upkendra || row['उपकेंद्र'] || ''
      });
    }
  });

  console.log(`Identified missing VillageDetails rows: ${missingVdRows.length}`);
  let vdInserted = 0;
  if (missingVdRows.length > 0) {
    const syncVdRes = await syncVillageDetailsToSupabase(missingVdRows);
    if (syncVdRes.success) vdInserted = missingVdRows.length;
  }

  return {
    success: true,
    bsInserted,
    vdInserted
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrateDeltaFiles().then(res => {
    console.log('Result:', res);
  }).catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
}
