// =========================================================================
// NWBDCP — WATER QUALITY MANAGEMENT MODULE DATA STORE
// Completely Isolated from NVBDCP
// =========================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { subcenterMaster, villagesMaster } from '../data/store.js';
import { 
  fetchWaterSourcesFromSupabase,
  fetchSampleDispatchesFromSupabase,
  fetchSampleResultsFromSupabase,
  fetchRetestsFromSupabase,
  fetchAuditLogsFromSupabase,
  syncWaterSourceToSupabase, 
  syncSampleDispatchToSupabase,
  syncBatchSampleDispatchesToSupabase,
  syncSampleResultToSupabase,
  syncRetestToSupabase,
  syncAuditLogToSupabase
} from './nwbdcpSupabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NWBDCP_DB_FILE = path.join(__dirname, '../data/nwbdcp_db.json');

// Standard Predefined Lists for NWBDCP
export const PREDEFINED_SOURCE_TYPES = [
  "हातपंप",
  "विद्युत पंप",
  "विहीर",
  "आड",
  "सार्वजनिक पाणीपुरवठा योजना (नळ योजना)",
  "स्टॅन्ड पोस्ट",
  "RO Plant",
  "इतर"
];

export const PREDEFINED_OWNERSHIPS = [
  "शासकीय",
  "खाजगी",
  "अज्ञात / Not Specified"
];

export const SAMPLE_STATUSES = {
  DISPATCHED: "पाठविलेले",
  AWAITED: "अहवाल अप्राप्त",
  SUITABLE: "पिण्यास योग्य",
  UNSUITABLE: "पिण्यास अयोग्य",
  RETEST_REQUIRED: "पुनर्तपासणी आवश्यक",
  RETEST_RECEIVED: "पुनर्तपासणी अहवाल प्राप्त"
};

// In-Memory Data Collections for NWBDCP (Isolated)
export let nwbdcpWaterSources = [];
export let nwbdcpSampleDispatches = [];
export let nwbdcpSampleResults = [];
export let nwbdcpRetests = [];
export let nwbdcpAuditLogs = [];

// Helper: Generate Category Prefix Code
export function getSourceTypeCode(sourceType) {
  switch (sourceType) {
    case "हातपंप": return "HP";
    case "विद्युत पंप":
    case "विद्युतंप": return "EP";
    case "विहीर": return "WLL";
    case "आड": return "AAD";
    case "सार्वजनिक पाणीपुरवठा योजना (नळ योजना)": return "TAP";
    case "स्टॅन्ड पोस्ट": return "SP";
    case "RO Plant": return "RO";
    default: return "OTH";
  }
}

// Helper: Auto-generate unique Source ID (e.g., WS-BHD-TAP-001)
export function generateWaterSourceCode(village = "", sourceType = "") {
  const typeCode = getSourceTypeCode(sourceType);
  const cleanVil = (village || "BHD").replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || "BHD";
  
  // Count existing sources of same type in same village
  const matching = nwbdcpWaterSources.filter(s => s.village === village && s.sourceType === sourceType).length + 1;
  const seq = String(matching).padStart(3, '0');
  
  return `WS-${cleanVil}-${typeCode}-${seq}`;
}

// Seed Initial Water Sources for PHC Bhada Villages if DB is empty
function getInitialSeedWaterSources() {
  const seedSources = [];
  let idCounter = 1001;

  villagesMaster.forEach(v => {
    const sc = v.subcenter || "भादा";
    const vName = v.villageName || "भादा";
    const vilCode = (vName || "BHD").replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || "BHD";

    // Standard water sources per village with distinct Source IDs
    seedSources.push({
      id: `SRC_${idCounter}`,
      sourceCode: `WS-${vilCode}-TAP-001`,
      sourceId: `WS-${vilCode}-TAP-001`,
      subcenter: sc,
      gramPanchayat: vName,
      village: vName,
      sourceName: `${vName} सार्वजनिक पाणीपुरवठा योजना (नळ योजना)`,
      sourceType: "सार्वजनिक पाणीपुरवठा योजना (नळ योजना)",
      ownership: "शासकीय",
      status: "Active",
      location: `${vName} ग्रामपंचायत परिसर`,
      createdDate: "2026-01-01",
      updatedDate: "2026-01-01"
    });
    idCounter++;

    seedSources.push({
      id: `SRC_${idCounter}`,
      sourceCode: `WS-${vilCode}-HP-001`,
      sourceId: `WS-${vilCode}-HP-001`,
      subcenter: sc,
      gramPanchayat: vName,
      village: vName,
      sourceName: `${vName} जिल्हा परिषद शाळा परिसर हातपंप`,
      sourceType: "हातपंप",
      ownership: "शासकीय",
      status: "Active",
      location: `जि.प. शाळा परिसर, ${vName}`,
      createdDate: "2026-01-01",
      updatedDate: "2026-01-01"
    });
    idCounter++;

    seedSources.push({
      id: `SRC_${idCounter}`,
      sourceCode: `WS-${vilCode}-WLL-001`,
      sourceId: `WS-${vilCode}-WLL-001`,
      subcenter: sc,
      gramPanchayat: vName,
      village: vName,
      sourceName: `${vName} सार्वजनिक मुख्य विहीर`,
      sourceType: "विहीर",
      ownership: "शासकीय",
      status: "Active",
      location: `मुख्य रस्ता, ${vName}`,
      createdDate: "2026-01-01",
      updatedDate: "2026-01-01"
    });
    idCounter++;
  });

  return seedSources;
}

// Save NWBDCP Database to Disk
export function saveNwbdcpDbToDisk() {
  try {
    const payload = {
      waterSources: nwbdcpWaterSources,
      sampleDispatches: nwbdcpSampleDispatches,
      sampleResults: nwbdcpSampleResults,
      retests: nwbdcpRetests,
      auditLogs: nwbdcpAuditLogs,
      lastSaved: new Date().toISOString()
    };
    fs.writeFileSync(NWBDCP_DB_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving NWBDCP DB to disk:', err);
  }
}

// Refresh in-memory collections directly from Supabase (Primary Source of Truth)
export async function refreshNwbdcpFromSupabase() {
  try {
    const supaSources = await fetchWaterSourcesFromSupabase();
    if (Array.isArray(supaSources) && supaSources.length > 0) {
      nwbdcpWaterSources.length = 0;
      supaSources.forEach(s => nwbdcpWaterSources.push(s));
      console.log(`✅ [NWBDCP Store] Primary read: Loaded ${supaSources.length} Water Sources directly from Supabase.`);
    }

    const supaDispatches = await fetchSampleDispatchesFromSupabase();
    if (Array.isArray(supaDispatches) && supaDispatches.length > 0) {
      nwbdcpSampleDispatches.length = 0;
      supaDispatches.forEach(d => nwbdcpSampleDispatches.push(d));
      console.log(`✅ [NWBDCP Store] Primary read: Loaded ${supaDispatches.length} Dispatched Samples directly from Supabase.`);
    }

    try {
      const supaResults = await fetchSampleResultsFromSupabase();
      if (Array.isArray(supaResults)) {
        nwbdcpSampleResults.length = 0;
        supaResults.forEach(r => {
          nwbdcpSampleResults.push(r);
          // Overlay authoritative sample results onto sample dispatches
          const sample = nwbdcpSampleDispatches.find(d => d.sampleId === r.sample_id);
          if (sample) {
            sample.result = r.result;
            sample.reportReceivedDate = r.report_received_date || sample.reportReceivedDate || '';
            sample.labRefNo = r.lab_ref_no || sample.labRefNo || '';
            sample.labRemarks = r.lab_remarks || sample.labRemarks || '';
            sample.testedBy = r.tested_by || sample.testedBy || '';
            if (r.coliform_count !== undefined) sample.coliformCount = r.coliform_count;
            if (r.ecoli_present !== undefined) sample.ecoliPresent = r.ecoli_present;
            if (r.chlorine_ppm !== undefined) sample.chlorinePpm = r.chlorine_ppm;
            if (r.turbidity_ntu !== undefined) sample.turbidityNtu = r.turbidity_ntu;
            if (r.ph_value !== undefined) sample.phValue = r.ph_value;
            if (r.tds_ppm !== undefined) sample.tdsPpm = r.tds_ppm;
            if (r.result && r.result !== 'अहवाल अप्राप्त' && r.report_received_date && r.lab_ref_no) {
              sample.status = "अहवाल अपडेट पूर्ण";
            }
          }
        });
        console.log(`✅ [NWBDCP Store] Primary read: Loaded ${supaResults.length} Sample Results directly from Supabase.`);
      }
    } catch (resErr) {
      console.warn('⚠️ [NWBDCP Store] Could not fetch Sample Results from Supabase, using local cache:', resErr.message);
    }

    try {
      const supaRetests = await fetchRetestsFromSupabase();
      if (Array.isArray(supaRetests)) {
        nwbdcpRetests.length = 0;
        supaRetests.forEach(r => {
          const localRetest = {
            id: r.id,
            retestId: r.retest_id,
            originalSampleId: r.original_sample_id,
            sourceId: r.source_id,
            retestSampleId: r.retest_sample_id,
            retestDispatchDate: r.retest_dispatch_date || r.retest_date || '',
            retestCollectionDate: r.retest_collection_date || r.retest_date || '',
            labName: r.lab_name || 'जिल्हा सार्वजनिक आरोग्य प्रयोगशाळा, धाराशीव',
            remarks: r.remarks || '',
            retestResult: r.retest_result || 'अहवाल अप्राप्त',
            retestStatus: r.retest_status || 'पुनर्तपासणी प्रलंबित',
            retestReportReceivedDate: r.retest_report_received_date || '',
            retestLabRefNo: r.retest_lab_ref_no || '',
            retestReportFileName: r.retest_report_file_name || '',
            retestReportFileUrl: r.retest_report_file_url || '',
            actionTaken: r.corrective_action || '',
            createdBy: r.created_by || 'System',
            createdDate: r.created_at,
            updatedDate: r.updated_at
          };

          const origSample = nwbdcpSampleDispatches.find(d => d.sampleId === r.original_sample_id);
          if (origSample) {
            localRetest.subcenter = origSample.subcenter;
            localRetest.gramPanchayat = origSample.gramPanchayat;
            localRetest.village = origSample.village;
            localRetest.sourceCode = origSample.sourceCode || origSample.sourceId;
            localRetest.sourceName = origSample.sourceName;
            localRetest.sourceType = origSample.sourceType;
            localRetest.ownership = origSample.ownership;
            localRetest.originalResult = origSample.result;
          }

          nwbdcpRetests.push(localRetest);
        });
        console.log(`✅ [NWBDCP Store] Primary read: Loaded ${supaRetests.length} Retest records directly from Supabase.`);
      }
    } catch (retErr) {
      console.warn('⚠️ [NWBDCP Store] Could not fetch Retest records from Supabase, using local cache:', retErr.message);
    }

    try {
      const supaAuditLogs = await fetchAuditLogsFromSupabase();
      if (Array.isArray(supaAuditLogs) && supaAuditLogs.length > 0) {
        nwbdcpAuditLogs.length = 0;
        supaAuditLogs.forEach(a => nwbdcpAuditLogs.push(a));
        console.log(`✅ [NWBDCP Store] Primary read: Loaded ${supaAuditLogs.length} Audit Logs directly from Supabase.`);
      } else if (Array.isArray(supaAuditLogs) && supaAuditLogs.length === 0 && nwbdcpAuditLogs.length > 0) {
        console.log(`🔄 [NWBDCP Store] Migrating ${nwbdcpAuditLogs.length} historical local audit logs to Supabase...`);
        for (const localLog of nwbdcpAuditLogs) {
          await syncAuditLogToSupabase(localLog);
        }
        const freshAuditLogs = await fetchAuditLogsFromSupabase();
        if (Array.isArray(freshAuditLogs) && freshAuditLogs.length > 0) {
          nwbdcpAuditLogs.length = 0;
          freshAuditLogs.forEach(a => nwbdcpAuditLogs.push(a));
          console.log(`✅ [NWBDCP Store] Successfully migrated and loaded ${freshAuditLogs.length} Audit Logs from Supabase.`);
        }
      }
    } catch (auditErr) {
      console.warn('⚠️ [NWBDCP Store] Could not fetch/sync Audit Logs from Supabase, using local cache:', auditErr.message);
    }

    saveNwbdcpDbToDisk();
  } catch (err) {
    console.warn('⚠️ [NWBDCP Store] Primary Supabase read unavailable, using local offline fallback cache:', err.message);
  }
}

// Load NWBDCP Database from Disk
export function loadNwbdcpDbFromDisk() {
  try {
    if (fs.existsSync(NWBDCP_DB_FILE)) {
      const raw = fs.readFileSync(NWBDCP_DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.waterSources)) {
        nwbdcpWaterSources.length = 0;
        parsed.waterSources.forEach(s => {
          if (!s.sourceCode && !s.sourceId) {
            const code = generateWaterSourceCode(s.village, s.sourceType);
            s.sourceCode = code;
            s.sourceId = code;
          } else if (!s.sourceCode) {
            s.sourceCode = s.sourceId;
          } else if (!s.sourceId) {
            s.sourceId = s.sourceCode;
          }
          if (!s.gramPanchayat) s.gramPanchayat = s.village || "";
          nwbdcpWaterSources.push(s);
        });
      }
      if (Array.isArray(parsed.sampleDispatches)) {
        nwbdcpSampleDispatches.length = 0;
        parsed.sampleDispatches.forEach(d => {
          if (!d.gramPanchayat) d.gramPanchayat = d.village || "";
          nwbdcpSampleDispatches.push(d);
        });
      }
      if (Array.isArray(parsed.sampleResults)) {
        nwbdcpSampleResults.length = 0;
        parsed.sampleResults.forEach(r => nwbdcpSampleResults.push(r));
      }
      if (Array.isArray(parsed.retests)) {
        nwbdcpRetests.length = 0;
        parsed.retests.forEach(rt => nwbdcpRetests.push(rt));
      }
      if (Array.isArray(parsed.auditLogs)) {
        nwbdcpAuditLogs.length = 0;
        parsed.auditLogs.forEach(a => nwbdcpAuditLogs.push(a));
      }
    } else {
      // Populate initial seed sources if empty
      const initialSources = getInitialSeedWaterSources();
      initialSources.forEach(s => nwbdcpWaterSources.push(s));
      saveNwbdcpDbToDisk();
    }
  } catch (err) {
    console.error('Error loading NWBDCP DB from disk:', err);
    if (nwbdcpWaterSources.length === 0) {
      const initialSources = getInitialSeedWaterSources();
      initialSources.forEach(s => nwbdcpWaterSources.push(s));
    }
  }
}

// Initialize on module load: First load disk cache as offline backup, then sync from Supabase
loadNwbdcpDbFromDisk();
refreshNwbdcpFromSupabase();

// Audit Logger (PRIMARY: Supabase, FALLBACK: Local Cache & Sync Queue)
export function addNwbdcpAuditLog(action, details, user = "System") {
  const logEntry = {
    id: `LOG_${Date.now()}_${Math.floor(Math.random()*1000)}`,
    action,
    details,
    user,
    timestamp: new Date().toISOString()
  };
  nwbdcpAuditLogs.push(logEntry);
  if (nwbdcpAuditLogs.length > 500) {
    nwbdcpAuditLogs.shift();
  }
  saveNwbdcpDbToDisk();

  // Primary write: Sync to Supabase NWBDCP_AuditLogs
  syncAuditLogToSupabase(logEntry).catch(err => {
    console.warn('⚠️ [NWBDCP Audit Log] Async Supabase sync warning:', err.message);
  });

  return logEntry;
}

// =========================================================================
// 1. READ-ONLY NVBDCP MASTER DATA REFERENCE FOR NWBDCP
// =========================================================================
export function getNwbdcpReferenceMasterData() {
  // Read-only export of Subcenter and Village Master Data from NVBDCP
  return {
    subcenters: subcenterMaster.map(s => ({
      name: s.name,
      headquarter: s.headquarter || s.name,
      population: s.population || 0,
      houses: s.houses || 0,
      villages: Array.isArray(s.villages) ? [...s.villages] : []
    })),
    villages: villagesMaster.map(v => ({
      id: v.id,
      villageName: v.villageName,
      subcenter: v.subcenter,
      gramPanchayat: v.villageName,
      population: v.population || 0,
      houses: v.houses || 0
    }))
  };
}

// =========================================================================
// 2. WATER SOURCE REGISTER CONTROLLER
// =========================================================================
export function getWaterSources(filters = {}) {
  let list = [...nwbdcpWaterSources];

  if (filters.subcenter && filters.subcenter !== 'ALL') {
    list = list.filter(s => s.subcenter === filters.subcenter);
  }
  if (filters.village && filters.village !== 'ALL') {
    list = list.filter(s => s.village === filters.village);
  }
  if (filters.sourceType && filters.sourceType !== 'ALL') {
    list = list.filter(s => s.sourceType === filters.sourceType);
  }
  if (filters.ownership && filters.ownership !== 'ALL') {
    list = list.filter(s => s.ownership === filters.ownership);
  }
  if (filters.status && filters.status !== 'ALL') {
    list = list.filter(s => s.status === filters.status);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    list = list.filter(s => 
      (s.sourceName && s.sourceName.toLowerCase().includes(q)) ||
      (s.sourceCode && s.sourceCode.toLowerCase().includes(q)) ||
      (s.sourceId && s.sourceId.toLowerCase().includes(q)) ||
      (s.village && s.village.toLowerCase().includes(q)) ||
      (s.subcenter && s.subcenter.toLowerCase().includes(q)) ||
      (s.gramPanchayat && s.gramPanchayat.toLowerCase().includes(q)) ||
      (s.location && s.location.toLowerCase().includes(q))
    );
  }

  return list;
}

export function saveWaterSource(data, user = "System", allowDuplicate = false) {
  if (!data || !data.subcenter || !data.village || !data.sourceName || !data.sourceType) {
    return { success: false, message: "⚠️ उपकेंद्र, गाव, स्त्रोताचे नाव आणि स्त्रोत प्रकार आवश्यक आहेत." };
  }

  const cleanSubcenter = data.subcenter.trim();
  const cleanVillage = data.village.trim();
  const cleanSourceName = data.sourceName.trim();

  // Subcenter-Village Dependency Check (read-only reference against master)
  const validVillageObj = villagesMaster.find(v => 
    v.villageName.toLowerCase() === cleanVillage.toLowerCase() &&
    v.subcenter.toLowerCase() === cleanSubcenter.toLowerCase()
  );
  if (!validVillageObj) {
    const villageMasterEntry = villagesMaster.find(v => v.villageName.toLowerCase() === cleanVillage.toLowerCase());
    if (villageMasterEntry && villageMasterEntry.subcenter.toLowerCase() !== cleanSubcenter.toLowerCase()) {
      return {
        success: false,
        message: `⚠️ 'गाव: ${cleanVillage}' हे 'उपकेंद्र: ${villageMasterEntry.subcenter}' अंतर्गत येते. निवडलेल्या 'उपकेंद्र: ${cleanSubcenter}' मध्ये येत नाही.`
      };
    }
  }

  // Validate predefined source type
  let cleanSourceType = data.sourceType.trim();
  if (!PREDEFINED_SOURCE_TYPES.includes(cleanSourceType)) {
    cleanSourceType = "इतर";
  }

  // Validate predefined ownership (If unknown or empty, preserve as 'अज्ञात / Not Specified')
  let cleanOwnership = data.ownership ? data.ownership.trim() : "अज्ञात / Not Specified";
  if (!PREDEFINED_OWNERSHIPS.includes(cleanOwnership)) {
    cleanOwnership = "अज्ञात / Not Specified";
  }

  let existing = nwbdcpWaterSources.find(s => s.id === data.id || (data.sourceCode && (s.sourceCode === data.sourceCode || s.sourceId === data.sourceCode)));

  if (existing) {
    // Edit existing water source (Source ID is immutable)
    const oldValueDesc = `${existing.subcenter} - ${existing.village} - ${existing.sourceType} - ${existing.sourceName} (${existing.ownership})`;

    existing.subcenter = cleanSubcenter;
    existing.village = cleanVillage;
    existing.gramPanchayat = data.gramPanchayat ? data.gramPanchayat.trim() : cleanVillage;
    existing.sourceName = cleanSourceName;
    existing.sourceType = cleanSourceType;
    existing.ownership = cleanOwnership;
    existing.status = data.status || existing.status || "Active";
    existing.location = data.location ? data.location.trim() : "";
    existing.updatedDate = new Date().toISOString().slice(0, 10);
    existing.updatedBy = user;

    const newValueDesc = `${existing.subcenter} - ${existing.village} - ${existing.sourceType} - ${existing.sourceName} (${existing.ownership})`;

    addNwbdcpAuditLog('UPDATE_WATER_SOURCE', `जलस्त्रोत संपादित केला [ID: ${existing.sourceCode}]: ${oldValueDesc} ➔ ${newValueDesc}`, user);
    saveNwbdcpDbToDisk();
    syncWaterSourceToSupabase(existing);
    return { success: true, message: `✅ जलस्त्रोत '${existing.sourceName}' [ID: ${existing.sourceCode}] अपडेट झाला!`, source: existing };
  } else {
    // Check for duplicate source in same subcenter, village, sourceType, and sourceName
    if (!allowDuplicate) {
      const duplicateFound = nwbdcpWaterSources.find(s => 
        s.subcenter.toLowerCase() === cleanSubcenter.toLowerCase() &&
        s.village.toLowerCase() === cleanVillage.toLowerCase() &&
        s.sourceType.toLowerCase() === cleanSourceType.toLowerCase() &&
        s.sourceName.toLowerCase() === cleanSourceName.toLowerCase()
      );

      if (duplicateFound) {
        return {
          success: false,
          isDuplicate: true,
          duplicateSource: duplicateFound,
          message: `⚠️ 'गाव: ${cleanVillage}' मध्ये '${cleanSourceName}' (${cleanSourceType}) या नावाचा जलस्त्रोत [ID: ${duplicateFound.sourceCode}] आधीच नोंदणीकृत आहे.\n\nतुम्हाला तरीही नवीन जलस्त्रोत नोंदवायचा आहे का?`
        };
      }
    }

    const code = (data.sourceCode && data.sourceCode.trim() && !nwbdcpWaterSources.some(s => s.sourceCode === data.sourceCode.trim())) 
      ? data.sourceCode.trim() 
      : generateWaterSourceCode(cleanVillage, cleanSourceType);

    const newSource = {
      id: data.id || `SRC_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      sourceCode: code,
      sourceId: code,
      subcenter: cleanSubcenter,
      village: cleanVillage,
      gramPanchayat: data.gramPanchayat ? data.gramPanchayat.trim() : cleanVillage,
      sourceName: cleanSourceName,
      sourceType: cleanSourceType,
      ownership: cleanOwnership,
      status: data.status || "Active",
      location: data.location ? data.location.trim() : "",
      createdDate: new Date().toISOString().slice(0, 10),
      updatedDate: new Date().toISOString().slice(0, 10),
      createdBy: user
    };

    nwbdcpWaterSources.push(newSource);
    addNwbdcpAuditLog('ADD_WATER_SOURCE', `नवीन जलस्त्रोत नोंदवला: ${newSource.sourceName} (${newSource.village}) [ID: ${newSource.sourceCode}]`, user);
    saveNwbdcpDbToDisk();
    syncWaterSourceToSupabase(newSource);
    return { success: true, message: `✅ नवीन जलस्त्रोत '${newSource.sourceName}' [ID: ${newSource.sourceCode}] यशस्वीरित्या नोंदवला गेला!`, source: newSource };
  }
}

export function toggleWaterSourceStatus(sourceId, user = "System") {
  const source = nwbdcpWaterSources.find(s => s.id === sourceId);
  if (!source) {
    return { success: false, message: "जलस्त्रोत सापडला नाही." };
  }

  source.status = (source.status === "Active") ? "Inactive" : "Active";
  source.updatedDate = new Date().toISOString().slice(0, 10);

  addNwbdcpAuditLog('TOGGLE_SOURCE_STATUS', `जलस्त्रोत स्थिती बदलली: ${source.sourceName} -> ${source.status}`, user);
  saveNwbdcpDbToDisk();
  syncWaterSourceToSupabase(source);

  return { 
    success: true, 
    message: `जलस्त्रोत '${source.sourceName}' स्थिती ${source.status === 'Active' ? 'सक्रिय (Active)' : 'अकार्यक्षम (Inactive)'} करण्यात आली.`,
    source 
  };
}

export function deleteWaterSource(sourceId, user = "System") {
  const source = nwbdcpWaterSources.find(s => s.id === sourceId);
  if (!source) {
    return { success: false, message: "जलस्त्रोत सापडला नाही." };
  }

  // Check if historical sample dispatch records exist for this source
  const hasHistory = nwbdcpSampleDispatches.some(d => d.sourceId === sourceId || d.sourceName === source.sourceName || d.sourceCode === source.sourceCode);
  if (hasHistory) {
    return { 
      success: false, 
      hasHistory: true,
      message: "⚠️ या जलस्त्रोताची नोंदणीकृत नमुना हिस्ट्री आहे. त्यामुळे हा स्त्रोत कायमचा हटवता येत नाही. त्याऐवजी स्थिती 'Inactive' (अकार्यक्षम) करा." 
    };
  }

  const index = nwbdcpWaterSources.findIndex(s => s.id === sourceId);
  if (index !== -1) {
    nwbdcpWaterSources.splice(index, 1);
    addNwbdcpAuditLog('DELETE_WATER_SOURCE', `जलस्त्रोत हटवला: ${source.sourceName}`, user);
    saveNwbdcpDbToDisk();
    return { success: true, message: `जलस्त्रोत '${source.sourceName}' हटवण्यात आला.` };
  }

  return { success: false, message: "हटवताना त्रुटी आली." };
}

// Generate Unique Collision-Safe Sample ID
export function generateUniqueSampleId(dispatchDateStr) {
  const cleanDate = (dispatchDateStr || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const prefix = `NWBDCP-${cleanDate}-`;
  
  // Find highest existing sequence for this date
  let maxSeq = 0;
  nwbdcpSampleDispatches.forEach(d => {
    if (d.sampleId && d.sampleId.startsWith(prefix)) {
      const parts = d.sampleId.split('-');
      if (parts.length >= 3) {
        const seq = parseInt(parts[2], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
  });

  const nextSeqStr = String(maxSeq + 1).padStart(4, '0');
  return `${prefix}${nextSeqStr}`;
}

// =========================================================================
// 3. WATER SAMPLE DISPATCH CONTROLLER (MULTI-SELECTION & BATCH DISPATCH)
// =========================================================================
export function dispatchWaterSamples(payload, user = "System") {
  const {
    dispatchDate = new Date().toISOString().slice(0, 10),
    collectionDate,
    selectedSources = [],
    labName = "जिल्हा सार्वजनिक आरोग्य प्रयोगशाळा, धाराशीव",
    dispatchedBy = "वैद्यकीय अधिकारी, प्रा.आ.केंद्र भादा",
    remarks = ""
  } = payload || {};

  // 1. Date Validation
  const cleanDispatchDate = String(dispatchDate || '').trim().slice(0, 10);
  if (!cleanDispatchDate || !/^\d{4}-\d{2}-\d{2}$/.test(cleanDispatchDate)) {
    return { success: false, message: "⚠️ अवैध पाठवणी दिनांक. कृपया योग्य दिनांक निवडा (YYYY-MM-DD)." };
  }

  const dObj = new Date(cleanDispatchDate);
  if (isNaN(dObj.getTime())) {
    return { success: false, message: "⚠️ अवैध पाठवणी दिनांक रचना." };
  }

  // Warning/Restriction on future dates (beyond 30 days ahead)
  const todayStr = new Date().toISOString().slice(0, 10);
  const maxAllowedFuture = new Date();
  maxAllowedFuture.setDate(maxAllowedFuture.getDate() + 30);
  const maxFutureStr = maxAllowedFuture.toISOString().slice(0, 10);
  if (cleanDispatchDate > maxFutureStr) {
    return { success: false, message: `⚠️ पाठवणी दिनांक खूप पुढील (Future) आहे. कृपया कमाल ३० दिवसांपर्यंतचा दिनांक निवडा.` };
  }

  const cleanCollectionDate = collectionDate ? String(collectionDate).trim().slice(0, 10) : cleanDispatchDate;

  // 2. Selected Sources Validation
  if (!Array.isArray(selectedSources) || selectedSources.length === 0) {
    return { success: false, message: "⚠️ कृपया नमुने पाठवण्यासाठी किमान एक नोंदणीकृत जलस्त्रोत निवडा." };
  }

  // 3. Atomic Pre-Validation of all selected sources
  const validatedSources = [];
  const seenSourceIdsInBatch = new Set();

  for (let i = 0; i < selectedSources.length; i++) {
    const srcInput = selectedSources[i];
    const rawId = typeof srcInput === 'string' ? srcInput : (srcInput.id || srcInput.sourceId || srcInput.sourceCode);
    
    // Find master record in Water Source Master
    const masterSource = nwbdcpWaterSources.find(s => 
      s.id === rawId || 
      s.sourceId === rawId || 
      s.sourceCode === rawId ||
      (typeof srcInput === 'object' && s.sourceName === srcInput.sourceName && s.village === srcInput.village)
    );

    if (!masterSource) {
      return { 
        success: false, 
        message: `⚠️ जलस्त्रोत [${rawId || 'Unknown'}] वॉटर सोर्स मास्टरमध्ये नोंदणीकृत नाही. कृपया वॉटर सोर्स मास्टरमधूनच स्त्रोत निवडा.` 
      };
    }

    // Active Source Rule: Disallow inactive sources
    if (masterSource.status !== 'Active') {
      return { 
        success: false, 
        message: `⚠️ जलस्त्रोत '${masterSource.sourceName}' अकार्यक्षम (Inactive) आहे. फक्त सक्रिय (Active) स्त्रोतांचे नमुने पाठवता येतात.` 
      };
    }

    // Check for duplicate selection within the same batch request
    const uniqueKey = masterSource.sourceCode || masterSource.sourceId || masterSource.id;
    if (seenSourceIdsInBatch.has(uniqueKey)) {
      return {
        success: false,
        message: `⚠️ एकाच पाठवणी बॅचमध्ये '${masterSource.sourceName}' हा स्त्रोत एकापेक्षा जास्त वेळा निवडला गेला आहे.`
      };
    }
    seenSourceIdsInBatch.add(uniqueKey);

    // Duplicate Check: Same Source ID + Same Dispatch Date
    const existingDuplicate = nwbdcpSampleDispatches.find(d => 
      ((d.sourceId === masterSource.id || d.sourceCode === masterSource.sourceCode || d.sourceCode === masterSource.sourceId) ||
       (d.sourceName === masterSource.sourceName && d.village === masterSource.village)) &&
      d.dispatchDate === cleanDispatchDate
    );

    if (existingDuplicate) {
      return { 
        success: false, 
        duplicate: true,
        existingSampleId: existingDuplicate.sampleId,
        sourceName: masterSource.sourceName,
        sourceCode: masterSource.sourceCode || masterSource.sourceId,
        dispatchDate: cleanDispatchDate,
        message: `⚠️ या स्रोताचा या दिनांकाचा (${cleanDispatchDate}) नमुना आधीच नोंदविला आहे.\nजलस्त्रोत: ${masterSource.sourceName} [ID: ${masterSource.sourceCode || masterSource.sourceId}]\nविद्यमान नमुना आयडी: ${existingDuplicate.sampleId}` 
      };
    }

    validatedSources.push(masterSource);
  }

  // 4. Batch Creation (All validations passed - Atomic execution)
  const createdRecords = [];
  const nowIso = new Date().toISOString();

  validatedSources.forEach((src) => {
    const sampleId = generateUniqueSampleId(cleanDispatchDate);

    const record = {
      sampleId,
      sourceId: src.id,
      sourceCode: src.sourceCode || src.sourceId || generateWaterSourceCode(src.village, src.sourceType),
      subcenter: src.subcenter || "भादा",
      gramPanchayat: src.gramPanchayat || src.village || "भादा",
      village: src.village || "भादा",
      sourceName: src.sourceName,
      sourceType: src.sourceType || "विहीर",
      ownership: src.ownership || "शासकीय",
      location: src.location || "",
      collectionDate: cleanCollectionDate,
      dispatchDate: cleanDispatchDate,
      labName,
      dispatchedBy,
      remarks,
      status: "अहवाल अप्राप्त", // Initial status (Requirement 10)
      result: "अहवाल अप्राप्त",
      reportReceivedDate: "",
      labRefNo: "",
      labRemarks: "",
      reportFileName: "",
      reportFileUrl: "",
      reportFileType: "",
      reportFileSize: "",
      reportUploadedAt: "",
      createdDate: nowIso,
      createdBy: user,
      history: [{
        action: "DISPATCHED",
        status: "अहवाल अप्राप्त",
        date: cleanDispatchDate,
        by: user,
        notes: "पाणी नमुना नोंदवून प्रयोगशाळेत तपासणीसाठी पाठवण्यात आला."
      }]
    };

    nwbdcpSampleDispatches.push(record);
    createdRecords.push(record);
  });

  const sampleIdsList = createdRecords.map(r => r.sampleId);

  // 5. Audit Logging
  addNwbdcpAuditLog(
    'BATCH_DISPATCH_SAMPLES', 
    `एकूण ${createdRecords.length} पाणी नमुने नोंदविले [${sampleIdsList.join(', ')}] (दिनांक: ${cleanDispatchDate})`, 
    user
  );

  // 6. Persistence to Disk and Supabase
  saveNwbdcpDbToDisk();
  syncBatchSampleDispatchesToSupabase(createdRecords);

  return {
    success: true,
    message: `✅ एकूण ${createdRecords.length} पाणी नमुने यशस्वीरित्या नोंदविण्यात आले.`,
    count: createdRecords.length,
    dispatchDate: cleanDispatchDate,
    sampleIds: sampleIdsList,
    samples: createdRecords
  };
}

export function getDispatchedSamples(filters = {}) {
  let list = [...nwbdcpSampleDispatches];

  if (filters.subcenter && filters.subcenter !== 'ALL') {
    list = list.filter(d => d.subcenter === filters.subcenter);
  }
  if (filters.village && filters.village !== 'ALL') {
    list = list.filter(d => d.village === filters.village);
  }
  if (filters.status && filters.status !== 'ALL') {
    list = list.filter(d => d.status === filters.status || d.result === filters.status);
  }
  if (filters.fromDate) {
    list = list.filter(d => d.dispatchDate >= filters.fromDate);
  }
  if (filters.toDate) {
    list = list.filter(d => d.dispatchDate <= filters.toDate);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    list = list.filter(d => 
      (d.sampleId && d.sampleId.toLowerCase().includes(q)) ||
      (d.sourceName && d.sourceName.toLowerCase().includes(q)) ||
      (d.sourceCode && d.sourceCode.toLowerCase().includes(q)) ||
      (d.village && d.village.toLowerCase().includes(q)) ||
      (d.subcenter && d.subcenter.toLowerCase().includes(q))
    );
  }

  // Universal Helper to parse dates into timestamp numbers for true DESCENDING date sorting
  function parseDateTimestamp(dStr) {
    if (!dStr) return 0;
    const clean = String(dStr).trim();
    if (clean.includes('/')) {
      const parts = clean.split('/');
      if (parts.length === 3) {
        return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`).getTime() || 0;
      }
    }
    return new Date(clean).getTime() || 0;
  }

  // Sort descending by dispatch date (newest first) and secondary sample ID
  list.sort((a, b) => {
    const timeA = parseDateTimestamp(a.dispatchDate);
    const timeB = parseDateTimestamp(b.dispatchDate);
    if (timeB !== timeA) return timeB - timeA;
    return (b.sampleId || '').localeCompare(a.sampleId || '');
  });

  return list;
}

// =========================================================================
// 4. LABORATORY RESULT UPDATE CONTROLLER (WITH MANDATORY REPORT COPY UPLOAD)
// =========================================================================
export async function updateLabResults(payload, user = "System") {
  const {
    sampleIds = [],
    reportReceivedDate = "",
    labResult = "",
    labRefNo = "",
    labRemarks = "",
    reportCopy = null // { reportFileName, reportFileUrl, reportFileType, reportFileSize, reportUploadedAt }
  } = payload || {};

  if (!Array.isArray(sampleIds) || sampleIds.length === 0) {
    return { success: false, message: "⚠️ कृपया निकाल अपडेट करण्यासाठी तक्त्यामध्ये नमुने निवडा." };
  }

  if (!labResult || labResult === 'अहवाल अप्राप्त') {
    return { success: false, message: "⚠️ कृपया प्रयोगशाळा नमुना तपासणी निकाल (पिण्यास योग्य / अयोग्य) निवडा." };
  }

  if (!reportReceivedDate) {
    return { success: false, message: "⚠️ कृपया अहवाल प्राप्ती दिनांक प्रविष्ट करा." };
  }

  if (!labRefNo || !labRefNo.trim()) {
    return { success: false, message: "⚠️ कृपया प्रयोगशाळा अहवाल जावक / संदर्भ क्रमांक (Report Reference Number) प्रविष्ट करा." };
  }

  // Validate that every sample has a report copy file (either newly attached or existing)
  const missingCopySamples = [];
  sampleIds.forEach(sId => {
    const sample = nwbdcpSampleDispatches.find(d => d.sampleId === sId);
    if (sample) {
      const hasNewCopy = reportCopy && reportCopy.reportFileUrl;
      const hasExistingCopy = sample.reportFileUrl || (sample.reportCopy && sample.reportCopy.reportFileUrl);
      if (!hasNewCopy && !hasExistingCopy) {
        missingCopySamples.push(sId);
      }
    }
  });

  if (missingCopySamples.length > 0) {
    return {
      success: false,
      message: "⚠️ प्रयोगशाळा अहवालाची प्रत (Laboratory Report Copy) अपलोड करणे अनिवार्य आहे."
    };
  }

  let updatedCount = 0;

  for (const sId of sampleIds) {
    const sample = nwbdcpSampleDispatches.find(d => d.sampleId === sId);
    if (sample) {
      const cleanDate = reportReceivedDate.slice(0, 10);
      
      // 1. PRIMARY WRITE: Construct & Sync NWBDCP_SampleResults record to Supabase
      const resultRecord = {
        id: `RESULT_${sample.sampleId}`,
        sample_id: sample.sampleId,
        source_id: sample.sourceId || sample.sourceCode,
        result: labResult,
        status: 'RESULT_DECLARED',
        report_received_date: cleanDate,
        lab_ref_no: labRefNo ? labRefNo.trim() : (sample.labRefNo || ''),
        lab_remarks: labRemarks ? labRemarks.trim() : (sample.labRemarks || ''),
        tested_by: user,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (payload.coliformCount !== undefined) resultRecord.coliform_count = payload.coliformCount;
      if (payload.ecoliPresent !== undefined) resultRecord.ecoli_present = payload.ecoliPresent;
      if (payload.chlorinePpm !== undefined) resultRecord.chlorine_ppm = payload.chlorinePpm;
      if (payload.turbidityNtu !== undefined) resultRecord.turbidity_ntu = payload.turbidityNtu;
      if (payload.phValue !== undefined) resultRecord.ph_value = payload.phValue;
      if (payload.tdsPpm !== undefined) resultRecord.tds_ppm = payload.tdsPpm;

      await syncSampleResultToSupabase(resultRecord);

      // Update in-memory nwbdcpSampleResults collection
      const existingResIdx = nwbdcpSampleResults.findIndex(r => r.sample_id === sample.sampleId);
      if (existingResIdx >= 0) {
        nwbdcpSampleResults[existingResIdx] = resultRecord;
      } else {
        nwbdcpSampleResults.push(resultRecord);
      }

      // 2. DENORMALIZED DISPLAY FIELD UPDATE on Dispatched Sample
      sample.reportReceivedDate = cleanDate;
      sample.result = labResult;
      sample.labRefNo = labRefNo ? labRefNo.trim() : sample.labRefNo;
      sample.labRemarks = labRemarks ? labRemarks.trim() : sample.labRemarks;

      // Update report copy file metadata (Stored physically in Google Drive with metadata in Supabase)
      if (reportCopy && (reportCopy.reportFileUrl || reportCopy.googleDriveFileId)) {
        const prevFile = sample.reportFileName || (sample.reportCopy ? sample.reportCopy.reportFileName : '');
        sample.reportFileName = reportCopy.reportFileName;
        sample.reportFileUrl = reportCopy.reportFileUrl;
        sample.reportFileType = reportCopy.reportFileType;
        sample.reportFileSize = reportCopy.reportFileSize;
        sample.googleDriveFileId = reportCopy.googleDriveFileId || sample.googleDriveFileId || '';
        sample.googleDriveUrl = reportCopy.googleDriveUrl || sample.googleDriveUrl || '';
        sample.googleDriveDownloadUrl = reportCopy.googleDriveDownloadUrl || sample.googleDriveDownloadUrl || '';
        sample.reportUploadedAt = reportCopy.reportUploadedAt || new Date().toISOString();
        sample.reportUploadedBy = user;
        sample.reportCopy = {
          ...reportCopy,
          googleDriveFileId: sample.googleDriveFileId,
          googleDriveUrl: sample.googleDriveUrl
        };

        if (prevFile && prevFile !== reportCopy.reportFileName) {
          if (!Array.isArray(sample.reportHistory)) sample.reportHistory = [];
          sample.reportHistory.push({
            previousFile: prevFile,
            newFile: reportCopy.reportFileName,
            oldDriveFileId: sample.googleDriveFileId,
            newDriveFileId: reportCopy.googleDriveFileId || sample.googleDriveFileId,
            changedBy: user,
            changedDateTime: new Date().toISOString()
          });
        }
      }

      // Strict status calculation: Result + Date + LabRefNo + Report Copy File
      if (sample.result && sample.result !== 'अहवाल अप्राप्त' && sample.reportReceivedDate && sample.labRefNo && (sample.reportFileUrl || sample.reportFileName)) {
        sample.status = "अहवाल अपडेट पूर्ण";
      } else {
        sample.status = "अहवाल अपडेट अपूर्ण";
      }

      sample.updatedDate = new Date().toISOString();
      sample.updatedBy = user;

      if (!Array.isArray(sample.history)) sample.history = [];
      sample.history.push({
        action: "RESULT_UPDATED",
        status: sample.status,
        result: labResult,
        date: cleanDate,
        by: user,
        reportFileName: sample.reportFileName,
        reportFileUrl: sample.reportFileUrl,
        notes: `प्रयोगशाळा अहवाल नोंदवला: ${labResult} (जा.क्र. ${sample.labRefNo || '-'}), प्रत फाईल: ${sample.reportFileName}`
      });

      // Sync updated denormalized dispatch display record to NWBDCP_DispatchedSamples
      await syncSampleDispatchToSupabase(sample);

      updatedCount++;
    }
  }

  addNwbdcpAuditLog('UPDATE_LAB_RESULTS', `${updatedCount} नमुन्यांचे प्रयोगशाळा निकाल व प्रत अपलोड सेव्ह झाले (${labResult})`, user);
  saveNwbdcpDbToDisk();

  return {
    success: true,
    message: `✅ ${updatedCount} नमुन्यांचे प्रयोगशाळा निकाल व अहवाल प्रत यशस्वीरित्या जतन झाले! (अहवाल अपडेट पूर्ण)`,
    updatedCount
  };
}

export function replaceNwbdcpReportCopy(payload, user = "System") {
  const { sampleId, reportCopy } = payload || {};
  const sample = nwbdcpSampleDispatches.find(d => d.sampleId === sampleId);

  if (!sample) {
    return { success: false, message: "⚠️ नमुना नोंद सापडली नाही." };
  }

  if (!reportCopy || !reportCopy.reportFileUrl) {
    return { success: false, message: "⚠️ नवीन फाईल अपलोड माहिती उपलब्ध नाही." };
  }

  const previousFile = sample.reportFileName || "";
  const previousDriveId = sample.googleDriveFileId || "";
  sample.reportFileName = reportCopy.reportFileName;
  sample.reportFileUrl = reportCopy.reportFileUrl;
  sample.reportFileType = reportCopy.reportFileType;
  sample.reportFileSize = reportCopy.reportFileSize;
  sample.googleDriveFileId = reportCopy.googleDriveFileId || sample.googleDriveFileId || '';
  sample.googleDriveUrl = reportCopy.googleDriveUrl || sample.googleDriveUrl || '';
  sample.googleDriveDownloadUrl = reportCopy.googleDriveDownloadUrl || sample.googleDriveDownloadUrl || '';
  sample.reportUploadedAt = new Date().toISOString();
  sample.reportUploadedBy = user;
  sample.reportCopy = {
    ...reportCopy,
    googleDriveFileId: sample.googleDriveFileId,
    googleDriveUrl: sample.googleDriveUrl
  };

  if (!Array.isArray(sample.reportHistory)) sample.reportHistory = [];
  sample.reportHistory.push({
    previousFile,
    newFile: reportCopy.reportFileName,
    oldDriveFileId: previousDriveId,
    newDriveFileId: sample.googleDriveFileId,
    changedBy: user,
    changedDateTime: new Date().toISOString()
  });

  if (sample.result && sample.result !== 'अहवाल अप्राप्त' && sample.reportReceivedDate && sample.labRefNo && sample.reportFileUrl) {
    sample.status = "अहवाल अपडेट पूर्ण";
  } else {
    sample.status = "अहवाल अपडेट अपूर्ण";
  }

  addNwbdcpAuditLog('REPLACE_REPORT_COPY', `नमुना ${sampleId} ची अहवाल प्रत बदलेली: ${previousFile} -> ${reportCopy.reportFileName}`, user);
  saveNwbdcpDbToDisk();

  return {
    success: true,
    message: `✅ नमुना ${sampleId} ची प्रयोगशाळा अहवाल प्रत यशस्वीरित्या बदलण्यात आली!`,
    sample
  };
}

// =========================================================================
// 5. CONTAMINATED SAMPLE RE-TEST CONTROLLER
// =========================================================================
export async function createRetestForSample(payload, user = "System") {
  const {
    originalSampleId,
    retestDispatchDate = new Date().toISOString().slice(0, 10),
    retestCollectionDate = new Date().toISOString().slice(0, 10),
    actionTaken = "टीसीएल ब्लिचिंग पावडरद्वारे सुपर क्लोरीनेशन करण्यात आले व गावाला उकळून पाणी पिण्याचा सल्ला दिला.",
    labName = "जिल्हा सार्वजनिक आरोग्य प्रयोगशाळा, धाराशीव",
    remarks = "",
    retestSampleId = null
  } = payload || {};

  const originalSample = nwbdcpSampleDispatches.find(d => d.sampleId === originalSampleId);
  if (!originalSample) {
    return { success: false, message: "मूळ नमुना नोंद सापडली नाही." };
  }

  // Verify that Retest can be initiated ONLY when the original laboratory result is 'पिण्यास अयोग्य'
  if (originalSample.result !== SAMPLE_STATUSES.UNSUITABLE && originalSample.result !== 'पिण्यास अयोग्य') {
    return { success: false, message: "⚠️ फक्त 'पिण्यास अयोग्य' (दूषित) नमुन्यांचीच पुनर्तपासणी करता येते." };
  }

  // Prevent duplicate active retest for the same original sample if one is already pending
  const existingPendingRetest = nwbdcpRetests.find(r => r.originalSampleId === originalSampleId && r.retestResult === SAMPLE_STATUSES.AWAITED);
  if (existingPendingRetest) {
    return { success: false, message: `⚠️ या नमुन्यासाठी आधीच पुनर्तपासणी प्रलंबित आहे (Re-test ID: ${existingPendingRetest.retestId}).` };
  }

  const cleanDate = retestDispatchDate.slice(0, 10).replace(/-/g, '');
  const retestId = `NWBDCP-RETEST-${cleanDate}-${originalSampleId.replace('NWBDCP-', '')}`;

  const retestRecord = {
    retestId,
    originalSampleId: originalSample.sampleId,
    subcenter: originalSample.subcenter,
    gramPanchayat: originalSample.gramPanchayat || originalSample.village,
    village: originalSample.village,
    sourceId: originalSample.sourceId,
    sourceCode: originalSample.sourceCode || originalSample.sourceId,
    sourceName: originalSample.sourceName,
    sourceType: originalSample.sourceType,
    ownership: originalSample.ownership,
    originalResult: originalSample.result || SAMPLE_STATUSES.UNSUITABLE,
    retestSampleId: retestSampleId || null,
    retestCollectionDate: retestCollectionDate.slice(0, 10),
    retestDispatchDate: retestDispatchDate.slice(0, 10),
    actionTaken,
    labName,
    remarks,
    retestResult: SAMPLE_STATUSES.AWAITED, // Initial re-test status
    retestStatus: "पुनर्तपासणी प्रलंबित",
    retestReportReceivedDate: "",
    retestLabRefNo: "",
    retestReportFileName: "",
    retestReportFileUrl: "",
    createdDate: new Date().toISOString(),
    createdBy: user
  };

  // 1. PRIMARY WRITE: Sync Retest record to Supabase public."NWBDCP_Retests"
  await syncRetestToSupabase(retestRecord);

  // Update in-memory retest collection
  const existingIdx = nwbdcpRetests.findIndex(r => r.retestId === retestId);
  if (existingIdx >= 0) {
    nwbdcpRetests[existingIdx] = retestRecord;
  } else {
    nwbdcpRetests.push(retestRecord);
  }

  // 2. STATUS SYNCHRONIZATION on Original Sample (Original Result preserved permanently!)
  originalSample.status = SAMPLE_STATUSES.RETEST_REQUIRED;
  if (!Array.isArray(originalSample.history)) originalSample.history = [];
  originalSample.history.push({
    action: "RETEST_INITIATED",
    status: SAMPLE_STATUSES.RETEST_REQUIRED,
    date: retestDispatchDate.slice(0, 10),
    by: user,
    notes: `पुनर्तपासणी नमुना तयार करण्यात आला (Re-test ID: ${retestId})`
  });

  await syncSampleDispatchToSupabase(originalSample);

  addNwbdcpAuditLog('CREATE_RETEST', `पुनर्तपासणी नमुना तयार केला: ${retestId} (मूळ: ${originalSample.sampleId})`, user);
  saveNwbdcpDbToDisk();

  return {
    success: true,
    message: `✅ दूषित नमुन्यासाठी पुनर्तपासणी नमुना (Re-test ID: ${retestId}) यशस्वीरित्या नोंदवला गेला!`,
    retestRecord
  };
}

export async function updateRetestResult(payload, user = "System") {
  const {
    retestId,
    retestReportReceivedDate = new Date().toISOString().slice(0, 10),
    retestResult = SAMPLE_STATUSES.SUITABLE,
    retestLabRefNo = "",
    labRemarks = "",
    reportCopy = null
  } = payload || {};

  const retest = nwbdcpRetests.find(rt => rt.retestId === retestId);
  if (!retest) {
    return { success: false, message: "पुनर्तपासणी नोंद सापडली नाही." };
  }

  retest.retestReportReceivedDate = retestReportReceivedDate.slice(0, 10);
  retest.retestResult = retestResult;
  retest.retestStatus = "पुनर्तपासणी पूर्ण";
  retest.retestLabRefNo = retestLabRefNo ? retestLabRefNo.trim() : retest.retestLabRefNo;
  retest.labRemarks = labRemarks ? labRemarks.trim() : retest.labRemarks;
  retest.remarks = labRemarks ? labRemarks.trim() : (payload.remarks ? payload.remarks.trim() : retest.remarks);
  if (reportCopy && reportCopy.reportFileUrl) {
    retest.retestReportFileName = reportCopy.reportFileName;
    retest.retestReportFileUrl = reportCopy.reportFileUrl;
  }
  retest.updatedDate = new Date().toISOString();

  // 1. PRIMARY WRITE: Sync updated Retest record to Supabase public."NWBDCP_Retests"
  await syncRetestToSupabase(retest);

  // 2. STATUS SYNCHRONIZATION on Original Sample (Original Result preserved permanently!)
  const original = nwbdcpSampleDispatches.find(d => d.sampleId === retest.originalSampleId);
  if (original) {
    original.status = SAMPLE_STATUSES.RETEST_RECEIVED;
    if (!Array.isArray(original.history)) original.history = [];
    original.history.push({
      action: "RETEST_RESULT_UPDATED",
      status: SAMPLE_STATUSES.RETEST_RECEIVED,
      date: retestReportReceivedDate.slice(0, 10),
      by: user,
      notes: `पुनर्तपासणी निकाल प्राप्त: ${retestResult}`
    });

    await syncSampleDispatchToSupabase(original);
  }

  addNwbdcpAuditLog('UPDATE_RETEST_RESULT', `पुनर्तपासणी निकाल नोंदवला: ${retestId} -> ${retestResult}`, user);
  saveNwbdcpDbToDisk();

  return {
    success: true,
    message: `✅ पुनर्तपासणी निकाल '${retestResult}' सेव्ह झाला!`,
    retest
  };
}

export function getRetestsList(filters = {}) {
  let list = [...nwbdcpRetests];

  if (filters.subcenter && filters.subcenter !== 'ALL') {
    list = list.filter(rt => rt.subcenter === filters.subcenter);
  }
  if (filters.village && filters.village !== 'ALL') {
    list = list.filter(rt => rt.village === filters.village);
  }
  if (filters.retestResult && filters.retestResult !== 'ALL') {
    list = list.filter(rt => rt.retestResult === filters.retestResult);
  }

  list.sort((a, b) => (b.retestDispatchDate || '').localeCompare(a.retestDispatchDate || ''));
  return list;
}

// =========================================================================
// 6. LAST 3 MONTHS SOURCE MONITORING & CURRENT MONTH SAMPLE PLAN
// =========================================================================
export function getOverdueSources(months = 3) {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  const activeSources = nwbdcpWaterSources.filter(s => s.status === 'Active');
  const result = [];

  activeSources.forEach(s => {
    // Find all samples for this source
    const samples = nwbdcpSampleDispatches.filter(d => 
      d.sourceId === s.id || 
      d.sourceCode === s.sourceCode || 
      (d.sourceName === s.sourceName && d.village === s.village)
    );

    if (samples.length === 0) {
      result.push({
        ...s,
        lastSampleDate: "यापूर्वी नमुना पाठविलेला नाही",
        lastSampleId: "--",
        lastResult: "--",
        isNeverSampled: true,
        daysOverdue: 9999
      });
    } else {
      // Find most recent sample date
      samples.sort((a, b) => b.dispatchDate.localeCompare(a.dispatchDate));
      const latest = samples[0];
      if (latest.dispatchDate < cutoffStr) {
        const diffDays = Math.floor((new Date().getTime() - new Date(latest.dispatchDate).getTime()) / (1000 * 3600 * 24));
        result.push({
          ...s,
          lastSampleDate: latest.dispatchDate,
          lastSampleId: latest.sampleId,
          lastResult: latest.result || latest.status,
          isNeverSampled: false,
          daysOverdue: diffDays
        });
      }
    }
  });

  // Sort: Never sampled first, then oldest lastSampleDate
  result.sort((a, b) => {
    if (a.isNeverSampled && !b.isNeverSampled) return -1;
    if (!a.isNeverSampled && b.isNeverSampled) return 1;
    return (a.lastSampleDate || '').localeCompare(b.lastSampleDate || '');
  });

  return result;
}

export function getCurrentMonthSamplePlan() {
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const activeSources = nwbdcpWaterSources.filter(s => s.status === 'Active');
  const overdueList = getOverdueSources(3);
  const overdueSourceIds = new Set(overdueList.map(o => o.id));

  const planSources = [];

  activeSources.forEach(s => {
    const samplesThisMonth = nwbdcpSampleDispatches.filter(d => 
      (d.sourceId === s.id || d.sourceCode === s.sourceCode || (d.sourceName === s.sourceName && d.village === s.village)) &&
      d.dispatchDate.startsWith(currentMonthStr)
    );

    const isSampledThisMonth = samplesThisMonth.length > 0;
    const isOverdue = overdueSourceIds.has(s.id);
    const overdueInfo = overdueList.find(o => o.id === s.id);

    // If not sampled this month, add to plan
    if (!isSampledThisMonth) {
      planSources.push({
        ...s,
        isSampledThisMonth: false,
        isOverdue: isOverdue,
        lastSampleDate: overdueInfo ? overdueInfo.lastSampleDate : (nwbdcpSampleDispatches.filter(d => d.sourceId === s.id || d.sourceCode === s.sourceCode).sort((a,b) => b.dispatchDate.localeCompare(a.dispatchDate))[0]?.dispatchDate || "यापूर्वी नमुना पाठविलेला नाही"),
        priority: isOverdue ? "उच्च (High Priority - 3M Overdue)" : "नियमित (Regular Monthly Plan)"
      });
    }
  });

  // Sort: High priority first, then village
  planSources.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return a.village.localeCompare(b.village);
  });

  return {
    currentMonth: currentMonthStr,
    totalActiveSources: activeSources.length,
    planCount: planSources.length,
    overdueCount: overdueList.length,
    planSources
  };
}

// =========================================================================
// 7. COMPREHENSIVE DYNAMIC REPORTS & DASHBOARD ENGINE (ALL 8 REPORTS)
// =========================================================================
export function generateNwbdcpReports(reportType, options = {}) {
  const {
    subcenter = "ALL",
    village = "ALL",
    sourceType = "ALL",
    ownership = "ALL",
    resultStatus = "ALL",
    search = "",
    month = "ALL",
    year = "2026",
    fromDate = "",
    toDate = ""
  } = options;

  let samples = [...nwbdcpSampleDispatches];

  // Apply Date / Period Filters
  if (fromDate && toDate) {
    samples = samples.filter(s => {
      const d = s.dispatchDate || '';
      return d >= fromDate && d <= toDate;
    });
  } else if (fromDate) {
    samples = samples.filter(s => (s.dispatchDate || '') >= fromDate);
  } else if (toDate) {
    samples = samples.filter(s => (s.dispatchDate || '') <= toDate);
  } else if (month && month !== 'ALL' && year) {
    const monthNumStr = String(month).padStart(2, '0');
    samples = samples.filter(s => (s.dispatchDate || '').startsWith(`${year}-${monthNumStr}`));
  }

  if (subcenter && subcenter !== 'ALL') samples = samples.filter(s => s.subcenter === subcenter);
  if (village && village !== 'ALL') samples = samples.filter(s => s.village === village);
  if (sourceType && sourceType !== 'ALL') samples = samples.filter(s => s.sourceType === sourceType);
  if (ownership && ownership !== 'ALL') samples = samples.filter(s => s.ownership === ownership);
  if (resultStatus && resultStatus !== 'ALL') samples = samples.filter(s => s.result === resultStatus || s.status === resultStatus);
  if (search) {
    const q = search.toLowerCase().trim();
    samples = samples.filter(s => {
      const d = (s.dispatchDate || '').toLowerCase();
      let dDisplay = '';
      if (d.includes('-')) {
        const p = d.split('-');
        if (p.length === 3) dDisplay = `${p[2]}/${p[1]}/${p[0]}`;
      }
      return (
        (s.sampleId && s.sampleId.toLowerCase().includes(q)) ||
        (s.sourceCode && s.sourceCode.toLowerCase().includes(q)) ||
        (s.sourceId && s.sourceId.toLowerCase().includes(q)) ||
        (s.sourceName && s.sourceName.toLowerCase().includes(q)) ||
        (s.village && s.village.toLowerCase().includes(q)) ||
        (s.subcenter && s.subcenter.toLowerCase().includes(q)) ||
        d.includes(q) ||
        (dDisplay && dDisplay.includes(q))
      );
    });
  }

  // Universal Helper to parse dates into timestamp numbers for true DESCENDING date sorting
  function parseDateTimestamp(dStr) {
    if (!dStr) return 0;
    const clean = String(dStr).trim();
    if (clean.includes('/')) {
      const parts = clean.split('/');
      if (parts.length === 3) {
        return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`).getTime() || 0;
      }
    }
    return new Date(clean).getTime() || 0;
  }

  // Sort samples: Primary Dispatch Date DESC (Newest First), Secondary Sample ID ASC
  samples.sort((a, b) => {
    const timeA = parseDateTimestamp(a.dispatchDate);
    const timeB = parseDateTimestamp(b.dispatchDate);
    if (timeB !== timeA) {
      return timeB - timeA; // DESCENDING order (Newest date at top)
    }
    return (a.sampleId || '').localeCompare(b.sampleId || '');
  });

  // Build Date-Grouped Data Structure
  const dateGroupsMap = {};
  samples.forEach(s => {
    const dKey = s.dispatchDate || 'अज्ञात दिनांक';
    if (!dateGroupsMap[dKey]) {
      dateGroupsMap[dKey] = [];
    }
    dateGroupsMap[dKey].push(s);
  });

  const dateGroups = Object.keys(dateGroupsMap).map(dKey => ({
    dispatchDate: dKey,
    timestamp: parseDateTimestamp(dKey),
    count: dateGroupsMap[dKey].length,
    samples: dateGroupsMap[dKey]
  })).sort((a, b) => b.timestamp - a.timestamp); // Date Groups sorted DESCENDING

  // Aggregate Metrics
  const totalSent = samples.length;
  const totalReceived = samples.filter(s => s.result === SAMPLE_STATUSES.SUITABLE || s.result === SAMPLE_STATUSES.UNSUITABLE).length;
  const suitable = samples.filter(s => s.result === SAMPLE_STATUSES.SUITABLE).length;
  const unsuitable = samples.filter(s => s.result === SAMPLE_STATUSES.UNSUITABLE).length;
  const awaited = totalSent - totalReceived;

  // Subcenter Breakdown
  const subcenterBreakdown = {};
  subcenterMaster.forEach(sc => {
    subcenterBreakdown[sc.name] = {
      subcenter: sc.name,
      totalSent: 0,
      totalReceived: 0,
      suitable: 0,
      unsuitable: 0,
      awaited: 0
    };
  });

  // Village Breakdown
  const villageBreakdown = {};
  villagesMaster.forEach(v => {
    villageBreakdown[v.villageName] = {
      village: v.villageName,
      subcenter: v.subcenter,
      totalSent: 0,
      totalReceived: 0,
      suitable: 0,
      unsuitable: 0,
      awaited: 0
    };
  });

  samples.forEach(s => {
    if (subcenterBreakdown[s.subcenter]) {
      const b = subcenterBreakdown[s.subcenter];
      b.totalSent++;
      if (s.result === SAMPLE_STATUSES.SUITABLE) {
        b.totalReceived++;
        b.suitable++;
      } else if (s.result === SAMPLE_STATUSES.UNSUITABLE) {
        b.totalReceived++;
        b.unsuitable++;
      } else {
        b.awaited++;
      }
    }

    if (villageBreakdown[s.village]) {
      const vb = villageBreakdown[s.village];
      vb.totalSent++;
      if (s.result === SAMPLE_STATUSES.SUITABLE) {
        vb.totalReceived++;
        vb.suitable++;
      } else if (s.result === SAMPLE_STATUSES.UNSUITABLE) {
        vb.totalReceived++;
        vb.unsuitable++;
      } else {
        vb.awaited++;
      }
    }
  });

  // Source Type Breakdown
  const sourceTypeBreakdown = {};
  PREDEFINED_SOURCE_TYPES.forEach(st => {
    sourceTypeBreakdown[st] = { sourceType: st, totalSent: 0, suitable: 0, unsuitable: 0, awaited: 0 };
  });
  samples.forEach(s => {
    const stKey = PREDEFINED_SOURCE_TYPES.includes(s.sourceType) ? s.sourceType : "इतर";
    if (!sourceTypeBreakdown[stKey]) {
      sourceTypeBreakdown[stKey] = { sourceType: stKey, totalSent: 0, suitable: 0, unsuitable: 0, awaited: 0 };
    }
    sourceTypeBreakdown[stKey].totalSent++;
    if (s.result === SAMPLE_STATUSES.SUITABLE) sourceTypeBreakdown[stKey].suitable++;
    else if (s.result === SAMPLE_STATUSES.UNSUITABLE) sourceTypeBreakdown[stKey].unsuitable++;
    else sourceTypeBreakdown[stKey].awaited++;
  });

  // Retests breakdown
  const retests = [...nwbdcpRetests];

  return {
    reportType,
    options,
    summary: {
      totalSent,
      totalReceived,
      suitable,
      unsuitable,
      awaited,
      retestCount: retests.length,
      fitnessPercentage: totalReceived > 0 ? ((suitable / totalReceived) * 100).toFixed(1) : 0
    },
    samplesList: samples,
    dateGroups: dateGroups,
    subcenterSummary: Object.values(subcenterBreakdown),
    villageSummary: Object.values(villageBreakdown).filter(v => v.totalSent > 0),
    sourceTypeSummary: Object.values(sourceTypeBreakdown),
    retestsList: retests
  };
}

export function getNwbdcpDashboardData() {
  const totalSources = nwbdcpWaterSources.length;
  const activeSources = nwbdcpWaterSources.filter(s => s.status === 'Active').length;
  const totalDispatches = nwbdcpSampleDispatches.length;
  const suitableCount = nwbdcpSampleDispatches.filter(d => d.result === SAMPLE_STATUSES.SUITABLE).length;
  const unsuitableCount = nwbdcpSampleDispatches.filter(d => d.result === SAMPLE_STATUSES.UNSUITABLE).length;
  const awaitedCount = nwbdcpSampleDispatches.filter(d => !d.result || d.result === SAMPLE_STATUSES.AWAITED || (!d.reportFileUrl && !d.reportFileName)).length;
  const retestsCount = nwbdcpRetests.length;

  const currentMonthPlan = getCurrentMonthSamplePlan();
  const overdueSources = getOverdueSources(3);

  // Subcenter Coverage Map
  const scCoverage = subcenterMaster.map(sc => {
    const scSources = nwbdcpWaterSources.filter(s => s.subcenter === sc.name && s.status === 'Active');
    const scSamples = nwbdcpSampleDispatches.filter(d => d.subcenter === sc.name);
    const scSuitable = scSamples.filter(d => d.result === SAMPLE_STATUSES.SUITABLE).length;
    const scUnsuitable = scSamples.filter(d => d.result === SAMPLE_STATUSES.UNSUITABLE).length;
    const scPending = scSamples.filter(d => !d.result || d.result === SAMPLE_STATUSES.AWAITED).length;

    return {
      name: sc.name,
      sourcesCount: scSources.length,
      samplesCount: scSamples.length,
      suitable: scSuitable,
      unsuitable: scUnsuitable,
      pending: scPending
    };
  });

  return {
    success: true,
    stats: {
      totalSources,
      activeSources,
      totalDispatches,
      suitableCount,
      unsuitableCount,
      awaitedCount,
      retestsCount,
      overdueCount: overdueSources.length,
      currentMonthPlanCount: currentMonthPlan.planCount,
      fitnessPercentage: (suitableCount + unsuitableCount > 0) ? ((suitableCount / (suitableCount + unsuitableCount)) * 100).toFixed(1) : "100.0"
    },
    subcenterCoverage: scCoverage,
    recentDispatches: nwbdcpSampleDispatches.slice(0, 10),
    overdueSources: overdueSources.slice(0, 10),
    currentMonthPlan: currentMonthPlan.planSources.slice(0, 10),
    auditLogs: nwbdcpAuditLogs.slice(-10).reverse()
  };
}

// =========================================================================
// 8. HISTORICAL DATA CONTROLLED IMPORT
// =========================================================================
export function importHistoricalWaterSamples(samplesArray = [], user = "System") {
  if (!Array.isArray(samplesArray) || samplesArray.length === 0) {
    return { success: false, message: "इम्पोर्ट करण्यासाठी कोणताही नमुना डेटा सापडला नाही." };
  }

  const validRecords = [];
  const duplicateRecords = [];
  const invalidRecords = [];

  samplesArray.forEach((item, index) => {
    const rowNum = index + 1;
    const subcenter = item.subcenter || item['उपकेंद्र'] || item['उपकेंद्र (Subcenter)'] || "भादा";
    const village = item.village || item['गाव'] || item['गाव (Village)'] || "भादा";
    const gramPanchayat = item.gramPanchayat || item['ग्रामपंचायत'] || village;
    const sourceName = item.sourceName || item['जलस्त्रोत'] || item['स्त्रोताचे नाव'] || item['जलस्त्रोताचे नाव (Source Name)'] || "";
    const sourceType = item.sourceType || item['स्त्रोत प्रकार'] || item['स्त्रोत प्रकार (Source Type)'] || "विहीर";
    const ownership = item.ownership || item['मालकी'] || item['मालकी (Ownership)'] || "शासकीय";
    const sourceCode = item.sourceCode || item.sourceId || item['स्त्रोत आयडी'] || item['स्त्रोत आयडी (Source ID)'] || generateWaterSourceCode(String(village).trim(), sourceType);
    const dispatchDate = item.dispatchDate || item['दिनांक'] || item['पाठवणी दिनांक'] || item['पाठवणी दिनांक (Dispatch Date)'] || new Date().toISOString().slice(0, 10);
    const collectionDate = item.collectionDate || item['संकलन दिनांक'] || dispatchDate;
    const result = item.result || item['निकाल'] || item['तपासणी निकाल'] || item['तपासणी निकाल (Result)'] || SAMPLE_STATUSES.AWAITED;
    const labName = item.labName || item['प्रयोगशाळा नाव'] || item['प्रयोगशाळा नाव (Lab Name)'] || "जिल्हा सार्वजनिक आरोग्य प्रयोगशाळा, धाराशीव";
    const reportReceivedDate = item.reportReceivedDate || item['अहवाल दिनांक'] || item['अहवाल दिनांक (Report Date)'] || (result !== SAMPLE_STATUSES.AWAITED ? dispatchDate : "");
    const remarks = item.remarks || item['शेरा'] || item['शेरा (Remarks)'] || "जुने ऐतिहासिक पाणी नमुने इम्पोर्ट नोंदी";

    if (!sourceName) {
      invalidRecords.push({ rowNum, item, reason: "जलस्त्रोताचे नाव अनुपस्थित आहे." });
      return;
    }

    // Check duplicate sample ID
    const sampleId = item.sampleId || item['नमुना आयडी'] || item['नमुना आयडी (Sample ID)'] || generateUniqueSampleId(dispatchDate);
    const isDuplicate = nwbdcpSampleDispatches.some(d => d.sampleId === sampleId);

    if (isDuplicate) {
      duplicateRecords.push({ rowNum, sampleId, sourceName, village, reason: "हा नमुना आयडी (Sample ID) सिस्टीममध्ये आधीच अस्तित्वात आहे." });
      return;
    }

    validRecords.push({
      sampleId,
      sourceId: `SRC_HIST_${Date.now()}_${index}`,
      sourceCode: String(sourceCode).trim(),
      subcenter: String(subcenter).trim(),
      gramPanchayat: String(gramPanchayat).trim(),
      village: String(village).trim(),
      sourceName: String(sourceName).trim(),
      sourceType: String(sourceType).trim(),
      ownership: String(ownership).trim(),
      location: item.location || "",
      collectionDate: String(collectionDate).trim(),
      dispatchDate: String(dispatchDate).trim(),
      labName: String(labName).trim(),
      dispatchedBy: item.dispatchedBy || "वैद्यकीय अधिकारी, प्रा.आ.केंद्र भादा",
      remarks: String(remarks).trim(),
      status: result === SAMPLE_STATUSES.SUITABLE || result === SAMPLE_STATUSES.UNSUITABLE ? "अहवाल अपडेट पूर्ण" : "अहवाल अप्राप्त",
      result: result,
      reportReceivedDate: String(reportReceivedDate).trim(),
      labRefNo: item.labRefNo || "HIST_IMPORT",
      labRemarks: item.labRemarks || "",
      createdDate: new Date().toISOString(),
      createdBy: `${user} (CSV/Excel Import)`
    });
  });

  // Commit valid records
  validRecords.forEach(rec => {
    nwbdcpSampleDispatches.push(rec);
  });

  if (validRecords.length > 0) {
    addNwbdcpAuditLog('IMPORT_HISTORICAL_SAMPLES', `${validRecords.length} जुने पाणी नमुने सिस्टीममध्ये यशस्वीरित्या इम्पोर्ट केले.`, user);
    saveNwbdcpDbToDisk();
  }

  return {
    success: validRecords.length > 0,
    importedCount: validRecords.length,
    duplicateCount: duplicateRecords.length,
    invalidCount: invalidRecords.length,
    validRecords,
    duplicateRecords,
    invalidRecords,
    message: `✅ ${validRecords.length} जुने पाणी नमुने यशस्वीरित्या सिस्टीममध्ये सेव्ह झाले! (${duplicateRecords.length} दुबार व ${invalidRecords.length} अवैध नोंदी वगळल्या)`
  };
}
