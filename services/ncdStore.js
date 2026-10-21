// =========================================================================
// PHC BHADA — NCD (NON-COMMUNICABLE DISEASES) MANAGEMENT MODULE
// Primary & Authoritative Database: Supabase PostgreSQL (via nwbdcp_sync_queue)
// Persistent Local Cache: data/ncd_db.json
// Supports: Complete Dataset Replacement (CBAC, Screening, Treatment Line Listings),
//           Exact CSV SHC/Village Preservation, Cross-File Consistency Auditing,
//           Subcenter/Village/Period/Disease-wise Reporting, Line Listings & Excel Exports
// =========================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { supabaseClient, isSupabaseOnline } from './nvbdcpSupabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NCD_DB_FILE = path.join(__dirname, '../data/ncd_db.json');

// In-Memory Active NCD Dataset
export let ncdIndividuals = [];        // Patients / Line Listing (Active Dataset)
export let ncdCbacRecords = [];        // CBAC Form Entries (Active Dataset)
export let ncdScreeningRecords = [];   // HTN, DM, Oral, Breast, Cervical Screenings (Active Dataset)
export let ncdTreatmentRecords = [];   // Treatment & Follow-up Entries (Active Dataset)
export let ncdImportBatches = [];      // Import & Replacement History Logs

export let activeDatasetVersion = 'NCD_DS_DEFAULT';

// Server-side Staging Sessions for Large Multi-File Chunked Uploads (avoids 32MB Cloud Run proxy limit)
const stagedUploadSessions = new Map();

export function stageNcdCsvChunk(payload = {}) {
  const {
    sessionId = 'default_ncd_session',
    fileIndex = 0,
    filename = '',
    chunkIndex = 0,
    totalChunks = 1,
    chunkData = '',
    resetSession = false
  } = payload;

  if (resetSession || !stagedUploadSessions.has(sessionId)) {
    stagedUploadSessions.set(sessionId, {
      createdAt: Date.now(),
      files: new Map()
    });
  }

  const session = stagedUploadSessions.get(sessionId);
  session.updatedAt = Date.now();

  if (!session.files.has(fileIndex)) {
    session.files.set(fileIndex, {
      filename: filename || `File_${fileIndex + 1}.csv`,
      chunks: new Array(totalChunks).fill(''),
      receivedChunks: 0,
      totalChunks
    });
  }

  const fileEntry = session.files.get(fileIndex);
  if (filename) fileEntry.filename = filename;
  fileEntry.chunks[chunkIndex] = String(chunkData || '');
  fileEntry.receivedChunks++;

  return {
    success: true,
    sessionId,
    fileIndex,
    filename: fileEntry.filename,
    chunkIndex,
    totalChunks
  };
}

export function clearNcdStagedSession(sessionId = 'default_ncd_session') {
  stagedUploadSessions.delete(sessionId);
  return { success: true };
}

function getReassembledStagedFiles(sessionId = 'default_ncd_session') {
  const session = stagedUploadSessions.get(sessionId);
  if (!session || !session.files || session.files.size === 0) return [];
  const sortedIndices = Array.from(session.files.keys()).sort((a, b) => a - b);
  return sortedIndices.map(idx => {
    const f = session.files.get(idx);
    return {
      filename: f.filename,
      csvContent: f.chunks.join('')
    };
  });
}

// Helper for date parsing (Supports DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, DD Mon YYYY, ISO timestamps)
export function parseNcdDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const str = String(val).trim();
  if (!str || str === 'N/A' || str === 'NA' || str === 'null' || str === 'undefined' || str === '-' || str === '--') return null;

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const mDmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (mDmy) {
    const d = parseInt(mDmy[1], 10);
    const m = parseInt(mDmy[2], 10) - 1;
    const y = parseInt(mDmy[3], 10);
    if (m >= 0 && m <= 11 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      const date = new Date(y, m, d, 12, 0, 0);
      return isNaN(date.getTime()) ? null : date;
    }
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const mIso = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (mIso) {
    const y = parseInt(mIso[1], 10);
    const m = parseInt(mIso[2], 10) - 1;
    const d = parseInt(mIso[3], 10);
    if (m >= 0 && m <= 11 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      const date = new Date(y, m, d, 12, 0, 0);
      return isNaN(date.getTime()) ? null : date;
    }
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function formatNcdDateStr(d) {
  const parsed = parseNcdDate(d);
  if (!parsed) return '';
  const day = String(parsed.getDate()).padStart(2, '0');
  const mon = String(parsed.getMonth() + 1).padStart(2, '0');
  const yr = parsed.getFullYear();
  return `${day}/${mon}/${yr}`;
}

export function formatNcdIsoDate(d) {
  const parsed = parseNcdDate(d);
  if (!parsed) return '';
  const day = String(parsed.getDate()).padStart(2, '0');
  const mon = String(parsed.getMonth() + 1).padStart(2, '0');
  const yr = parsed.getFullYear();
  return `${yr}-${mon}-${day}`;
}

// =========================================================================
// STATUS NORMALIZATION & CLASSIFICATION HELPERS (STEP NCD-07)
// =========================================================================

// Screening CSV uses values such as:
// - "Completed Screening"
// - "Pending Screening"
// - "Not Eligible for Screening"
// - "Screened" / "Completed"
export function classifyScreeningStatus(statusVal, dateVal) {
  const st = String(statusVal || '').trim().toLowerCase();
  const hasValidDate = Boolean(parseNcdDate(dateVal));

  if (st.includes('not eligible') || st.includes('ineligible')) {
    return 'NOT_ELIGIBLE';
  }
  if (st.includes('pending') || st.includes('not screened') || st.includes('due') || st === 'no') {
    return 'PENDING';
  }
  if (
    st === 'completed screening' ||
    st === 'screened' ||
    st === 'completed' ||
    st === 'done' ||
    st === 'yes' ||
    st.includes('completed screening') ||
    (st.includes('screened') && !st.includes('not')) ||
    (st.includes('completed') && !st.includes('not'))
  ) {
    // Count a completed screening only when the source status represents completion AND the relevant screening date is valid
    return hasValidDate ? 'COMPLETED' : 'COMPLETED_NO_DATE';
  }

  if (!st && hasValidDate) {
    return 'COMPLETED';
  }

  return 'OTHER';
}

export function isCompletedScreeningRecord(s) {
  if (!s) return false;
  return classifyScreeningStatus(s.raw_screening_status || s.screening_status, s.screened_date) === 'COMPLETED';
}

// Treatment CSV uses values such as:
// - "Adhering to Follow-up"
// - "Newly Diagnosed"
// - "Missed Follow-up"
// - "Under Treatment"
// - blank values
export function classifyTreatmentStatus(statusVal, startDateVal, followupDateVal) {
  const st = String(statusVal || '').trim().toLowerCase();
  const hasValidStart = Boolean(parseNcdDate(startDateVal));
  const hasValidFollowup = Boolean(parseNcdDate(followupDateVal));

  if (
    st === 'not applicable' ||
    st === 'na' ||
    st === 'n/a' ||
    st === 'none' ||
    st === 'no' ||
    st === '-' ||
    st === '--' ||
    st.includes('not eligible') ||
    st.includes('not on treatment')
  ) {
    return 'NONE';
  }

  if (st.includes('adhering') || st.includes('regular') || st.includes('completed follow')) {
    return 'ADHERING_FOLLOWUP';
  }
  if (st.includes('newly diagnosed') || st === 'new' || st.includes('newly')) {
    return 'NEWLY_DIAGNOSED';
  }
  if (st.includes('missed') || st.includes('default') || st.includes('lost') || st.includes('overdue') || st.includes('pending follow')) {
    return 'MISSED_FOLLOWUP';
  }
  if (st.includes('under') || st.includes('treatment') || st.includes('active') || st.includes('initiated') || st.includes('follow-up') || st.includes('followup')) {
    return 'UNDER_TREATMENT';
  }

  if (hasValidStart || hasValidFollowup) {
    return 'UNDER_TREATMENT';
  }

  return 'NONE';
}

export function isActiveTreatmentRecord(t) {
  if (!t) return false;
  const cat = classifyTreatmentStatus(t.raw_treatment_status || t.treatment_status, t.treatment_start_date, t.last_followup_date);
  return cat === 'ADHERING_FOLLOWUP' || cat === 'NEWLY_DIAGNOSED' || cat === 'MISSED_FOLLOWUP' || cat === 'UNDER_TREATMENT';
}

export function isMissedFollowupRecord(t) {
  if (!t) return false;
  return classifyTreatmentStatus(t.raw_treatment_status || t.treatment_status, t.treatment_start_date, t.last_followup_date) === 'MISSED_FOLLOWUP';
}

export function isAdheringFollowupRecord(t) {
  if (!t) return false;
  return classifyTreatmentStatus(t.raw_treatment_status || t.treatment_status, t.treatment_start_date, t.last_followup_date) === 'ADHERING_FOLLOWUP';
}

export function isNewlyDiagnosedRecord(t) {
  if (!t) return false;
  return classifyTreatmentStatus(t.raw_treatment_status || t.treatment_status, t.treatment_start_date, t.last_followup_date) === 'NEWLY_DIAGNOSED';
}

// Disk Persistence Helper
function saveNcdDbToDisk() {
  try {
    const payload = {
      activeDatasetVersion,
      ncdIndividuals,
      ncdCbacRecords,
      ncdScreeningRecords,
      ncdTreatmentRecords,
      ncdImportBatches,
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(NCD_DB_FILE, JSON.stringify(payload), 'utf8');
  } catch (err) {
    console.warn('[NCD Store] Warning saving NCD cache to disk:', err.message);
  }
}

const DUMMY_NCD_BATCH_IDS = new Set(['NCD_DS_1792315514660']);
const DUMMY_NCD_IND_IDS = new Set(['IND_10001', 'IND_10002', 'IND_10003']);

function isDummyNcdBatch(b) {
  if (!b) return false;
  if (DUMMY_NCD_BATCH_IDS.has(b.batch_id)) return true;
  if (b.cbac_filename === 'cbac_sample_2026.csv' && b.total_individuals === 3) return true;
  return false;
}

function isDummyNcdRecord(r) {
  if (!r) return false;
  if (DUMMY_NCD_BATCH_IDS.has(r.dataset_version)) return true;
  if (DUMMY_NCD_IND_IDS.has(r.individual_id)) return true;
  return false;
}

function loadNcdDbFromDisk() {
  try {
    if (fs.existsSync(NCD_DB_FILE)) {
      const content = fs.readFileSync(NCD_DB_FILE, 'utf8');
      const data = JSON.parse(content);
      if (data.activeDatasetVersion && !DUMMY_NCD_BATCH_IDS.has(data.activeDatasetVersion)) {
        activeDatasetVersion = data.activeDatasetVersion;
      } else {
        activeDatasetVersion = null;
      }
      if (Array.isArray(data.ncdIndividuals)) ncdIndividuals = data.ncdIndividuals.filter(r => !isDummyNcdRecord(r));
      if (Array.isArray(data.ncdCbacRecords)) ncdCbacRecords = data.ncdCbacRecords.filter(r => !isDummyNcdRecord(r));
      if (Array.isArray(data.ncdScreeningRecords)) ncdScreeningRecords = data.ncdScreeningRecords.filter(r => !isDummyNcdRecord(r));
      if (Array.isArray(data.ncdTreatmentRecords)) ncdTreatmentRecords = data.ncdTreatmentRecords.filter(r => !isDummyNcdRecord(r));
      if (Array.isArray(data.ncdImportBatches)) ncdImportBatches = data.ncdImportBatches.filter(b => !isDummyNcdBatch(b));
      console.log(`[NCD Store] Loaded NCD cache from disk: Version ${activeDatasetVersion}, ${ncdIndividuals.length} individuals, ${ncdImportBatches.length} batches.`);
    }
  } catch (err) {
    console.warn('[NCD Store] Warning loading NCD cache from disk:', err.message);
  }
}

// Helper to paginated-fetch from Supabase using Primary Key B-Tree Index on queue_id
async function fetchAllEntityRecords(entityType, datasetVersion) {
  let records = [];
  const pageSize = 1000;
  const pkPrefix = `${entityType.toUpperCase()}_`;

  function buildPageQuery(pageIndex) {
    let q = supabaseClient
      .from('nwbdcp_sync_queue')
      .select('payload')
      .gte('queue_id', pkPrefix)
      .lt('queue_id', pkPrefix + 'z')
      .order('queue_id', { ascending: true });

    if (datasetVersion) {
      if (entityType === 'ncd_import_batches') {
        q = q.eq('payload->>batch_id', datasetVersion);
      } else {
        q = q.eq('payload->>dataset_version', datasetVersion);
      }
    }
    return q.range(pageIndex * pageSize, (pageIndex + 1) * pageSize - 1);
  }

  const { data: firstBatch, error } = await buildPageQuery(0);

  if (error) {
    console.error(`[NCD Store] Error fetching ${entityType}:`, error.message);
    return records;
  }

  if (!firstBatch || firstBatch.length === 0) return records;

  firstBatch.forEach(r => { if (r.payload) records.push(r.payload); });

  if (firstBatch.length < pageSize) return records;

  // Fetch remaining pages in parallel chunks of 8 using fast PK index scan
  let currentPage = 1;
  let hasMore = true;
  const concurrency = 8;

  while (hasMore) {
    const pagesToFetch = [];
    for (let i = 0; i < concurrency; i++) {
      pagesToFetch.push(currentPage + i);
    }

    const results = await Promise.all(pagesToFetch.map(p => buildPageQuery(p)));

    for (const res of results) {
      if (res.error) {
        console.error(`[NCD Store] Page fetch error for ${entityType}:`, res.error.message);
        hasMore = false;
        break;
      }
      if (res.data && res.data.length > 0) {
        res.data.forEach(r => { if (r.payload) records.push(r.payload); });
        if (res.data.length < pageSize) {
          hasMore = false;
          break;
        }
      } else {
        hasMore = false;
        break;
      }
    }

    currentPage += concurrency;
  }

  return records;
}

// Initialize Store & Load from Supabase Primary Database
export async function initNcdStore() {
  loadNcdDbFromDisk();

  if (!supabaseClient || !isSupabaseOnline()) {
    console.warn('[NCD Store] Supabase client offline. Using local disk cache.');
    return;
  }

  try {
    console.log('[NCD Store] Syncing NCD batches from Supabase...');
    const rawBatches = await fetchAllEntityRecords('ncd_import_batches', null);
    const loadedBatches = rawBatches.filter(b => !isDummyNcdBatch(b));
    if (loadedBatches.length > 0) {
      ncdImportBatches = mergeListsByPk(ncdImportBatches, loadedBatches, 'batch_id');
      ncdImportBatches.sort((a, b) => new Date(b.imported_at || 0) - new Date(a.imported_at || 0));
    }

    const activeBatch = ncdImportBatches.find(b => b.status === 'ACTIVE') || ncdImportBatches[0];
    if (activeBatch && activeBatch.batch_id) {
      activeDatasetVersion = activeBatch.batch_id;
    } else {
      activeDatasetVersion = null;
    }

    console.log(`[NCD Store] Active dataset version identified: ${activeDatasetVersion}`);
    if (!activeDatasetVersion) {
      saveNcdDbToDisk();
      return;
    }

    // Check if local cache already has complete data for activeDatasetVersion
    if (
      activeDatasetVersion &&
      ncdIndividuals.length > 0 &&
      ncdIndividuals[0]?.dataset_version === activeDatasetVersion &&
      activeBatch &&
      ncdIndividuals.length === activeBatch.total_individuals
    ) {
      console.log(`✅ [NCD Store] Local cache already up-to-date for ${activeDatasetVersion} (${ncdIndividuals.length} individuals).`);
      return;
    }

    console.log(`[NCD Store] Fetching records for version ${activeDatasetVersion} from Supabase...`);
    const [fetchedInds, fetchedCbac, fetchedScr, fetchedTrt] = await Promise.all([
      fetchAllEntityRecords('ncd_individuals', activeDatasetVersion),
      fetchAllEntityRecords('ncd_cbac_records', activeDatasetVersion),
      fetchAllEntityRecords('ncd_screening_records', activeDatasetVersion),
      fetchAllEntityRecords('ncd_treatment_records', activeDatasetVersion)
    ]);

    const cleanInds = fetchedInds.filter(r => !isDummyNcdRecord(r));
    const cleanCbac = fetchedCbac.filter(r => !isDummyNcdRecord(r));
    const cleanScr = fetchedScr.filter(r => !isDummyNcdRecord(r));
    const cleanTrt = fetchedTrt.filter(r => !isDummyNcdRecord(r));

    if (cleanInds.length > 0) ncdIndividuals = cleanInds;
    if (cleanCbac.length > 0) ncdCbacRecords = cleanCbac;
    if (cleanScr.length > 0) ncdScreeningRecords = cleanScr;
    if (cleanTrt.length > 0) ncdTreatmentRecords = cleanTrt;

    saveNcdDbToDisk();
    console.log(`✅ [NCD Store] Successfully synced Active Version ${activeDatasetVersion} from Supabase: ${ncdIndividuals.length} individuals, ${ncdCbacRecords.length} CBAC, ${ncdScreeningRecords.length} screenings, ${ncdTreatmentRecords.length} treatments.`);
  } catch (err) {
    console.warn('[NCD Store] Error during Supabase sync:', err.message);
  }
}

function mergeListsByPk(existing, incoming, pkField) {
  const map = new Map();
  existing.forEach(item => {
    if (item && item[pkField]) map.set(String(item[pkField]), item);
  });
  incoming.forEach(item => {
    if (item && item[pkField]) {
      const prev = map.get(String(item[pkField])) || {};
      map.set(String(item[pkField]), { ...prev, ...item });
    }
  });
  return Array.from(map.values());
}

// Sync Batch to Supabase Primary Database
async function syncNcdBatchToSupabase(entityType, items, pkField) {
  if (!supabaseClient || !isSupabaseOnline() || !Array.isArray(items) || items.length === 0) return true;
  const chunkSize = 1500;
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const rows = chunk.map(item => ({
      queue_id: `${entityType.toUpperCase()}_${item[pkField]}`,
      entity_type: entityType,
      entity_id: String(item[pkField]),
      operation: 'UPSERT',
      payload: item,
      sync_status: 'SYNCED',
      last_attempt_at: new Date().toISOString()
    }));
    chunks.push(rows);
  }

  const batchConcurrency = 10;
  for (let i = 0; i < chunks.length; i += batchConcurrency) {
    const batch = chunks.slice(i, i + batchConcurrency);
    const promises = batch.map(cRows => supabaseClient.from('nwbdcp_sync_queue').upsert(cRows));
    const results = await Promise.all(promises);
    for (const res of results) {
      if (res.error) {
        console.error(`[NCD Store] Supabase batch sync error for ${entityType}:`, res.error.message);
        throw new Error(`Supabase batch sync error for ${entityType}: ${res.error.message}`);
      }
    }
  }
  return true;
}

// =========================================================================
// CSV PARSING, HEADER DETECTION & EXACT SHC/VILLAGE EXTRACTION
// =========================================================================

export function detectNcdFileType(headers, filename = '') {
  const cleanHeaders = (headers || []).map(h => String(h || '').replace(/^\uFEFF/, '').trim().toLowerCase());
  const headerStr = cleanHeaders.join(' ');
  const normStr = cleanHeaders.map(h => h.replace(/[^a-z0-9]+/g, '_')).join(' ');
  const fName = String(filename || '').toLowerCase();

  // 1. Check Treatment first (most specific headers)
  if (
    normStr.includes('treatment_start') ||
    normStr.includes('treatment_status') ||
    normStr.includes('lastfollowup') ||
    normStr.includes('last_followup') ||
    normStr.includes('last_visit') ||
    normStr.includes('hypertension_control') ||
    normStr.includes('diabetes_control') ||
    normStr.includes('htn_control') ||
    normStr.includes('dm_control') ||
    normStr.includes('oral_cancer_control') ||
    normStr.includes('breast_cancer_control') ||
    normStr.includes('cervical_cancer_control')
  ) {
    return 'TREATMENT';
  }

  // 2. Check Screening second
  if (
    normStr.includes('screening_status') ||
    normStr.includes('screened_date') ||
    normStr.includes('screening_date') ||
    normStr.includes('htn_screen') ||
    normStr.includes('dm_screen') ||
    normStr.includes('oc_screen') ||
    normStr.includes('bc_screen') ||
    normStr.includes('cc_screen') ||
    normStr.includes('hypertension_screen') ||
    normStr.includes('diabetes_screen') ||
    normStr.includes('oral_cancer_screen') ||
    normStr.includes('breast_cancer_screen') ||
    normStr.includes('cervical_cancer_screen')
  ) {
    return 'SCREENING';
  }

  // 3. Check CBAC third
  if (
    headerStr.includes('cbac') ||
    normStr.includes('cbac_date') ||
    normStr.includes('cbac_status') ||
    normStr.includes('risk_score') ||
    normStr.includes('cbac_score')
  ) {
    return 'CBAC';
  }

  // Fallback to filename if headers are non-standard
  if (fName.includes('treatment')) return 'TREATMENT';
  if (fName.includes('screening')) return 'SCREENING';
  if (fName.includes('cbac')) return 'CBAC';

  return 'UNKNOWN';
}

function parseCsvContent(csvString) {
  const cleanStr = String(csvString || '').replace(/^\uFEFF/, '');
  const lines = cleanStr.split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };

  function parseLine(line) {
    const arr = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        arr.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    arr.push(current.trim());
    return arr;
  }

  let headerLineIdx = 0;
  while (headerLineIdx < lines.length && !lines[headerLineIdx].trim()) {
    headerLineIdx++;
  }
  if (headerLineIdx >= lines.length) return { headers: [], rows: [] };

  const headers = parseLine(lines[headerLineIdx]).map(h => h.replace(/^\uFEFF/, '').trim());
  const rows = [];
  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const parsed = parseLine(line);
    if (parsed.length > 0 && parsed.some(cell => cell.length > 0)) {
      rows.push(parsed);
    }
  }

  return { headers, rows };
}

function buildHeaderLookup(headers) {
  const exactMap = {};
  const lowerMap = {};
  const alphaNumMap = {};

  headers.forEach((h, idx) => {
    const clean = String(h || '').replace(/^\uFEFF/, '').trim();
    if (!clean) return;
    if (exactMap[clean] === undefined) exactMap[clean] = idx;
    const low = clean.toLowerCase();
    if (lowerMap[low] === undefined) lowerMap[low] = idx;
    const alpha = low.replace(/[^a-z0-9]/g, '');
    if (alpha && alphaNumMap[alpha] === undefined) alphaNumMap[alpha] = idx;
  });

  function findColIndex(possibleKeys) {
    for (const k of possibleKeys) {
      if (exactMap[k] !== undefined) return exactMap[k];
      const low = k.toLowerCase().trim();
      if (lowerMap[low] !== undefined) return lowerMap[low];
      const alpha = low.replace(/[^a-z0-9]/g, '');
      if (alpha && alphaNumMap[alpha] !== undefined) return alphaNumMap[alpha];
    }
    return -1;
  }

  function getVal(row, possibleKeys) {
    const idx = findColIndex(possibleKeys);
    if (idx !== -1 && idx < row.length) {
      return String(row[idx] ?? '').trim();
    }
    return '';
  }

  function getMatchedHeaderName(possibleKeys) {
    const idx = findColIndex(possibleKeys);
    return idx !== -1 ? headers[idx] : null;
  }

  return { getVal, findColIndex, getMatchedHeaderName };
}

// Possible column keys for core fields (Prioritizing exact 'SHC', 'Village', 'Individual ID')
const IND_ID_KEYS = ['Individual ID', 'Individual_ID', 'IndividualID', 'individual_id', 'Beneficiary ID', 'Beneficiary_ID', 'Member ID', 'Patient ID'];
const SHC_KEYS = ['SHC', 'SHC Name', 'SHC_Name', 'Subcenter', 'Sub Center', 'Sub-Center', 'Sub_Center', 'Subcenter Name', 'Sub_Center_Name'];
const VILLAGE_KEYS = ['Village', 'Village Name', 'Village_Name', 'VillageName', 'VILLAGE'];
const PHC_KEYS = ['PHC', 'PHC Name', 'PHC_Name', 'PHCName'];
const TALUKA_KEYS = ['Taluka', 'Taluka Name', 'Taluka_Name', 'Block', 'Block Name'];
const DISTRICT_KEYS = ['District', 'District Name', 'District_Name'];
const FIRST_NAME_KEYS = ['First Name', 'First_Name', 'FirstName', 'Name', 'Beneficiary Name', 'Full Name', 'Patient Name'];
const MIDDLE_NAME_KEYS = ['Middle Name', 'Middle_Name', 'MiddleName'];
const LAST_NAME_KEYS = ['Last Name', 'Last_Name', 'LastName', 'Surname'];
const AGE_KEYS = ['Age', 'age', 'Age (Years)', 'Age_Years'];
const SEX_KEYS = ['Sex', 'Gender', 'sex', 'gender'];
const ABHA_KEYS = ['ABHA Number', 'ABHA_Number', 'ABHA ID', 'ABHA_ID', 'ABHA', 'Abha_Card_Number', 'Health ID', 'Health_ID_Number'];

export function previewNcdCsvImport(filename, csvContent) {
  const res = previewNcdMultiFileImport([{ filename, csvContent }]);
  if (!res || !res.filesSummary || res.filesSummary.length === 0) {
    return { success: false, message: 'CSV फाईल वाचता आली नाही.' };
  }
  const f = res.filesSummary[0];
  const { headers, rows } = parseCsvContent(csvContent);
  const { getVal } = buildHeaderLookup(headers);

  const sampleRows = rows.slice(0, 10).map((r, idx) => {
    const indId = getVal(r, IND_ID_KEYS);
    return {
      rowNum: idx + 1,
      individualId: indId || '',
      firstName: getVal(r, FIRST_NAME_KEYS),
      lastName: getVal(r, LAST_NAME_KEYS),
      village: getVal(r, VILLAGE_KEYS),
      shc: getVal(r, SHC_KEYS),
      phc: getVal(r, PHC_KEYS),
      status: indId ? 'VALID' : 'REJECTED (Missing Individual ID)'
    };
  });

  return {
    success: true,
    filename: f.filename,
    fileType: f.fileType,
    totalRows: f.totalRows,
    validRows: f.validRows,
    invalidRows: f.invalidRows,
    duplicateCount: f.duplicateCount,
    headersCount: headers.length,
    headers,
    detectedShcHeader: f.detectedShcHeader,
    detectedVillageHeader: f.detectedVillageHeader,
    distinctShcs: f.distinctShcs,
    distinctVillages: f.distinctVillages,
    sampleRows
  };
}

export async function processNcdCsvImport(filename, csvContent) {
  return await replaceNcdDataset({ files: [{ filename, csvContent }], userEmail: 'phbhada@gmail.com' });
}

// Multi-File Preview and Dataset Validation (STEP NCD-06, NCD-07, NCD-08)
export function previewNcdMultiFileImport(filesList, sessionId = null) {
  let effectiveFiles = filesList;
  if ((!Array.isArray(effectiveFiles) || effectiveFiles.length === 0) && sessionId) {
    effectiveFiles = getReassembledStagedFiles(sessionId);
  }
  if (!Array.isArray(effectiveFiles) || effectiveFiles.length === 0) {
    return { success: false, validationPassed: false, message: 'अपलोड करण्यासाठी कोणत्याही फाईल्स आढळल्या नाहीत.' };
  }

  const filesSummary = [];
  const allUniqueIds = new Set();
  const validationExceptions = [];
  let totalRowsSum = 0;
  let validRowsSum = 0;
  let invalidRowsSum = 0;

  // Track per-file Individual IDs and (SHC, Village) for cross-file linkage & consistency check
  const idsByFileType = { CBAC: new Set(), SCREENING: new Set(), TREATMENT: new Set() };
  const locationByIndId = new Map(); // indId -> { CBAC: {shc, village}, SCREENING: {shc, village}, TREATMENT: {shc, village} }
  const allDetectedShcs = new Set();
  const allDetectedVillages = new Set();

  effectiveFiles.forEach((fileObj, idx) => {
    const { filename, csvContent } = fileObj;
    const { headers, rows } = parseCsvContent(csvContent);

    if (headers.length === 0 || rows.length === 0) {
      validationExceptions.push(`फाईल ${filename || idx + 1}: फाईल रिकामी आहे किंवा वाचता येत नाही.`);
      return;
    }

    const fileType = detectNcdFileType(headers, filename);
    const { getVal, getMatchedHeaderName } = buildHeaderLookup(headers);

    const detectedIdHeader = getMatchedHeaderName(IND_ID_KEYS);
    const detectedShcHeader = getMatchedHeaderName(SHC_KEYS);
    const detectedVillageHeader = getMatchedHeaderName(VILLAGE_KEYS);

    if (!detectedIdHeader) {
      validationExceptions.push(`फाईल ${filename}: 'Individual ID' कॉलम आढळला नाही.`);
    }

    let validRows = 0;
    let invalidRows = 0;
    let duplicateCount = 0;
    const fileIds = new Set();
    const fileShcs = new Set();
    const fileVillages = new Set();
    const fileErrors = [];

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const r = rows[rIdx];
      const indId = getVal(r, IND_ID_KEYS);
      const shc = getVal(r, SHC_KEYS);
      const village = getVal(r, VILLAGE_KEYS);

      if (shc) {
        fileShcs.add(shc);
        allDetectedShcs.add(shc);
      }
      if (village) {
        fileVillages.add(village);
        allDetectedVillages.add(village);
      }

      if (!indId) {
        invalidRows++;
        if (fileErrors.length < 10) {
          fileErrors.push(`ओळ क्र. ${rIdx + 2}: Individual ID रिकामा आहे.`);
        }
      } else {
        if (fileIds.has(indId)) {
          duplicateCount++;
          if (fileErrors.length < 10) {
            fileErrors.push(`ओळ क्र. ${rIdx + 2}: दुबार Individual ID (${indId}).`);
          }
        } else {
          fileIds.add(indId);
          allUniqueIds.add(indId);
        }
        validRows++;

        if (idsByFileType[fileType]) {
          idsByFileType[fileType].add(indId);
        }

        let locObj = locationByIndId.get(indId);
        if (!locObj) {
          locObj = {};
          locationByIndId.set(indId, locObj);
        }
        if (fileType !== 'UNKNOWN') {
          locObj[fileType] = { shc, village };
        }
      }
    }

    totalRowsSum += rows.length;
    validRowsSum += validRows;
    invalidRowsSum += invalidRows;

    filesSummary.push({
      filename: filename || `File_${idx + 1}`,
      fileType,
      headersCount: headers.length,
      headers,
      detectedIdHeader,
      detectedShcHeader,
      detectedVillageHeader,
      totalRows: rows.length,
      validRows,
      invalidRows,
      duplicateCount,
      uniqueIdsInFile: fileIds.size,
      distinctShcsCount: fileShcs.size,
      distinctShcs: Array.from(fileShcs).sort(),
      distinctVillagesCount: fileVillages.size,
      distinctVillages: Array.from(fileVillages).sort(),
      errors: fileErrors
    });
  });

  // Cross-File Individual ID Linkage & SHC/Village Consistency Audit (STEP NCD-08 #4)
  let cbacScreeningMatchedCount = 0;
  let treatmentMatchedInCbacCount = 0;
  let treatmentMatchedInScreeningCount = 0;
  const locationDiscrepancies = [];
  let locationDiscrepancyCount = 0;

  idsByFileType.SCREENING.forEach(id => {
    if (idsByFileType.CBAC.has(id)) cbacScreeningMatchedCount++;
  });
  idsByFileType.TREATMENT.forEach(id => {
    if (idsByFileType.CBAC.has(id)) treatmentMatchedInCbacCount++;
    if (idsByFileType.SCREENING.has(id)) treatmentMatchedInScreeningCount++;
  });

  for (const [indId, loc] of locationByIndId.entries()) {
    const fileTypesPresent = Object.keys(loc);
    if (fileTypesPresent.length > 1) {
      const shcValues = [...new Set(fileTypesPresent.map(ft => loc[ft].shc).filter(Boolean))];
      const villageValues = [...new Set(fileTypesPresent.map(ft => loc[ft].village).filter(Boolean))];
      const shcMismatch = shcValues.length > 1;
      const villageMismatch = villageValues.length > 1;

      if (shcMismatch || villageMismatch) {
        locationDiscrepancyCount++;
        if (locationDiscrepancies.length < 50) {
          locationDiscrepancies.push({
            individual_id: indId,
            cbac_shc: loc.CBAC?.shc || '',
            screening_shc: loc.SCREENING?.shc || '',
            treatment_shc: loc.TREATMENT?.shc || '',
            cbac_village: loc.CBAC?.village || '',
            screening_village: loc.SCREENING?.village || '',
            treatment_village: loc.TREATMENT?.village || '',
            issue: shcMismatch && villageMismatch ? 'SHC & Village Mismatch' : (shcMismatch ? 'SHC Mismatch' : 'Village Mismatch')
          });
        }
      }
    }
  }

  const validationPassed = validationExceptions.length === 0 && validRowsSum > 0;

  return {
    success: true,
    validationPassed,
    warningNotice: '⚠️ सूचना: नवीन डेटासेट कन्फर्म केल्यानंतर मागील NCD डेटासेट पूर्णपणे बदलला (Replace) जाईल.',
    totalFiles: filesSummary.length,
    totalRowsSum,
    validRowsSum,
    invalidRowsSum,
    totalUniqueIndividuals: allUniqueIds.size,
    distinctShcs: Array.from(allDetectedShcs).sort(),
    distinctVillages: Array.from(allDetectedVillages).sort(),
    crossFileConsistency: {
      cbacUniqueIds: idsByFileType.CBAC.size,
      screeningUniqueIds: idsByFileType.SCREENING.size,
      treatmentUniqueIds: idsByFileType.TREATMENT.size,
      cbacScreeningMatchedCount,
      treatmentMatchedInCbacCount,
      treatmentMatchedInScreeningCount,
      locationDiscrepancyCount,
      locationDiscrepanciesSample: locationDiscrepancies
    },
    filesSummary,
    validationExceptions
  };
}

// Complete Dataset Replacement Workflow (STEP NCD-06, NCD-07, NCD-08)
export async function replaceNcdDataset(payload) {
  const { files, sessionId, userEmail } = payload || {};
  let effectiveFiles = files;
  if ((!Array.isArray(effectiveFiles) || effectiveFiles.length === 0) && sessionId) {
    effectiveFiles = getReassembledStagedFiles(sessionId);
  }
  if (!Array.isArray(effectiveFiles) || effectiveFiles.length === 0) {
    return { success: false, validationPassed: false, message: 'रिप्लेस करण्यासाठी फाईल्स उपलब्ध नाहीत.' };
  }

  // Step 1: Pre-Validation Check
  const preview = previewNcdMultiFileImport(effectiveFiles);
  if (!preview.validationPassed || preview.validRowsSum === 0) {
    return {
      success: false,
      validationPassed: false,
      message: 'डेटासेट व्हॅलिडेशन अयशस्वी झाले. मागील ॲक्टिव्ह डेटासेट सुरक्षित ठेवला आहे.',
      exceptions: preview.validationExceptions
    };
  }

  // Sort files in canonical order: CBAC -> SCREENING -> TREATMENT so baseline demographics load first
  const fileOrderWeight = { CBAC: 1, SCREENING: 2, TREATMENT: 3, UNKNOWN: 4 };
  const sortedFiles = [...effectiveFiles].sort((a, b) => {
    const { headers: hA } = parseCsvContent(a.csvContent?.slice(0, 4096) || '');
    const { headers: hB } = parseCsvContent(b.csvContent?.slice(0, 4096) || '');
    const tA = detectNcdFileType(hA, a.filename);
    const tB = detectNcdFileType(hB, b.filename);
    return (fileOrderWeight[tA] || 9) - (fileOrderWeight[tB] || 9);
  });

  // Step 2: Stage & Parse All Files into Isolated Dataset State
  const stagedIndMap = new Map();
  const stagedCbac = [];
  const stagedScreenings = [];
  const stagedTreatments = [];

  const newDatasetVersion = `NCD_DS_${Date.now()}`;
  const importedAt = new Date().toISOString();

  for (const fileObj of sortedFiles) {
    const { filename, csvContent } = fileObj;
    const { headers, rows } = parseCsvContent(csvContent);
    const fileType = detectNcdFileType(headers, filename);
    const { getVal } = buildHeaderLookup(headers);

    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      const indId = getVal(r, IND_ID_KEYS);
      if (!indId) continue;

      const fName = getVal(r, FIRST_NAME_KEYS);
      const mName = getVal(r, MIDDLE_NAME_KEYS);
      const lName = getVal(r, LAST_NAME_KEYS);
      const age = getVal(r, AGE_KEYS);
      const sex = getVal(r, SEX_KEYS);
      const abha = getVal(r, ABHA_KEYS);
      const dist = getVal(r, DISTRICT_KEYS);
      const taluka = getVal(r, TALUKA_KEYS);
      const phc = getVal(r, PHC_KEYS);
      // Exact source SHC and Village from the uploaded CSV without NVBDCP master normalization
      const shc = getVal(r, SHC_KEYS);
      const village = getVal(r, VILLAGE_KEYS);

      let indObj = stagedIndMap.get(indId);
      if (!indObj) {
        indObj = {
          individual_id: indId,
          first_name: fName,
          middle_name: mName,
          last_name: lName,
          age: age,
          sex: sex,
          abha_number: abha,
          district: dist,
          taluka: taluka,
          phc: phc,
          shc: shc,
          village: village,
          shc_by_file: { [fileType]: shc },
          village_by_file: { [fileType]: village },
          has_location_discrepancy: false,
          dataset_version: newDatasetVersion,
          created_at: importedAt,
          updated_at: importedAt
        };
        stagedIndMap.set(indId, indObj);
      } else {
        if (fName && !indObj.first_name) indObj.first_name = fName;
        if (mName && !indObj.middle_name) indObj.middle_name = mName;
        if (lName && !indObj.last_name) indObj.last_name = lName;
        if (age && !indObj.age) indObj.age = age;
        if (sex && !indObj.sex) indObj.sex = sex;
        if (abha && !indObj.abha_number) indObj.abha_number = abha;
        if (dist && !indObj.district) indObj.district = dist;
        if (taluka && !indObj.taluka) indObj.taluka = taluka;
        if (phc && !indObj.phc) indObj.phc = phc;

        // Preserve original file's SHC/Village without silently overwriting if different
        if (!indObj.shc && shc) indObj.shc = shc;
        if (!indObj.village && village) indObj.village = village;

        if (!indObj.shc_by_file) indObj.shc_by_file = {};
        if (!indObj.village_by_file) indObj.village_by_file = {};
        if (shc) indObj.shc_by_file[fileType] = shc;
        if (village) indObj.village_by_file[fileType] = village;

        const distinctShcs = new Set(Object.values(indObj.shc_by_file).filter(Boolean));
        const distinctVils = new Set(Object.values(indObj.village_by_file).filter(Boolean));
        if (distinctShcs.size > 1 || distinctVils.size > 1) {
          indObj.has_location_discrepancy = true;
        }
      }

      // Handle File-Specific Records
      if (fileType === 'CBAC') {
        const cbacDate = getVal(r, ['CBAC Date', 'CBAC_Date', 'CBACDate', 'Date_of_CBAC', 'Date of CBAC', 'CBAC Filled Date', 'Last CBAC Date']);
        const rawCbacStatus = getVal(r, ['CBAC Status', 'CBAC_Status', 'CBACStatus']);
        const cbacScore = getVal(r, ['CBAC Risk Score', 'CBAC_Risk_Score', 'CBACScore', 'Risk_Score', 'Risk Score', 'CBAC Score', 'Total Score']);
        const isoCbacDate = formatNcdIsoDate(cbacDate);
        const cbacStatus = rawCbacStatus || (isoCbacDate || cbacScore !== '' ? 'Completed' : 'Pending');

        const recId = `CBAC_${indId}_${isoCbacDate || idx}`;
        stagedCbac.push({
          record_id: recId,
          individual_id: indId,
          cbac_date: isoCbacDate,
          raw_cbac_date: cbacDate,
          cbac_status: cbacStatus,
          cbac_risk_score: cbacScore,
          shc: shc,
          village: village,
          dataset_version: newDatasetVersion,
          created_at: importedAt
        });

        indObj.cbac_date = isoCbacDate;
        indObj.cbac_status = cbacStatus;
        indObj.cbac_risk_score = cbacScore;
      } else if (fileType === 'SCREENING') {
        const diseases = [
          {
            code: 'HTN',
            name: 'Hypertension',
            dateKeys: ['HTN_Screened_Date', 'HTN Screened Date', 'HTN_Screening_Date', 'HTN Screening Date', 'Hypertension_Screened_Date', 'Hypertension Screened Date', 'Hypertension_Screening_Date', 'Hypertension Screening Date', 'HTN Date'],
            statusKeys: ['HTN_Screening_Status', 'HTN Screening Status', 'HTN_Status', 'HTN Status', 'Hypertension_Screening_Status', 'Hypertension Screening Status', 'Hypertension_Status', 'HTN_Screened']
          },
          {
            code: 'DM',
            name: 'Diabetes',
            dateKeys: ['DM_Screened_Date', 'DM Screened Date', 'DM_Screening_Date', 'DM Screening Date', 'Diabetes_Screened_Date', 'Diabetes Screened Date', 'Diabetes_Screening_Date', 'Diabetes Screening Date', 'DM Date'],
            statusKeys: ['DM_Screening_Status', 'DM Screening Status', 'DM_Status', 'DM Status', 'Diabetes_Screening_Status', 'Diabetes Screening Status', 'Diabetes_Status', 'DM_Screened']
          },
          {
            code: 'OC',
            name: 'Oral Cancer',
            dateKeys: ['OC_Screened_Date', 'OC Screened Date', 'OC_Screening_Date', 'OC Screening Date', 'Oral_Cancer_Screened_Date', 'Oral Cancer Screened Date', 'Oral_Cancer_Screening_Date', 'Oral Cancer Screening Date', 'Oral_Screened_Date', 'OC Date'],
            statusKeys: ['OC_Screening_Status', 'OC Screening Status', 'OC_Status', 'OC Status', 'Oral_Cancer_Screening_Status', 'Oral Cancer Screening Status', 'Oral_Cancer_Status', 'OC_Screened']
          },
          {
            code: 'BC',
            name: 'Breast Cancer',
            dateKeys: ['BC_Screened_Date', 'BC Screened Date', 'BC_Screening_Date', 'BC Screening Date', 'Breast_Cancer_Screened_Date', 'Breast Cancer Screened Date', 'Breast_Cancer_Screening_Date', 'Breast Cancer Screening Date', 'Breast_Screened_Date', 'BC Date'],
            statusKeys: ['BC_Screening_Status', 'BC Screening Status', 'BC_Status', 'BC Status', 'Breast_Cancer_Screening_Status', 'Breast Cancer Screening Status', 'Breast_Cancer_Status', 'BC_Screened']
          },
          {
            code: 'CC',
            name: 'Cervical Cancer',
            dateKeys: ['CC_Screened_Date', 'CC Screened Date', 'CC_Screening_Date', 'CC Screening Date', 'Cervical_Cancer_Screened_Date', 'Cervical Cancer Screened Date', 'Cervical_Cancer_Screening_Date', 'Cervical Cancer Screening Date', 'Cervical_Screened_Date', 'CC Date'],
            statusKeys: ['CC_Screening_Status', 'CC Screening Status', 'CC_Status', 'CC Status', 'Cervical_Cancer_Screening_Status', 'Cervical Cancer Screening Status', 'Cervical_Cancer_Status', 'CC_Screened']
          }
        ];

        diseases.forEach(d => {
          const sDate = getVal(r, d.dateKeys);
          const sStatus = getVal(r, d.statusKeys);
          const isoDate = formatNcdIsoDate(sDate);
          const normClass = classifyScreeningStatus(sStatus, sDate);

          // Store screening record when status or date is present (exclude Not Eligible with no date to avoid unnecessary row bloat)
          if (normClass === 'COMPLETED' || normClass === 'PENDING' || normClass === 'COMPLETED_NO_DATE' || (sStatus && normClass !== 'NOT_ELIGIBLE')) {
            const recId = `SCR_${d.code}_${indId}`;
            stagedScreenings.push({
              record_id: recId,
              individual_id: indId,
              disease: d.name,
              disease_code: d.code,
              screened_date: isoDate,
              raw_screened_date: sDate,
              raw_screening_status: sStatus,
              screening_status: normClass === 'COMPLETED' ? 'Completed Screening' : (sStatus || 'Pending Screening'),
              normalized_status: normClass,
              shc: shc,
              village: village,
              dataset_version: newDatasetVersion,
              created_at: importedAt
            });
          }
        });
      } else if (fileType === 'TREATMENT') {
        const treatDiseases = [
          {
            code: 'HTN',
            name: 'Hypertension',
            startKeys: ['HTN_Treatment_Start_Date', 'HTN Treatment Start Date', 'Hypertension_Treatment_Start_Date', 'Hypertension Treatment Start Date', 'HTN_Start_Date'],
            followupKeys: ['HTN_LastFollowup_Completed_Date', 'HTN LastFollowup Completed Date', 'HTN_Last_Followup_Date', 'HTN_Last_Visit_Date', 'Hypertension_LastFollowup_Completed_Date', 'Hypertension_Last_Visit_Date'],
            statusKeys: ['HTN_Treatment_Status', 'HTN Treatment Status', 'Hypertension_Treatment_Status', 'Hypertension Treatment Status', 'HTN_Status'],
            controlKeys: ['Hypertension_Control', 'Hypertension Control', 'HTN_Control', 'HTN Control', 'HTN_Control_Status']
          },
          {
            code: 'DM',
            name: 'Diabetes',
            startKeys: ['Diabetes_Treatment_Start_Date', 'Diabetes Treatment Start Date', 'DM_Treatment_Start_Date', 'DM Treatment Start Date', 'DM_Start_Date'],
            followupKeys: ['Diabetes_LastFollowup_Completed_Date', 'Diabetes LastFollowup Completed Date', 'DM_LastFollowup_Completed_Date', 'DM_Last_Followup_Date', 'DM_Last_Visit_Date', 'Diabetes_Last_Visit_Date'],
            statusKeys: ['DM_Treatment_Status', 'DM Treatment Status', 'Diabetes_Treatment_Status', 'Diabetes Treatment Status', 'DM_Status'],
            controlKeys: ['Diabetes_Control', 'Diabetes Control', 'DM_Control', 'DM Control', 'DM_Control_Status']
          },
          {
            code: 'OC',
            name: 'Oral Cancer',
            startKeys: ['Oral_Cancer_Treatment_Start_Date', 'Oral Cancer Treatment Start Date', 'OC_Treatment_Start_Date', 'OC Treatment Start Date'],
            followupKeys: ['Oral_Cancer_LastFollowup_Completed_Date', 'Oral_Cancer_Last_Visit_Date', 'OC_LastFollowup_Completed_Date', 'OC_Last_Visit_Date'],
            statusKeys: ['Oral_Cancer_Treatment_Status', 'Oral Cancer Treatment Status', 'OC_Treatment_Status', 'OC Treatment Status'],
            controlKeys: ['Oral_Cancer_Control', 'Oral Cancer Control', 'OC_Control', 'OC Control']
          },
          {
            code: 'BC',
            name: 'Breast Cancer',
            startKeys: ['Breast_Cancer_Treatment_Start_Date', 'Breast Cancer Treatment Start Date', 'BC_Treatment_Start_Date', 'BC Treatment Start Date'],
            followupKeys: ['Breast_Cancer_LastFollowup_Completed_Date', 'Breast_Cancer_Last_Visit_Date', 'BC_LastFollowup_Completed_Date', 'BC_Last_Visit_Date'],
            statusKeys: ['Breast_Cancer_Treatment_Status', 'Breast Cancer Treatment Status', 'BC_Treatment_Status', 'BC Treatment Status'],
            controlKeys: ['Breast_Cancer_Control', 'Breast Cancer Control', 'BC_Control', 'BC Control']
          },
          {
            code: 'CC',
            name: 'Cervical Cancer',
            startKeys: ['Cervical_Cancer_Treatment_Start_Date', 'Cervical Cancer Treatment Start Date', 'CC_Treatment_Start_Date', 'CC Treatment Start Date'],
            followupKeys: ['Cervical_Cancer_LastFollowup_Completed_Date', 'Cervical_Cancer_Last_Visit_Date', 'CC_LastFollowup_Completed_Date', 'CC_Last_Visit_Date'],
            statusKeys: ['Cervical_Cancer_Treatment_Status', 'Cervical Cancer Treatment Status', 'CC_Treatment_Status', 'CC Treatment Status'],
            controlKeys: ['Cervical_Cancer_Control', 'Cervical Cancer Control', 'CC_Control', 'CC Control']
          }
        ];

        treatDiseases.forEach(td => {
          const tStart = getVal(r, td.startKeys);
          const tFollow = getVal(r, td.followupKeys);
          const tStatus = getVal(r, td.statusKeys);
          const tControl = getVal(r, td.controlKeys);

          const normTrtClass = classifyTreatmentStatus(tStatus, tStart, tFollow);
          if (normTrtClass !== 'NONE') {
            const recId = `TRT_${td.code}_${indId}`;
            stagedTreatments.push({
              record_id: recId,
              individual_id: indId,
              disease: td.name,
              disease_code: td.code,
              treatment_start_date: formatNcdIsoDate(tStart),
              raw_treatment_start_date: tStart,
              last_followup_date: formatNcdIsoDate(tFollow),
              raw_last_followup_date: tFollow,
              raw_treatment_status: tStatus,
              treatment_status: tStatus || 'Under Treatment',
              normalized_status: normTrtClass,
              disease_control: tControl || '',
              shc: shc,
              village: village,
              dataset_version: newDatasetVersion,
              created_at: importedAt
            });
          }
        });
      }
    }
  }

  const stagedInds = Array.from(stagedIndMap.values());

  const newBatchLog = {
    batch_id: newDatasetVersion,
    imported_at: importedAt,
    imported_by: userEmail || 'phbhada@gmail.com',
    action: 'COMPLETE_DATASET_REPLACEMENT',
    status: 'ACTIVE',
    filenames: sortedFiles.map(f => f.filename),
    files_summary: preview.filesSummary.map(f => ({
      filename: f.filename,
      fileType: f.fileType,
      headersCount: f.headersCount,
      totalRows: f.totalRows,
      validRows: f.validRows,
      invalidRows: f.invalidRows,
      uniqueIdsInFile: f.uniqueIdsInFile,
      distinctShcsCount: f.distinctShcsCount,
      distinctVillagesCount: f.distinctVillagesCount
    })),
    cross_file_consistency: preview.crossFileConsistency,
    total_individuals: stagedInds.length,
    total_cbac: stagedCbac.length,
    total_screenings: stagedScreenings.length,
    total_treatments: stagedTreatments.length,
    message: 'मागील NCD डेटासेट यशस्वीरित्या नवीन डेटासेटने रिप्लेस व ॲक्टिव्हेट करण्यात आला आहे.'
  };

  // Step 3: Persist Staged Dataset into Supabase Primary Database FIRST
  try {
    await syncNcdBatchToSupabase('ncd_individuals', stagedInds, 'individual_id');
    if (stagedCbac.length > 0) await syncNcdBatchToSupabase('ncd_cbac_records', stagedCbac, 'record_id');
    if (stagedScreenings.length > 0) await syncNcdBatchToSupabase('ncd_screening_records', stagedScreenings, 'record_id');
    if (stagedTreatments.length > 0) await syncNcdBatchToSupabase('ncd_treatment_records', stagedTreatments, 'record_id');

    // Mark older batches as SUPERSEDED in memory and Supabase before activating new batch
    const supersededBatches = [];
    ncdImportBatches.forEach(b => {
      if (b.status === 'ACTIVE') {
        b.status = 'SUPERSEDED';
        supersededBatches.push(b);
      }
    });
    await syncNcdBatchToSupabase('ncd_import_batches', [...supersededBatches, newBatchLog], 'batch_id');
  } catch (err) {
    console.error('[NCD Store] Dataset Replacement Failed during Supabase Persistence:', err.message);
    return {
      success: false,
      validationPassed: false,
      message: `मागील NCD डेटासेट सुरक्षित ठेवून नवीन डेटासेट अपडेट अयशस्वी झाले: ${err.message}`
    };
  }

  // Step 4: Atomic Memory & Disk Cache Activation (Only reached after Supabase persistence succeeds)
  activeDatasetVersion = newDatasetVersion;
  ncdIndividuals = stagedInds;
  ncdCbacRecords = stagedCbac;
  ncdScreeningRecords = stagedScreenings;
  ncdTreatmentRecords = stagedTreatments;

  ncdImportBatches.unshift(newBatchLog);
  if (sessionId) clearNcdStagedSession(sessionId);

  saveNcdDbToDisk();

  return {
    success: true,
    validationPassed: true,
    activeVersion: newDatasetVersion,
    message: `मागील डेटासेट यशस्वीरित्या रिप्लेस झाला! नवीन डेटासेटमध्ये ${stagedInds.length.toLocaleString('en-IN')} नागरिक, ${stagedScreenings.length.toLocaleString('en-IN')} स्क्रिनिंग व ${stagedTreatments.length.toLocaleString('en-IN')} उपचार नोंदी ॲक्टिव्हेट झाल्या आहेत.`,
    batchSummary: newBatchLog
  };
}

// =========================================================================
// AUTHORITATIVE CSV SUBCENTER (SHC) & VILLAGE LISTS FROM ACTIVE DATASET
// (STEP NCD-08: Never use NVBDCP master data; preserve exact CSV names)
// =========================================================================

function getAuthoritativeShcAndVillages() {
  const shcSet = new Set();
  const villageSet = new Set();
  const villagesByShc = {};

  function addPair(rawShc, rawVillage) {
    const sc = String(rawShc || '').trim();
    const vil = String(rawVillage || '').trim();
    if (sc) {
      shcSet.add(sc);
      if (!villagesByShc[sc]) villagesByShc[sc] = new Set();
      if (vil) villagesByShc[sc].add(vil);
    }
    if (vil) {
      villageSet.add(vil);
    }
  }

  ncdIndividuals.forEach(i => addPair(i.shc, i.village));
  ncdCbacRecords.forEach(c => addPair(c.shc, c.village));
  ncdScreeningRecords.forEach(s => addPair(s.shc, s.village));
  ncdTreatmentRecords.forEach(t => addPair(t.shc, t.village));

  const subcentersList = Array.from(shcSet).sort((a, b) => a.localeCompare(b));
  const villagesList = Array.from(villageSet).sort((a, b) => a.localeCompare(b));
  const villagesByShcSorted = {};
  Object.keys(villagesByShc).forEach(sc => {
    villagesByShcSorted[sc] = Array.from(villagesByShc[sc]).sort((a, b) => a.localeCompare(b));
  });

  // Check cross-file consistency on active dataset
  const discrepancyIndividuals = ncdIndividuals.filter(i => i.has_location_discrepancy);

  return {
    subcentersList,
    villagesList,
    villagesByShc: villagesByShcSorted,
    locationDiscrepancyCount: discrepancyIndividuals.length,
    locationDiscrepanciesSample: discrepancyIndividuals.slice(0, 50).map(i => ({
      individual_id: i.individual_id,
      name: `${i.first_name || ''} ${i.last_name || ''}`.trim(),
      shc_by_file: i.shc_by_file || { DEFAULT: i.shc },
      village_by_file: i.village_by_file || { DEFAULT: i.village }
    }))
  };
}

export function getActiveDatasetInfo() {
  const activeBatch = ncdImportBatches.find(b => b.status === 'ACTIVE') || ncdImportBatches[0];
  const { subcentersList, villagesList, villagesByShc, locationDiscrepancyCount, locationDiscrepanciesSample } = getAuthoritativeShcAndVillages();

  return {
    success: true,
    activeDatasetVersion,
    totalIndividuals: ncdIndividuals.length,
    totalCbacRecords: ncdCbacRecords.length,
    totalScreeningRecords: ncdScreeningRecords.length,
    totalTreatmentRecords: ncdTreatmentRecords.length,
    lastReplacementTime: activeBatch?.imported_at || new Date().toISOString(),
    importedBy: activeBatch?.imported_by || 'Authorized User',
    filenames: activeBatch?.filenames || [],
    filesSummary: activeBatch?.files_summary || [],
    crossFileConsistency: activeBatch?.cross_file_consistency || {
      locationDiscrepancyCount,
      locationDiscrepanciesSample
    },
    subcentersList,
    villagesList,
    villagesByShc
  };
}

// Helper to filter items by Date Range
function filterByDateRange(items, dateField, fromDate, toDate, fallbackDateField = null) {
  if (!fromDate && !toDate) return items;
  const fStart = fromDate ? parseNcdDate(fromDate) : null;
  const fEnd = toDate ? parseNcdDate(toDate) : null;
  if (fEnd) fEnd.setHours(23, 59, 59, 999);

  return items.filter(item => {
    let d = parseNcdDate(item[dateField]);
    if (!d && fallbackDateField) {
      d = parseNcdDate(item[fallbackDateField]);
    }
    if (!d) return false;
    if (fStart && d < fStart) return false;
    if (fEnd && d > fEnd) return false;
    return true;
  });
}

// Helper to filter items by exact CSV SHC, Village, Disease (STEP NCD-08: Do not merge similar names)
function filterNcdRecords(records, filters = {}) {
  let list = records;
  const { shc, village, disease } = filters;

  if (shc && shc !== 'ALL' && shc !== 'सर्व') {
    const targetShc = String(shc).trim();
    list = list.filter(r => String(r.shc || '').trim() === targetShc);
  }
  if (village && village !== 'ALL' && village !== 'सर्व') {
    const targetVil = String(village).trim();
    list = list.filter(r => String(r.village || '').trim() === targetVil);
  }
  if (disease && disease !== 'ALL' && disease !== 'सर्व') {
    const dNorm = String(disease).toLowerCase().trim();
    list = list.filter(r => {
      const rDis = String(r.disease || '').toLowerCase().trim();
      const rCode = String(r.disease_code || '').toLowerCase().trim();
      return rDis === dNorm || rCode === dNorm || rDis.includes(dNorm);
    });
  }

  return list;
}

// =========================================================================
// CALCULATIONS & REPORT GENERATION (QUERYING ACTIVE DATASET ONLY)
// =========================================================================

export function getNcdDashboardStats(filters = {}) {
  const { shc, village, disease, fromDate, toDate, month, year } = filters;

  // 1. Filter Individuals in Active Dataset
  const filteredInds = filterNcdRecords(ncdIndividuals, { shc, village });

  // 2. Filter CBAC in Active Dataset
  let filteredCbac = filterNcdRecords(ncdCbacRecords, { shc, village });
  filteredCbac = filterByDateRange(filteredCbac, 'cbac_date', fromDate, toDate);

  // 3. Filter Screenings in Active Dataset (Count completed only when status = completed & date is valid)
  let filteredScr = filterNcdRecords(ncdScreeningRecords, { shc, village, disease });
  filteredScr = filterByDateRange(filteredScr, 'screened_date', fromDate, toDate);
  const completedScr = filteredScr.filter(isCompletedScreeningRecord);
  const pendingScr = filteredScr.filter(s => classifyScreeningStatus(s.raw_screening_status || s.screening_status, s.screened_date) === 'PENDING');

  // 4. Filter Treatments in Active Dataset (Support Adhering to Follow-up, Newly Diagnosed, Missed Follow-up, Under Treatment)
  let filteredTrt = filterNcdRecords(ncdTreatmentRecords, { shc, village, disease });
  filteredTrt = filterByDateRange(filteredTrt, 'treatment_start_date', fromDate, toDate, 'last_followup_date');

  const underTreatment = filteredTrt.filter(isActiveTreatmentRecord);
  const adheringFollowup = underTreatment.filter(isAdheringFollowupRecord);
  const newlyDiagnosed = underTreatment.filter(isNewlyDiagnosedRecord);
  const missedFollowup = underTreatment.filter(isMissedFollowupRecord);

  const { subcentersList, villagesList, villagesByShc, locationDiscrepancyCount } = getAuthoritativeShcAndVillages();

  return {
    success: true,
    activeVersion: activeDatasetVersion,
    filters: { shc, village, disease, fromDate, toDate, month, year },
    kpis: {
      totalIndividuals: filteredInds.length,
      cbacCompleted: filteredCbac.length,
      screeningCompletedEvents: completedScr.length,
      screeningPendingEvents: pendingScr.length,
      uniqueScreenedIndividuals: new Set(completedScr.map(s => s.individual_id)).size,
      newlyDiagnosedCases: newlyDiagnosed.length,
      uniqueNewlyDiagnosedIndividuals: new Set(newlyDiagnosed.map(t => t.individual_id)).size,
      diagnosedCasesNote: newlyDiagnosed.length > 0
        ? `Newly Diagnosed from Treatment CSV: ${newlyDiagnosed.length}`
        : 'Source data unavailable (Explicit diagnosis field missing in source files)',
      underTreatmentCases: underTreatment.length,
      uniqueUnderTreatmentIndividuals: new Set(underTreatment.map(t => t.individual_id)).size,
      adheringFollowupCases: adheringFollowup.length,
      uniqueAdheringIndividuals: new Set(adheringFollowup.map(t => t.individual_id)).size,
      followupMissedCases: missedFollowup.length,
      uniqueMissedFollowupIndividuals: new Set(missedFollowup.map(t => t.individual_id)).size,
      rescreeningCountsNote: 'Source data unavailable (Repeat screening history missing in source files)'
    },
    meta: {
      subcentersList,
      villagesList,
      villagesByShc,
      locationDiscrepancyCount,
      totalBatches: ncdImportBatches.length
    }
  };
}

export function getNcdSubcenterReport(filters = {}) {
  const { shc, village, disease, fromDate, toDate } = filters;
  const { subcentersList } = getAuthoritativeShcAndVillages();

  let targetSubcenters = subcentersList;
  if (shc && shc !== 'ALL' && shc !== 'सर्व') {
    targetSubcenters = subcentersList.filter(s => s === String(shc).trim());
  }

  const rows = targetSubcenters.map((scName, idx) => {
    const inds = filterNcdRecords(ncdIndividuals, { shc: scName, village });
    const cbac = filterByDateRange(filterNcdRecords(ncdCbacRecords, { shc: scName, village }), 'cbac_date', fromDate, toDate);
    const rawScr = filterByDateRange(filterNcdRecords(ncdScreeningRecords, { shc: scName, village, disease }), 'screened_date', fromDate, toDate);
    const scr = rawScr.filter(isCompletedScreeningRecord);

    const htnScr = scr.filter(s => s.disease_code === 'HTN' || s.disease === 'Hypertension');
    const dmScr = scr.filter(s => s.disease_code === 'DM' || s.disease === 'Diabetes');
    const ocScr = scr.filter(s => s.disease_code === 'OC' || s.disease === 'Oral Cancer');
    const bcScr = scr.filter(s => s.disease_code === 'BC' || s.disease === 'Breast Cancer');
    const ccScr = scr.filter(s => s.disease_code === 'CC' || s.disease === 'Cervical Cancer');

    const trt = filterByDateRange(filterNcdRecords(ncdTreatmentRecords, { shc: scName, village, disease }), 'treatment_start_date', fromDate, toDate, 'last_followup_date');
    const activeTrt = trt.filter(isActiveTreatmentRecord);
    const adheringTrt = activeTrt.filter(isAdheringFollowupRecord);
    const newlyDiagTrt = activeTrt.filter(isNewlyDiagnosedRecord);
    const missedTrt = activeTrt.filter(isMissedFollowupRecord);

    return {
      srNo: idx + 1,
      shc: scName,
      totalIndividuals: inds.length,
      cbacCompleted: cbac.length,
      htnScreened: htnScr.length,
      dmScreened: dmScr.length,
      ocScreened: ocScr.length,
      bcScreened: bcScr.length,
      ccScreened: ccScr.length,
      totalScreenedEvents: scr.length,
      uniqueScreenedIndividuals: new Set(scr.map(s => s.individual_id)).size,
      diagnosed: newlyDiagTrt.length > 0 ? newlyDiagTrt.length : 'N/A*',
      newlyDiagnosed: newlyDiagTrt.length,
      underTreatment: activeTrt.length,
      uniqueUnderTreatmentIndividuals: new Set(activeTrt.map(t => t.individual_id)).size,
      adheringFollowup: adheringTrt.length,
      missedFollowup: missedTrt.length,
      rescreening: 'N/A*'
    };
  });

  return {
    success: true,
    activeVersion: activeDatasetVersion,
    reportName: 'उपकेंद्र निहाय NCD अहवाल (Subcenter-wise NCD Report - CSV Authoritative)',
    notes: '*टीप: या अहवालातील उपकेंद्र (SHC) नावे थेट अपलोड केलेल्या CSV फाईल्सवरून घेतली आहेत (NVBDCP मास्टर डेटा वापरलेला नाही).',
    rows
  };
}

export function getNcdVillageReport(filters = {}) {
  const { shc, village, disease, fromDate, toDate } = filters;

  // Build unique (shc, village) pairs strictly from active CSV dataset without merging similar village names
  const pairMap = new Map();
  function registerPair(rawShc, rawVil) {
    const sc = String(rawShc || '').trim();
    const vil = String(rawVil || '').trim();
    if (!vil) return;
    if (shc && shc !== 'ALL' && shc !== 'सर्व' && sc !== String(shc).trim()) return;
    if (village && village !== 'ALL' && village !== 'सर्व' && vil !== String(village).trim()) return;
    const key = `${sc}|||${vil}`;
    if (!pairMap.has(key)) {
      pairMap.set(key, { shc: sc, village: vil });
    }
  }

  ncdIndividuals.forEach(i => registerPair(i.shc, i.village));
  ncdCbacRecords.forEach(c => registerPair(c.shc, c.village));
  ncdScreeningRecords.forEach(s => registerPair(s.shc, s.village));
  ncdTreatmentRecords.forEach(t => registerPair(t.shc, t.village));

  const sortedPairs = Array.from(pairMap.values()).sort((a, b) => {
    const scCmp = a.shc.localeCompare(b.shc);
    if (scCmp !== 0) return scCmp;
    return a.village.localeCompare(b.village);
  });

  const rows = sortedPairs.map((pair, idx) => {
    const scName = pair.shc;
    const vName = pair.village;

    const vInds = filterNcdRecords(ncdIndividuals, { shc: scName, village: vName });
    const cbac = filterByDateRange(filterNcdRecords(ncdCbacRecords, { shc: scName, village: vName }), 'cbac_date', fromDate, toDate);
    const rawScr = filterByDateRange(filterNcdRecords(ncdScreeningRecords, { shc: scName, village: vName, disease }), 'screened_date', fromDate, toDate);
    const scr = rawScr.filter(isCompletedScreeningRecord);

    const htnScr = scr.filter(s => s.disease_code === 'HTN' || s.disease === 'Hypertension');
    const dmScr = scr.filter(s => s.disease_code === 'DM' || s.disease === 'Diabetes');
    const ocScr = scr.filter(s => s.disease_code === 'OC' || s.disease === 'Oral Cancer');
    const bcScr = scr.filter(s => s.disease_code === 'BC' || s.disease === 'Breast Cancer');
    const ccScr = scr.filter(s => s.disease_code === 'CC' || s.disease === 'Cervical Cancer');

    const trt = filterByDateRange(filterNcdRecords(ncdTreatmentRecords, { shc: scName, village: vName, disease }), 'treatment_start_date', fromDate, toDate, 'last_followup_date');
    const activeTrt = trt.filter(isActiveTreatmentRecord);
    const adheringTrt = activeTrt.filter(isAdheringFollowupRecord);
    const newlyDiagTrt = activeTrt.filter(isNewlyDiagnosedRecord);
    const missedTrt = activeTrt.filter(isMissedFollowupRecord);

    return {
      srNo: idx + 1,
      shc: scName,
      village: vName,
      totalIndividuals: vInds.length,
      cbacCompleted: cbac.length,
      htnScreened: htnScr.length,
      dmScreened: dmScr.length,
      ocScreened: ocScr.length,
      bcScreened: bcScr.length,
      ccScreened: ccScr.length,
      totalScreenedEvents: scr.length,
      uniqueScreenedIndividuals: new Set(scr.map(s => s.individual_id)).size,
      newlyDiagnosed: newlyDiagTrt.length,
      underTreatment: activeTrt.length,
      uniqueUnderTreatmentIndividuals: new Set(activeTrt.map(t => t.individual_id)).size,
      adheringFollowup: adheringTrt.length,
      missedFollowup: missedTrt.length
    };
  });

  return {
    success: true,
    activeVersion: activeDatasetVersion,
    reportName: 'गावनिहाय NCD अहवाल (Village-wise NCD Report - CSV Authoritative)',
    rows
  };
}

export function getNcdDiseaseReport(filters = {}) {
  const { shc, village, fromDate, toDate } = filters;
  const diseases = [
    { code: 'HTN', name: 'उच्च रक्तदाब (Hypertension - HTN)' },
    { code: 'DM', name: 'मधुमेह (Diabetes Mellitus - DM)' },
    { code: 'OC', name: 'मुख कर्करोग (Oral Cancer - OC)' },
    { code: 'BC', name: 'स्तन कर्करोग (Breast Cancer - BC)' },
    { code: 'CC', name: 'गर्भाशय मुख कर्करोग (Cervical Cancer - CC)' }
  ];

  const rows = diseases.map((dObj, idx) => {
    const rawScr = filterByDateRange(
      filterNcdRecords(ncdScreeningRecords.filter(s => s.disease_code === dObj.code || s.disease.includes(dObj.code)), { shc, village }),
      'screened_date',
      fromDate,
      toDate
    );
    const completedScr = rawScr.filter(isCompletedScreeningRecord);
    const pendingScr = rawScr.filter(s => classifyScreeningStatus(s.raw_screening_status || s.screening_status, s.screened_date) === 'PENDING');

    const rawTrt = filterByDateRange(
      filterNcdRecords(ncdTreatmentRecords.filter(t => t.disease_code === dObj.code || t.disease.includes(dObj.code)), { shc, village }),
      'treatment_start_date',
      fromDate,
      toDate,
      'last_followup_date'
    );
    const activeTrt = rawTrt.filter(isActiveTreatmentRecord);
    const adheringTrt = activeTrt.filter(isAdheringFollowupRecord);
    const newlyDiagTrt = activeTrt.filter(isNewlyDiagnosedRecord);
    const missedTrt = activeTrt.filter(isMissedFollowupRecord);

    const controlled = activeTrt.filter(t => String(t.disease_control || '').toLowerCase().includes('control') && !String(t.disease_control || '').toLowerCase().includes('uncontrol'));
    const uncontrolled = activeTrt.filter(t => String(t.disease_control || '').toLowerCase().includes('uncontrol'));

    return {
      srNo: idx + 1,
      diseaseCode: dObj.code,
      diseaseName: dObj.name,
      screenedTotal: completedScr.length,
      uniqueScreenedIndividuals: new Set(completedScr.map(s => s.individual_id)).size,
      pendingScreeningCount: pendingScr.length,
      newlyDiagnosedCount: newlyDiagTrt.length,
      underTreatment: activeTrt.length,
      uniqueUnderTreatmentIndividuals: new Set(activeTrt.map(t => t.individual_id)).size,
      adheringFollowupCount: adheringTrt.length,
      missedFollowupCount: missedTrt.length,
      controlledCount: controlled.length,
      uncontrolledCount: uncontrolled.length,
      diagnosedNotice: newlyDiagTrt.length > 0 ? `${newlyDiagTrt.length} (Newly Diagnosed)` : 'Source Data Unavailable*',
      rescreeningNotice: 'Source Data Unavailable*'
    };
  });

  return {
    success: true,
    activeVersion: activeDatasetVersion,
    reportName: 'आजार निहाय NCD अहवाल (Disease-wise NCD Report)',
    rows
  };
}

export function getNcdLineListing(filters = {}) {
  const { shc, village, page = 1, limit = 50, search = '', onlyDiscrepancies = false } = filters;
  let list = ncdIndividuals;

  if (shc && shc !== 'ALL' && shc !== 'सर्व') {
    const targetShc = String(shc).trim();
    list = list.filter(i => String(i.shc || '').trim() === targetShc);
  }
  if (village && village !== 'ALL' && village !== 'सर्व') {
    const targetVil = String(village).trim();
    list = list.filter(i => String(i.village || '').trim() === targetVil);
  }
  if (onlyDiscrepancies === true || onlyDiscrepancies === 'true') {
    list = list.filter(i => i.has_location_discrepancy);
  }
  if (search) {
    const q = search.toLowerCase().trim();
    list = list.filter(i =>
      String(i.individual_id || '').toLowerCase().includes(q) ||
      String(i.first_name || '').toLowerCase().includes(q) ||
      String(i.last_name || '').toLowerCase().includes(q) ||
      String(i.shc || '').toLowerCase().includes(q) ||
      String(i.village || '').toLowerCase().includes(q) ||
      String(i.abha_number || '').toLowerCase().includes(q)
    );
  }

  const total = list.length;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.max(1, parseInt(limit, 10) || 50);
  const start = (p - 1) * l;
  const paginated = list.slice(start, start + l);

  // Enrich paginated items with their linked CBAC, Screening, and Treatment records by Individual ID
  const pageIndIds = new Set(paginated.map(i => i.individual_id));
  const cbacByInd = new Map();
  const scrByInd = new Map();
  const trtByInd = new Map();

  ncdCbacRecords.forEach(c => {
    if (pageIndIds.has(c.individual_id)) cbacByInd.set(c.individual_id, c);
  });
  ncdScreeningRecords.forEach(s => {
    if (pageIndIds.has(s.individual_id)) {
      if (!scrByInd.has(s.individual_id)) scrByInd.set(s.individual_id, []);
      scrByInd.get(s.individual_id).push(s);
    }
  });
  ncdTreatmentRecords.forEach(t => {
    if (pageIndIds.has(t.individual_id)) {
      if (!trtByInd.has(t.individual_id)) trtByInd.set(t.individual_id, []);
      trtByInd.get(t.individual_id).push(t);
    }
  });

  const enrichedItems = paginated.map(ind => {
    const cbac = cbacByInd.get(ind.individual_id);
    const scrs = scrByInd.get(ind.individual_id) || [];
    const trts = trtByInd.get(ind.individual_id) || [];
    const completedScrs = scrs.filter(isCompletedScreeningRecord);
    const activeTrts = trts.filter(isActiveTreatmentRecord);

    return {
      ...ind,
      cbac_date: cbac?.cbac_date || ind.cbac_date || '',
      cbac_status: cbac?.cbac_status || ind.cbac_status || '',
      cbac_risk_score: cbac?.cbac_risk_score || ind.cbac_risk_score || '',
      completed_screenings: completedScrs.map(s => `${s.disease_code} (${s.screened_date})`).join(', ') || '-',
      active_treatments: activeTrts.map(t => `${t.disease_code}: ${t.raw_treatment_status || t.treatment_status}`).join(', ') || '-'
    };
  });

  return {
    success: true,
    activeVersion: activeDatasetVersion,
    page: p,
    limit: l,
    total,
    totalPages: Math.max(1, Math.ceil(total / l)),
    items: enrichedItems
  };
}
