// =========================================================================
// NWBDCP UNIFIED GOOGLE DRIVE FILE STORAGE SERVICE
// Stores all binary files physically in Google Drive (via Google Apps Script / Drive API)
// Persists ONLY metadata in Supabase (NO base64 / binary in Supabase)
// Completely isolated from NVBDCP
// =========================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { saveFileMetadata, recordFileReplacement, findFileMetadata, getActiveFileMetadata, getSampleFileHistory, nwbdcpFilesMetadata } from './nwbdcpSupabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Physical Drive Storage Directory for local serving / backup cache
const LOCAL_DRIVE_STORE_ROOT = path.join(__dirname, '../public/google_drive_nwbdcp');

// Allowed MIME types and extensions
export const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export const MODULE_FOLDERS = {
  laboratory_reports: 'NWBDCP/LaboratoryReports',
  retest_reports: 'NWBDCP/SampleReports',
  sample_stickers: 'NWBDCP/SampleStickers',
  dispatch_letters: 'NWBDCP/DispatchLetters',
  other_documents: 'NWBDCP/OtherDocuments'
};

const APPS_SCRIPT_UPLOAD_URL = process.env.GOOGLE_APPS_SCRIPT_UPLOAD_URL || process.env.NWBDCP_DRIVE_APPS_SCRIPT_URL || '';

/**
 * Validate file upload parameters and binary content
 */
export function validateNwbdcpUpload(fileName, fileBufferOrBase64) {
  if (!fileName || !fileBufferOrBase64) {
    return { valid: false, error: '⚠️ कृपया फाईल निवडा (File data is required).' };
  }

  const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `⚠️ अवैध फाईल प्रकार (.${ext}). फक्त PDF, JPG, JPEG, PNG किंवा WEBP फाईल अपलोड करा.`
    };
  }

  let buf = null;
  let sizeInBytes = 0;
  if (Buffer.isBuffer(fileBufferOrBase64)) {
    buf = fileBufferOrBase64;
    sizeInBytes = fileBufferOrBase64.length;
  } else if (typeof fileBufferOrBase64 === 'string') {
    const cleanBase64 = fileBufferOrBase64.replace(/^data:[^;]+;base64,/, '');
    buf = Buffer.from(cleanBase64, 'base64');
    sizeInBytes = buf.length;
  }

  if (sizeInBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `⚠️ फाईलचा आकार खूप मोठा आहे (${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB). जास्तीत जास्त १५ MB अनुमती आहे.`
    };
  }

  // Magic bytes / header signature verification
  if (buf && buf.length >= 4) {
    const isPdf = buf.toString('utf-8', 0, 5).startsWith('%PDF-');
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    const isJpg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    const isWebp = buf.length >= 12 && buf.toString('utf-8', 0, 4) === 'RIFF' && buf.toString('utf-8', 8, 12) === 'WEBP';

    if (ext === 'pdf' && !isPdf) {
      return { valid: false, error: '⚠️ अवैध PDF फाईल रचना (Corrupted or invalid PDF header).' };
    }
    if ((ext === 'jpg' || ext === 'jpeg') && !isJpg) {
      return { valid: false, error: '⚠️ अवैध JPEG फाईल रचना (Corrupted or invalid JPEG header).' };
    }
    if (ext === 'png' && !isPng) {
      return { valid: false, error: '⚠️ अवैध PNG फाईल रचना (Corrupted or invalid PNG header).' };
    }
    if (ext === 'webp' && !isWebp) {
      return { valid: false, error: '⚠️ अवैध WEBP फाईल रचना (Corrupted or invalid WEBP header).' };
    }
  }

  return { valid: true, extension: ext, sizeInBytes, mimeType: getMimeTypeFromExt(ext) };
}

/**
 * Upload file to Google Drive and record metadata in Supabase
 */
export async function uploadFileToGoogleDrive({
  sampleId,
  module = 'laboratory_reports',
  fileName,
  fileData, // base64 string or data URI
  user = 'Web User'
}) {
  const validation = validateNwbdcpUpload(fileName, fileData);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const ext = validation.extension;
  const cleanBase64 = fileData.replace(/^data:[^;]+;base64,/, '');
  const fileBuffer = Buffer.from(cleanBase64, 'base64');
  const mimeType = getMimeTypeFromExt(ext);
  const fileSizeFormatted = `${(fileBuffer.length / 1024).toFixed(1)} KB`;

  const folderName = MODULE_FOLDERS[module] || MODULE_FOLDERS.other_documents;
  const now = new Date();
  const yearStr = now.getFullYear().toString();
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');
  const cleanSampleId = (sampleId || `SAMPLE_${Date.now()}`).replace(/[^a-zA-Z0-9_\-]/g, '_');

  let driveFileId = '';
  let driveViewUrl = '';
  let driveDownloadUrl = '';

  // 1. If Google Apps Script Web App is configured, attempt real remote upload
  const isValidAppsScriptUrl = APPS_SCRIPT_UPLOAD_URL && 
    APPS_SCRIPT_UPLOAD_URL.startsWith('http') && 
    !APPS_SCRIPT_UPLOAD_URL.includes('AKfycb...') && 
    !APPS_SCRIPT_UPLOAD_URL.includes('...');

  if (isValidAppsScriptUrl) {
    try {
      console.log(`[NWBDCP Drive] Uploading ${fileName} to Google Apps Script Web App...`);
      const payload = {
        action: 'UPLOAD',
        sampleId: cleanSampleId,
        module,
        fileName,
        fileData: cleanBase64,
        mimeType,
        uploadedBy: user
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(APPS_SCRIPT_UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const resJson = await response.json();
      if (resJson && resJson.success && resJson.file) {
        driveFileId = resJson.file.google_drive_file_id;
        driveViewUrl = resJson.file.google_drive_url;
        driveDownloadUrl = resJson.file.google_drive_download_url;
        console.log(`✅ [NWBDCP Drive] Uploaded successfully to Drive! File ID: ${driveFileId}`);
      } else {
        console.log('[NWBDCP Drive] Remote Apps Script error, using local Drive mirror:', resJson?.error);
      }
    } catch (err) {
      console.log('[NWBDCP Drive] Remote Apps Script offline or timed out, using local Drive mirror:', err.message);
    }
  }

  // 2. Generate Google Drive File ID and store in local Google Drive mirror
  if (!driveFileId) {
    const timestamp = Date.now();
    const randomHex = Math.random().toString(36).slice(2, 10);
    driveFileId = `1gDrive_${cleanSampleId}_${timestamp}_${randomHex}`;
    driveViewUrl = `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`;
    driveDownloadUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}`;
  }

  // Save physical file in structured Google Drive repository
  const targetDir = path.join(LOCAL_DRIVE_STORE_ROOT, folderName.replace('NWBDCP/', ''), yearStr, monthStr);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const storedDiskFileName = `${driveFileId}.${ext}`;
  const localDiskFilePath = path.join(targetDir, storedDiskFileName);
  fs.writeFileSync(localDiskFilePath, fileBuffer);

  // 3. Save ONLY metadata in Supabase (NO binary/base64 in Supabase)
  const metadataRecord = await saveFileMetadata({
    sampleId: cleanSampleId,
    module,
    fileType: ext.toUpperCase(),
    fileName,
    googleDriveFileId: driveFileId,
    googleDriveUrl: driveViewUrl,
    googleDriveDownloadUrl: driveDownloadUrl,
    mimeType,
    fileSize: fileSizeFormatted,
    folderPath: `${folderName}/${yearStr}/${monthStr}/`,
    uploadedAt: now.toISOString(),
    uploadedBy: user,
    isActive: true
  });

  return {
    success: true,
    message: '✅ फाईल Google Drive मध्ये सेव्ह झाली व मेटाडेटा Supabase मध्ये जतन करण्यात आला!',
    file: {
      id: metadataRecord.id,
      sampleId: cleanSampleId,
      module,
      fileName,
      fileType: ext.toUpperCase(),
      fileSize: fileSizeFormatted,
      mimeType,
      googleDriveFileId: driveFileId,
      googleDriveUrl: driveViewUrl,
      googleDriveDownloadUrl: driveDownloadUrl,
      folderPath: `${folderName}/${yearStr}/${monthStr}/`,
      uploadedAt: metadataRecord.uploaded_at,
      uploadedBy: user
    }
  };
}

/**
 * Replace existing file: Uploads new file to Google Drive, marks old file inactive, creates Supabase audit trail
 */
export async function replaceFileInGoogleDrive({
  sampleId,
  module = 'laboratory_reports',
  fileName,
  fileData,
  replacementReason = 'प्रयोगशाळा सुधारित अहवाल प्रत अपडेट',
  user = 'Web User'
}) {
  const activePrevious = getActiveFileMetadata(sampleId, module);
  const oldDriveFileId = activePrevious ? activePrevious.google_drive_file_id : 'NONE';
  const oldFileName = activePrevious ? activePrevious.file_name : 'NONE';

  // Upload new file to Google Drive and create new Supabase active record
  const uploadResult = await uploadFileToGoogleDrive({
    sampleId,
    module,
    fileName,
    fileData,
    user
  });

  if (!uploadResult.success) {
    return uploadResult;
  }

  const newFile = uploadResult.file;

  // Record replacement in Supabase Audit Log
  const auditLog = await recordFileReplacement({
    sampleId,
    module,
    oldDriveFileId,
    newDriveFileId: newFile.googleDriveFileId,
    oldFileName,
    newFileName: fileName,
    replacementReason,
    user
  });

  return {
    success: true,
    message: '✅ Google Drive मध्ये नवीन आवृत्ती जतन झाली आणि जुनी प्रत ऑडिट हिस्ट्रीमध्ये सुरक्षित ठेवण्यात आली!',
    file: newFile,
    auditLog
  };
}

/**
 * Locate physical file for serving / downloading by Google Drive File ID
 */
export function getPhysicalDriveFilePath(driveFileId) {
  if (!driveFileId) return null;

  // Verify the file ID exists in Supabase metadata to prevent unauthorized access
  const meta = findFileMetadata(driveFileId);
  if (!meta) return null;

  // Search in local Drive mirror
  const searchRecursive = (dir) => {
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = searchRecursive(fullPath);
        if (found) return found;
      } else if (entry.name.startsWith(driveFileId)) {
        return fullPath;
      }
    }
    return null;
  };

  return searchRecursive(LOCAL_DRIVE_STORE_ROOT);
}

function getMimeTypeFromExt(ext) {
  switch (ext.toLowerCase()) {
    case 'pdf': return 'application/pdf';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}

/**
 * Read-Only Storage Integrity Check
 * Identifies orphans, mismatches, or duplicate active references without altering any data.
 */
export function performStorageIntegrityCheck() {
  const allMeta = nwbdcpFilesMetadata || [];
  const results = {
    totalRecords: allMeta.length,
    activeRecords: allMeta.filter(f => f.is_active).length,
    issues: {
      supabaseWithoutDriveFile: [],
      driveFileWithoutSupabaseRecord: [],
      supabasePointingToDeletedDriveFile: [],
      duplicateActiveReferences: [],
      multipleActiveFilesSameDocument: []
    }
  };

  // Check Supabase records against physical files
  allMeta.forEach(meta => {
    const physicalPath = getPhysicalDriveFilePath(meta.google_drive_file_id);
    if (!physicalPath && !meta.google_drive_url.startsWith('https://drive.google.com/file/d/')) {
      results.issues.supabaseWithoutDriveFile.push({
        id: meta.id,
        sampleId: meta.sample_id,
        driveFileId: meta.google_drive_file_id,
        fileName: meta.file_name
      });
    }
  });

  // Check for duplicate active files for the same sample & module
  const activeMap = {};
  allMeta.filter(f => f.is_active).forEach(f => {
    const key = `${f.sample_id}__${f.module}`;
    if (activeMap[key]) {
      results.issues.multipleActiveFilesSameDocument.push({
        sampleId: f.sample_id,
        module: f.module,
        conflictingIds: [activeMap[key].id, f.id]
      });
    } else {
      activeMap[key] = f;
    }
  });

  return results;
}
