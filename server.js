import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

// Universal Helper for Excel (.xlsx) and CSV exports with 100% Devanagari Unicode support
function sendExportData(req, res, filenameBase, headers, rawRows, sheetName = 'Data') {
  const cleanRows = rawRows.map(r => {
    const rowArr = Array.isArray(r) ? r : [r];
    return rowArr.map(c => {
      if (c === null || c === undefined) return '';
      let str = String(c).trim();
      if (str.startsWith('"') && str.endsWith('"')) {
        str = str.slice(1, -1);
      }
      return str.replace(/""/g, '"');
    });
  });

  const isCsvReq = req.path.endsWith('.csv') && req.query.format !== 'excel' && req.query.format !== 'xlsx';

  if (isCsvReq) {
    const csvContent = '\uFEFF' + [headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','), ...cleanRows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    return res.status(200).send(csvContent);
  }

  // Native Binary XLSX Export (100% readable Marathi in Excel)
  try {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...cleanRows]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('Error generating XLSX export:', err);
    const csvContent = '\uFEFF' + [headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','), ...cleanRows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    return res.status(200).send(csvContent);
  }
}

import {
  masterData,
  monthMaster,
  bsDataEntry,
  villageDetails,
  importantLinks,
  downloadsData,
  photosData,
  generatedReports,
  googleSheetConfig,
  formatBsEntry,
  formatVillageDetail,
  subcenterMaster,
  villagesMaster,
  employeeMaster,
  syncMasterData,
  transferHistory,
  transferEmployee,
  updateEmployeeVillages,
  saveEmployee,
  deleteEmployee,
  FIXED_BS_CODES,
  bsServiceTenureHistory,
  endEmployeeService,
  attachEmployeeToBsCode,
  getBsCodeRegistry,
  getBsServiceTenureHistory,
  saveSubcenter,
  deleteSubcenter,
  saveVillage,
  deleteVillage,
  importMasterDataFromCsv,
  importBsDataEntryCsv,
  importVillageDetailsCsv,
  importMonthMasterCsv,
  seedInitialMalariaData,
  clearAllTransactionData,
  getOpdBsVillagewiseSummary,
  getEmployeeVillageDistributionSummary,
  recalculateAllMonthProgressives,
  saveDbToDisk,
  loadDbFromDisk,
  backfillBsDataEmployeeNames,
  dengueChikungunyaEntries,
  saveDengueEntry,
  deleteDengueEntry,
  deleteBatchDengueEntries,
  getDengueEntries,
  updateDengueLabReport,
  saveDengueBatchLabReport,
  importDengueOldDataCsv,
  clearDengueEntries,
  pendingSyncQueue,
  addToPendingQueue,
  getPendingSyncQueue,
  removePendingQueueItem,
  markDengueEntrySyncStatus,
  getPendingDengueEntries
} from './data/store.js';

import {
  refreshNwbdcpFromSupabase,
  getNwbdcpReferenceMasterData,
  getWaterSources,
  saveWaterSource,
  toggleWaterSourceStatus,
  deleteWaterSource,
  dispatchWaterSamples,
  getDispatchedSamples,
  updateLabResults,
  replaceNwbdcpReportCopy,
  createRetestForSample,
  updateRetestResult,
  getRetestsList,
  generateNwbdcpReports,
  getNwbdcpDashboardData,
  getOverdueSources,
  getCurrentMonthSamplePlan,
  importWaterSourcesList,
  importHistoricalWaterSamples
} from './services/nwbdcpStore.js';

import {
  uploadFileToGoogleDrive,
  replaceFileInGoogleDrive,
  getPhysicalDriveFilePath,
  validateNwbdcpUpload,
  performStorageIntegrityCheck
} from './services/nwbdcpDriveStorage.js';

import {
  saveFileMetadata,
  recordFileReplacement,
  getActiveFileMetadata,
  getSampleFileHistory,
  findFileMetadata,
  getSupabaseStatus,
  getSyncQueueSummary,
  processPendingSyncQueue
} from './services/nwbdcpSupabase.js';

import {
  nwbdcpRequireAuth,
  ROLES,
  issueNwbdcpToken,
  verifyNwbdcpToken,
  revokeNwbdcpSession,
  authenticateAndIssueNwbdcpToken,
  authenticateGoogleIdentityAndIssueToken,
  handleNwbdcpTokenIssuance,
  nwbdcpAuthRateLimiter
} from './services/nwbdcpAuth.js';

import {
  generateDailyMalariaReportWebApp,
  generateMonthlyReportWebApp,
  generateEmployeeRegisterWebApp,
  getDefaulterListForMonth,
  generateEmployeeNoticesWebApp,
  generateLowPerformanceReportWebApp,
  generateEmployeeVillageMonthlyReportWebApp,
  getEmployeeVillageMonthlyData,
  generateGmcForwardingLetter,
  generateNivCaseHistorySheets,
  findMonthInMaster
} from './services/reports.js';

import {
  initNcdStore,
  getNcdDashboardStats,
  getNcdSubcenterReport,
  getNcdVillageReport,
  getNcdDiseaseReport,
  getNcdLineListing,
  previewNcdCsvImport,
  processNcdCsvImport,
  previewNcdMultiFileImport,
  replaceNcdDataset,
  stageNcdCsvChunk,
  clearNcdStagedSession,
  getActiveDatasetInfo,
  ncdImportBatches,
  ncdIndividuals
} from './services/ncdStore.js';

import {
  syncDengueEntryToFirestore,
  syncBatchDengueEntriesToFirestore,
  deleteDengueEntryFromFirestore,
  deleteBatchDengueEntriesFromFirestore,
  clearAllDengueEntriesFromFirestore,
  syncBsDataEntryToFirestore,
  syncBatchBsDataToFirestore,
  syncVillageDetailToFirestore,
  syncSubcenterMasterToFirestore,
  syncEmployeeMasterToFirestore,
  syncVillagesMasterToFirestore,
  syncMonthMasterToFirestore,
  syncBatchMonthMasterToFirestore,
  transferAllDataToFirestore,
  fetchAllDataFromFirestore,
  deleteBsDataEntryFromFirestore,
  getMonthDocId,
  syncBatchEmployeesToFirestore,
  syncBatchSubcentersToFirestore,
  syncBatchVillagesToFirestore,
  syncBatchTransferHistoryToFirestore,
  syncBsTenureHistoryToFirestore,
  syncBatchBsTenureHistoryToFirestore
} from './services/firebaseStore.js';

import {
  fetchSubcentersFromSupabase,
  syncSubcenterToSupabase,
  deleteSubcenterFromSupabase,
  fetchVillagesFromSupabase,
  syncVillageToSupabase,
  deleteVillageFromSupabase,
  fetchEmployeesFromSupabase,
  syncEmployeeToSupabase,
  deleteEmployeeFromSupabase,
  fetchMonthMasterFromSupabase,
  syncMonthMasterToSupabase,
  syncBatchMonthMasterToSupabase,
  fetchBsDataFromSupabase,
  syncBsDataToSupabase,
  deleteBsEntryFromSupabase,
  fetchVillageDetailsFromSupabase,
  syncVillageDetailsToSupabase,
  fetchTransferHistoryFromSupabase,
  syncTransferHistoryToSupabase,
  fetchDengueChikungunyaFromSupabase,
  syncDengueEntryToSupabase,
  deleteDengueEntryFromSupabase,
  clearDengueEntriesFromSupabase,
  clearAllNvbdcpTransactionsFromSupabase,
  isSupabaseOnline as isNvbdcpSupabaseOnline
} from './services/nvbdcpSupabase.js';

let lastFsSyncTime = 0;
const FS_SYNC_CACHE_MS = 1000; // 1-second debounce to avoid redundant concurrent network calls

let lastSbSyncTime = 0;
const SB_SYNC_CACHE_MS = 2000; // 2-second debounce for live two-way Supabase reads

export async function syncAllDataFromSupabase(force = false) {
  if (!isNvbdcpSupabaseOnline()) {
    return { success: false, reason: 'SUPABASE_OFFLINE' };
  }
  const now = Date.now();
  if (!force && (now - lastSbSyncTime < SB_SYNC_CACHE_MS)) {
    return { success: true, cached: true };
  }
  lastSbSyncTime = now;
  try {
    const [subcenters, villages, employees, months, bsData, vDetails, transfers, dengue] = await Promise.all([
      fetchSubcentersFromSupabase(),
      fetchVillagesFromSupabase(),
      fetchEmployeesFromSupabase(),
      fetchMonthMasterFromSupabase(),
      fetchBsDataFromSupabase(),
      fetchVillageDetailsFromSupabase(),
      fetchTransferHistoryFromSupabase(),
      fetchDengueChikungunyaFromSupabase()
    ]);

    let loadedAny = false;

    if (Array.isArray(subcenters) && subcenters.length > 0) {
      subcenterMaster.length = 0;
      subcenters.forEach(s => subcenterMaster.push(s));
      loadedAny = true;
    }
    if (Array.isArray(villages) && villages.length > 0) {
      villagesMaster.length = 0;
      villages.forEach(v => villagesMaster.push(v));
      loadedAny = true;
    }
    if (Array.isArray(employees) && employees.length > 0) {
      employeeMaster.length = 0;
      employees.forEach(e => employeeMaster.push(e));
      syncMasterData();
      loadedAny = true;
    }
    if (Array.isArray(months) && months.length > 0) {
      months.forEach(savedM => {
        const m = monthMaster.find(x => x.name === savedM.name);
        if (m) Object.assign(m, savedM);
      });
      loadedAny = true;
    }
    if (Array.isArray(bsData)) {
      bsDataEntry.length = 0;
      bsData.forEach(r => bsDataEntry.push(r));
      loadedAny = true;
    }
    if (Array.isArray(vDetails)) {
      villageDetails.length = 0;
      vDetails.forEach(r => villageDetails.push(r));
      loadedAny = true;
    }
    if (Array.isArray(transfers)) {
      transferHistory.length = 0;
      transfers.forEach(t => transferHistory.push(t));
      loadedAny = true;
    }
    if (Array.isArray(dengue)) {
      dengueChikungunyaEntries.length = 0;
      dengue.forEach(d => dengueChikungunyaEntries.push(d));
      loadedAny = true;
    }

    if (loadedAny) {
      backfillBsDataEmployeeNames();
      recalculateAllMonthProgressives();
      saveDbToDisk();
      console.log(`[Server] Synced and refreshed from Supabase Primary Database.`);
      return { success: true, source: 'SUPABASE' };
    }
    return { success: false, reason: 'SUPABASE_EMPTY_OR_UNAVAILABLE' };
  } catch (err) {
    console.warn('[Server] syncAllDataFromSupabase error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function syncAllDataFromFirestore(force = false) {
  const now = Date.now();
  if (!force && (now - lastFsSyncTime < FS_SYNC_CACHE_MS)) {
    return { success: true, cached: true };
  }
  lastFsSyncTime = now;

  try {
    const fsData = await fetchAllDataFromFirestore();
    if (!fsData || !fsData.success) {
      console.warn('[Server] Firestore fetch failed or unready:', fsData?.error);
      return { success: false, error: fsData?.error };
    }

    // 1. BS Data Entries (Blood Smear Slides)
    if (Array.isArray(fsData.bsList)) {
      bsDataEntry.length = 0;
      fsData.bsList.forEach(r => {
        bsDataEntry.push([
          r[0],
          new Date(r[1]),
          r[2] || '',
          r[3] || '',
          r[4] || '',
          r[5] || '',
          r[6] || '',
          parseInt(r[7]) || 0,
          parseInt(r[8]) || 0,
          parseInt(r[9]) || 0
        ]);
      });
    }

    // 2. Village Details (Villagewise Breakdown)
    if (Array.isArray(fsData.villageList)) {
      villageDetails.length = 0;
      fsData.villageList.forEach(r => {
        villageDetails.push([
          r[0],
          r[1] || '',
          new Date(r[2]),
          r[3] || '',
          parseInt(r[4]) || 0,
          parseInt(r[5]) || 0,
          parseInt(r[6]) || 0,
          r[7] || ''
        ]);
      });
    }

    // 3. Dengue / Chikungunya entries
    if (Array.isArray(fsData.dengueList)) {
      dengueChikungunyaEntries.length = 0;
      fsData.dengueList.forEach(d => dengueChikungunyaEntries.push(d));
    }

    // 4. Subcenters Master
    if (Array.isArray(fsData.subcenterList) && fsData.subcenterList.length > 0) {
      subcenterMaster.length = 0;
      fsData.subcenterList.forEach(s => subcenterMaster.push(s));
    }

    // 4.5. Transfer History
    if (Array.isArray(fsData.transferList)) {
      transferHistory.length = 0;
      fsData.transferList.forEach(t => transferHistory.push(t));
    }

    // 5. Employee Master
    if (Array.isArray(fsData.employeeList) && fsData.employeeList.length > 0) {
      employeeMaster.length = 0;
      fsData.employeeList.forEach(e => employeeMaster.push(e));
      syncMasterData();
    }

    // 6. Villages Master
    if (Array.isArray(fsData.villageMasterList) && fsData.villageMasterList.length > 0) {
      villagesMaster.length = 0;
      fsData.villageMasterList.forEach(v => {
        const pop = parseInt(v.population) || 0;
        let h = parseInt(v.houses != null ? v.houses : v.households);
        if (isNaN(h) || h <= 0) {
          h = pop > 0 ? Math.round(pop / 5) : 0;
        }
        villagesMaster.push({
          ...v,
          population: pop,
          houses: h,
          households: h,
          annualSmearTarget: parseInt(v.annualSmearTarget != null ? v.annualSmearTarget : v.target) || Math.round(pop * 0.1),
          ashaName: v.ashaName || v.ashaWorker || ''
        });
      });
      saveDbToDisk();
    }

    // 7. Month Master (NVBDCP Indicators, OPD, and MPW/ANM Home Visits)
    const cleanStr = s => String(s || '').trim().toLowerCase();
    const cleanMonthName = s => String(s || '').replace(/[0-9०-९\s\-_]/g, '').trim().toLowerCase();
    if (Array.isArray(fsData.monthList) && fsData.monthList.length > 0) {
      fsData.monthList.forEach(savedM => {
        const m = monthMaster.find(x => 
          (savedM.id && getMonthDocId(x.name) === savedM.id) ||
          (savedM.name && cleanMonthName(x.name) === cleanMonthName(savedM.name)) ||
          (savedM.name && cleanStr(x.name) === cleanStr(savedM.name))
        );
        if (m) {
          if (savedM.newOpd != null) m.newOpd = parseInt(savedM.newOpd) || 0;
          if (savedM.progNewOpd != null) m.progNewOpd = parseInt(savedM.progNewOpd) || 0;
          if (savedM.bloodSmears != null) m.bloodSmears = parseInt(savedM.bloodSmears) || 0;
          if (savedM.progBloodSmears != null) m.progBloodSmears = parseInt(savedM.progBloodSmears) || 0;
          if (savedM.feverCases != null) m.feverCases = parseInt(savedM.feverCases) || 0;
          if (savedM.progFeverCases != null) m.progFeverCases = parseInt(savedM.progFeverCases) || 0;
          if (savedM.treatedCases != null) m.treatedCases = parseInt(savedM.treatedCases) || 0;
          if (savedM.progTreatedCases != null) m.progTreatedCases = parseInt(savedM.progTreatedCases) || 0;
          if (savedM.chloroquineSpent != null) m.chloroquineSpent = parseInt(savedM.chloroquineSpent) || 0;
          if (savedM.progChloroquineSpent != null) m.progChloroquineSpent = parseInt(savedM.progChloroquineSpent) || 0;
          if (savedM.mpwFn1 != null) m.mpwFn1 = parseInt(savedM.mpwFn1) || 0;
          if (savedM.mpwFn2 != null) m.mpwFn2 = parseInt(savedM.mpwFn2) || 0;
          if (savedM.mpwHomeVisits != null) m.mpwHomeVisits = parseInt(savedM.mpwHomeVisits) || 0;
          if (savedM.progMpwFn1 != null) m.progMpwFn1 = parseInt(savedM.progMpwFn1) || 0;
          if (savedM.progMpwFn2 != null) m.progMpwFn2 = parseInt(savedM.progMpwFn2) || 0;
          if (savedM.progMpwHomeVisits != null) m.progMpwHomeVisits = parseInt(savedM.progMpwHomeVisits) || 0;
          if (savedM.anmFn1 != null) m.anmFn1 = parseInt(savedM.anmFn1) || 0;
          if (savedM.anmFn2 != null) m.anmFn2 = parseInt(savedM.anmFn2) || 0;
          if (savedM.anmHomeVisits != null) m.anmHomeVisits = parseInt(savedM.anmHomeVisits) || 0;
          if (savedM.progAnmFn1 != null) m.progAnmFn1 = parseInt(savedM.progAnmFn1) || 0;
          if (savedM.progAnmFn2 != null) m.progAnmFn2 = parseInt(savedM.progAnmFn2) || 0;
          if (savedM.progAnmHomeVisits != null) m.progAnmHomeVisits = parseInt(savedM.progAnmHomeVisits) || 0;
        }
      });
    } else {
      // If MonthMaster does not yet exist in Firestore, seed all 12 months with recalculated progressives
      recalculateAllMonthProgressives();
      await syncBatchMonthMasterToFirestore(monthMaster);
      console.log('[Server] Seeded initial 12 months of MonthMaster into Cloud Firestore.');
    }

    backfillBsDataEmployeeNames();
    recalculateAllMonthProgressives();
    saveDbToDisk();
    console.log(`[Server] Synced and refreshed from Firestore: ${bsDataEntry.length} BS, ${villageDetails.length} villages, ${monthMaster.length} months.`);
    return { success: true };
  } catch (err) {
    console.error('[Server] Error syncing from Firestore:', err);
    return { success: false, error: err.message };
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.options('*', cors());

// Minimal Exact Allowed Origins helper for NWBDCP APIs (/api/nwbdcp/*)
// NWBDCP runs entirely on Cloud Run and does NOT run from GitHub Pages or AI Studio parent window
function getExactAllowedOrigins() {
  const allowed = new Set();

  // 1. Parse process.env.ALLOWED_ORIGINS (excluding legacy NVBDCP GitHub Pages)
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach(entry => {
      let val = entry.trim();
      if (val.includes('=')) {
        val = val.split('=').pop().trim();
      }
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1).trim();
      }
      val = val.replace(/\/+$/, '').toLowerCase();
      // Only allow custom production origins; exclude legacy NVBDCP GitHub Pages
      if (val && !val.includes('phbhada-pixel.github.io')) {
        allowed.add(val);
      }
    });
  }

  // 2. Specific Cloud Run service URL for this applet deployment
  if (process.env.APP_URL) {
    const appUrlClean = process.env.APP_URL.trim().replace(/\/+$/, '').toLowerCase();
    allowed.add(appUrlClean);

    // Paired production/shared environment pair
    if (appUrlClean.includes('ais-dev-')) {
      allowed.add(appUrlClean.replace('ais-dev-', 'ais-pre-'));
    } else if (appUrlClean.includes('ais-pre-')) {
      allowed.add(appUrlClean.replace('ais-pre-', 'ais-dev-'));
    }
  }

  return allowed;
}

// Hardened CORS Origin Guard strictly for NWBDCP APIs (/api/nwbdcp/*)
// Preserves existing shared global CORS for NVBDCP while restricting NWBDCP to exact trusted origins
const nwbdcpCorsGuard = (req, res, next) => {
  const origin = req.headers.origin;

  // Requests without origin header (same-origin, curl, server-to-server) are allowed
  if (!origin) {
    return next();
  }

  const isProd = process.env.NODE_ENV === 'production';
  const originClean = origin.trim().replace(/\/+$/, '').toLowerCase();

  // Check localhost / loopback origins
  const isLocalhost =
    originClean.startsWith('http://localhost:') ||
    originClean === 'http://localhost' ||
    originClean.startsWith('http://127.0.0.1:') ||
    originClean === 'http://127.0.0.1';

  if (isLocalhost) {
    // In production, reject localhost unconditionally
    if (isProd) {
      return res.status(403).json({ error: 'CORS origin not allowed in production.' });
    }
    // In development mode only, allow localhost
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  }

  // Precision check against exact allowlisted production origins (no wildcards)
  const exactAllowedOrigins = getExactAllowedOrigins();
  const isAllowed = exactAllowedOrigins.has(originClean);

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  }

  // Reject untrusted/unknown cross-origin requests
  return res.status(403).json({ error: 'CORS origin not allowed.' });
};

app.use('/api/nwbdcp', nwbdcpCorsGuard);
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Serve static NWBDCP uploaded laboratory reports
const nwbdcpReportsDir = path.join(__dirname, 'public/uploads/nwbdcp_reports');
if (!fs.existsSync(nwbdcpReportsDir)) {
  fs.mkdirSync(nwbdcpReportsDir, { recursive: true });
}
app.use('/uploads/nwbdcp_reports', express.static(nwbdcpReportsDir));

// Serve xlsx library
app.use('/js/xlsx.full.min.js', (req, res) => {
  const xlsxPath = path.join(__dirname, 'node_modules/xlsx/dist/xlsx.full.min.js');
  if (fs.existsSync(xlsxPath)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(xlsxPath);
  } else {
    res.status(404).send('Not found');
  }
});

// Serve index.html at root and standard entry paths
app.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/Form.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/defaultData.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'defaultData.js'));
});

// RPC health/info endpoint
app.get('/api/rpc', (req, res) => {
  res.json({ status: 'ok', service: 'PHC Bhada Malaria RPC API' });
});

// View generated reports (HTML / Print View)
app.get('/api/reports/:id', (req, res) => {
  const reportHtml = generatedReports.get(req.params.id);
  if (!reportHtml) {
    return res.status(404).send('<h3>अहवाल सापडला नाही (Report Not Found).</h3>');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(reportHtml);
});

// Export BS Data as CSV / Excel
app.get(['/api/export/dengue-samples.csv', '/api/export/dengue-samples.xlsx'], (req, res) => {
  const headers = [
    'आयडी (ID)', 'रुग्णाचे नाव (Patient Name)', 'मोबाईल (Mobile)', 'घर क्र. (House No)',
    'गाव (Village)', 'तालुका (Taluka)', 'जिल्हा (District)', 'रुग्णालय पत्ता (Hospital Address)',
    'नोंदणी क्र. (Reg No)', 'वार्ड (Ward)', 'बेड (Bed)', 'वय (Age)', 'लिंग (Sex)',
    'लक्षणे सुरू दिनांक (Onset Date)', 'नमुना प्रकार (Sample Nature)', 'नमुना घेतल्याचा दिनांक (Collection Date)',
    'ताप दिवस (Fever Days)', 'डोकेदुखी दिवस (Headache Days)', 'अंगदुखी दिवस (Bodyache Days)',
    'सांधेदुखी दिवस (Joint Pain Days)', 'डोळ्यांमागे दुखणे (Retro Orbital Pain Days)', 'पुरळ दिवस (Rash Days)',
    'रक्तस्राव (Haemorrhagic)', 'डॉक्टर नाव (Doctor Name)', 'डॉक्टर मोबाईल (Doctor Mobile)',
    'डेंगी निष्कर्ष (Dengue Result)', 'डेंगी चाचणी प्रकार (Dengue Test Type)', 'डेंगी लॅब संदर्भ क्र. (Dengue Report Ref)',
    'डेंगी अहवाल दिनांक (Dengue Report Date)', 'चिकनगुनिया निष्कर्ष (Chikungunya Result)',
    'चिकनगुनिया चाचणी प्रकार (Chikungunya Test Type)', 'चिकनगुनिया लॅब संदर्भ क्र. (Chikungunya Report Ref)',
    'चिकनगुनिया अहवाल दिनांक (Chikungunya Report Date)', 'एकूण स्थिती (Overall Status)'
  ];

  const rows = dengueChikungunyaEntries.map(e => [
    e.id,
    e.patientName || '',
    e.mobile || '-',
    e.houseNo || '-',
    e.village || '',
    e.taluka || 'AUSA',
    e.district || 'LATUR',
    e.hospitalAddress || '',
    e.patientRegNo || '-',
    e.wardNo || '--',
    e.bedNo || '--',
    e.age || 0,
    e.sex || '',
    e.dateOnset || '',
    e.sampleNature || 'Serum',
    e.dateCollection || '',
    e.clinicalFever ?? 1,
    e.clinicalHeadache ?? 0,
    e.clinicalBodyache ?? 0,
    e.clinicalJointPain ?? 0,
    e.clinicalRetroOrbitalPain ?? 0,
    e.clinicalRash ?? 0,
    e.haemorrhagic || 'No',
    e.doctorName || '',
    e.doctorMobile || '',
    e.dengueResult || 'Pending',
    e.dengueTestType || '',
    e.dengueReportRef || '',
    e.dengueReportDate || '',
    e.chikungunyaResult || 'Pending',
    e.chikungunyaTestType || '',
    e.chikungunyaReportRef || '',
    e.chikungunyaReportDate || '',
    e.testResult || 'Pending'
  ]);

  sendExportData(req, res, 'phc_bhada_dengue_chikungunya_samples', headers, rows, 'Dengue_Chikungunya');
});

app.get(['/api/export/bs-data.csv', '/api/export/bs-data.xlsx'], (req, res) => {
  const headers = ['BS_ID', 'तारीख', 'उपकेंद्र', 'कर्मचारी नाव', 'पदनाम', 'BS Code', 'बंडल क्र.', 'पासून', 'पर्यंत', 'एकूण नमुने'];
  const rows = bsDataEntry.map(r => {
    const item = formatBsEntry(r);
    return [
      item.id,
      item.dateStr,
      item.upkendra,
      item.employeeName,
      item.designation,
      item.bsCode,
      item.bundleNumber,
      item.pasun,
      item.paraynt,
      item.total
    ];
  });

  sendExportData(req, res, 'BsDataEntry_PHC_Bhada', headers, rows, 'BsDataEntry');
});

// Export Village Details
app.get(['/api/export/village-details.csv', '/api/export/village-details.xlsx'], (req, res) => {
  const headers = ['BS_ID', 'कर्मचारी नाव', 'तारीख', 'गाव', 'एकूण नमुने', 'पुरुष', 'स्त्री', 'उपकेंद्र'];
  const rows = villageDetails.map(r => {
    const item = formatVillageDetail(r);
    return [
      item.id,
      item.employeeName,
      item.dateStr,
      item.villageName,
      item.sampleCount,
      item.maleCount,
      item.femaleCount,
      item.upkendra
    ];
  });

  sendExportData(req, res, 'VillageDetails_PHC_Bhada', headers, rows, 'VillageDetails');
});

// Export Subcenters
app.get(['/api/export/subcenters.csv', '/api/export/subcenters.xlsx'], (req, res) => {
  const headers = ['उपकेंद्र आयडी', 'उपकेंद्र नाव', 'मुख्यालय', 'लोकसंख्या', 'घरांची संख्या', 'समाविष्ट गावे', 'संपर्क व्यक्ती', 'मोबाईल'];
  const rows = subcenterMaster.map(s => [
    s.id,
    s.name,
    s.headquarter || '',
    s.population || 0,
    s.houses || 0,
    (s.villages || []).join('; '),
    s.contactPerson || '',
    s.contactPhone || ''
  ]);

  sendExportData(req, res, 'SubcenterMaster_PHC_Bhada', headers, rows, 'SubcenterMaster');
});

// Export Villages
app.get(['/api/export/villages.csv', '/api/export/villages.xlsx'], (req, res) => {
  const headers = ['गाव आयडी', 'गावाचे नाव', 'उपकेंद्र', 'लोकसंख्या', 'घरांची संख्या', 'वार्षिक उद्दिष्ट', 'आशा नाव', 'नियुक्त कर्मचारी'];
  const rows = villagesMaster.map(v => [
    v.id,
    v.villageName,
    v.subcenter,
    v.population || 0,
    v.houses || 0,
    v.annualSmearTarget || 0,
    v.ashaName || '',
    (v.assignedEmployees || []).join('; ')
  ]);

  sendExportData(req, res, 'VillagesMaster_PHC_Bhada', headers, rows, 'VillagesMaster');
});

// Export Employees
app.get(['/api/export/employees.csv', '/api/export/employees.xlsx'], (req, res) => {
  const headers = ['कर्मचारी आयडी', 'उपकेंद्र', 'कर्मचारी नाव', 'पदनाम', 'प्रवर्ग', 'BS Code', 'मोबाईल', 'लागू असणारी गावे'];
  const rows = employeeMaster.map(e => [
    e.id,
    e.upkendra,
    e.employeeName,
    e.designation,
    e.category || '',
    e.bsCode || '',
    e.mobile || '',
    (e.villageList || []).join('; ')
  ]);

  sendExportData(req, res, 'EmployeesMaster_PHC_Bhada', headers, rows, 'EmployeesMaster');
});

// Export Transfers
app.get(['/api/export/transfers.csv', '/api/export/transfers.xlsx'], (req, res) => {
  const headers = ['बदली आयडी', 'दिनांक', 'कर्मचारी नाव', 'पदनाम', 'पूर्वीचे उपकेंद्र', 'नवीन उपकेंद्र', 'पूर्वीची गावे', 'नवीन गावे', 'BS Code', 'कारण', 'आदेश क्र', 'आदेश अधिकारी'];
  const rows = transferHistory.map(t => [
    t.id,
    t.dateFormatted || '',
    t.employeeName,
    t.designation,
    t.fromUpkendra,
    t.toUpkendra,
    (t.previousVillages || []).join('; '),
    (t.newVillages || []).join('; '),
    t.bsCode || '',
    t.reason || '',
    t.orderNo || '',
    t.transferredBy || ''
  ]);

  sendExportData(req, res, 'TransferHistory_PHC_Bhada', headers, rows, 'TransferHistory');
});

// Export BS Code Registry (Fixed Codes & Current Attachments)
app.get(['/api/export/bs-registry.csv', '/api/export/bs-registry.xlsx'], (req, res) => {
  const registry = getBsCodeRegistry();
  const headers = ['अ.क्र.', 'उपकेंद्र', 'BS Code', 'पदनाम/संवर्ग', 'कार्यक्षेत्र गावे', 'स्थिती (Status)', 'सध्या जोडलेले कर्मचारी', 'पदभार प्रकार', 'संलग्न दिनांक', 'मोबाईल क्र.'];
  const rows = registry.map((r, i) => [
    i + 1,
    r.upkendra,
    r.bsCode,
    r.designation,
    r.village || '',
    r.isVacant ? 'रिक्त / उपलब्ध' : 'कार्यरत',
    r.attachedEmployee ? r.attachedEmployee.employeeName : '-',
    r.attachedEmployee ? (r.attachedEmployee.chargeType === 'ADDITIONAL' ? 'अतिरिक्त पदभार' : r.attachedEmployee.chargeType === 'TRANSFER' ? 'बदली' : 'नियमित') : '-',
    r.attachedEmployee ? (r.attachedEmployee.attachDate || '-') : '-',
    r.attachedEmployee ? (r.attachedEmployee.mobile || '-') : '-'
  ]);

  sendExportData(req, res, 'BsCodeRegistry_PHC_Bhada', headers, rows, 'BsCodeRegistry');
});

// Export BS Service Tenure & End Service History Log
app.get(['/api/export/bs-tenure-history.csv', '/api/export/bs-tenure-history.xlsx'], (req, res) => {
  const headers = ['नोंद आयडी', 'BS Code', 'उपकेंद्र', 'कर्मचारी नाव', 'पदनाम', 'संवर्ग', 'पदभार प्रकार', 'सुरुवात दिनांक', 'सेवा समाप्ती दिनांक', 'स्थिती', 'समाप्तीचे कारण', 'आदेश क्र', 'शेरा/तपशील'];
  const rows = bsServiceTenureHistory.map(t => [
    t.id,
    t.bsCode,
    t.upkendra,
    t.employeeName,
    t.designation,
    t.category,
    t.chargeType === 'ADDITIONAL' ? 'अतिरिक्त पदभार' : t.chargeType === 'TRANSFER' ? 'बदली' : 'नियमित',
    t.startDate || '',
    t.endDate || '-',
    t.status === 'ENDED' ? 'सेवा समाप्त' : 'सक्रिय',
    t.endReason || '-',
    t.orderNo || '-',
    t.remarks || '-'
  ]);

  sendExportData(req, res, 'BsTenureHistory_PHC_Bhada', headers, rows, 'BsTenureHistory');
});

// Export Monthly Indicators
app.get(['/api/export/monthly-indicators.csv', '/api/export/monthly-indicators.xlsx'], (req, res) => {
  const headers = [
    'महिना (Month)',
    'नवीन बाह्यरुग्ण मासिक (New OPD Monthly)',
    'नवीन बाह्यरुग्ण प्रगत (New OPD Progressive)',
    'तापाचे रुग्ण मासिक (Fever Cases Monthly)',
    'तापाचे रुग्ण प्रगत (Fever Cases Progressive)',
    'घेतलेले रक्त नमुणे मासिक (Blood Smears Monthly)',
    'घेतलेले रक्त नमुणे प्रगत (Blood Smears Progressive)',
    'उपचारीत रुग्ण मासिक (Treated Cases Monthly)',
    'उपचारीत रुग्ण प्रगत (Treated Cases Progressive)',
    'क्लोरोक्वीन गोळ्या खर्च मासिक (Chloroquine Monthly)',
    'क्लोरोक्वीन गोळ्या खर्च प्रगत (Chloroquine Progressive)',
    'आरोग्य सेवक गृहभेटी १ ला पंधरवडा (MPW Fn 1)',
    'आरोग्य सेवक गृहभेटी २ रा पंधरवडा (MPW Fn 2)',
    'आरोग्य सेवक गृहभेटी एकूण मासिक (MPW Total)',
    'आरोग्य सेवक गृहभेटी प्रगत (MPW Progressive)',
    'आरोग्य सेविका गृहभेटी १ ला पंधरवडा (ANM Fn 1)',
    'आरोग्य सेविका गृहभेटी २ रा पंधरवडा (ANM Fn 2)',
    'आरोग्य सेविका गृहभेटी एकूण मासिक (ANM Total)',
    'आरोग्य सेविका गृहभेटी प्रगत (ANM Progressive)'
  ];

  let priorOpd = 0, priorFever = 0, priorSmears = 0, priorTreated = 0, priorCq = 0;
  let priorMpw = 0, priorAnm = 0;
  const rows = monthMaster.map(m => {
    const opdM = parseInt(m.newOpd != null ? m.newOpd : (m.opd || 0)) || 0;
    const opdP = m.progNewOpd != null ? parseInt(m.progNewOpd) : (priorOpd + opdM);
    priorOpd = opdP;

    const feverM = parseInt(m.feverCases) || 0;
    const feverP = m.progFeverCases != null ? parseInt(m.progFeverCases) : (priorFever + feverM);
    priorFever = feverP;

    const smearM = parseInt(m.bloodSmears) || 0;
    const smearP = m.progBloodSmears != null ? parseInt(m.progBloodSmears) : (priorSmears + smearM);
    priorSmears = smearP;

    const treatedM = parseInt(m.treatedCases) || 0;
    const treatedP = m.progTreatedCases != null ? parseInt(m.progTreatedCases) : (priorTreated + treatedM);
    priorTreated = treatedP;

    const cqM = parseInt(m.chloroquineSpent) || 0;
    const cqP = m.progChloroquineSpent != null ? parseInt(m.progChloroquineSpent) : (priorCq + cqM);
    priorCq = cqP;

    const mpwFn1 = parseInt(m.mpwFn1) || 0;
    const mpwFn2 = parseInt(m.mpwFn2) || 0;
    const mpwTot = parseInt(m.mpwHomeVisits) || (mpwFn1 + mpwFn2);
    const mpwProg = m.progMpwHomeVisits != null ? parseInt(m.progMpwHomeVisits) : (priorMpw + mpwTot);
    priorMpw = mpwProg;

    const anmFn1 = parseInt(m.anmFn1) || 0;
    const anmFn2 = parseInt(m.anmFn2) || 0;
    const anmTot = parseInt(m.anmHomeVisits) || (anmFn1 + anmFn2);
    const anmProg = m.progAnmHomeVisits != null ? parseInt(m.progAnmHomeVisits) : (priorAnm + anmTot);
    priorAnm = anmProg;

    return [
      m.name,
      opdM, opdP,
      feverM, feverP,
      smearM, smearP,
      treatedM, treatedP,
      cqM, cqP,
      mpwFn1, mpwFn2, mpwTot, mpwProg,
      anmFn1, anmFn2, anmTot, anmProg
    ];
  });

  sendExportData(req, res, 'NVBDCP_Monthly_Indicators_PHC_Bhada', headers, rows, 'Monthly_Indicators');
});

// Export Month Master
app.get(['/api/export/month-master.csv', '/api/export/month-master.xlsx'], (req, res) => {
  const headers = [
    'महिना (Month)',
    'पंधरवडा १ सुरु (FN1 Start)',
    'पंधरवडा १ शेवट (FN1 End)',
    'पंधरवडा २ सुरु (FN2 Start)',
    'पंधरवडा २ शेवट (FN2 End)',
    'नवीन बाह्यरुग्ण मासिक (New OPD Monthly)',
    'नवीन बाह्यरुग्ण प्रगत (New OPD Progressive)',
    'MPW पहिला पंधरवडा (MPW FN1)',
    'MPW दुसरा पंधरवडा (MPW FN2)',
    'MPW एकूण गृहभेटी (MPW Total Visits)',
    'MPW गृहभेटी प्रगत (MPW Visits Progressive)',
    'ANM पहिला पंधरवडा (ANM FN1)',
    'ANM दुसरा पंधरवडा (ANM FN2)',
    'ANM एकूण गृहभेटी (ANM Total Visits)',
    'ANM गृहभेटी प्रगत (ANM Visits Progressive)',
    'आशा गृहभेटी मासिक (ASHA Home Visits)',
    'आशा गृहभेटी प्रगत (ASHA Visits Progressive)',
    'तापाचे रुग्ण मासिक (Fever Cases Monthly)',
    'तापाचे रुग्ण प्रगत (Fever Cases Progressive)',
    'घेतलेले रक्त नमुणे मासिक (Blood Smears Monthly)',
    'घेतलेले रक्त नमुणे प्रगत (Blood Smears Progressive)',
    'उपचारीत रुग्ण मासिक (Treated Cases Monthly)',
    'उपचारीत रुग्ण प्रगत (Treated Cases Progressive)',
    'क्लोरोक्वीन खर्च मासिक (Chloroquine Monthly)',
    'क्लोरोक्वीन खर्च प्रगत (Chloroquine Progressive)'
  ];

  const fmtD = d => d instanceof Date ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` : String(d || '');

  const rows = monthMaster.map(m => [
    m.name,
    fmtD(m.f1Start),
    fmtD(m.f1End),
    fmtD(m.f2Start),
    fmtD(m.f2End),
    m.newOpd || 0,
    m.progNewOpd || 0,
    m.mpwFn1 || 0,
    m.mpwFn2 || 0,
    m.mpwHomeVisits || 0,
    m.progMpwHomeVisits || 0,
    m.anmFn1 || 0,
    m.anmFn2 || 0,
    m.anmHomeVisits || 0,
    m.progAnmHomeVisits || 0,
    m.ashaHomeVisits || 0,
    m.progAshaHomeVisits || 0,
    m.feverCases || 0,
    m.progFeverCases || 0,
    m.bloodSmears || 0,
    m.progBloodSmears || 0,
    m.treatedCases || 0,
    m.progTreatedCases || 0,
    m.chloroquineSpent || 0,
    m.progChloroquineSpent || 0
  ]);

  sendExportData(req, res, 'MonthMaster_PHC_Bhada_2026', headers, rows, 'MonthMaster');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'PHC Bhada Malaria Management System',
    records: bsDataEntry.length,
    villageRecords: villageDetails.length
  });
});

// Employee-Village Distribution Analytics Endpoint
app.get('/api/analytics/employee-village-distribution', (req, res) => {
  try {
    const summary = getEmployeeVillageDistributionSummary();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to view or copy Google Apps Script Code
app.get('/api/google-apps-script-code', (req, res) => {
  const scriptPath = path.join(__dirname, 'google-apps-script', 'Code.js');
  if (fs.existsSync(scriptPath)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.sendFile(scriptPath);
  } else {
    res.status(404).send('Google Apps Script code not found');
  }
});

// Endpoint to download Dengue & Chikungunya sample CSV template
app.get(['/api/download-dengue-template', '/dengue_chikungunya_sample_template.csv'], (req, res) => {
  const templatePath = path.join(__dirname, 'dengue_chikungunya_sample_template.csv');
  if (fs.existsSync(templatePath)) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="dengue_chikungunya_sample_template.csv"');
    res.sendFile(templatePath);
  } else {
    res.status(404).send('Template file not found');
  }
});

// Endpoint to download Dengue & Chikungunya sample Excel (.xls) template with 100% Marathi Unicode support
app.get(['/api/download-dengue-excel-template', '/dengue_chikungunya_sample_template.xls'], (req, res) => {
  const templatePath = path.join(__dirname, 'dengue_chikungunya_sample_template.xls');
  if (fs.existsSync(templatePath)) {
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="dengue_chikungunya_sample_template.xls"');
    res.sendFile(templatePath);
  } else {
    res.status(404).send('Template file not found');
  }
});

// Endpoint to download Dengue & Chikungunya English header CSV template
app.get(['/api/download-dengue-english-template', '/dengue_chikungunya_sample_template_english.csv'], (req, res) => {
  const templatePath = path.join(__dirname, 'dengue_chikungunya_sample_template_english.csv');
  if (fs.existsSync(templatePath)) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="dengue_chikungunya_sample_template_english.csv"');
    res.sendFile(templatePath);
  } else {
    res.status(404).send('Template file not found');
  }
});

// Endpoint to download Android APK file
app.get(['/api/download-apk', '/download-apk', '/phc_bhada_nvbdcp.apk', '/nvbdcp_app.apk'], (req, res) => {
  const possibleApkNames = ['phc_bhada_nvbdcp.apk', 'app-release.apk', 'app.apk', 'PHC_Bhada_NVBDCP.apk'];
  let apkPath = null;
  for (const name of possibleApkNames) {
    const fullPath = path.join(__dirname, name);
    if (fs.existsSync(fullPath)) {
      apkPath = fullPath;
      break;
    }
  }

  if (apkPath) {
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="PHC_Bhada_NVBDCP_v2.0.apk"');
    return res.sendFile(apkPath);
  } else {
    // If APK binary is not present directly on disk, provide HTML APK installer page & PWA install instructions
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<!DOCTYPE html>
<html lang="mr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PHC Bhada NVBDCP App - Android APK Download</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Poppins', sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #1e293b; padding: 32px 28px; border-radius: 20px; max-width: 500px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.4); border: 1px solid #334155; text-align: center; }
    .icon { font-size: 54px; margin-bottom: 12px; }
    h2 { color: #38bdf8; margin: 0 0 8px 0; font-size: 22px; font-weight: 700; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 10px 0; }
    .highlight { background: rgba(56, 189, 248, 0.1); border-left: 4px solid #38bdf8; padding: 12px; border-radius: 8px; text-align: left; margin: 18px 0; font-size: 13.5px; color: #e2e8f0; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: #10b981; color: #022c22; padding: 14px 28px; border-radius: 12px; font-weight: 700; text-decoration: none; font-size: 15px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.2s ease; margin-top: 10px; width: 100%; box-sizing: border-box; }
    .btn:hover { background: #34d399; transform: translateY(-2px); }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📱</div>
    <h2>प्रा.आ.केंद्र भादा - NVBDCP Android App</h2>
    <p>राष्ट्रीय कीटकजन्य रोग नियंत्रण कार्यक्रम अधिकृत मोबाईल ॲप्लिकेशन</p>
    <div class="highlight">
      <b>💡 अँड्रॉइड ॲप इन्स्टॉल पद्धत:</b><br>
      १. क्रोम (Chrome) ब्राऊझरच्या मेनूवर <b>(⋮)</b> क्लिक करा.<br>
      २. <b>'Add to Home screen'</b> किंवा <b>'Install app'</b> निवडा.<br>
      ३. ॲप तुमच्या फोनवर थेट अँड्रॉइड नेटिव्ह ॲपप्रमाणे सेव्ह होईल.
    </div>
    <a href="/" class="btn">🏠 मुख्य ॲप उघडा (Open Application)</a>
  </div>
</body>
</html>`);
  }
});

// Central RPC endpoint for client calls
app.post('/api/rpc', async (req, res) => {
  try {
    const { method, args = [] } = req.body || {};
    if (!method) {
      return res.status(400).json({ error: 'मेथडचे नाव आवश्यक आहे (Method name is required).' });
    }

    let result;

    const READ_OR_REPORT_METHODS = new Set([
      'getTablesData', 'getAllTablesData',
      'getMonthlyReportDashboardData', 'getMonthIndicators',
      'getDengueEntries', 'getDashboardStats',
      'generateDailyMalariaReportWebApp', 'generateMonthlyReportWebApp',
      'generateEmployeeRegisterWebApp', 'getEmployeeRegisterData', 'getDefaulterListForMonth',
      'generateEmployeeNoticesWebApp', 'generateLowPerformanceReportWebApp',
      'generateEmployeeVillageMonthlyReportWebApp', 'getEmployeeVillageMonthlyData', 'getVillageAnalyticsData', 'getFormWiseData',
      'getEmployeeVillageDistributionSummary', 'getSubcenterMaster',
      'getVillagesMaster', 'getEmployeeMaster', 'getMasterData',
      'getTransferHistory', 'getBsCodeRegistry', 'getBsServiceTenureHistory',
      'getLatestBundleNumber', 'getLastParayntValue',
      'syncFromFirestore', 'refreshFirestoreData'
    ]);

    if (READ_OR_REPORT_METHODS.has(method)) {
      await syncAllDataFromSupabase();
    }

    switch (method) {
      case 'syncFromFirestore':
      case 'refreshFirestoreData': {
        const sbRes = await syncAllDataFromSupabase(true);
        if (sbRes && sbRes.success) {
          result = {
            success: true,
            message: 'सर्व डेटा Supabase Primary Cloud डेटाबेसमधून थेट यशस्वीरित्या सिंक झाला! 🟢'
          };
        } else {
          const syncRes = await syncAllDataFromFirestore(true);
          result = {
            success: syncRes.success,
            message: syncRes.success
              ? 'सर्व डेटा Cloud डेटाबेसमधून थेट यशस्वीरित्या सिंक झाला! 🟢'
              : 'डेटाबेस सिंक त्रुटी: ' + syncRes.error
          };
        }
        break;
      }
      case 'getMasterData': {
        result = masterData;
        break;
      }

      case 'getLatestBundleNumber': {
        const [commonDate] = args;
        const inputDate = commonDate ? new Date(commonDate) : new Date();
        const inputDateStr = !isNaN(inputDate.getTime())
          ? `${inputDate.getFullYear()}-${String(inputDate.getMonth() + 1).padStart(2, '0')}-${String(inputDate.getDate()).padStart(2, '0')}`
          : '';
        let latest = 0;
        for (let i = bsDataEntry.length - 1; i >= 0; i--) {
          const rowDate = new Date(bsDataEntry[i][1]);
          const rowDateStr = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, '0')}-${String(rowDate.getDate()).padStart(2, '0')}`;
          if (rowDateStr === inputDateStr) {
            const match = String(bsDataEntry[i][6]).match(/(\d+)$/);
            if (match) latest = Math.max(latest, parseInt(match[1]));
          }
        }
        result = latest;
        break;
      }

      case 'getLastParayntValue': {
        const [upkendra, employeeName, commonDate, providedBsCode] = args;
        
        if (typeof backfillBsDataEmployeeNames === 'function') {
          backfillBsDataEmployeeNames();
        }

        const normalizeStr = (s) => String(s || '')
          .replace(/^(श्री\.|श्रीमती\.|सौ\.|डॉ\.|श्री|श्रीमती|सौ|डॉ)\s*/i, '')
          .replace(/[^a-zA-Z0-9\u0900-\u097F]/g, '')
          .toLowerCase()
          .trim();

        const inputEmpNorm = normalizeStr(employeeName);
        const inputBsCode = providedBsCode ? String(providedBsCode).trim().toUpperCase() : '';
        const cleanUpkendraInput = normalizeStr(upkendra);

        // Find employee record in employeeMaster
        const empRec = employeeMaster.find(e => 
          (inputBsCode && e.bsCode && String(e.bsCode).trim().toUpperCase() === inputBsCode) ||
          (e.employeeName && String(e.employeeName).trim() === String(employeeName).trim()) ||
          (e.employeeName && normalizeStr(e.employeeName) === inputEmpNorm)
        );

        const targetBsCode = empRec && empRec.bsCode ? String(empRec.bsCode).trim().toUpperCase() : inputBsCode;
        const targetEmpName = empRec ? empRec.employeeName : String(employeeName || '').trim();

        let inputYear = null;
        if (commonDate) {
          const d = new Date(commonDate);
          if (!isNaN(d.getTime())) inputYear = d.getFullYear();
        }
        if (!inputYear) inputYear = new Date().getFullYear();

        let maxParayntForYear = 0;
        let maxParayntOverall = 0;

        for (let i = 0; i < bsDataEntry.length; i++) {
          const row = bsDataEntry[i];
          if (!Array.isArray(row)) continue;

          // Only match records for the requested sub-centre to support posting-wise sequences
          const rowUpkendraNorm = normalizeStr(row[2]);
          if (cleanUpkendraInput && rowUpkendraNorm !== cleanUpkendraInput) continue;

          const rowEmpName = String(row[3] || '').trim();
          const rowBsCode = String(row[5] || '').trim().toUpperCase();
          const parayntVal = parseInt(row[8]) || 0;

          const matchesEmp = (
            (targetBsCode && rowBsCode && rowBsCode === targetBsCode) ||
            (rowEmpName && targetEmpName && (rowEmpName === targetEmpName || normalizeStr(rowEmpName) === inputEmpNorm))
          );

          if (!matchesEmp) continue;

          if (parayntVal > maxParayntOverall) {
            maxParayntOverall = parayntVal;
          }

          let rowYear = null;
          if (row[1]) {
            const rd = new Date(row[1]);
            if (!isNaN(rd.getTime())) rowYear = rd.getFullYear();
          }

          if (rowYear === inputYear) {
            if (parayntVal > maxParayntForYear) {
              maxParayntForYear = parayntVal;
            }
          }
        }

        result = maxParayntForYear > 0 ? maxParayntForYear : maxParayntOverall;
        break;
      }

      case 'saveBsData':
      case 'processDataEntry':
      case 'processForm': {
        const [formData] = args;
        const formDataArray = Array.isArray(formData) ? formData : (formData ? [formData] : []);
        if (!formDataArray.length) {
          result = { success: false, message: 'अवैध किंवा रिकामा फॉर्म डेटा (Invalid or empty form data).' };
          break;
        }

        const newEntriesForSync = [];
        const newVillageDetailsForSync = [];

        formDataArray.forEach(entry => {
          let empName = entry.employeeName || '';
          let bsCode = entry.bsCode || '';
          let upkendra = entry.upkendra || '';
          let designation = entry.designation || '';

          // Auto-fill from employeeMaster if any field is missing
          const empMatch = employeeMaster.find(e => 
            (bsCode && e.bsCode && String(e.bsCode).trim().toUpperCase() === String(bsCode).trim().toUpperCase()) ||
            (empName && e.employeeName && String(e.employeeName).trim() === String(empName).trim())
          );

          if (empMatch) {
            if (!empName) empName = empMatch.employeeName;
            if (!bsCode) bsCode = empMatch.bsCode || '';
            if (!upkendra) upkendra = empMatch.upkendra || '';
            if (!designation) designation = empMatch.designation || '';
          }

          const dateObj = entry.bsSendDate ? new Date(entry.bsSendDate) : new Date();
          const yyyymmdd = `${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, '0')}${String(dateObj.getDate()).padStart(2, '0')}`;
          const rowId = bsDataEntry.length + 1;
          const uniqueId = `BS_${yyyymmdd}_${bsCode || '0'}_${rowId}`;
          const total = (parseInt(entry.paraynt) || 0) - (parseInt(entry.pasun) || 0) + 1;

          bsDataEntry.push([
            uniqueId,
            dateObj,
            upkendra,
            empName,
            designation,
            bsCode,
            entry.bundleNumber || '',
            parseInt(entry.pasun) || 0,
            parseInt(entry.paraynt) || 0,
            total
          ]);

          newEntriesForSync.push({
            id: uniqueId,
            date: dateObj.toISOString().split('T')[0],
            upkendra: upkendra,
            employeeName: empName,
            designation: designation,
            bsCode: bsCode,
            bundleNumber: entry.bundleNumber || '',
            pasun: parseInt(entry.pasun) || 0,
            paraynt: parseInt(entry.paraynt) || 0,
            total: total
          });

          const vDetails = Array.isArray(entry.villageDetails) ? entry.villageDetails : (Array.isArray(entry.villageRows) ? entry.villageRows : []);
          if (vDetails.length > 0) {
            vDetails.forEach(v => {
              villageDetails.push([
                uniqueId,
                empName,
                dateObj,
                v.villageName || '',
                parseInt(v.sampleCount) || 0,
                parseInt(v.maleCount) || 0,
                parseInt(v.femaleCount) || 0,
                upkendra
              ]);
              newVillageDetailsForSync.push({
                uniqueId: uniqueId,
                employeeName: empName,
                date: dateObj.toISOString().split('T')[0],
                villageName: v.villageName || '',
                sampleCount: parseInt(v.sampleCount) || 0,
                maleCount: parseInt(v.maleCount) || 0,
                femaleCount: parseInt(v.femaleCount) || 0,
                upkendra: upkendra
              });
            });
          }
        });

        recalculateAllMonthProgressives();
        saveDbToDisk();

        // Primary Supabase Write (Awaited for strict two-way consistency)
        const sbBsRes = await syncBsDataToSupabase(newEntriesForSync);
        if (newVillageDetailsForSync.length > 0) {
          await syncVillageDetailsToSupabase(newVillageDetailsForSync);
        }
        await syncBatchMonthMasterToSupabase(monthMaster);
        lastSbSyncTime = Date.now();

        // Direct Firestore Write (Compatibility / Fallback)
        const fsBsRes = await syncBatchBsDataToFirestore(newEntriesForSync.map(e => [
          e.id, e.date, e.upkendra, e.employeeName, e.designation, e.bsCode, e.bundleNumber, e.pasun, e.paraynt, e.total
        ]));

        if (newVillageDetailsForSync.length > 0) {
          for (const v of newVillageDetailsForSync) {
            await syncVillageDetailToFirestore([
              v.uniqueId || v.id, v.employeeName, v.date, v.villageName, v.sampleCount, v.maleCount, v.femaleCount, v.upkendra
            ]);
          }
        }

        if (sbBsRes.success || fsBsRes.success) {
          result = {
            success: true,
            message: '✅ नोंद Supabase क्लाउड डेटाबेसमध्ये थेट यशस्वीरित्या सेव्ह झाली 🟢'
          };
        } else {
          result = {
            success: false,
            message: 'डेटा जतन करणे शक्य झाले नाही. कृपया तुमचे इंटरनेट कनेक्शन तपासून पुन्हा प्रयत्न करा (' + (sbBsRes.error || fsBsRes.error || 'Database Error') + ').'
          };
        }
        break;
      }

      case 'getTablesData':
      case 'getAllTablesData': {
        result = {
          success: true,
          bsData: bsDataEntry.map(formatBsEntry).reverse(),
          villageDetails: villageDetails.map(formatVillageDetail).reverse(),
          masterData: masterData,
          subcenterMaster: subcenterMaster,
          villagesMaster: villagesMaster,
          employeeMaster: employeeMaster,
          transferHistory: transferHistory,
          monthMaster: monthMaster.map((m, idx) => {
            const pad = n => String(n).padStart(2, '0');
            const dStr = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
            const priorMonths = monthMaster.slice(0, idx + 1);
            const calcProgOpd = priorMonths.reduce((s, x) => s + (parseInt(x.newOpd) || 0), 0);
            const calcProgFever = priorMonths.reduce((s, x) => s + (parseInt(x.feverCases != null ? x.feverCases : 0) || 0), 0);
            const calcProgSmears = priorMonths.reduce((s, x) => s + (parseInt(x.bloodSmears != null ? x.bloodSmears : (x.feverCases || 0)) || 0), 0);
            const calcProgTreated = priorMonths.reduce((s, x) => s + (parseInt(x.treatedCases != null ? x.treatedCases : 0) || 0), 0);
            const calcProgCq = priorMonths.reduce((s, x) => s + (parseInt(x.chloroquineSpent) || 0), 0);

            return {
              name: m.name,
              fn1: `${dStr(m.f1Start)} ते ${dStr(m.f1End)}`,
              fn2: `${dStr(m.f2Start)} ते ${dStr(m.f2End)}`,
              opd: m.newOpd,
              progOpd: m.progNewOpd != null ? m.progNewOpd : calcProgOpd,
              feverCases: m.feverCases != null ? m.feverCases : 0,
              progFeverCases: m.progFeverCases != null ? m.progFeverCases : calcProgFever,
              bloodSmears: m.bloodSmears != null ? m.bloodSmears : (m.feverCases || 0),
              progBloodSmears: m.progBloodSmears != null ? m.progBloodSmears : calcProgSmears,
              treatedCases: m.treatedCases != null ? m.treatedCases : 0,
              progTreatedCases: m.progTreatedCases != null ? m.progTreatedCases : calcProgTreated,
              chloroquineSpent: m.chloroquineSpent != null ? m.chloroquineSpent : 0,
              progChloroquineSpent: m.progChloroquineSpent != null ? m.progChloroquineSpent : calcProgCq
            };
          }),
          googleSheetConfig: googleSheetConfig
        };
        break;
      }

      case 'saveGoogleSheetConfig':
      case 'testGoogleSheetConnection':
      case 'syncAllToGoogleSheet':
      case 'fetchRealtimeFromGoogleSheet':
      case 'fetchDataFromGoogleSheet': {
        result = {
          success: true,
          message: 'प्रणाली आता पूर्णपणे प्राथमिक क्लाउड डेटाबेस कडून संचलित आहे. (Google Sheet सेवा पूर्णपणे बंद करण्यात आली आहे).'
        };
        break;
      }

      case 'clearAllDummyData':
      case 'clearAllData': {
        const clearRes = clearAllTransactionData();
        await clearAllNvbdcpTransactionsFromSupabase();
        await syncBatchMonthMasterToSupabase(monthMaster);
        lastSbSyncTime = Date.now();
        result = {
          success: true,
          message: clearRes.message || 'सर्व तात्पुरता/नमुना डेटा यशस्वीरित्या काढून टाकण्यात आला.'
        };
        break;
      }

      case 'deleteBsEntry': {
        const [entryId] = args;
        const index = bsDataEntry.findIndex(r => r[0] === entryId);
        if (index !== -1) {
          bsDataEntry.splice(index, 1);
          // Also remove corresponding village details
          for (let i = villageDetails.length - 1; i >= 0; i--) {
            if (villageDetails[i][0] === entryId) {
              villageDetails.splice(i, 1);
            }
          }
          recalculateAllMonthProgressives();
          saveDbToDisk();
          await deleteBsEntryFromSupabase(entryId);
          await syncBatchMonthMasterToSupabase(monthMaster);
          lastSbSyncTime = Date.now();
          await deleteBsDataEntryFromFirestore(entryId);
          result = { success: true, message: `नोंद ${entryId} डेटाबेसमधून यशस्वीरित्या हटवली!` };
        } else {
          result = { success: false, message: 'नोंद सापडली नाही.' };
        }
        break;
      }

      case 'getDashboardStats': {
        const [targetMonth] = args;
        let monthObj = findMonthInMaster(targetMonth);
        if (!monthObj) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          monthObj = monthMaster.find(m => {
            const s = m.f1Start ? new Date(m.f1Start) : null;
            const e = m.f2End ? new Date(m.f2End) : null;
            return s && e && today >= s && today <= e;
          }) || monthMaster[9] || monthMaster[0];
        }

        const startDate = monthObj && monthObj.f1Start ? new Date(monthObj.f1Start) : new Date(2026, 9, 1);
        const endDate = monthObj && monthObj.f2End ? new Date(monthObj.f2End) : new Date(2026, 9, 31, 23, 59, 59, 999);

        let total = 0;
        let active = 0;
        let passive = 0;

        for (let i = 0; i < bsDataEntry.length; i++) {
          const row = bsDataEntry[i];
          const rowDate = new Date(row[1]);
          if (!isNaN(rowDate.getTime()) && rowDate >= startDate && rowDate <= endDate) {
            const count = parseInt(row[9]) || 0;
            total += count;

            const upkendra = String(row[2] || '').toLowerCase();
            const employeeName = String(row[3] || '').toLowerCase();
            const desig = String(row[4] || '').toLowerCase();
            const bsCode = String(row[5] || '').toUpperCase().trim();

            const isOpd = (
              bsCode === '54P' ||
              bsCode.startsWith('54P') ||
              employeeName.includes('बाह्य') || employeeName.includes('opd') || employeeName.includes('ओपीडी') ||
              desig.includes('opd') || desig.includes('ओपीडी') || desig.includes('वैद्यकीय अधिकारी') ||
              (upkendra.includes('प्रा.आ.केंद्र') && !bsCode.startsWith('54S') && !bsCode.startsWith('54F') && !bsCode.includes('V') && !desig.includes('सेवक') && !desig.includes('सेविका') && !desig.includes('आशा'))
            );

            if (isOpd) {
              passive += count;
            } else {
              active += count;
            }
          }
        }

        const activePercent = total > 0 ? Math.round((active / total) * 100) : 0;
        const passivePercent = total > 0 ? Math.round((passive / total) * 100) : 0;

        result = {
          success: true,
          data: {
            total,
            active,
            passive,
            activePercent,
            passivePercent
          }
        };
        break;
      }

      case 'getMonthlyReportDashboardData': {
        const [targetMonth] = args;
        const monthStr = typeof targetMonth === 'string' ? targetMonth : (targetMonth && typeof targetMonth === 'object' ? (targetMonth.monthName || targetMonth.name || '') : '');
        let monthObj = findMonthInMaster(monthStr);
        if (!monthObj) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          monthObj = monthMaster.find(m => m.f1Start && m.f2End && today >= new Date(m.f1Start) && today <= new Date(m.f2End)) || monthMaster[9] || monthMaster[0];
        }
        if (!monthObj) {
          monthObj = { name: "ऑक्टोबर २०२६", newOpd: 0, feverCases: 0, bloodSmears: 0, treatedCases: 0, chloroquineSpent: 0, f1Start: new Date(2026, 9, 1), f2End: new Date(2026, 9, 31) };
        }

        const targetIdx = Math.max(0, monthMaster.indexOf(monthObj));
        let priorOpdSum = 0;
        let priorFeverSum = 0;
        let priorSmearsSum = 0;
        let priorTreatedSum = 0;
        let priorCqSum = 0;
        let priorMpwFn1Sum = 0;
        let priorMpwFn2Sum = 0;
        let priorMpwSum = 0;
        let priorAnmFn1Sum = 0;
        let priorAnmFn2Sum = 0;
        let priorAnmSum = 0;

        for (let i = 0; i < targetIdx; i++) {
          const p = monthMaster[i];
          priorOpdSum += parseInt(p.newOpd != null ? p.newOpd : (p.opd || 0)) || 0;
          priorFeverSum += parseInt(p.feverCases) || 0;
          priorSmearsSum += parseInt(p.bloodSmears) || 0;
          priorTreatedSum += parseInt(p.treatedCases) || 0;
          priorCqSum += parseInt(p.chloroquineSpent) || 0;
          priorMpwFn1Sum += parseInt(p.mpwFn1) || 0;
          priorMpwFn2Sum += parseInt(p.mpwFn2) || 0;
          priorMpwSum += parseInt(p.mpwHomeVisits) || ((parseInt(p.mpwFn1) || 0) + (parseInt(p.mpwFn2) || 0));
          priorAnmFn1Sum += parseInt(p.anmFn1) || 0;
          priorAnmFn2Sum += parseInt(p.anmFn2) || 0;
          priorAnmSum += parseInt(p.anmHomeVisits) || ((parseInt(p.anmFn1) || 0) + (parseInt(p.anmFn2) || 0));
        }

        const opdSummary = getOpdBsVillagewiseSummary(monthObj.name);

        // Auto-populate & auto-save Blood Smears from OPD section (बाह्यरुग्ण विभाग रक्त नमुने)
        if (opdSummary.monthlyTotal > 0 && (!monthObj.bloodSmears || monthObj.bloodSmears === 0 || !monthObj.bloodSmearsManual)) {
          monthObj.bloodSmears = opdSummary.monthlyTotal;
        }

        const newOpd = parseInt(monthObj.newOpd != null ? monthObj.newOpd : (monthObj.opd || 0)) || 0;
        const progNewOpd = priorOpdSum + newOpd;

        // 🩸 घेतलेले रक्त नमुणे (Blood Smears) = 🌡️ तापाचे रुग्ण (Fever Cases) = 💊 उपचारीत रुग्ण (Treated Cases)
        let bloodSmears = monthObj.bloodSmears != null ? parseInt(monthObj.bloodSmears) : 0;
        if (bloodSmears === 0 && opdSummary.monthlyTotal > 0) {
          bloodSmears = opdSummary.monthlyTotal;
        }
        monthObj.bloodSmears = bloodSmears;
        monthObj.feverCases = bloodSmears;
        monthObj.treatedCases = bloodSmears;

        const progBloodSmears = priorSmearsSum + bloodSmears;
        const feverCases = bloodSmears;
        const progFeverCases = progBloodSmears;
        const treatedCases = bloodSmears;
        const progTreatedCases = progBloodSmears;

        const chloroquineSpent = parseInt(monthObj.chloroquineSpent) || 0;
        const progChloroquineSpent = priorCqSum + chloroquineSpent;

        // MPW & ANM Home Visits (पहिला व दुसरा पंधरवडा - जानेवारीपासून सर्व महिन्याची बेरीज)
        const mpwFn1 = parseInt(monthObj.mpwFn1) || 0;
        const mpwFn2 = parseInt(monthObj.mpwFn2) || 0;
        const mpwHomeVisits = parseInt(monthObj.mpwHomeVisits) || (mpwFn1 + mpwFn2);
        const progMpwFn1 = priorMpwFn1Sum + mpwFn1;
        const progMpwFn2 = priorMpwFn2Sum + mpwFn2;
        const progMpwHomeVisits = priorMpwSum + mpwHomeVisits;

        const anmFn1 = parseInt(monthObj.anmFn1) || 0;
        const anmFn2 = parseInt(monthObj.anmFn2) || 0;
        const anmHomeVisits = parseInt(monthObj.anmHomeVisits) || (anmFn1 + anmFn2);
        const progAnmFn1 = priorAnmFn1Sum + anmFn1;
        const progAnmFn2 = priorAnmFn2Sum + anmFn2;
        const progAnmHomeVisits = priorAnmSum + anmHomeVisits;

        // Calculate field vs opd smears in this month from entries
        let fieldSmears = 0;
        let opdSmears = 0;
        const mStart = monthObj.f1Start ? new Date(monthObj.f1Start) : new Date(2026, 9, 1);
        const mEnd = monthObj.f2End ? new Date(monthObj.f2End) : new Date(2026, 9, 31, 23, 59, 59, 999);
        for (let i = 0; i < bsDataEntry.length; i++) {
          const row = bsDataEntry[i];
          const rowDate = new Date(row[1]);
          if (!isNaN(rowDate.getTime()) && rowDate >= mStart && rowDate <= mEnd) {
            const count = parseInt(row[9]) || 0;
            const upk = String(row[2] || '').toLowerCase();
            const empN = String(row[3] || '').toLowerCase();
            const desig = String(row[4] || '').toLowerCase();
            const code = String(row[5] || '').toUpperCase().trim();
            const isOpd = (
              code === '54P' ||
              code.startsWith('54P') ||
              code.includes('54P') ||
              empN.includes('बाह्य') || empN.includes('opd') || empN.includes('ओपीडी') || empN.includes('वैद्यकीय') ||
              desig.includes('opd') || desig.includes('ओपीडी') || desig.includes('वैद्यकीय अधिकारी') || desig.includes('mo') ||
              (upk.includes('प्रा.आ.केंद्र') && !code.startsWith('54S') && !code.startsWith('54F') && !code.includes('V') && !desig.includes('सेवक') && !desig.includes('सेविका') && !desig.includes('आशा'))
            );
            if (isOpd) {
              opdSmears += count;
            } else {
              fieldSmears += count;
            }
          }
        }
        if (opdSummary && opdSummary.monthlyTotal > 0 && opdSmears === 0) {
          opdSmears = opdSummary.monthlyTotal;
        }

        const totalSmears = fieldSmears + opdSmears;
        const smearFeverCoverage = feverCases > 0 ? Math.round((bloodSmears / feverCases) * 100) : (bloodSmears > 0 ? 100 : 0);
        const treatmentCoverage = feverCases > 0 ? Math.round((treatedCases / feverCases) * 100) : (treatedCases > 0 ? 100 : 0);

        // Dengue & Chikungunya Monthly & Progressive Surveillance Data
        const startDate = monthObj.f1Start ? new Date(monthObj.f1Start) : new Date(2026, 8, 1);
        const endDate = monthObj.f2End ? new Date(monthObj.f2End) : new Date(2026, 8, 30, 23, 59, 59, 999);
        const yearStart = monthMaster[0] && monthMaster[0].f1Start ? new Date(monthMaster[0].f1Start) : new Date(2026, 0, 1);

        function parseDateSafeHelper(value) {
          if (!value) return null;
          if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
          const str = String(value).trim();
          const mIso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
          if (mIso) return new Date(parseInt(mIso[1]), parseInt(mIso[2]) - 1, parseInt(mIso[3]), 12, 0, 0);
          const mDmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
          if (mDmy) return new Date(parseInt(mDmy[3]), parseInt(mDmy[2]) - 1, parseInt(mDmy[1]), 12, 0, 0);
          const mDMonY = str.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,})[-/ ](\d{4})/);
          if (mDMonY) {
            const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
            const mKey = mDMonY[2].toLowerCase().slice(0, 3);
            if (months[mKey] !== undefined) return new Date(parseInt(mDMonY[3]), months[mKey], parseInt(mDMonY[1]), 12, 0, 0);
          }
          const parsed = new Date(str);
          return isNaN(parsed.getTime()) ? null : parsed;
        }

        function getDengueSampleDateHelper(e) {
          if (!e) return null;
          if (e.dateCollection) {
            const d = parseDateSafeHelper(e.dateCollection);
            if (d) return d;
          }
          if (e.dateOnset) {
            const d = parseDateSafeHelper(e.dateOnset);
            if (d) return d;
          }
          return parseDateSafeHelper(e.createdAt);
        }

        const mDengue = dengueChikungunyaEntries.filter(e => {
          const d = getDengueSampleDateHelper(e);
          return d && d >= startDate && d <= endDate;
        });

        const pDengue = dengueChikungunyaEntries.filter(e => {
          const d = getDengueSampleDateHelper(e);
          return d && d >= yearStart && d <= endDate;
        });

        const isDPos = e => {
          const d = String(e.dengueResult || '').toLowerCase();
          const t = String(e.testResult || '').toLowerCase();
          return d.includes('pos') || d.includes('पॉझिटिव्ह') || d.includes('positive') || (t.includes('pos') && t.includes('dengue'));
        };
        const isDNeg = e => {
          const d = String(e.dengueResult || '').toLowerCase();
          const t = String(e.testResult || '').toLowerCase();
          return (d.includes('neg') || d.includes('निगेटिव्ह') || d.includes('negative')) && !isDPos(e);
        };
        const isDEquivocal = e => {
          const d = String(e.dengueResult || '').toLowerCase();
          const t = String(e.testResult || '').toLowerCase();
          return (d.includes('equivocal') || d.includes('इक्विव्होकल') || d.includes('borderline') || d.includes('संशयित') || t.includes('equivocal')) && !isDPos(e) && !isDNeg(e);
        };
        const isDPend = e => !isDPos(e) && !isDNeg(e) && !isDEquivocal(e);

        const isCPos = e => {
          const c = String(e.chikungunyaResult || '').toLowerCase();
          const t = String(e.testResult || '').toLowerCase();
          return c.includes('pos') || c.includes('पॉझिटिव्ह') || c.includes('positive') || (t.includes('pos') && (t.includes('chik') || t.includes('chikungunya')));
        };
        const isCNeg = e => {
          const c = String(e.chikungunyaResult || '').toLowerCase();
          const t = String(e.testResult || '').toLowerCase();
          return (c.includes('neg') || c.includes('निगेटिव्ह') || c.includes('negative')) && !isCPos(e);
        };
        const isCEquivocal = e => {
          const c = String(e.chikungunyaResult || '').toLowerCase();
          const t = String(e.testResult || '').toLowerCase();
          return (c.includes('equivocal') || c.includes('इक्विव्होकल') || c.includes('borderline') || c.includes('संशयित') || t.includes('equivocal')) && !isCPos(e) && !isCNeg(e);
        };
        const isCPend = e => !isCPos(e) && !isCNeg(e) && !isCEquivocal(e);

        const dengueSummary = {
          monthSamples: mDengue.length,
          progSamples: pDengue.length,
          monthDenguePos: mDengue.filter(isDPos).length,
          progDenguePos: pDengue.filter(isDPos).length,
          monthChikPos: mDengue.filter(isCPos).length,
          progChikPos: pDengue.filter(isCPos).length,
          monthDengueEquivocal: mDengue.filter(isDEquivocal).length,
          progDengueEquivocal: pDengue.filter(isDEquivocal).length,
          monthChikEquivocal: mDengue.filter(isCEquivocal).length,
          progChikEquivocal: pDengue.filter(isCEquivocal).length,
          monthEquivocal: mDengue.filter(e => isDEquivocal(e) || isCEquivocal(e)).length,
          progEquivocal: pDengue.filter(e => isDEquivocal(e) || isCEquivocal(e)).length,
          monthNeg: mDengue.filter(e => isDNeg(e) && isCNeg(e)).length,
          progNeg: pDengue.filter(e => isDNeg(e) && isCNeg(e)).length,
          monthPend: mDengue.filter(e => isDPend(e) || isCPend(e)).length,
          progPend: pDengue.filter(e => isDPend(e) || isCPend(e)).length
        };

        result = {
          success: true,
          data: {
            selectedMonth: monthObj.name,
            allMonths: monthMaster.map(m => m.name),
            newOpd: { monthly: newOpd, progressive: progNewOpd, prior: priorOpdSum },
            feverCases: { monthly: feverCases, progressive: progFeverCases, prior: priorFeverSum },
            bloodSmears: { monthly: bloodSmears, progressive: progBloodSmears, prior: priorSmearsSum },
            treatedCases: { monthly: treatedCases, progressive: progTreatedCases, prior: priorTreatedSum },
            chloroquineSpent: { monthly: chloroquineSpent, progressive: progChloroquineSpent, prior: priorCqSum },
            mpw: {
              fn1: mpwFn1,
              fn2: mpwFn2,
              monthly: mpwHomeVisits,
              progFn1: progMpwFn1,
              progFn2: progMpwFn2,
              progressive: progMpwHomeVisits,
              priorFn1: priorMpwFn1Sum,
              priorFn2: priorMpwFn2Sum,
              prior: priorMpwSum
            },
            anm: {
              fn1: anmFn1,
              fn2: anmFn2,
              monthly: anmHomeVisits,
              progFn1: progAnmFn1,
              progFn2: progAnmFn2,
              progressive: progAnmHomeVisits,
              priorFn1: priorAnmFn1Sum,
              priorFn2: priorAnmFn2Sum,
              prior: priorAnmSum
            },
            fieldSmears,
            opdSmears,
            totalSmears,
            smearFeverCoverage,
            treatmentCoverage,
            opdVillagewise: opdSummary,
            dengueSummary,
            templateData: {
              phcName: 'भादा',
              month: monthObj.name,
              newOpdM: newOpd,
              newOpdP: progNewOpd,
              feverM: feverCases,
              feverP: progFeverCases,
              smearsM: bloodSmears,
              smearsP: progBloodSmears,
              treatedM: treatedCases,
              treatedP: progTreatedCases,
              cqM: chloroquineSpent,
              cqP: progChloroquineSpent,
              mpwFn1,
              mpwFn2,
              mpwTot: mpwHomeVisits,
              progMpwFn1,
              progMpwFn2,
              progMpwTot: progMpwHomeVisits,
              anmFn1,
              anmFn2,
              anmTot: anmHomeVisits,
              progAnmFn1,
              progAnmFn2,
              progAnmTot: progAnmHomeVisits
            }
          }
        };
        break;
      }

      case 'getEmployeeRegisterData': {
        const [upkendra, employee] = args;
        result = generateEmployeeRegisterWebApp(upkendra, employee);
        break;
      }

      case 'getVillageAnalyticsData': {
        const [month, upkendra, employee, staffType] = args;
        result = getEmployeeVillageMonthlyData(month, upkendra, employee, staffType);
        break;
      }

      case 'getFormWiseData': {
        const [month, upkendra, employee, staffType] = args;
        result = getEmployeeVillageMonthlyData(month, upkendra, employee, staffType);
        break;
      }

      // NCD Management Module RPC Cases
      case 'getNcdDashboardStats': {
        const [filters] = args;
        result = getNcdDashboardStats(filters || {});
        break;
      }

      case 'getNcdSubcenterReport': {
        const [filters] = args;
        result = getNcdSubcenterReport(filters || {});
        break;
      }

      case 'getNcdVillageReport': {
        const [filters] = args;
        result = getNcdVillageReport(filters || {});
        break;
      }

      case 'getNcdDiseaseReport': {
        const [filters] = args;
        result = getNcdDiseaseReport(filters || {});
        break;
      }

      case 'getNcdLineListing': {
        const [filters] = args;
        result = getNcdLineListing(filters || {});
        break;
      }

      case 'previewNcdCsv': {
        const [filename, csvContent] = args;
        result = previewNcdCsvImport(filename, csvContent);
        break;
      }

      case 'importNcdCsv': {
        const [filename, csvContent] = args;
        result = await processNcdCsvImport(filename, csvContent);
        break;
      }

      case 'stageNcdCsvChunk': {
        const [chunkPayload] = args;
        result = stageNcdCsvChunk(chunkPayload || {});
        break;
      }

      case 'clearNcdStagedSession': {
        const [sessionId] = args;
        result = clearNcdStagedSession(sessionId);
        break;
      }

      case 'previewNcdMultiFileImport': {
        const [filesList, sessionId] = args;
        result = previewNcdMultiFileImport(filesList || [], sessionId || null);
        break;
      }

      case 'replaceNcdDataset': {
        const [payload] = args;
        result = await replaceNcdDataset(payload || {});
        break;
      }

      case 'getActiveDatasetInfo': {
        result = getActiveDatasetInfo();
        break;
      }

      case 'getNcdImportBatches': {
        result = { success: true, batches: ncdImportBatches };
        break;
      }

      case 'getMonthListForWebApp': {
        result = monthMaster.map(m => m.name);
        break;
      }

      case 'getDriveDownloads': {
        const [targetFolderId] = args;
        const key = targetFolderId || 'root';
        const folderData = downloadsData[key] || { folders: [], files: [] };
        result = {
          success: true,
          folders: folderData.folders,
          files: folderData.files
        };
        break;
      }

      case 'getDrivePhotos': {
        const [targetFolderId] = args;
        const key = targetFolderId || 'root';
        const photoData = photosData[key] || { folders: [], files: [] };
        result = {
          success: true,
          folders: photoData.folders,
          files: photoData.files
        };
        break;
      }

      case 'getImportantLinks': {
        result = { success: true, data: importantLinks };
        break;
      }

      case 'getGithubInfo': {
        const repoUrl = googleSheetConfig.githubRepoUrl || "https://github.com/phcbhada/nvbdcp-malaria-management-system";
        result = {
          success: true,
          repoUrl: repoUrl,
          cloneUrl: repoUrl.endsWith('.git') ? repoUrl : `${repoUrl}.git`,
          issuesUrl: `${repoUrl.replace(/\/$/, '')}/issues`,
          pullsUrl: `${repoUrl.replace(/\/$/, '')}/pulls`,
          releasesUrl: `${repoUrl.replace(/\/$/, '')}/releases`,
          readmeUrl: `${repoUrl.replace(/\/$/, '')}#readme`
        };
        break;
      }

      case 'saveGithubConfig': {
        const [repoUrl] = args;
        if (repoUrl && typeof repoUrl === 'string' && repoUrl.trim().length > 0) {
          googleSheetConfig.githubRepoUrl = repoUrl.trim();
          const ghLink = importantLinks.find(l => l.isGithub || l.name.includes("GitHub"));
          if (ghLink) ghLink.url = googleSheetConfig.githubRepoUrl;
          result = {
            success: true,
            message: 'GitHub रिपॉझिटरी URL यशस्वीरित्या अद्ययावत केले!',
            repoUrl: googleSheetConfig.githubRepoUrl
          };
        } else {
          result = { success: false, message: 'कृपया वैध GitHub रिपॉझिटरी लिंक टाका.' };
        }
        break;
      }

      case 'clearAllTransactionData': {
        result = clearAllTransactionData();
        await clearAllNvbdcpTransactionsFromSupabase();
        await syncBatchMonthMasterToSupabase(monthMaster);
        lastSbSyncTime = Date.now();
        break;
      }

      case 'getDengueEntries': {
        const [filterDate, filterVillage] = args;
        result = { success: true, entries: getDengueEntries(filterDate, filterVillage) };
        break;
      }

      case 'saveDengueEntry': {
        const [entryData] = args;
        result = saveDengueEntry(entryData);
        if (result.success) {
          const rec = result.record || entryData;
          const sbRes = await syncDengueEntryToSupabase(rec);
          lastSbSyncTime = Date.now();
          const fsRes = await syncDengueEntryToFirestore(rec);
          if (sbRes.success || fsRes.success) {
            result.message = `रुग्ण ${rec.patientName} ची नोंद Supabase डेटाबेसमध्ये थेट यशस्वीरित्या जतन झाली 🟢`;
          } else {
            result.success = false;
            result.message = `डेटा जतन करणे शक्य झाले नाही. कृपया तुमचे इंटरनेट कनेक्शन तपासून पुन्हा प्रयत्न करा (${sbRes.error || fsRes.error || 'Connection Error'}).`;
          }
        }
        break;
      }

      case 'updateDengueLabReport': {
        const [reportData] = args;
        result = updateDengueLabReport(reportData);
        if (result.success) {
          const rec = result.record;
          const sbRes = await syncDengueEntryToSupabase(rec);
          lastSbSyncTime = Date.now();
          const fsRes = await syncDengueEntryToFirestore(rec);
          if (sbRes.success || fsRes.success) {
            result.message = `रुग्ण ${rec.patientName} चा प्रयोगशाळा अहवाल Supabase डेटाबेसमध्ये थेट जतन झाला 🟢`;
          } else {
            result.success = false;
            result.message = `अहवाल अपडेट झाला नाही. इंटरनेट कनेक्शन तपासून पुन्हा प्रयत्न करा (${sbRes.error || fsRes.error || 'Connection Error'}).`;
          }
        }
        break;
      }

      case 'saveDengueBatchLabReport': {
        const [batchData] = args;
        result = saveDengueBatchLabReport(batchData);
        if (result.success && batchData && Array.isArray(batchData.patientResults)) {
          const updatedIds = new Set(batchData.patientResults.map(p => p.id));
          const updatedRecords = dengueChikungunyaEntries.filter(e => updatedIds.has(e.id));
          if (updatedRecords.length > 0) {
            await syncDengueEntryToSupabase(updatedRecords);
            lastSbSyncTime = Date.now();
            await syncBatchDengueEntriesToFirestore(updatedRecords);
          }
        }
        break;
      }

      case 'importDengueOldDataCsv': {
        const [csvText, replace] = args;
        result = importDengueOldDataCsv(csvText, replace);
        if (result.success && Array.isArray(result.entries) && result.entries.length > 0) {
          if (replace) {
            await clearDengueEntriesFromSupabase();
            await clearAllDengueEntriesFromFirestore();
          }
          await syncDengueEntryToSupabase(result.entries);
          lastSbSyncTime = Date.now();
          await syncBatchDengueEntriesToFirestore(result.entries);
          saveDbToDisk();
          result.message = `एकूण ${result.entries.length} डेंगी व चिकनगुनिया जुन्या रुग्णांच्या नोंदी Supabase व सिस्टीममध्ये यशस्वीरित्या आयात व जतन झाल्या! 💾`;
        }
        break;
      }

      case 'clearDengueEntries': {
        result = clearDengueEntries();
        await clearDengueEntriesFromSupabase();
        lastSbSyncTime = Date.now();
        await clearAllDengueEntriesFromFirestore();
        saveDbToDisk();
        result = {
          success: true,
          message: 'सर्व डेंगी व चिकनगुनिया चाचणी नोंदी Supabase व प्रणालीमधून सुरक्षित हटवण्यात आल्या.'
        };
        break;
      }

      case 'deleteDengueEntry': {
        const [id] = args;
        await deleteDengueEntryFromSupabase(id);
        lastSbSyncTime = Date.now();
        const fsDelRes = await deleteDengueEntryFromFirestore(id);
        const memRes = deleteDengueEntry(id);
        saveDbToDisk();
        result = {
          success: true,
          message: memRes.message || 'नोंद Supabase व प्रणालीमधून यशस्वीरित्या हटवली.'
        };
        break;
      }

      case 'deleteBatchDengueEntries': {
        const [idsArray] = args;
        const ids = Array.isArray(idsArray) ? idsArray : (idsArray ? [idsArray] : []);
        await deleteDengueEntryFromSupabase(ids);
        lastSbSyncTime = Date.now();
        const fsDelRes = await deleteBatchDengueEntriesFromFirestore(ids);
        const memRes = deleteBatchDengueEntries(ids);
        saveDbToDisk();
        const finalCount = Math.max(memRes.count || 0, fsDelRes.count || 0, ids.length);
        result = {
          success: true,
          count: finalCount,
          message: `निवडलेल्या एकूण ${finalCount} डेंगी/चिकनगुनिया नोंदी Supabase व प्रणालीमधून कायमस्वरूपी हटवण्यात आल्या 🗑️`
        };
        break;
      }

      case 'generateGmcForwardingLetter': {
        const [dateStr, outwardNo] = args;
        result = generateGmcForwardingLetter(dateStr, outwardNo);
        break;
      }

      case 'generateNivCaseHistorySheets': {
        const [patientIdsOrDate] = args;
        result = generateNivCaseHistorySheets(patientIdsOrDate);
        break;
      }

      case 'generateDailyMalariaReportWebApp': {
        const [dateStr] = args;
        result = generateDailyMalariaReportWebApp(dateStr);
        break;
      }

      case 'generateMonthlyReportWebApp': {
        const [month] = args;
        result = generateMonthlyReportWebApp(month);
        break;
      }

      case 'generateEmployeeRegisterWebApp': {
        const [upkendra, employee] = args;
        result = generateEmployeeRegisterWebApp(upkendra, employee);
        break;
      }

      case 'getDefaulterListForMonth': {
        const [month] = args;
        result = getDefaulterListForMonth(month);
        break;
      }

      case 'generateEmployeeNoticesWebApp': {
        const [month, selectedEmpNames] = args;
        result = generateEmployeeNoticesWebApp(month, selectedEmpNames);
        break;
      }

      case 'generateLowPerformanceReportWebApp': {
        const [month] = args;
        result = generateLowPerformanceReportWebApp(month);
        break;
      }

      case 'generateEmployeeVillageMonthlyReportWebApp': {
        const [month, upkendra, employee, staffType] = args;
        result = generateEmployeeVillageMonthlyReportWebApp(month, upkendra, employee, staffType);
        break;
      }

      case 'getEmployeeVillageMonthlyData': {
        const [month, upkendra, employee, staffType] = args;
        result = getEmployeeVillageMonthlyData(month, upkendra, employee, staffType);
        break;
      }

      case 'getMonthIndicators': {
        const [monthName] = args;
        const clean = s => String(s || '').trim();
        let mIdx = monthMaster.findIndex(m => clean(m.name) === clean(monthName));
        if (mIdx === -1) mIdx = 9; // Default October 2026
        const monthObj = monthMaster[mIdx];
        const priorMonths = monthMaster.slice(0, mIdx);

        // Calculate dynamic OPD Blood Smears directly from villagewise entries
        const opdSummary = getOpdBsVillagewiseSummary(monthObj.name);

        // Auto-populate & auto-save Blood Smears from OPD section (त्या महिन्यात बाह्यरुग्ण विभाग रक्त नमुने auto save व्हावे)
        if (opdSummary.monthlyTotal > 0 && (!monthObj.bloodSmears || monthObj.bloodSmears === 0 || !monthObj.bloodSmearsManual)) {
          monthObj.bloodSmears = opdSummary.monthlyTotal;
        }

        // 🩸 घेतलेले रक्त नमुणे (Blood Smears) = 🌡️ तापाचे रुग्ण (Fever Cases) = 💊 उपचारीत रुग्ण (Treated Cases)
        const bloodSmears = parseInt(monthObj.bloodSmears) || (opdSummary.monthlyTotal > 0 ? opdSummary.monthlyTotal : 0);
        monthObj.bloodSmears = bloodSmears;
        monthObj.feverCases = bloodSmears;
        monthObj.treatedCases = bloodSmears;

        recalculateAllMonthProgressives();
        saveDbToDisk();

        const priorOpdSum = monthObj.priorOpdSum != null ? monthObj.priorOpdSum : priorMonths.reduce((s, m) => s + (parseInt(m.newOpd) || 0), 0);
        const priorSmearsSum = monthObj.priorSmearsSum != null ? monthObj.priorSmearsSum : priorMonths.reduce((s, m) => s + (parseInt(m.bloodSmears) || 0), 0);
        const priorFeverSum = priorSmearsSum;
        const priorTreatedSum = priorSmearsSum;
        const priorCqSum = monthObj.priorCqSum != null ? monthObj.priorCqSum : priorMonths.reduce((s, m) => s + (parseInt(m.chloroquineSpent) || 0), 0);

        const newOpd = monthObj.newOpd != null ? parseInt(monthObj.newOpd) : 0;
        const progNewOpd = monthObj.progNewOpd != null ? parseInt(monthObj.progNewOpd) : (priorOpdSum + newOpd);

        const progBloodSmears = monthObj.progBloodSmears != null ? parseInt(monthObj.progBloodSmears) : (priorSmearsSum + bloodSmears);
        const feverCases = bloodSmears;
        const progFeverCases = progBloodSmears;
        const treatedCases = bloodSmears;
        const progTreatedCases = progBloodSmears;

        const chloroquineSpent = parseInt(monthObj.chloroquineSpent) || 0;
        const progChloroquineSpent = monthObj.progChloroquineSpent != null ? parseInt(monthObj.progChloroquineSpent) : (priorCqSum + chloroquineSpent);

        const mpwFn1 = parseInt(monthObj.mpwFn1) || 0;
        const mpwFn2 = parseInt(monthObj.mpwFn2) || 0;
        const mpwHomeVisits = parseInt(monthObj.mpwHomeVisits) || (mpwFn1 + mpwFn2);
        const progMpwFn1 = (monthObj.priorMpwFn1Sum || 0) + mpwFn1;
        const progMpwFn2 = (monthObj.priorMpwFn2Sum || 0) + mpwFn2;
        const progMpwHomeVisits = (monthObj.priorMpwSum || 0) + mpwHomeVisits;

        const anmFn1 = parseInt(monthObj.anmFn1) || 0;
        const anmFn2 = parseInt(monthObj.anmFn2) || 0;
        const anmHomeVisits = parseInt(monthObj.anmHomeVisits) || (anmFn1 + anmFn2);
        const progAnmFn1 = (monthObj.priorAnmFn1Sum || 0) + anmFn1;
        const progAnmFn2 = (monthObj.priorAnmFn2Sum || 0) + anmFn2;
        const progAnmHomeVisits = (monthObj.priorAnmSum || 0) + anmHomeVisits;

        result = {
          success: true,
          data: {
            name: monthObj.name,
            newOpd,
            progNewOpd,
            feverCases,
            progFeverCases,
            bloodSmears,
            progBloodSmears,
            treatedCases,
            progTreatedCases,
            chloroquineSpent,
            progChloroquineSpent,
            mpwFn1,
            mpwFn2,
            mpwHomeVisits,
            progMpwFn1,
            progMpwFn2,
            progMpwHomeVisits,
            anmFn1,
            anmFn2,
            anmHomeVisits,
            progAnmFn1,
            progAnmFn2,
            progAnmHomeVisits,
            priorOpdSum,
            priorFeverSum,
            priorSmearsSum,
            priorTreatedSum,
            priorCqSum,
            priorMpwFn1Sum: monthObj.priorMpwFn1Sum || 0,
            priorMpwFn2Sum: monthObj.priorMpwFn2Sum || 0,
            priorMpwSum: monthObj.priorMpwSum || 0,
            priorAnmFn1Sum: monthObj.priorAnmFn1Sum || 0,
            priorAnmFn2Sum: monthObj.priorAnmFn2Sum || 0,
            priorAnmSum: monthObj.priorAnmSum || 0,
            opdVillagewise: {
              monthlyTotal: opdSummary.monthlyTotal,
              ytdTotal: opdSummary.ytdTotal,
              monthlyMale: opdSummary.monthlyMale,
              monthlyFemale: opdSummary.monthlyFemale,
              priorTotal: opdSummary.priorTotal,
              villages: opdSummary.villages
            }
          }
        };
        break;
      }

      case 'saveMonthlyIndicators':
      case 'saveMonthIndicators': {
        const [indicatorData] = args;
        if (!indicatorData || !indicatorData.monthName) {
          return res.status(400).json({ error: 'महिन्याचे नाव आवश्यक आहे (Month name is required).' });
        }
        const clean = s => String(s || '').trim();
        const monthObj = monthMaster.find(m => clean(m.name) === clean(indicatorData.monthName));
        if (!monthObj) {
          return res.status(404).json({ error: `महिना '${indicatorData.monthName}' सापडला नाही.` });
        }

        const opdIn = indicatorData.newOpd !== undefined ? indicatorData.newOpd : indicatorData.opd;
        if (opdIn !== undefined) monthObj.newOpd = parseInt(opdIn) || 0;

        // Auto-resolve Blood Smears: from input or from OPD villagewise summary
        const opdSummary = getOpdBsVillagewiseSummary(monthObj.name);
        let bsVal = indicatorData.bloodSmears !== undefined ? parseInt(indicatorData.bloodSmears) : null;
        if (bsVal === null || (bsVal === 0 && opdSummary.monthlyTotal > 0)) {
          bsVal = opdSummary.monthlyTotal;
        }
        monthObj.bloodSmears = bsVal != null ? bsVal : 0;
        monthObj.bloodSmearsManual = (indicatorData.bloodSmears !== undefined);

        // 🩸 घेतलेले रक्त नमुणे (Blood Smears) = 🌡️ तापाचे रुग्ण (Fever Cases) = 💊 उपचारीत रुग्ण (Treated Cases)
        monthObj.feverCases = monthObj.bloodSmears;
        monthObj.treatedCases = monthObj.bloodSmears;

        const cqIn = indicatorData.chloroquineSpent !== undefined ? indicatorData.chloroquineSpent : indicatorData.chloroquine;
        if (cqIn !== undefined) monthObj.chloroquineSpent = parseInt(cqIn) || 0;

        // MPW & ANM गृहभेटी पहिला व दुसरा पंधरवडा
        if (indicatorData.mpwFn1 !== undefined) monthObj.mpwFn1 = parseInt(indicatorData.mpwFn1) || 0;
        if (indicatorData.mpwFn2 !== undefined) monthObj.mpwFn2 = parseInt(indicatorData.mpwFn2) || 0;
        if (indicatorData.mpwHomeVisits !== undefined) {
          monthObj.mpwHomeVisits = parseInt(indicatorData.mpwHomeVisits) || ((monthObj.mpwFn1 || 0) + (monthObj.mpwFn2 || 0));
        } else {
          monthObj.mpwHomeVisits = (monthObj.mpwFn1 || 0) + (monthObj.mpwFn2 || 0);
        }

        if (indicatorData.anmFn1 !== undefined) monthObj.anmFn1 = parseInt(indicatorData.anmFn1) || 0;
        if (indicatorData.anmFn2 !== undefined) monthObj.anmFn2 = parseInt(indicatorData.anmFn2) || 0;
        if (indicatorData.anmHomeVisits !== undefined) {
          monthObj.anmHomeVisits = parseInt(indicatorData.anmHomeVisits) || ((monthObj.anmFn1 || 0) + (monthObj.anmFn2 || 0));
        } else {
          monthObj.anmHomeVisits = (monthObj.anmFn1 || 0) + (monthObj.anmFn2 || 0);
        }

        // Automatically recalculate and lock progressive values for all months
        recalculateAllMonthProgressives();
        saveDbToDisk();

        // Direct Supabase Primary Sync + Firestore Compatibility Sync
        await syncBatchMonthMasterToSupabase(monthMaster);
        lastSbSyncTime = Date.now();
        await syncBatchMonthMasterToFirestore(monthMaster);

        result = {
          success: true,
          message: `माहे ${monthObj.name} चे मासिक अहवाल निर्देशांक Supabase क्लाउड डेटाबेसमध्ये यशस्वीरित्या जतन झाले!`,
          data: {
            name: monthObj.name,
            newOpd: monthObj.newOpd,
            progNewOpd: monthObj.progNewOpd,
            feverCases: monthObj.feverCases,
            progFeverCases: monthObj.progFeverCases,
            bloodSmears: monthObj.bloodSmears,
            progBloodSmears: monthObj.progBloodSmears,
            treatedCases: monthObj.treatedCases,
            progTreatedCases: monthObj.progTreatedCases,
            chloroquineSpent: monthObj.chloroquineSpent,
            progChloroquineSpent: monthObj.progChloroquineSpent,
            mpwFn1: monthObj.mpwFn1,
            mpwFn2: monthObj.mpwFn2,
            mpwHomeVisits: monthObj.mpwHomeVisits,
            progMpwFn1: monthObj.progMpwFn1,
            progMpwFn2: monthObj.progMpwFn2,
            progMpwHomeVisits: monthObj.progMpwHomeVisits,
            anmFn1: monthObj.anmFn1,
            anmFn2: monthObj.anmFn2,
            anmHomeVisits: monthObj.anmHomeVisits,
            progAnmFn1: monthObj.progAnmFn1,
            progAnmFn2: monthObj.progAnmFn2,
            progAnmHomeVisits: monthObj.progAnmHomeVisits
          }
        };
        break;
      }

      // ================= REPORT DATA VALIDATION & AUTO-ALIGN RPC =================
      case 'validateMonthlyReport': {
        const [monthName] = args;
        if (!monthName) {
          return res.status(400).json({ error: 'महिना निवडा.' });
        }
        const clean = s => String(s || '').trim();
        const monthObj = monthMaster.find(m => clean(m.name) === clean(monthName));
        if (!monthObj) {
          return res.status(404).json({ error: `महिना '${monthName}' सापडला नाही.` });
        }

        const opdSummary = getOpdBsVillagewiseSummary(monthObj.name);
        const priorMonths = monthMaster.slice(0, monthMaster.indexOf(monthObj));

        const bloodSmears = parseInt(monthObj.bloodSmears) || 0;
        const feverCases = parseInt(monthObj.feverCases) || 0;
        const treatedCases = parseInt(monthObj.treatedCases) || 0;
        const newOpd = parseInt(monthObj.newOpd) || 0;
        const cq = parseInt(monthObj.chloroquineSpent) || 0;

        const priorSmears = priorMonths.reduce((s, m) => s + (parseInt(m.bloodSmears) || 0), 0);
        const progBloodSmears = parseInt(monthObj.progBloodSmears) || (priorSmears + bloodSmears);

        const priorOpd = priorMonths.reduce((s, m) => s + (parseInt(m.newOpd) || 0), 0);
        const progNewOpd = parseInt(monthObj.progNewOpd) || (priorOpd + newOpd);

        const rule1Equal = (bloodSmears === feverCases && bloodSmears === treatedCases);
        const rule2OpdMatch = (bloodSmears === opdSummary.monthlyTotal);
        const rule3ProgMatch = (progBloodSmears === (priorSmears + bloodSmears));

        const isValid = rule1Equal && rule2OpdMatch && rule3ProgMatch;

        result = {
          success: true,
          monthName: monthObj.name,
          isValid,
          rule1: {
            name: 'तपशील ३ समानता (रक्त नमुने = तापाचे रुग्ण = उपचारीत रुग्ण)',
            passed: rule1Equal,
            bloodSmears,
            feverCases,
            treatedCases
          },
          rule2: {
            name: 'गावनिहाय OPD रक्त नमुने जुळणी (Village-wise OPD = Monthly Smears)',
            passed: rule2OpdMatch,
            monthlySmears: bloodSmears,
            opdTotal: opdSummary.monthlyTotal,
            opdVillages: opdSummary.villages
          },
          rule3: {
            name: 'प्रगत संख्या स्वयं-गणना (Progressive YTD = Prior + Current)',
            passed: rule3ProgMatch,
            priorSmears,
            currentSmears: bloodSmears,
            expectedProg: priorSmears + bloodSmears,
            actualProg: progBloodSmears
          },
          indicators: {
            newOpd,
            progNewOpd,
            bloodSmears,
            feverCases,
            treatedCases,
            chloroquineSpent: cq
          }
        };
        break;
      }

      case 'autoAlignMonthlyReport': {
        const [monthName] = args;
        if (!monthName) {
          return res.status(400).json({ error: 'महिना निवडा.' });
        }
        const clean = s => String(s || '').trim();
        const monthObj = monthMaster.find(m => clean(m.name) === clean(monthName));
        if (!monthObj) {
          return res.status(404).json({ error: `महिना '${monthName}' सापडला नाही.` });
        }

        const opdSummary = getOpdBsVillagewiseSummary(monthObj.name);
        const correctSmears = opdSummary.monthlyTotal;

        monthObj.bloodSmears = correctSmears;
        monthObj.feverCases = correctSmears;
        monthObj.treatedCases = correctSmears;

        recalculateAllMonthProgressives();
        saveDbToDisk();
        await syncBatchMonthMasterToSupabase(monthMaster);
        lastSbSyncTime = Date.now();
        await syncBatchMonthMasterToFirestore(monthMaster);

        result = {
          success: true,
          message: `✅ माहे ${monthObj.name} साठी रक्त नमुने, तापाचे रुग्ण व उपचारीत रुग्ण (${correctSmears}) तंतोतंत सिंक झाले व प्रगत आकडे दुरुस्त झाले!`,
          alignedValue: correctSmears
        };
        break;
      }

      // ================= MASTER DATA & TRANSFER FACILITY RPC =================
      case 'transferAllDataToFirestore':
      case 'syncDataToFirestore':
      case 'transferAllToFirestore': {
        await syncBatchMonthMasterToSupabase(monthMaster);
        if (bsDataEntry.length > 0) await syncBsDataToSupabase(bsDataEntry);
        if (villageDetails.length > 0) await syncVillageDetailsToSupabase(villageDetails);
        if (dengueChikungunyaEntries.length > 0) await syncDengueEntryToSupabase(dengueChikungunyaEntries);
        lastSbSyncTime = Date.now();
        const transferRes = await transferAllDataToFirestore({
          bsDataEntry,
          subcenterMaster,
          employeeMaster,
          villagesMaster,
          villageDetails,
          dengueChikungunyaEntries,
          monthMaster
        });
        result = transferRes;
        break;
      }

      case 'getSubcenterMaster': {
        result = subcenterMaster;
        break;
      }

      case 'saveSubcenter': {
        const [scData] = args;
        result = saveSubcenter(scData);
        if (result.success && result.subcenter) {
          await syncSubcenterToSupabase(result.subcenter);
          lastSbSyncTime = Date.now();
          syncSubcenterMasterToFirestore(result.subcenter).catch(err => console.error(err));
        }
        break;
      }

      case 'deleteSubcenter': {
        const [scId] = args;
        const targetSc = subcenterMaster.find(s => s.id === scId || s.name === scId);
        result = deleteSubcenter(scId);
        if (result.success) {
          await deleteSubcenterFromSupabase(targetSc ? targetSc.id : scId);
          lastSbSyncTime = Date.now();
        }
        break;
      }

      case 'getVillagesMaster': {
        result = villagesMaster;
        break;
      }

      case 'saveVillage': {
        const [vilData] = args;
        result = saveVillage(vilData);
        if (result.success && result.village) {
          await syncVillageToSupabase(result.village);
          lastSbSyncTime = Date.now();
          await syncVillagesMasterToFirestore(result.village);
          saveDbToDisk();
        }
        break;
      }

      case 'deleteVillage': {
        const [vilId] = args;
        const targetVil = villagesMaster.find(v => v.id === vilId || v.villageName === vilId);
        result = deleteVillage(vilId);
        if (result.success) {
          await deleteVillageFromSupabase(targetVil ? targetVil.id : vilId);
          lastSbSyncTime = Date.now();
        }
        break;
      }

      case 'getEmployeeMaster': {
        result = employeeMaster;
        break;
      }

      case 'saveEmployee': {
        const [empData] = args;
        result = saveEmployee(empData);
        if (result.success && result.employee) {
          await syncEmployeeToSupabase(result.employee);
          lastSbSyncTime = Date.now();
          syncEmployeeMasterToFirestore(result.employee).catch(err => console.error(err));
        }
        break;
      }

      case 'deleteEmployee': {
        const [empId] = args;
        const targetEmp = employeeMaster.find(e => e.id === empId || e.employeeName === empId);
        result = deleteEmployee(empId);
        if (result.success) {
          await deleteEmployeeFromSupabase(targetEmp ? targetEmp.id : empId);
          lastSbSyncTime = Date.now();
        }
        break;
      }

      case 'transferEmployee': {
        const [empId, targetUpkendra, newVillages, newBsCode, reason, orderNo] = args;
        result = transferEmployee(empId, targetUpkendra, newVillages, newBsCode, reason, orderNo);
        if (result.success) {
          const trLog = result.transferLog || result.transfer;
          if (trLog) {
            await syncTransferHistoryToSupabase(trLog);
          }
          if (result.employee) {
            await syncEmployeeToSupabase(result.employee);
          }
          for (const sc of subcenterMaster) {
            await syncSubcenterToSupabase(sc);
          }
          for (const v of villagesMaster) {
            await syncVillageToSupabase(v);
          }
          lastSbSyncTime = Date.now();
          // Sync all master changes to Cloud Firestore synchronously to prevent page refresh rollback!
          await syncBatchEmployeesToFirestore(employeeMaster);
          await syncBatchSubcentersToFirestore(subcenterMaster);
          await syncBatchVillagesToFirestore(villagesMaster);
          await syncBatchTransferHistoryToFirestore(transferHistory);
        }
        break;
      }

      case 'updateEmployeeVillages': {
        const [empId, villageList] = args;
        result = updateEmployeeVillages(empId, villageList);
        if (result.success) {
          if (result.employee) {
            await syncEmployeeToSupabase(result.employee);
          }
          for (const v of villagesMaster) {
            await syncVillageToSupabase(v);
          }
          lastSbSyncTime = Date.now();
          // Sync changes to Cloud Firestore synchronously to prevent page refresh rollback!
          await syncBatchEmployeesToFirestore(employeeMaster);
          await syncBatchVillagesToFirestore(villagesMaster);
        }
        break;
      }

      case 'getTransferHistory': {
        result = transferHistory;
        break;
      }

      case 'endEmployeeService': {
        const [empId, endDate, endReason, orderNo, remarks] = args;
        result = endEmployeeService(empId, endDate, endReason, orderNo, remarks);
        if (result.success) {
          if (result.employee) {
            await syncEmployeeToSupabase(result.employee);
          }
          lastSbSyncTime = Date.now();
          if (result.tenureLog) {
            syncBsTenureHistoryToFirestore(result.tenureLog).catch(e => console.warn('[Firestore] Tenure sync warning:', e.message));
          }
          await syncBatchEmployeesToFirestore(employeeMaster);
        }
        break;
      }

      case 'attachEmployeeToBsCode': {
        const [empId, bsCode, chargeType, attachDate, orderNo, remarks, autoEndPrevious, previousEndReason] = args;
        result = attachEmployeeToBsCode(empId, bsCode, chargeType, attachDate, orderNo, remarks, !!autoEndPrevious, previousEndReason);
        if (result.success) {
          for (const emp of employeeMaster) {
            await syncEmployeeToSupabase(emp);
          }
          lastSbSyncTime = Date.now();
          if (result.tenureLog) {
            syncBsTenureHistoryToFirestore(result.tenureLog).catch(e => console.warn('[Firestore] Tenure sync warning:', e.message));
          }
          await syncBatchEmployeesToFirestore(employeeMaster);
        }
        break;
      }

      case 'getBsCodeRegistry': {
        result = getBsCodeRegistry();
        break;
      }

      case 'getBsServiceTenureHistory': {
        result = getBsServiceTenureHistory();
        break;
      }

      case 'importMasterDataCsv':
      case 'importMasterDataFromCsv': {
        const [csvText] = args;
        result = importMasterDataFromCsv(csvText);
        saveDbToDisk();
        for (const emp of employeeMaster) await syncEmployeeToSupabase(emp);
        for (const v of villagesMaster) await syncVillageToSupabase(v);
        lastSbSyncTime = Date.now();
        break;
      }

      case 'importBsDataEntryCsv':
      case 'uploadBsDataCsv': {
        const [csvText, replace] = args;
        result = importBsDataEntryCsv(csvText, !!replace);
        recalculateAllMonthProgressives();
        saveDbToDisk();
        await syncBsDataToSupabase(bsDataEntry);
        await syncBatchMonthMasterToSupabase(monthMaster);
        lastSbSyncTime = Date.now();
        break;
      }

      case 'importVillageDetailsCsv':
      case 'uploadVillageDetailsCsv': {
        const [csvText, replace] = args;
        result = importVillageDetailsCsv(csvText, !!replace);
        saveDbToDisk();
        await syncVillageDetailsToSupabase(villageDetails);
        lastSbSyncTime = Date.now();
        break;
      }

      case 'importMonthMasterCsv':
      case 'uploadMonthMasterCsv': {
        const [csvText] = args;
        result = importMonthMasterCsv(csvText);
        recalculateAllMonthProgressives();
        saveDbToDisk();
        await syncBatchMonthMasterToSupabase(monthMaster);
        lastSbSyncTime = Date.now();
        break;
      }

      case 'seedInitialData':
      case 'resetToDefaultData': {
        const clearRes = clearAllTransactionData();
        await clearAllNvbdcpTransactionsFromSupabase();
        await syncBatchMonthMasterToSupabase(monthMaster);
        lastSbSyncTime = Date.now();
        result = {
          success: true,
          message: "सर्व तात्पुरता/नमुना डेटा यशस्वीरित्या काढून टाकण्यात आला. प्रणाली रिअल-टाईम नोंदींसाठी सज्ज आहे."
        };
        break;
      }

      case 'getEmployeeVillageDistributionSummary': {
        result = getEmployeeVillageDistributionSummary();
        break;
      }

      default:
        return res.status(400).json({ error: `अज्ञात मेथड (Unknown method): ${method}` });
    }

    res.json({ result });
  } catch (err) {
    console.error(`Error in RPC method:`, err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// =========================================================================
// NWBDCP WATER QUALITY MANAGEMENT MODULE ENDPOINTS
// =========================================================================

// 0. Auth & Token Management Endpoints
app.post(['/api/nwbdcp/auth/google', '/api/nwbdcp/auth/token'], nwbdcpAuthRateLimiter, async (req, res) => {
  try {
    await handleNwbdcpTokenIssuance(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/nwbdcp/auth/logout', (req, res) => {
  try {
    const { sessionId } = req.body || {};
    const revoked = revokeNwbdcpSession(sessionId);
    res.json({ success: true, revoked });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dashboard & Planning Endpoints
app.get('/api/nwbdcp/dashboard', async (req, res) => {
  try {
    await refreshNwbdcpFromSupabase();
    const data = getNwbdcpDashboardData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/nwbdcp/overdue-sources', async (req, res) => {
  try {
    await refreshNwbdcpFromSupabase();
    const months = parseInt(req.query.months) || 3;
    const sources = getOverdueSources(months);
    res.json({ success: true, sources });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/nwbdcp/current-month-plan', async (req, res) => {
  try {
    await refreshNwbdcpFromSupabase();
    const plan = getCurrentMonthSamplePlan();
    res.json({ success: true, ...plan });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1. Read-Only NVBDCP Master Data Reference
app.get('/api/nwbdcp/master-data', async (req, res) => {
  try {
    await syncAllDataFromSupabase();
    const data = getNwbdcpReferenceMasterData();
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Water Sources Register Endpoints
app.get('/api/nwbdcp/water-sources', async (req, res) => {
  try {
    await refreshNwbdcpFromSupabase();
    const sources = getWaterSources(req.query);
    res.json({ success: true, sources });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/nwbdcp/water-source', nwbdcpRequireAuth(ROLES.STAFF), (req, res) => {
  try {
    const user = req.nwbdcpAuth.user;
    const result = saveWaterSource(req.body, user, req.body.allowDuplicate || false);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/nwbdcp/water-source/toggle-status', nwbdcpRequireAuth(ROLES.ADMIN), (req, res) => {
  try {
    const user = req.nwbdcpAuth.user;
    const result = toggleWaterSourceStatus(req.body.id, user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/nwbdcp/water-source/:id', nwbdcpRequireAuth(ROLES.ADMIN), (req, res) => {
  try {
    const user = req.nwbdcpAuth.user;
    const result = deleteWaterSource(req.params.id, user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2b. Water Source List Bulk Upload Endpoint
app.post('/api/nwbdcp/import-water-sources', nwbdcpRequireAuth(ROLES.STAFF), async (req, res) => {
  try {
    const user = req.nwbdcpAuth.user;
    const result = await importWaterSourcesList(req.body.sources || [], user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Sample Dispatch Endpoints
app.post('/api/nwbdcp/sample-dispatch', nwbdcpRequireAuth(ROLES.STAFF), (req, res) => {
  try {
    const user = req.nwbdcpAuth.user;
    const result = dispatchWaterSamples(req.body, user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/nwbdcp/dispatched-samples', async (req, res) => {
  try {
    await refreshNwbdcpFromSupabase();
    const samples = getDispatchedSamples(req.query);
    res.json({ success: true, samples });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Lab Results & Unified Google Drive Storage Endpoints
// (Physical files stored in Google Drive, metadata strictly persisted in Supabase nwbdcp_files)
app.post('/api/nwbdcp/upload-report-copy', nwbdcpRequireAuth(ROLES.STAFF), async (req, res) => {
  try {
    const user = req.nwbdcpAuth.user;
    const { sampleId, fileData, fileName, fileType, module = 'laboratory_reports' } = req.body;

    const driveResult = await uploadFileToGoogleDrive({
      sampleId,
      module,
      fileName,
      fileData,
      user
    });

    if (!driveResult.success) {
      return res.status(driveResult.statusCode || 400).json(driveResult);
    }

    const file = driveResult.file;

    return res.json({
      success: true,
      message: '✅ प्रयोगशाळा अहवालाची प्रत Google Drive मध्ये यशस्वीरित्या जतन झाली व मेटाडेटा Supabase मध्ये नोंदवला गेला!',
      reportCopy: {
        reportFileName: file.fileName,
        reportSavedFileName: file.fileName,
        reportFileUrl: `/api/nwbdcp/storage/serve/${file.googleDriveFileId}`,
        reportFileType: file.fileType,
        reportFileSize: file.fileSize,
        googleDriveFileId: file.googleDriveFileId,
        googleDriveUrl: file.googleDriveUrl,
        googleDriveDownloadUrl: file.googleDriveDownloadUrl,
        reportUploadedAt: file.uploadedAt,
        reportUploadedBy: user
      },
      file
    });
  } catch (err) {
    console.error('Error uploading NWBDCP report copy:', err);
    return res.status(500).json({ success: false, error: '⚠️ अहवालाची प्रत अपलोड करण्यात अडचण आली: ' + err.message });
  }
});

// Unified Multi-Module NWBDCP Google Drive Upload Endpoint
app.post('/api/nwbdcp/storage/upload', nwbdcpRequireAuth(ROLES.STAFF), async (req, res) => {
  try {
    const user = req.nwbdcpAuth.user;
    const { sampleId, module = 'other_documents', fileName, fileData } = req.body;
    const result = await uploadFileToGoogleDrive({ sampleId, module, fileName, fileData, user });
    if (!result.success) {
      return res.status(result.statusCode || 400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Unified NWBDCP File Replacement with Google Drive Versioning & Supabase Audit Log
app.post('/api/nwbdcp/storage/replace', nwbdcpRequireAuth(ROLES.ADMIN), async (req, res) => {
  try {
    const user = req.nwbdcpAuth.user;
    const { sampleId, module = 'laboratory_reports', fileName, fileData, replacementReason } = req.body;
    const result = await replaceFileInGoogleDrive({ sampleId, module, fileName, fileData, replacementReason, user });
    if (!result.success) {
      return res.status(result.statusCode || 400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Lazy-loaded File Metadata & History for a Sample
app.get('/api/nwbdcp/storage/files/:sampleId', (req, res) => {
  try {
    const sampleId = req.params.sampleId;
    const module = req.query.module || 'laboratory_reports';
    const activeFile = getActiveFileMetadata(sampleId, module);
    const history = getSampleFileHistory(sampleId);
    res.json({ success: true, activeFile, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Secure Google Drive File Serving / Proxy with Validation
app.get('/api/nwbdcp/storage/serve/:fileId', (req, res) => {
  try {
    const fileId = req.params.fileId;
    
    // Security check: Validate file ID exists in Supabase metadata
    const meta = findFileMetadata(fileId);
    if (!meta) {
      return res.status(403).json({
        success: false,
        error: '⚠️ अनाधिकृत प्रवेश: ही फाईल NWBDCP सिस्टीममध्ये नोंदणीकृत नाही (Unauthorized file access prevented).'
      });
    }

    const physicalPath = getPhysicalDriveFilePath(fileId);
    if (physicalPath && fs.existsSync(physicalPath)) {
      res.setHeader('Content-Type', meta.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(meta.file_name)}"`);
      return res.sendFile(physicalPath);
    }

    // If only remote Google Drive URL is available, redirect safely
    if (meta.google_drive_url) {
      return res.redirect(meta.google_drive_url);
    }

    return res.status(404).json({ success: false, error: '⚠️ फाईल Google Drive वर उपलब्ध नाही.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Supabase & Google Drive Storage Status
app.get('/api/nwbdcp/storage/status', (req, res) => {
  try {
    const status = getSupabaseStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Read-Only Storage Integrity Check Endpoint
app.get('/api/nwbdcp/storage/integrity-check', (req, res) => {
  try {
    const integrity = performStorageIntegrityCheck();
    res.json({ success: true, ...integrity });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Offline Sync Queue Status & Processing Endpoints
app.get('/api/nwbdcp/sync-queue/status', (req, res) => {
  try {
    const summary = getSyncQueueSummary();
    res.json({ success: true, ...summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/nwbdcp/sync-queue/process', nwbdcpRequireAuth(ROLES.STAFF), async (req, res) => {
  try {
    const result = await processPendingSyncQueue();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/nwbdcp/update-lab-results', nwbdcpRequireAuth(ROLES.STAFF), async (req, res) => {
  try {
    const user = req.nwbdcpAuth.user;
    const result = await updateLabResults(req.body, user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/nwbdcp/replace-report-copy', nwbdcpRequireAuth(ROLES.ADMIN), async (req, res) => {
  try {
    const user = req.nwbdcpAuth.user;
    const { sampleId, reportCopy } = req.body;
    let finalCopy = reportCopy;

    // If raw fileData is provided for replacement, upload to Google Drive first
    if (reportCopy && reportCopy.fileData) {
      const driveRes = await replaceFileInGoogleDrive({
        sampleId,
        module: 'laboratory_reports',
        fileName: reportCopy.fileName,
        fileData: reportCopy.fileData,
        replacementReason: reportCopy.replacementReason || 'प्रयोगशाळा अहवाल प्रत बदलण्यात आली',
        user
      });

      if (!driveRes.success) {
        return res.status(driveRes.statusCode || 400).json(driveRes);
      }

      const f = driveRes.file;
      finalCopy = {
        reportFileName: f.fileName,
        reportFileUrl: `/api/nwbdcp/storage/serve/${f.googleDriveFileId}`,
        reportFileType: f.fileType,
        reportFileSize: f.fileSize,
        googleDriveFileId: f.googleDriveFileId,
        googleDriveUrl: f.googleDriveUrl,
        googleDriveDownloadUrl: f.googleDriveDownloadUrl,
        reportUploadedAt: f.uploadedAt,
        reportUploadedBy: user
      };
    }

    const result = replaceNwbdcpReportCopy({ sampleId, reportCopy: finalCopy }, user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Re-Test Endpoints
app.post('/api/nwbdcp/retest-sample', nwbdcpRequireAuth(ROLES.STAFF), async (req, res) => {
  try {
    const user = req.nwbdcpAuth.user;
    const result = await createRetestForSample(req.body, user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/nwbdcp/update-retest-result', nwbdcpRequireAuth(ROLES.STAFF), async (req, res) => {
  try {
    const user = req.nwbdcpAuth.user;
    const { retestId, reportCopy } = req.body;
    let finalCopy = reportCopy;

    if (reportCopy && reportCopy.fileData) {
      const driveRes = await uploadFileToGoogleDrive({
        sampleId: retestId,
        module: 'retest_reports',
        fileName: reportCopy.fileName,
        fileData: reportCopy.fileData,
        user
      });

      if (driveRes && driveRes.success && driveRes.file) {
        const f = driveRes.file;
        finalCopy = {
          reportFileName: f.fileName,
          reportFileUrl: `/api/nwbdcp/storage/serve/${f.googleDriveFileId}`,
          reportFileType: f.fileType,
          reportFileSize: f.fileSize,
          googleDriveFileId: f.googleDriveFileId
        };
      }
    }

    const result = await updateRetestResult({ ...req.body, reportCopy: finalCopy }, user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/nwbdcp/retests', async (req, res) => {
  try {
    await refreshNwbdcpFromSupabase();
    const retests = getRetestsList(req.query);
    res.json({ success: true, retests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Reports Endpoint
app.get('/api/nwbdcp/reports', async (req, res) => {
  try {
    await refreshNwbdcpFromSupabase();
    const reportData = generateNwbdcpReports(req.query.type || "SUMMARY", req.query);
    res.json({ success: true, ...reportData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Historical Data Import Endpoint
app.post('/api/nwbdcp/import-historical-samples', nwbdcpRequireAuth(ROLES.STAFF), (req, res) => {
  try {
    const user = req.nwbdcpAuth.user;
    const result = importHistoricalWaterSamples(req.body.samples || [], user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Export NWBDCP Water Sources (.xlsx / .csv)
app.get('/api/export/nwbdcp-water-sources.xlsx', (req, res) => {
  try {
    const sources = getWaterSources(req.query);
    const headers = ["आयडी (ID)", "उपकेंद्र (Subcenter)", "गाव (Village)", "जलस्त्रोताचे नाव (Source Name)", "स्त्रोत प्रकार (Source Type)", "मालकी (Ownership)", "स्थिती (Status)", "पत्ता/ठिकाण (Location)"];
    const rows = sources.map(s => [
      s.id || '', s.subcenter || '', s.village || '', s.sourceName || '', s.sourceType || '', s.ownership || '', s.status || '', s.location || ''
    ]);
    return sendExportData(req, res, `phc_bhada_nwbdcp_water_sources_${new Date().toISOString().slice(0, 10)}`, headers, rows, 'Water_Sources');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8b. Download Official NWBDCP Water Source List Upload Template (.xlsx / .csv)
app.get(['/api/export/nwbdcp-source-template.xlsx', '/api/export/nwbdcp-source-template.csv'], (req, res) => {
  try {
    const headers = [
      "उपकेंद्र (Subcenter)",
      "गाव (Village)",
      "जलस्त्रोताचे नाव (Source Name)",
      "स्त्रोत प्रकार (Source Type)",
      "मालकी (Ownership)",
      "स्थिती (Status)",
      "पत्ता/ठिकाण (Location)",
      "अक्षांश (Latitude)",
      "रेखांश (Longitude)"
    ];
    const demoRows = [
      ["भादा", "भादा", "ग्रामपंचायत मुख्य विहीर क्र. १", "सार्वजनिक विहीर", "सार्वजनिक", "सुरू", "हनुमान मंदिराजवळ", "", ""],
      ["भादा", "भादा", "जिल्हा परिषद शाळा हातपंप", "हातपंप", "सार्वजनिक", "सुरू", "जि.प. शाळा आवार", "", ""]
    ];
    return sendExportData(req, res, `NWBDCP_Water_Source_List_Upload_Template`, headers, demoRows, 'Water_Source_Template');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Export NWBDCP Sample Dispatch & Results (.xlsx / .csv)
app.get('/api/export/nwbdcp-samples.xlsx', (req, res) => {
  try {
    const samples = getDispatchedSamples(req.query);
    const headers = [
      "नमुना आयडी (Sample ID)",
      "तपासणी प्रकार (Analysis Type)",
      "पाणी/TCL संकलन दिनांक (Collection Date)",
      "पाठवणी दिनांक (Dispatch Date)",
      "उपकेंद्र (Subcenter)",
      "गाव (Village)",
      "जलस्त्रोत / TCL साठा नाव (Source Name)",
      "स्त्रोत प्रकार (Source Type)",
      "मालकी (Ownership)",
      "प्रयोगशाळा (Lab Name)",
      "नमुना निकाल (Result)",
      "तपासणी मानके / तपशील (Analytical Params)",
      "अहवाल दिनांक (Report Date)",
      "प्रयोगशाळा जा.क्र. (Lab Ref No)",
      "शेरा (Remarks)"
    ];
    const rows = samples.map(s => {
      const aType = s.analysisType === 'CHEMICAL' ? 'रासायनिक तपासणी (Chemical)' : (s.analysisType === 'BLEACHING_POWDER' ? 'ब्लिचिंग पावडर (TCL)' : 'जैविक तपासणी (Bacteriological)');
      const p = s.analysisParams || {};
      let paramSummary = '';
      if (s.analysisType === 'CHEMICAL') {
        paramSummary = [
          p.ph ? `pH:${p.ph}` : '',
          p.tds ? `TDS:${p.tds}` : '',
          p.turbidity ? `Turbidity:${p.turbidity}` : '',
          p.hardness ? `Hardness:${p.hardness}` : '',
          p.fluoride ? `Fluoride:${p.fluoride}` : '',
          p.nitrate ? `Nitrate:${p.nitrate}` : ''
        ].filter(Boolean).join(', ');
      } else if (s.analysisType === 'BLEACHING_POWDER') {
        paramSummary = [
          p.availableChlorinePct !== undefined && p.availableChlorinePct !== '' ? `उपलब्ध क्लोरीन: ${p.availableChlorinePct}%` : '',
          p.tclBatchNo ? `बॅच: ${p.tclBatchNo}` : '',
          p.tclPackingType ? `पॅकिंग: ${p.tclPackingType}` : ''
        ].filter(Boolean).join(', ');
      } else {
        paramSummary = [
          p.mpnCount !== undefined && p.mpnCount !== '' ? `MPN:${p.mpnCount}/100ml` : '',
          p.ecoliStatus ? `E.coli:${p.ecoliStatus}` : '',
          p.residualChlorine ? `RC:${p.residualChlorine}ppm` : ''
        ].filter(Boolean).join(', ');
      }
      return [
        s.sampleId || '', aType, s.collectionDate || '', s.dispatchDate || '', s.subcenter || '', s.village || '', s.sourceName || '', s.sourceType || '', s.ownership || '', s.labName || '', s.result || '', paramSummary, s.reportReceivedDate || '', s.labRefNo || '', s.remarks || ''
      ];
    });
    return sendExportData(req, res, `phc_bhada_nwbdcp_samples_${new Date().toISOString().slice(0, 10)}`, headers, rows, 'Sample_Dispatch');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Download Official NWBDCP Historical Import Template (.xlsx / .csv) with Unicode Devanagari Support
app.get(['/api/export/nwbdcp-template.xlsx', '/api/export/nwbdcp-template.csv'], (req, res) => {
  try {
    const headers = [
      "उपकेंद्र (Subcenter)",
      "गाव (Village)",
      "स्त्रोत आयडी (Source ID)",
      "जलस्त्रोताचे नाव (Source Name)",
      "स्त्रोत प्रकार (Source Type)",
      "मालकी (Ownership)",
      "तपासणी प्रकार (Analysis Type)",
      "पाठवणी दिनांक (Dispatch Date)",
      "नमुना आयडी (Sample ID)",
      "तपासणी निकाल (Result)",
      "प्रयोगशाळा नाव (Lab Name)",
      "अहवाल दिनांक (Report Date)",
      "शेरा (Remarks)"
    ];

    const sampleDemoRows = [];

    return sendExportData(req, res, `NWBDCP_Historical_Sample_Import_Template`, headers, sampleDemoRows, 'Template');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export NCD Subcenter Report
app.get(['/api/export/ncd-subcenter.xlsx', '/api/export/ncd-subcenter.csv'], (req, res) => {
  try {
    const report = getNcdSubcenterReport(req.query);
    const headers = ["अ.क्र.", "उपकेंद्र (SHC)", "एकूण नागरिक", "CBAC पूर्ण", "HTN तपासणी", "DM तपासणी", "मुख कर्करोग", "स्तन कर्करोग", "गर्भाशय कर्करोग", "एकूण स्क्रिनिंग (Events)", "युनिक स्क्रिनिंग व्यक्ती", "नवीन निदान (Newly Diagnosed)", "उपचाराखालील (Under Treatment)", "नियमित फॉलो-अप (Adhering)", "फॉलो-अप चुकलेले (Missed)"];
    const rows = report.rows.map(r => [
      r.srNo, r.shc, r.totalIndividuals, r.cbacCompleted, r.htnScreened, r.dmScreened, r.ocScreened, r.bcScreened, r.ccScreened, r.totalScreenedEvents, r.uniqueScreenedIndividuals, r.newlyDiagnosed, r.underTreatment, r.adheringFollowup, r.missedFollowup
    ]);
    return sendExportData(req, res, `NCD_Subcenter_Report`, headers, rows, 'Subcenters');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export NCD Village Report
app.get(['/api/export/ncd-village.xlsx', '/api/export/ncd-village.csv'], (req, res) => {
  try {
    const report = getNcdVillageReport(req.query);
    const headers = ["अ.क्र.", "उपकेंद्र (SHC)", "गाव (Village)", "एकूण नागरिक", "CBAC पूर्ण", "HTN तपासणी", "DM तपासणी", "मुख कर्करोग", "स्तन कर्करोग", "गर्भाशय कर्करोग", "एकूण स्क्रिनिंग (Events)", "युनिक स्क्रिनिंग व्यक्ती", "नवीन निदान (Newly Diagnosed)", "उपचाराखालील (Under Treatment)", "नियमित फॉलो-अप (Adhering)", "फॉलो-अप चुकलेले (Missed)"];
    const rows = report.rows.map(r => [
      r.srNo, r.shc, r.village, r.totalIndividuals, r.cbacCompleted, r.htnScreened, r.dmScreened, r.ocScreened, r.bcScreened, r.ccScreened, r.totalScreenedEvents, r.uniqueScreenedIndividuals, r.newlyDiagnosed, r.underTreatment, r.adheringFollowup, r.missedFollowup
    ]);
    return sendExportData(req, res, `NCD_Village_Report`, headers, rows, 'Villages');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export NCD Line Listing Report
app.get(['/api/export/ncd-line-listing.xlsx', '/api/export/ncd-line-listing.csv'], (req, res) => {
  try {
    const listing = getNcdLineListing({ ...req.query, page: 1, limit: 100000 });
    const headers = ["Individual ID", "First Name", "Middle Name", "Last Name", "Age", "Sex", "ABHA Number", "PHC", "SHC", "Village", "CBAC Date", "CBAC Status", "CBAC Risk Score", "Completed Screenings", "Treatment Status"];
    const rows = (listing.items || []).map(item => [
      item.individual_id || '',
      item.first_name || '',
      item.middle_name || '',
      item.last_name || '',
      item.age || '',
      item.sex || '',
      item.abha_number || '',
      item.phc || '',
      item.shc || '',
      item.village || '',
      item.cbac_date || '',
      item.cbac_status || '',
      item.cbac_risk_score || '',
      item.completed_screenings || '',
      item.active_treatments || ''
    ]);
    return sendExportData(req, res, `NCD_Individual_Line_Listing`, headers, rows, 'LineListing');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Express global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`PHC Bhada Malaria & NCD Management System running on http://0.0.0.0:${PORT}`);
  // Initialize NCD Store
  initNcdStore().catch(e => console.warn('[Server] NCD store init note:', e.message));

  // Immediately initialize from Supabase Primary Database, fallback to Cloud Firestore
  try {
    const sbRes = await syncAllDataFromSupabase();
    if (!sbRes || !sbRes.success) {
      console.log('[Server] Supabase primary unavailable/offline; syncing from Cloud Firestore.');
      await syncAllDataFromFirestore(true);
    }
  } catch (err) {
    console.warn('[Server] Initial data sync note:', err.message);
    await syncAllDataFromFirestore(true).catch(e => console.warn('[Server] Fallback Firestore sync note:', e.message));
  }
});
