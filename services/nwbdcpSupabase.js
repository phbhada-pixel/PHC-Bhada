// =========================================================================
// NWBDCP SUPABASE METADATA & DATABASE SERVICE
// Stores ONLY file metadata & Google Drive links (NO binary / base64 in Supabase)
// Provides authoritative database operations & offline sync queue
// Completely isolated from NVBDCP
// =========================================================================
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NWBDCP_FILES_CACHE_FILE = path.join(__dirname, '../data/nwbdcp_files_metadata.json');
const NWBDCP_SYNC_QUEUE_FILE = path.join(__dirname, '../data/nwbdcp_sync_queue.json');

// Supabase configuration from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
// Production server-side backend operations strictly REQUIRE SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const IS_SERVICE_ROLE = Boolean(SUPABASE_SERVICE_ROLE_KEY);

export let supabaseClient = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { 
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log('✅ [NWBDCP] Supabase client initialized with trusted SERVICE-ROLE credentials (RLS bypass enabled).');
  } catch (err) {
    console.warn('⚠️ [NWBDCP] Failed to initialize Supabase service-role client:', err.message);
  }
} else {
  // Fail-Closed: Do NOT initialize with Anon key for backend writes.
  console.warn('⚠️ [NWBDCP Security Policy] SUPABASE_SERVICE_ROLE_KEY not configured. Supabase write operations are safely disabled (Fail-Closed); all transactions will be queued in offline pending mode.');
}

// In-memory collections
export let nwbdcpFilesMetadata = [];
export let nwbdcpFileAuditLogs = [];
export let nwbdcpSyncQueue = [];

// Load local caches
function loadLocalFilesCache() {
  try {
    if (fs.existsSync(NWBDCP_FILES_CACHE_FILE)) {
      const raw = fs.readFileSync(NWBDCP_FILES_CACHE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      nwbdcpFilesMetadata = Array.isArray(data.files) ? data.files : [];
      nwbdcpFileAuditLogs = Array.isArray(data.auditLogs) ? data.auditLogs : [];
    }
    if (fs.existsSync(NWBDCP_SYNC_QUEUE_FILE)) {
      const rawQueue = fs.readFileSync(NWBDCP_SYNC_QUEUE_FILE, 'utf-8');
      const qData = JSON.parse(rawQueue);
      nwbdcpSyncQueue = Array.isArray(qData) ? qData : [];
    }
  } catch (err) {
    console.warn('[NWBDCP] Error reading local metadata/queue cache:', err.message);
  }
}

export function saveLocalFilesCache() {
  try {
    const dir = path.dirname(NWBDCP_FILES_CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(NWBDCP_FILES_CACHE_FILE, JSON.stringify({
      files: nwbdcpFilesMetadata,
      auditLogs: nwbdcpFileAuditLogs,
      lastSaved: new Date().toISOString()
    }, null, 2), 'utf-8');
  } catch (err) {
    console.error('[NWBDCP] Error saving local files metadata cache:', err.message);
  }
}

export function saveSyncQueueToDisk() {
  try {
    const dir = path.dirname(NWBDCP_SYNC_QUEUE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(NWBDCP_SYNC_QUEUE_FILE, JSON.stringify(nwbdcpSyncQueue, null, 2), 'utf-8');
  } catch (err) {
    console.error('[NWBDCP] Error saving sync queue:', err.message);
  }
}

loadLocalFilesCache();

/**
 * Enqueue a durable offline sync operation
 */
export function enqueuePendingSync(entityType, entityId, operation, payload) {
  const queueItem = {
    queue_id: `Q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    entity_type: entityType,
    entity_id: entityId,
    operation,
    payload,
    created_at: new Date().toISOString(),
    retry_count: 0,
    last_attempt_at: null,
    sync_status: 'PENDING', // 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED'
    sync_label: 'सर्व्हरशी समक्रमण प्रलंबित',
    last_error: null
  };

  nwbdcpSyncQueue.push(queueItem);
  saveSyncQueueToDisk();
  return queueItem;
}

/**
 * Process pending sync queue items with retry and backoff
 */
export async function processPendingSyncQueue() {
  if (!supabaseClient || nwbdcpSyncQueue.length === 0) {
    return { processed: 0, remaining: nwbdcpSyncQueue.filter(q => q.sync_status !== 'SYNCED').length };
  }

  const pendingItems = nwbdcpSyncQueue.filter(q => q.sync_status === 'PENDING' || q.sync_status === 'FAILED');
  let successCount = 0;

  for (const item of pendingItems) {
    if (item.retry_count >= 10) {
      item.sync_status = 'FAILED';
      item.last_error = 'Max retry limit reached (10 attempts)';
      continue;
    }

    item.sync_status = 'SYNCING';
    item.retry_count += 1;
    item.last_attempt_at = new Date().toISOString();

    try {
      if (item.entity_type === 'WATER_SOURCE') {
        const { error } = await supabaseClient.from('NWBDCP_WaterSources').upsert([item.payload], { onConflict: 'id' });
        if (error) throw error;
      } else if (item.entity_type === 'SAMPLE_DISPATCH') {
        const { error } = await supabaseClient.from('NWBDCP_DispatchedSamples').upsert([item.payload], { onConflict: 'sample_id' });
        if (error) throw error;
      } else if (item.entity_type === 'BATCH_DISPATCH') {
        const { error } = await supabaseClient.from('NWBDCP_DispatchedSamples').upsert(item.payload, { onConflict: 'sample_id' });
        if (error) throw error;
      } else if (item.entity_type === 'SAMPLE_RESULT') {
        const { error } = await supabaseClient.from('NWBDCP_SampleResults').upsert([item.payload], { onConflict: 'sample_id' });
        if (error) throw error;
      } else if (item.entity_type === 'RETEST') {
        const { error } = await supabaseClient.from('NWBDCP_Retests').upsert([item.payload], { onConflict: 'retest_id' });
        if (error) throw error;
      } else if (item.entity_type === 'FILE_METADATA') {
        const { error } = await supabaseClient.from('nwbdcp_files').upsert([item.payload], { onConflict: 'id' });
        if (error) throw error;
      } else if (item.entity_type === 'AUDIT_LOG') {
        const { error } = await supabaseClient.from('NWBDCP_AuditLogs').insert([item.payload]);
        if (error) throw error;
      }
      
      item.sync_status = 'SYNCED';
      item.sync_label = 'सर्व्हरशी समक्रमित (Synchronized)';
      item.last_error = null;
      successCount++;
    } catch (err) {
      item.sync_status = item.retry_count >= 10 ? 'FAILED' : 'PENDING';
      item.last_error = err.message;
    }
  }

  saveSyncQueueToDisk();
  return { processed: successCount, remaining: nwbdcpSyncQueue.filter(q => q.sync_status !== 'SYNCED').length };
}

export function getSyncQueueSummary() {
  return {
    totalItems: nwbdcpSyncQueue.length,
    pending: nwbdcpSyncQueue.filter(q => q.sync_status === 'PENDING').length,
    syncing: nwbdcpSyncQueue.filter(q => q.sync_status === 'SYNCING').length,
    synced: nwbdcpSyncQueue.filter(q => q.sync_status === 'SYNCED').length,
    failed: nwbdcpSyncQueue.filter(q => q.sync_status === 'FAILED').length,
    items: nwbdcpSyncQueue.slice(-20)
  };
}

/**
 * Save File Metadata in Supabase
 * Schema: nwbdcp_files
 */
export async function saveFileMetadata(meta) {
  const id = meta.id || `FILE_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  // Explicitly ensure NO binary, buffer, or base64 fields are allowed in Supabase record
  delete meta.fileData;
  delete meta.fileBuffer;
  delete meta.data;
  delete meta.blob;
  delete meta.base64;

  const record = {
    id,
    sample_id: String(meta.sampleId || meta.sample_id || '').trim(),
    module: String(meta.module || 'laboratory_reports').trim(),
    file_type: String(meta.fileType || meta.file_type || 'PDF').toUpperCase().trim(),
    file_name: String(meta.fileName || meta.file_name || 'document.pdf').trim(),
    google_drive_file_id: String(meta.googleDriveFileId || meta.google_drive_file_id || '').trim(),
    google_drive_url: String(meta.googleDriveUrl || meta.google_drive_url || '').trim(),
    google_drive_download_url: String(meta.googleDriveDownloadUrl || meta.google_drive_download_url || '').trim(),
    mime_type: String(meta.mimeType || meta.mime_type || 'application/octet-stream').trim(),
    file_size: String(meta.fileSize || meta.file_size || '0 KB').trim(),
    folder_path: String(meta.folderPath || meta.folder_path || 'NWBDCP/LaboratoryReports/').trim(),
    uploaded_at: meta.uploadedAt || meta.uploaded_at || now,
    uploaded_by: String(meta.uploadedBy || meta.uploaded_by || 'System').trim(),
    is_active: meta.isActive !== undefined ? Boolean(meta.isActive) : true,
    created_at: now,
    updated_at: now
  };

  // If this new file is active, deactivate previous active records for the same sample & module
  if (record.is_active) {
    nwbdcpFilesMetadata.forEach(f => {
      if (f.sample_id === record.sample_id && f.module === record.module && f.id !== record.id) {
        f.is_active = false;
        f.updated_at = now;
      }
    });
  }

  // Update in-memory & disk cache
  const existingIdx = nwbdcpFilesMetadata.findIndex(f => f.id === record.id);
  if (existingIdx >= 0) {
    nwbdcpFilesMetadata[existingIdx] = record;
  } else {
    nwbdcpFilesMetadata.push(record);
  }
  saveLocalFilesCache();

  // Persist to Supabase if connected
  if (supabaseClient) {
    try {
      // Check if sample_id exists in NWBDCP_DispatchedSamples to avoid foreign key violation
      let dispatchExists = false;
      if (record.sample_id) {
        const { data: dispatchCheck } = await supabaseClient
          .from('NWBDCP_DispatchedSamples')
          .select('sample_id')
          .eq('sample_id', record.sample_id)
          .maybeSingle();

        if (dispatchCheck && dispatchCheck.sample_id) {
          dispatchExists = true;
        } else {
          // Attempt sync from local dispatches if present
          try {
            const { nwbdcpSampleDispatches } = await import('./nwbdcpStore.js');
            const localDispatch = nwbdcpSampleDispatches.find(d => d.sampleId === record.sample_id || d.id === record.sample_id);
            if (localDispatch) {
              await syncSampleDispatchToSupabase(localDispatch);
              dispatchExists = true;
            }
          } catch (e) {
            // Ignore circular import
          }
        }
      }

      if (dispatchExists) {
        if (record.is_active) {
          await supabaseClient
            .from('nwbdcp_files')
            .update({ is_active: false, updated_at: now })
            .match({ sample_id: record.sample_id, module: record.module });
        }

        const { error } = await supabaseClient
          .from('nwbdcp_files')
          .upsert([record], { onConflict: 'id' });

        if (error) {
          console.log(`[NWBDCP Supabase] Deferring nwbdcp_files sync (FK pending or error: ${error.message})`);
          enqueuePendingSync('FILE_METADATA', record.id, 'UPSERT', record);
        } else {
          console.log(`✅ [NWBDCP Supabase] Metadata saved for file: ${record.file_name}`);
        }
      } else {
        console.log(`[NWBDCP Supabase] Sample ID ${record.sample_id} not found in Supabase dispatches; queued file metadata sync offline.`);
        enqueuePendingSync('FILE_METADATA', record.id, 'UPSERT', record);
      }
    } catch (err) {
      console.log(`[NWBDCP Supabase] Network error writing file metadata to Supabase (queued offline): ${err.message}`);
      enqueuePendingSync('FILE_METADATA', record.id, 'UPSERT', record);
    }
  }

  return record;
}

/**
 * Record File Replacement in Supabase & Audit Log
 */
export async function recordFileReplacement({
  sampleId,
  module = 'laboratory_reports',
  oldDriveFileId,
  newDriveFileId,
  oldFileName,
  newFileName,
  replacementReason = 'प्रयोगशाळा सुधारित अहवाल प्रत अपडेट',
  user = 'System'
}) {
  const auditId = `AUD_FILE_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const auditRecord = {
    id: auditId,
    sample_id: sampleId,
    module,
    old_file_id: oldDriveFileId,
    new_file_id: newDriveFileId,
    old_file_name: oldFileName,
    new_file_name: newFileName,
    uploaded_by: user,
    upload_datetime: now,
    replacement_reason: replacementReason,
    created_at: now
  };

  nwbdcpFileAuditLogs.push(auditRecord);
  saveLocalFilesCache();

  if (supabaseClient) {
    try {
      await supabaseClient
        .from('nwbdcp_file_audit_logs')
        .insert([auditRecord]);
    } catch (err) {
      console.warn('⚠️ [NWBDCP Supabase] Error inserting audit log:', err.message);
    }
  }

  return auditRecord;
}

export function getActiveFileMetadata(sampleId, module = 'laboratory_reports') {
  if (!sampleId) return null;
  const cleanId = String(sampleId).trim();
  return nwbdcpFilesMetadata.find(f => 
    f.sample_id === cleanId && 
    f.module === module && 
    f.is_active === true
  ) || nwbdcpFilesMetadata.find(f => 
    f.sample_id === cleanId && 
    f.is_active === true
  ) || null;
}

export function getSampleFileHistory(sampleId) {
  if (!sampleId) return [];
  const cleanId = String(sampleId).trim();
  return nwbdcpFilesMetadata
    .filter(f => f.sample_id === cleanId)
    .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
}

export function findFileMetadata(fileId) {
  if (!fileId) return null;
  const cleanId = String(fileId).trim();
  return nwbdcpFilesMetadata.find(f => 
    f.id === cleanId || 
    f.google_drive_file_id === cleanId
  ) || null;
}

export function getSupabaseStatus() {
  return {
    connected: Boolean(supabaseClient),
    urlConfigured: Boolean(SUPABASE_URL),
    keyConfigured: Boolean(SUPABASE_SERVICE_ROLE_KEY),
    isServiceRole: IS_SERVICE_ROLE,
    authMode: IS_SERVICE_ROLE ? 'SERVICE_ROLE (Trusted Server Backend)' : 'OFFLINE_PENDING (No Service-Role Key)',
    fileRecordsCount: nwbdcpFilesMetadata.length,
    auditLogsCount: nwbdcpFileAuditLogs.length,
    syncQueuePending: nwbdcpSyncQueue.filter(q => q.sync_status === 'PENDING').length,
    cachePath: NWBDCP_FILES_CACHE_FILE
  };
}

/**
 * Fetch all Water Sources directly from Supabase (NWBDCP_WaterSources)
 */
export async function fetchWaterSourcesFromSupabase() {
  if (!supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient
      .from('NWBDCP_WaterSources')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.warn('⚠️ [NWBDCP Supabase] Error fetching WaterSources from Supabase:', error.message);
      return null;
    }

    if (Array.isArray(data)) {
      return data.map(r => ({
        id: r.id,
        sourceCode: r.source_code || r.source_id,
        sourceId: r.source_id || r.source_code,
        subcenter: r.subcenter || '',
        gramPanchayat: r.gram_panchayat || r.village || '',
        village: r.village || '',
        sourceName: r.source_name || '',
        sourceType: r.source_type || '',
        ownership: r.ownership || 'अज्ञात / Not Specified',
        status: r.status || 'Active',
        location: r.location || '',
        createdDate: r.created_date || r.created_at,
        updatedDate: r.updated_date || r.updated_at,
        createdBy: r.created_by || 'System',
        updatedBy: r.updated_by || 'System'
      }));
    }
    return null;
  } catch (err) {
    console.warn('⚠️ [NWBDCP Supabase] Exception fetching WaterSources:', err.message);
    return null;
  }
}

/**
 * Fetch all Sample Dispatches directly from Supabase (NWBDCP_DispatchedSamples)
 */
export async function fetchSampleDispatchesFromSupabase() {
  if (!supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient
      .from('NWBDCP_DispatchedSamples')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('⚠️ [NWBDCP Supabase] Error fetching DispatchedSamples from Supabase:', error.message);
      return null;
    }

    if (Array.isArray(data)) {
      return data.map(r => ({
        id: r.id || r.sample_id,
        sampleId: r.sample_id,
        sourceId: r.source_id,
        sourceCode: r.source_code || r.source_id,
        subcenter: r.subcenter || '',
        gramPanchayat: r.gram_panchayat || r.village || '',
        village: r.village || '',
        sourceName: r.source_name || '',
        sourceType: r.source_type || '',
        ownership: r.ownership || 'शासकीय',
        location: r.location || '',
        collectionDate: r.collection_date || r.dispatch_date || '',
        dispatchDate: r.dispatch_date || '',
        labName: r.lab_name || 'जिल्हा सार्वजनिक आरोग्य प्रयोगशाळा, धाराशीव',
        dispatchedBy: r.dispatched_by || 'वैद्यकीय अधिकारी, प्रा.आ.केंद्र भादा',
        remarks: r.remarks || '',
        status: r.status || 'अहवाल अप्राप्त',
        result: r.result || 'अहवाल अप्राप्त',
        reportReceivedDate: r.report_received_date || '',
        labRefNo: r.lab_ref_no || '',
        labRemarks: r.lab_remarks || '',
        reportFileName: r.report_file_name || '',
        reportFileUrl: r.report_file_url || '',
        reportFileType: r.report_file_type || '',
        reportFileSize: r.report_file_size || '',
        reportUploadedAt: r.report_uploaded_at || '',
        createdDate: r.created_date || r.created_at,
        createdBy: r.created_by || 'System',
        history: r.history ? (typeof r.history === 'string' ? JSON.parse(r.history) : r.history) : []
      }));
    }
    return null;
  } catch (err) {
    console.warn('⚠️ [NWBDCP Supabase] Exception fetching DispatchedSamples:', err.message);
    return null;
  }
}

/**
 * Primary Write: Save Water Source Master Record to Supabase (NWBDCP_WaterSources)
 */
export async function syncWaterSourceToSupabase(source) {
  if (!source) return { success: false, message: 'Invalid source data' };

  const record = {
    id: source.id,
    source_code: source.sourceCode || source.sourceId,
    source_id: source.sourceId || source.sourceCode,
    subcenter: source.subcenter,
    gram_panchayat: source.gramPanchayat || source.village,
    village: source.village,
    source_name: source.sourceName,
    source_type: source.sourceType,
    ownership: source.ownership || 'अज्ञात / Not Specified',
    status: source.status || 'Active',
    location: source.location || '',
    created_date: source.createdDate || new Date().toISOString().slice(0, 10),
    updated_date: source.updatedDate || new Date().toISOString().slice(0, 10),
    created_by: source.createdBy || 'System',
    updated_by: source.updatedBy || 'System'
  };

  if (!supabaseClient) {
    enqueuePendingSync('WATER_SOURCE', source.id, 'UPSERT', record);
    return { success: false, queued: true, message: 'Offline mode: transaction enqueued in sync queue' };
  }

  try {
    const { error } = await supabaseClient
      .from('NWBDCP_WaterSources')
      .upsert([record], { onConflict: 'id' });
    if (error) throw error;
    return { success: true, record };
  } catch (err) {
    console.warn('⚠️ [NWBDCP Supabase] Error saving Water Source Master to Supabase, enqueued to offline queue:', err.message);
    enqueuePendingSync('WATER_SOURCE', source.id, 'UPSERT', record);
    return { success: false, queued: true, error: err.message };
  }
}

/**
 * Primary Write: Save Sample Dispatch Record to Supabase (NWBDCP_DispatchedSamples)
 */
export async function syncSampleDispatchToSupabase(sample) {
  if (!sample) return { success: false, message: 'Invalid sample data' };

  const record = {
    id: sample.id || sample.sampleId,
    sample_id: sample.sampleId,
    source_id: sample.sourceId || sample.sourceCode,
    source_code: sample.sourceCode || sample.sourceId,
    subcenter: sample.subcenter || '',
    gram_panchayat: sample.gramPanchayat || sample.village || '',
    village: sample.village || '',
    source_name: sample.sourceName || '',
    source_type: sample.sourceType || '',
    ownership: sample.ownership || 'शासकीय',
    location: sample.location || '',
    collection_date: sample.collectionDate || sample.dispatchDate || '',
    dispatch_date: sample.dispatchDate || '',
    lab_name: sample.labName || 'जिल्हा सार्वजनिक आरोग्य प्रयोगशाळा, धाराशीव',
    dispatched_by: sample.dispatchedBy || 'वैद्यकीय अधिकारी, प्रा.आ.केंद्र भादा',
    remarks: sample.remarks || '',
    status: sample.status || 'अहवाल अप्राप्त',
    result: sample.result || 'अहवाल अप्राप्त',
    report_received_date: sample.reportReceivedDate || '',
    lab_ref_no: sample.labRefNo || '',
    lab_remarks: sample.labRemarks || '',
    report_file_name: sample.reportFileName || '',
    report_file_url: sample.reportFileUrl || '',
    report_file_type: sample.reportFileType || '',
    report_file_size: sample.reportFileSize || '',
    report_uploaded_at: sample.reportUploadedAt || '',
    created_date: sample.createdDate || new Date().toISOString(),
    created_by: sample.createdBy || 'System',
    history: sample.history || []
  };

  if (!supabaseClient) {
    enqueuePendingSync('SAMPLE_DISPATCH', sample.sampleId, 'UPSERT', record);
    return { success: false, queued: true, message: 'Offline mode: transaction enqueued in sync queue' };
  }

  try {
    const { error } = await supabaseClient
      .from('NWBDCP_DispatchedSamples')
      .upsert([record], { onConflict: 'sample_id' });
    if (error) throw error;
    return { success: true, record };
  } catch (err) {
    console.warn('⚠️ [NWBDCP Supabase] Error saving Sample Dispatch to Supabase, enqueued to offline queue:', err.message);
    enqueuePendingSync('SAMPLE_DISPATCH', sample.sampleId, 'UPSERT', record);
    return { success: false, queued: true, error: err.message };
  }
}

export async function syncBatchSampleDispatchesToSupabase(samples = []) {
  if (!Array.isArray(samples) || samples.length === 0) return { success: true, count: 0 };

  const records = samples.map(s => ({
    id: s.id || s.sampleId,
    sample_id: s.sampleId,
    source_id: s.sourceId || s.sourceCode,
    source_code: s.sourceCode || s.sourceId,
    subcenter: s.subcenter || '',
    gram_panchayat: s.gramPanchayat || s.village || '',
    village: s.village || '',
    source_name: s.sourceName || '',
    source_type: s.sourceType || '',
    ownership: s.ownership || 'शासकीय',
    location: s.location || '',
    collection_date: s.collectionDate || s.dispatchDate || '',
    dispatch_date: s.dispatchDate || '',
    lab_name: s.labName || 'जिल्हा सार्वजनिक आरोग्य प्रयोगशाळा, धाराशीव',
    dispatched_by: s.dispatchedBy || 'वैद्यकीय अधिकारी, प्रा.आ.केंद्र भादा',
    remarks: s.remarks || '',
    status: s.status || 'अहवाल अप्राप्त',
    result: s.result || 'अहवाल अप्राप्त',
    report_received_date: s.reportReceivedDate || '',
    lab_ref_no: s.labRefNo || '',
    lab_remarks: s.labRemarks || '',
    report_file_name: s.reportFileName || '',
    report_file_url: s.reportFileUrl || '',
    report_file_type: s.reportFileType || '',
    report_file_size: s.reportFileSize || '',
    report_uploaded_at: s.reportUploadedAt || '',
    created_date: s.createdDate || new Date().toISOString(),
    created_by: s.createdBy || 'System',
    history: s.history || []
  }));

  if (!supabaseClient) {
    enqueuePendingSync('BATCH_DISPATCH', `BATCH_${Date.now()}`, 'UPSERT', records);
    return { success: false, queued: true, message: 'Offline mode: batch transaction enqueued in sync queue' };
  }

  try {
    const { error } = await supabaseClient
      .from('NWBDCP_DispatchedSamples')
      .upsert(records, { onConflict: 'sample_id' });
    if (error) throw error;
    return { success: true, count: records.length };
  } catch (err) {
    console.warn('⚠️ [NWBDCP Supabase] Error saving batch sample dispatches to Supabase, enqueued to offline queue:', err.message);
    enqueuePendingSync('BATCH_DISPATCH', `BATCH_${Date.now()}`, 'UPSERT', records);
    return { success: false, queued: true, error: err.message };
  }
}

/**
 * Fetch Sample Results from Supabase (PRIMARY Read)
 */
export async function fetchSampleResultsFromSupabase() {
  if (!supabaseClient) {
    throw new Error('Supabase client unavailable');
  }

  const { data, error } = await supabaseClient
    .from('NWBDCP_SampleResults')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching NWBDCP Sample Results from Supabase:', error);
    throw error;
  }

  return data || [];
}

/**
 * Sync Sample Result Record to Supabase (PRIMARY Write)
 * Table: public."NWBDCP_SampleResults"
 */
export async function syncSampleResultToSupabase(resultRecord) {
  if (!resultRecord || !resultRecord.sample_id) {
    return { success: false, message: 'Invalid sample result record' };
  }

  const record = {
    id: resultRecord.id || `RESULT_${resultRecord.sample_id}`,
    sample_id: String(resultRecord.sample_id).trim(),
    source_id: String(resultRecord.source_id || '').trim(),
    result: String(resultRecord.result || '').trim(),
    status: String(resultRecord.status || 'RESULT_DECLARED').trim(),
    report_received_date: resultRecord.report_received_date || '',
    lab_ref_no: String(resultRecord.lab_ref_no || '').trim(),
    lab_remarks: String(resultRecord.lab_remarks || '').trim(),
    tested_by: String(resultRecord.tested_by || 'System').trim(),
    created_at: resultRecord.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (resultRecord.coliform_count !== undefined) record.coliform_count = resultRecord.coliform_count;
  if (resultRecord.ecoli_present !== undefined) record.ecoli_present = resultRecord.ecoli_present;
  if (resultRecord.chlorine_ppm !== undefined) record.chlorine_ppm = resultRecord.chlorine_ppm;
  if (resultRecord.turbidity_ntu !== undefined) record.turbidity_ntu = resultRecord.turbidity_ntu;
  if (resultRecord.ph_value !== undefined) record.ph_value = resultRecord.ph_value;
  if (resultRecord.tds_ppm !== undefined) record.tds_ppm = resultRecord.tds_ppm;

  if (!supabaseClient) {
    enqueuePendingSync('SAMPLE_RESULT', record.sample_id, 'UPSERT', record);
    return { success: false, queued: true, message: 'Offline mode: transaction enqueued in sync queue' };
  }

  try {
    const { error } = await supabaseClient
      .from('NWBDCP_SampleResults')
      .upsert([record], { onConflict: 'sample_id' });

    if (error) throw error;
    return { success: true, record };
  } catch (err) {
    console.warn('⚠️ [NWBDCP Supabase] Error saving Sample Result to Supabase, enqueued to offline queue:', err.message);
    enqueuePendingSync('SAMPLE_RESULT', record.sample_id, 'UPSERT', record);
    return { success: false, queued: true, error: err.message };
  }
}

/**
 * Fetch Retests from Supabase (PRIMARY Read)
 */
export async function fetchRetestsFromSupabase() {
  if (!supabaseClient) {
    throw new Error('Supabase client unavailable');
  }

  const { data, error } = await supabaseClient
    .from('NWBDCP_Retests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching NWBDCP Retests from Supabase:', error);
    throw error;
  }

  return data || [];
}

/**
 * Sync Retest Record to Supabase (PRIMARY Write)
 * Table: public."NWBDCP_Retests"
 */
export async function syncRetestToSupabase(retestRecord) {
  if (!retestRecord || !retestRecord.retestId) {
    return { success: false, message: 'Invalid retest record' };
  }

  const record = {
    id: retestRecord.id || `RETEST_${retestRecord.retestId}`,
    retest_id: String(retestRecord.retestId).trim(),
    original_sample_id: String(retestRecord.originalSampleId || retestRecord.original_sample_id || '').trim(),
    source_id: String(retestRecord.sourceId || retestRecord.source_id || '').trim(),
    retest_sample_id: retestRecord.retestSampleId || retestRecord.retest_sample_id || null,
    retest_date: retestRecord.retestDispatchDate || retestRecord.retestCollectionDate || retestRecord.retest_date || new Date().toISOString().slice(0, 10),
    retest_collection_date: retestRecord.retestCollectionDate || retestRecord.retest_collection_date || '',
    retest_dispatch_date: retestRecord.retestDispatchDate || retestRecord.retest_dispatch_date || '',
    lab_name: String(retestRecord.labName || retestRecord.lab_name || '').trim(),
    remarks: String(retestRecord.remarks || '').trim(),
    retest_result: String(retestRecord.retestResult || retestRecord.retest_result || 'अहवाल अप्राप्त').trim(),
    retest_status: String(retestRecord.retestStatus || retestRecord.retest_status || 'पुनर्तपासणी प्रलंबित').trim(),
    retest_report_received_date: retestRecord.retestReportReceivedDate || retestRecord.retest_report_received_date || '',
    retest_lab_ref_no: String(retestRecord.retestLabRefNo || retestRecord.retest_lab_ref_no || '').trim(),
    retest_report_file_name: String(retestRecord.retestReportFileName || retestRecord.retest_report_file_name || '').trim(),
    retest_report_file_url: String(retestRecord.retestReportFileUrl || retestRecord.retest_report_file_url || '').trim(),
    corrective_action: String(retestRecord.actionTaken || retestRecord.corrective_action || '').trim(),
    created_by: String(retestRecord.createdBy || retestRecord.created_by || 'System').trim(),
    created_at: retestRecord.createdDate || retestRecord.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (!supabaseClient) {
    enqueuePendingSync('RETEST', record.retest_id, 'UPSERT', record);
    return { success: false, queued: true, message: 'Offline mode: transaction enqueued in sync queue' };
  }

  try {
    const { error } = await supabaseClient
      .from('NWBDCP_Retests')
      .upsert([record], { onConflict: 'retest_id' });

    if (error) {
      if (error.message && error.message.includes('schema cache')) {
        const baseRecord = {
          id: record.id,
          retest_id: record.retest_id,
          original_sample_id: record.original_sample_id,
          source_id: record.source_id,
          retest_sample_id: record.retest_sample_id,
          retest_date: record.retest_date,
          retest_result: record.retest_result,
          retest_status: record.retest_status,
          corrective_action: record.corrective_action,
          created_by: record.created_by,
          created_at: record.created_at,
          updated_at: record.updated_at
        };
        const { error: fallbackErr } = await supabaseClient
          .from('NWBDCP_Retests')
          .upsert([baseRecord], { onConflict: 'retest_id' });

        if (!fallbackErr) {
          enqueuePendingSync('RETEST', record.retest_id, 'UPSERT', record);
          return { success: true, record: baseRecord, queuedFullRecord: true };
        }
      }
      throw error;
    }
    return { success: true, record };
  } catch (err) {
    console.warn('⚠️ [NWBDCP Supabase] Error saving Retest to Supabase, enqueued to offline queue:', err.message);
    enqueuePendingSync('RETEST', record.retest_id, 'UPSERT', record);
    return { success: false, queued: true, error: err.message };
  }
}

/**
 * Fetch Audit Logs from Supabase (PRIMARY Read)
 * Table: public."NWBDCP_AuditLogs"
 */
export async function fetchAuditLogsFromSupabase() {
  if (!supabaseClient) {
    throw new Error('Supabase client unavailable');
  }

  const { data, error } = await supabaseClient
    .from('NWBDCP_AuditLogs')
    .select('*')
    .order('timestamp', { ascending: true });

  if (error) {
    console.error('Error fetching NWBDCP Audit Logs from Supabase:', error);
    throw error;
  }

  return (data || []).map(log => ({
    id: log.id,
    action: log.action,
    details: log.details,
    user: log.user_name || log.user || 'System',
    timestamp: log.timestamp || log.created_at
  }));
}

/**
 * Sync Audit Log Record to Supabase (PRIMARY Write)
 * Table: public."NWBDCP_AuditLogs"
 */
export async function syncAuditLogToSupabase(logEntry) {
  if (!logEntry || !logEntry.id) {
    return { success: false, message: 'Invalid audit log entry' };
  }

  const record = {
    id: String(logEntry.id).trim(),
    action: String(logEntry.action || '').trim(),
    details: String(logEntry.details || '').trim(),
    user_name: String(logEntry.user || logEntry.user_name || 'System').trim(),
    timestamp: logEntry.timestamp || new Date().toISOString()
  };

  if (!supabaseClient) {
    enqueuePendingSync('AUDIT_LOG', record.id, 'INSERT', record);
    return { success: false, queued: true, message: 'Offline mode: transaction enqueued in sync queue' };
  }

  try {
    const { error } = await supabaseClient
      .from('NWBDCP_AuditLogs')
      .upsert([record], { onConflict: 'id' });

    if (error) {
      throw error;
    }
    return { success: true, record };
  } catch (err) {
    console.warn('⚠️ [NWBDCP Supabase] Error saving Audit Log to Supabase, enqueued to offline queue:', err.message);
    enqueuePendingSync('AUDIT_LOG', record.id, 'INSERT', record);
    return { success: false, queued: true, error: err.message };
  }
}
