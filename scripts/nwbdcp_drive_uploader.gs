/**
 * =========================================================================
 * NWBDCP GOOGLE DRIVE UPLOAD & SERVE APPS SCRIPT
 * Primary Health Centre Bhada (PHC Bhada)
 * 
 * Deployment Instructions:
 * 1. Open https://script.google.com and create a new project named "NWBDCP_Drive_Storage".
 * 2. Paste this code into Code.gs.
 * 3. Deploy as Web App:
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone" (or "Anyone with Google Account")
 * 4. Copy the Web App URL and set it as GOOGLE_APPS_SCRIPT_UPLOAD_URL in .env
 * =========================================================================
 */

const NWBDCP_ROOT_FOLDER_NAME = "NWBDCP";

const SUBFOLDERS = {
  laboratory_reports: "LaboratoryReports",
  retest_reports: "SampleReports",
  sample_stickers: "SampleStickers",
  dispatch_letters: "DispatchLetters",
  other_documents: "OtherDocuments"
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || "UPLOAD";

    if (action === "UPLOAD" || action === "REPLACE") {
      return handleFileUpload(data);
    }

    return responseJson({ success: false, error: "Invalid action requested." });
  } catch (err) {
    return responseJson({ success: false, error: err.toString() });
  }
}

function doGet(e) {
  try {
    const fileId = e.parameter.fileId;
    const action = e.parameter.action || "SERVE";

    if (action === "PING") {
      return responseJson({ success: true, message: "NWBDCP Google Drive Storage API is online." });
    }

    if (action === "SERVE" && fileId) {
      const file = DriveApp.getFileById(fileId);
      const mimeType = file.getMimeType();
      const bytes = file.getBlob().getBytes();
      return ContentService.createTextOutput(Utilities.base64Encode(bytes))
        .setMimeType(ContentService.MimeType.TEXT);
    }

    return responseJson({ success: false, error: "File ID required." });
  } catch (err) {
    return responseJson({ success: false, error: err.toString() });
  }
}

function handleFileUpload(data) {
  const {
    sampleId,
    module = "laboratory_reports",
    fileName,
    fileData, // base64 string
    mimeType,
    uploadedBy = "PHC Bhada User"
  } = data;

  if (!fileData || !fileName) {
    return responseJson({ success: false, error: "Missing file data or file name." });
  }

  // 1. Get or Create Root Folder
  const rootFolder = getOrCreateFolder(DriveApp.getRootFolder(), NWBDCP_ROOT_FOLDER_NAME);

  // 2. Get or Create Module Subfolder
  const subfolderName = SUBFOLDERS[module] || "OtherDocuments";
  const moduleFolder = getOrCreateFolder(rootFolder, subfolderName);

  // 3. Optional Year/Month subfolder
  const now = new Date();
  const yearStr = now.getFullYear().toString();
  const monthStr = Utilities.formatDate(now, "Asia/Kolkata", "MM");
  const yearFolder = getOrCreateFolder(moduleFolder, yearStr);
  const targetFolder = getOrCreateFolder(yearFolder, monthStr);

  // 4. Decode base64 and create file
  const cleanBase64 = fileData.replace(/^data:[^;]+;base64,/, "");
  const decodedBytes = Utilities.base64Decode(cleanBase64);
  const blob = Utilities.newBlob(decodedBytes, mimeType || "application/octet-stream", fileName);

  const file = targetFolder.createFile(blob);
  
  // Set file description / metadata
  file.setDescription(`NWBDCP Sample ID: ${sampleId} | Module: ${module} | Uploaded by: ${uploadedBy} | Date: ${now.toISOString()}`);

  const fileId = file.getId();
  const webViewLink = file.getUrl();
  const downloadUrl = file.getDownloadUrl ? file.getDownloadUrl() : `https://drive.google.com/uc?export=download&id=${fileId}`;

  return responseJson({
    success: true,
    message: "File successfully uploaded to Google Drive",
    file: {
      google_drive_file_id: fileId,
      google_drive_url: webViewLink,
      google_drive_download_url: downloadUrl,
      file_name: fileName,
      file_size: file.getSize(),
      mime_type: file.getMimeType(),
      folder_path: `${NWBDCP_ROOT_FOLDER_NAME}/${subfolderName}/${yearStr}/${monthStr}/`,
      uploaded_at: now.toISOString(),
      uploaded_by: uploadedBy
    }
  });
}

function getOrCreateFolder(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(folderName);
}

function responseJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
