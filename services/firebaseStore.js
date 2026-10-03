import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs,
  getDoc,
  getDocFromServer,
  deleteDoc,
  setLogLevel
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../firebase-applet-config.json');
let firebaseConfig = {};
try {
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (err) {
  console.warn('[FirebaseStore] Warning loading firebase-applet-config.json:', err.message);
}

// Suppress internal BloomFilter SDK warnings
try {
  setLogLevel('error');
} catch (e) {
  // Ignore
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

console.log('[FirebaseStore] Initialized Cloud Firestore database:', firebaseConfig.firestoreDatabaseId);

// Validate Connection to Firestore on startup (as mandated by Skill)
async function testConnection() {
  try {
    await getDoc(doc(firestoreDb, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[FirebaseStore] Connection test note: client is offline or initializing.');
    }
  }
}
testConnection();

function toSafeDocId(str, prefix = 'DOC') {
  if (!str) return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const trimmed = String(str).trim();
  
  // If already starts with prefix (e.g. DENGUE_ or BS_), strip it first so prefix isn't duplicated
  const prefixRegex = new RegExp(`^${prefix}_+`, 'i');
  let cleanStr = trimmed.replace(prefixRegex, '').replace(/\//g, '_');

  const asciiClean = cleanStr.replace(/[^a-zA-Z0-9_\-.]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (asciiClean && asciiClean.length >= 1) {
    return `${prefix}_${asciiClean}`.slice(0, 120);
  }
  const hex = Buffer.from(trimmed, 'utf8').toString('hex').slice(0, 48);
  return `${prefix}_U_${hex}`;
}

export function getMonthDocId(monthNameOrIdx) {
  const MARATHI_MONTHS = [
    "जानेवारी", "फेब्रुवारी", "मार्च", "एप्रिल", "मे", "जून",
    "जुलै", "ऑगस्ट", "सप्टेंबर", "ऑक्टोबर", "नोव्हेंबर", "डिसेंबर"
  ];
  if (typeof monthNameOrIdx === 'number' && monthNameOrIdx >= 0 && monthNameOrIdx < 12) {
    const mm = String(monthNameOrIdx + 1).padStart(2, '0');
    return `MONTH_2026_${mm}`;
  }
  const str = String(monthNameOrIdx || '');
  for (let i = 0; i < MARATHI_MONTHS.length; i++) {
    if (str.includes(MARATHI_MONTHS[i])) {
      const mm = String(i + 1).padStart(2, '0');
      return `MONTH_2026_${mm}`;
    }
  }
  return toSafeDocId(str, 'MONTH');
}

// -------------------------------------------------------------
// DENGUE & CHIKUNGUNYA ENTRIES
// -------------------------------------------------------------
export async function syncDengueEntryToFirestore(entry) {
  if (!entry || !entry.id) return { success: false, error: 'Invalid entry' };
  try {
    const rawId = String(entry.id).trim();
    const docId = toSafeDocId(rawId, 'DENGUE');
    const ref = doc(firestoreDb, 'dengueEntries', docId);
    
    // Sanitize payload to prevent undefined fields from throwing Firestore errors
    const payload = {};
    for (const [k, v] of Object.entries(entry)) {
      if (v !== undefined && k !== '_docId') {
        payload[k] = v;
      }
    }
    payload.id = docId;
    payload.updatedAt = new Date().toISOString();

    await setDoc(ref, payload, { merge: true });
    return { success: true, docId };
  } catch (err) {
    console.error('[FirebaseStore] Error writing Dengue entry to Firestore:', err.message);
    return { success: false, error: err.message };
  }
}

export async function syncBatchDengueEntriesToFirestore(entriesArray) {
  if (!Array.isArray(entriesArray) || entriesArray.length === 0) return { success: true, count: 0 };
  try {
    let count = 0;
    for (const d of entriesArray) {
      if (!d) continue;
      const res = await syncDengueEntryToFirestore(d);
      if (res.success) count++;
    }
    console.log(`[FirebaseStore] Synced batch of ${count} Dengue entries to Firestore.`);
    return { success: true, count };
  } catch (err) {
    console.error('[FirebaseStore] Error syncing batch Dengue entries:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getDengueEntriesFromFirestore() {
  try {
    const snap = await getDocs(collection(firestoreDb, 'dengueEntries'));
    const entries = [];
    snap.forEach(docSnap => {
      const d = docSnap.data();
      entries.push({
        ...d,
        id: docSnap.id, // Always use the exact Firestore document ID as primary identifier
        _docId: docSnap.id
      });
    });
    return { success: true, data: entries };
  } catch (err) {
    console.error('[FirebaseStore] Error reading Dengue entries from Firestore:', err.message);
    return { success: false, error: err.message, data: [] };
  }
}

export async function deleteDengueEntryFromFirestore(id) {
  if (!id) return { success: false, error: 'Invalid ID' };
  try {
    const rawTrimmed = String(id).trim();
    const targetClean = rawTrimmed.toLowerCase();
    const candidateDocIds = new Set();
    candidateDocIds.add(rawTrimmed);
    candidateDocIds.add(rawTrimmed.replace(/\//g, '_'));
    candidateDocIds.add(toSafeDocId(rawTrimmed, 'DENGUE'));
    
    if (rawTrimmed.startsWith('DENGUE_')) {
      candidateDocIds.add(rawTrimmed.replace(/^DENGUE_+/i, ''));
    } else {
      candidateDocIds.add(`DENGUE_${rawTrimmed}`);
    }

    // 1. Direct delete attempts on candidate doc IDs
    for (const docId of candidateDocIds) {
      if (!docId) continue;
      try {
        await deleteDoc(doc(firestoreDb, 'dengueEntries', docId));
      } catch (e) {
        // Continue
      }
    }

    // 2. Comprehensive scan to ensure no matching document remains in Firestore
    const snap = await getDocs(collection(firestoreDb, 'dengueEntries'));
    let deletedCount = 0;
    for (const docSnap of snap.docs) {
      const d = docSnap.data();
      const sId = String(docSnap.id || '').trim().toLowerCase();
      const dId = String(d.id || '').trim().toLowerCase();
      const reg = String(d.patientRegNo || '').trim().toLowerCase();
      const sIdAlpha = sId.replace(/[^a-zA-Z0-9]/g, '');
      const targetAlpha = targetClean.replace(/[^a-zA-Z0-9]/g, '');

      if (
        sId === targetClean ||
        dId === targetClean ||
        (reg && reg !== '-' && reg === targetClean) ||
        (targetAlpha && sIdAlpha === targetAlpha)
      ) {
        await deleteDoc(doc(firestoreDb, 'dengueEntries', docSnap.id));
        deletedCount++;
        console.log(`[FirebaseStore] Deleted dengue document from Firestore: ${docSnap.id}`);
      }
    }

    return { success: true, count: deletedCount };
  } catch (err) {
    console.error('[FirebaseStore] Error deleting Dengue entry from Firestore:', err.message);
    return { success: false, error: err.message };
  }
}

export async function deleteBatchDengueEntriesFromFirestore(idsArray) {
  if (!Array.isArray(idsArray) || idsArray.length === 0) return { success: true, count: 0 };
  try {
    const cleanTargets = new Set();
    const candidateIds = new Set();

    idsArray.forEach(i => {
      if (!i) return;
      const str = String(i).trim();
      const lower = str.toLowerCase();
      cleanTargets.add(lower);
      cleanTargets.add(str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
      candidateIds.add(str);
      candidateIds.add(str.replace(/\//g, '_'));
      candidateIds.add(toSafeDocId(str, 'DENGUE'));

      if (str.startsWith('DENGUE_')) {
        const withoutPrefix = str.replace(/^DENGUE_+/i, '');
        candidateIds.add(withoutPrefix);
        cleanTargets.add(withoutPrefix.toLowerCase());
      } else {
        candidateIds.add(`DENGUE_${str}`);
      }
    });

    // 1. Direct delete attempts on all candidates
    for (const docId of candidateIds) {
      if (!docId) continue;
      try {
        await deleteDoc(doc(firestoreDb, 'dengueEntries', docId));
      } catch (e) {
        // Continue
      }
    }

    // 2. Comprehensive scan to delete all matching docs from collection
    const snap = await getDocs(collection(firestoreDb, 'dengueEntries'));
    let deletedCount = 0;
    for (const docSnap of snap.docs) {
      const d = docSnap.data();
      const sId = String(docSnap.id || '').trim().toLowerCase();
      const dId = String(d.id || '').trim().toLowerCase();
      const reg = String(d.patientRegNo || '').trim().toLowerCase();
      const sIdAlpha = sId.replace(/[^a-zA-Z0-9]/g, '');

      if (
        cleanTargets.has(sId) ||
        cleanTargets.has(dId) ||
        (reg && reg !== '-' && cleanTargets.has(reg)) ||
        cleanTargets.has(sIdAlpha)
      ) {
        await deleteDoc(doc(firestoreDb, 'dengueEntries', docSnap.id));
        deletedCount++;
        console.log(`[FirebaseStore] Batch deleted dengue document from Firestore: ${docSnap.id}`);
      }
    }

    return { success: true, count: deletedCount };
  } catch (err) {
    console.error('[FirebaseStore] Error deleting batch Dengue entries from Firestore:', err.message);
    return { success: false, error: err.message };
  }
}

export async function clearAllDengueEntriesFromFirestore() {
  try {
    const snap = await getDocs(collection(firestoreDb, 'dengueEntries'));
    let deletedCount = 0;
    for (const docSnap of snap.docs) {
      await deleteDoc(doc(firestoreDb, 'dengueEntries', docSnap.id));
      deletedCount++;
    }
    console.log(`[FirebaseStore] Cleared all ${deletedCount} dengue entries from Firestore.`);
    return { success: true, count: deletedCount };
  } catch (err) {
    console.error('[FirebaseStore] Error clearing all dengue entries from Firestore:', err.message);
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// BS DATA ENTRIES (BLOOD SLIDES)
// -------------------------------------------------------------
export async function syncBsDataEntryToFirestore(bsEntry) {
  if (!bsEntry) return { success: false, error: 'Invalid BS entry' };
  try {
    const idVal = bsEntry[0] || `BS_${Date.now()}`;
    const docId = toSafeDocId(idVal, 'BS');
    const ref = doc(firestoreDb, 'bsDataEntry', docId);
    const data = {
      id: String(bsEntry[0]),
      date: bsEntry[1] ? new Date(bsEntry[1]).toISOString() : new Date().toISOString(),
      upkendra: bsEntry[2] || '',
      employeeName: bsEntry[3] || '',
      designation: bsEntry[4] || '',
      bsCode: bsEntry[5] || '',
      bundleNumber: bsEntry[6] || '',
      pasun: parseInt(bsEntry[7]) || 0,
      paraynt: parseInt(bsEntry[8]) || 0,
      total: parseInt(bsEntry[9]) || 0,
      updatedAt: new Date().toISOString()
    };
    await setDoc(ref, data, { merge: true });
    return { success: true };
  } catch (err) {
    console.error('[FirebaseStore] Error writing BS entry to Firestore:', err.message);
    return { success: false, error: err.message };
  }
}

export async function syncBatchBsDataToFirestore(entriesArray) {
  if (!Array.isArray(entriesArray) || entriesArray.length === 0) return { success: true };
  try {
    for (const bs of entriesArray) {
      const res = await syncBsDataEntryToFirestore(bs);
      if (!res.success) return res;
    }
    return { success: true };
  } catch (err) {
    console.error('[FirebaseStore] Batch BS sync error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getBsDataEntriesFromFirestore() {
  try {
    const snap = await getDocs(collection(firestoreDb, 'bsDataEntry'));
    const entries = [];
    snap.forEach(docSnap => {
      const d = docSnap.data();
      entries.push([
        d.id,
        d.date,
        d.upkendra,
        d.employeeName,
        d.designation,
        d.bsCode,
        d.bundleNumber,
        d.pasun,
        d.paraynt,
        d.total
      ]);
    });
    return { success: true, data: entries };
  } catch (err) {
    console.error('[FirebaseStore] Error reading BS entries from Firestore:', err.message);
    return { success: false, error: err.message, data: [] };
  }
}

export async function deleteBsDataEntryFromFirestore(id) {
  if (!id) return { success: false, error: 'Invalid ID' };
  try {
    const docId = toSafeDocId(id, 'BS');
    const ref = doc(firestoreDb, 'bsDataEntry', docId);
    await deleteDoc(ref);
    return { success: true };
  } catch (err) {
    console.error('[FirebaseStore] Error deleting BS entry from Firestore:', err.message);
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// VILLAGE DETAILS
// -------------------------------------------------------------
export async function syncVillageDetailToFirestore(v) {
  if (!v || !v[0]) return { success: false };
  try {
    const rawId = `VIL_${v[0]}_${v[3] || 'VIL'}`;
    const docId = toSafeDocId(rawId, 'VILD');
    const ref = doc(firestoreDb, 'villageDetails', docId);
    const data = {
      id: String(v[0]),
      employeeName: v[1] || '',
      date: v[2] ? new Date(v[2]).toISOString() : new Date().toISOString(),
      villageName: v[3] || '',
      sampleCount: parseInt(v[4]) || 0,
      maleCount: parseInt(v[5]) || 0,
      femaleCount: parseInt(v[6]) || 0,
      upkendra: v[7] || '',
      updatedAt: new Date().toISOString()
    };
    await setDoc(ref, data, { merge: true });
    return { success: true };
  } catch (err) {
    console.error('[FirebaseStore] Error syncing village detail:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getVillageDetailsFromFirestore() {
  try {
    const snap = await getDocs(collection(firestoreDb, 'villageDetails'));
    const details = [];
    snap.forEach(docSnap => {
      const d = docSnap.data();
      details.push([
        d.id,
        d.employeeName,
        d.date,
        d.villageName,
        d.sampleCount,
        d.maleCount,
        d.femaleCount,
        d.upkendra
      ]);
    });
    return { success: true, data: details };
  } catch (err) {
    console.error('[FirebaseStore] Error reading village details from Firestore:', err.message);
    return { success: false, error: err.message, data: [] };
  }
}

export async function deleteVillageDetailFromFirestore(id) {
  if (!id) return { success: false };
  try {
    const docId = toSafeDocId(id, 'VILD');
    const ref = doc(firestoreDb, 'villageDetails', docId);
    await deleteDoc(ref);
    return { success: true };
  } catch (err) {
    console.error('[FirebaseStore] Error deleting village detail from Firestore:', err.message);
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// SUBCENTER MASTER DATA
// -------------------------------------------------------------
export async function syncSubcenterMasterToFirestore(sc) {
  if (!sc) return { success: false, error: 'Invalid subcenter' };
  try {
    const idVal = sc.id || `SC_${sc.name || Date.now()}`;
    const docId = toSafeDocId(idVal, 'SC');
    const ref = doc(firestoreDb, 'subcenterMaster', docId);
    const payload = {
      id: String(sc.id || docId),
      name: sc.name || '',
      headquarter: sc.headquarter || '',
      contactPerson: sc.contactPerson || '',
      population: parseInt(sc.population) || 0,
      houses: parseInt(sc.houses) || 0,
      contactPhone: sc.contactPhone || '',
      villages: Array.isArray(sc.villages) ? sc.villages : [],
      updatedAt: new Date().toISOString()
    };
    await setDoc(ref, payload, { merge: true });
    return { success: true };
  } catch (err) {
    console.error('[FirebaseStore] Error syncing subcenter master:', err.message);
    return { success: false, error: err.message };
  }
}

export async function syncBatchSubcentersToFirestore(subcentersArray) {
  if (!Array.isArray(subcentersArray) || subcentersArray.length === 0) return { success: true, count: 0 };
  let count = 0;
  for (const sc of subcentersArray) {
    const res = await syncSubcenterMasterToFirestore(sc);
    if (res.success) count++;
  }
  return { success: true, count };
}

export async function getSubcentersFromFirestore() {
  try {
    const snap = await getDocs(collection(firestoreDb, 'subcenterMaster'));
    const list = [];
    snap.forEach(docSnap => list.push(docSnap.data()));
    return { success: true, data: list };
  } catch (err) {
    console.error('[FirebaseStore] Error fetching subcenters from Firestore:', err.message);
    return { success: false, error: err.message, data: [] };
  }
}

// -------------------------------------------------------------
// EMPLOYEE MASTER DATA
// -------------------------------------------------------------
export async function syncEmployeeMasterToFirestore(emp) {
  if (!emp) return { success: false, error: 'Invalid employee' };
  try {
    const idVal = emp.id || `EMP_${emp.bsCode || emp.employeeName || Date.now()}`;
    const docId = toSafeDocId(idVal, 'EMP');
    const ref = doc(firestoreDb, 'employeeMaster', docId);
    const payload = {
      id: String(emp.id || docId),
      upkendra: emp.upkendra || '',
      employeeName: emp.employeeName || '',
      designation: emp.designation || '',
      bsCode: emp.bsCode || '',
      mobile: emp.mobile || '',
      villageList: Array.isArray(emp.villageList) ? emp.villageList : [],
      updatedAt: new Date().toISOString()
    };
    await setDoc(ref, payload, { merge: true });
    return { success: true };
  } catch (err) {
    console.error('[FirebaseStore] Error syncing employee master:', err.message);
    return { success: false, error: err.message };
  }
}

export async function syncBatchEmployeesToFirestore(employeesArray) {
  if (!Array.isArray(employeesArray) || employeesArray.length === 0) return { success: true, count: 0 };
  let count = 0;
  for (const emp of employeesArray) {
    const res = await syncEmployeeMasterToFirestore(emp);
    if (res.success) count++;
  }
  return { success: true, count };
}

export async function getEmployeesFromFirestore() {
  try {
    const snap = await getDocs(collection(firestoreDb, 'employeeMaster'));
    const list = [];
    snap.forEach(docSnap => list.push(docSnap.data()));
    return { success: true, data: list };
  } catch (err) {
    console.error('[FirebaseStore] Error fetching employees from Firestore:', err.message);
    return { success: false, error: err.message, data: [] };
  }
}

// -------------------------------------------------------------
// VILLAGES MASTER DATA
// -------------------------------------------------------------
export async function syncVillagesMasterToFirestore(vil) {
  if (!vil) return { success: false, error: 'Invalid village' };
  try {
    const idVal = vil.id || `VIL_${vil.villageName || Date.now()}`;
    const docId = toSafeDocId(idVal, 'VIL');
    const ref = doc(firestoreDb, 'villagesMaster', docId);
    const popCount = parseInt(vil.population) || 0;
    const housesCount = parseInt(vil.houses != null ? vil.houses : vil.households) || (popCount > 0 ? Math.round(popCount / 5) : 0);
    const targetCount = parseInt(vil.annualSmearTarget != null ? vil.annualSmearTarget : vil.target) || Math.round(popCount * 0.1);
    const asha = vil.ashaName || vil.ashaWorker || '';

    const payload = {
      id: String(vil.id || docId),
      subcenter: vil.subcenter || '',
      villageName: vil.villageName || '',
      population: popCount,
      houses: housesCount,
      households: housesCount,
      annualSmearTarget: targetCount,
      ashaName: asha,
      assignedEmployees: Array.isArray(vil.assignedEmployees) ? vil.assignedEmployees : [],
      updatedAt: new Date().toISOString()
    };
    await setDoc(ref, payload, { merge: true });
    return { success: true };
  } catch (err) {
    console.error('[FirebaseStore] Error syncing village master:', err.message);
    return { success: false, error: err.message };
  }
}

export async function syncBatchVillagesToFirestore(villagesArray) {
  if (!Array.isArray(villagesArray) || villagesArray.length === 0) return { success: true, count: 0 };
  let count = 0;
  for (const vil of villagesArray) {
    const res = await syncVillagesMasterToFirestore(vil);
    if (res.success) count++;
  }
  return { success: true, count };
}

export async function getVillagesFromFirestore() {
  try {
    const snap = await getDocs(collection(firestoreDb, 'villagesMaster'));
    const list = [];
    snap.forEach(docSnap => {
      const d = docSnap.data();
      const pop = parseInt(d.population) || 0;
      const hCount = parseInt(d.houses != null ? d.houses : d.households) || (pop > 0 ? Math.round(pop / 5) : 0);
      const target = parseInt(d.annualSmearTarget != null ? d.annualSmearTarget : d.target) || Math.round(pop * 0.1);
      list.push({
        ...d,
        id: docSnap.id,
        population: pop,
        houses: hCount,
        households: hCount,
        annualSmearTarget: target,
        ashaName: d.ashaName || d.ashaWorker || ''
      });
    });
    return { success: true, data: list };
  } catch (err) {
    console.error('[FirebaseStore] Error fetching villages from Firestore:', err.message);
    return { success: false, error: err.message, data: [] };
  }
}

// -------------------------------------------------------------
// MONTH MASTER (NVBDCP PROGRESSIVES)
// -------------------------------------------------------------
export async function syncMonthMasterToFirestore(monthObj) {
  if (!monthObj || (!monthObj.id && !monthObj.name)) return { success: false, error: 'Invalid month data' };
  try {
    const docId = getMonthDocId(monthObj.name || monthObj.id);
    const ref = doc(firestoreDb, 'monthMaster', docId);
    const payload = {
      ...monthObj,
      id: docId,
      name: monthObj.name,
      f1Start: monthObj.f1Start instanceof Date ? monthObj.f1Start.toISOString() : (monthObj.f1Start || null),
      f1End: monthObj.f1End instanceof Date ? monthObj.f1End.toISOString() : (monthObj.f1End || null),
      f2Start: monthObj.f2Start instanceof Date ? monthObj.f2Start.toISOString() : (monthObj.f2Start || null),
      f2End: monthObj.f2End instanceof Date ? monthObj.f2End.toISOString() : (monthObj.f2End || null),
      newOpd: parseInt(monthObj.newOpd) || 0,
      progNewOpd: parseInt(monthObj.progNewOpd) || 0,
      mpwFn1: parseInt(monthObj.mpwFn1) || 0,
      mpwFn2: parseInt(monthObj.mpwFn2) || 0,
      mpwHomeVisits: parseInt(monthObj.mpwHomeVisits) || 0,
      progMpwFn1: parseInt(monthObj.progMpwFn1) || 0,
      progMpwFn2: parseInt(monthObj.progMpwFn2) || 0,
      progMpwHomeVisits: parseInt(monthObj.progMpwHomeVisits) || 0,
      anmFn1: parseInt(monthObj.anmFn1) || 0,
      anmFn2: parseInt(monthObj.anmFn2) || 0,
      anmHomeVisits: parseInt(monthObj.anmHomeVisits) || 0,
      progAnmFn1: parseInt(monthObj.progAnmFn1) || 0,
      progAnmFn2: parseInt(monthObj.progAnmFn2) || 0,
      progAnmHomeVisits: parseInt(monthObj.progAnmHomeVisits) || 0,
      bloodSmears: parseInt(monthObj.bloodSmears) || 0,
      progBloodSmears: parseInt(monthObj.progBloodSmears) || 0,
      feverCases: parseInt(monthObj.feverCases) || 0,
      progFeverCases: parseInt(monthObj.progFeverCases) || 0,
      treatedCases: parseInt(monthObj.treatedCases) || 0,
      progTreatedCases: parseInt(monthObj.progTreatedCases) || 0,
      chloroquineSpent: parseInt(monthObj.chloroquineSpent) || 0,
      progChloroquineSpent: parseInt(monthObj.progChloroquineSpent) || 0,
      updatedAt: new Date().toISOString()
    };
    await setDoc(ref, payload, { merge: true });
    return { success: true };
  } catch (err) {
    console.error('[FirebaseStore] Error syncing monthMaster:', err.message);
    return { success: false, error: err.message };
  }
}

export async function syncBatchMonthMasterToFirestore(monthMasterArray) {
  if (!Array.isArray(monthMasterArray) || monthMasterArray.length === 0) return { success: true, count: 0 };
  let count = 0;
  for (const m of monthMasterArray) {
    const res = await syncMonthMasterToFirestore(m);
    if (res.success) count++;
  }
  return { success: true, count };
}

export async function getMonthMasterFromFirestore() {
  try {
    const snap = await getDocs(collection(firestoreDb, 'monthMaster'));
    const list = [];
    snap.forEach(docSnap => list.push(docSnap.data()));
    return { success: true, data: list };
  } catch (err) {
    console.error('[FirebaseStore] Error reading monthMaster from Firestore:', err.message);
    return { success: false, error: err.message, data: [] };
  }
}

// -------------------------------------------------------------
// APP CONFIG & METADATA
// -------------------------------------------------------------
export async function saveAppConfigToFirestore(configId, configData) {
  try {
    const docId = toSafeDocId(configId, 'CFG');
    const ref = doc(firestoreDb, 'appConfig', docId);
    await setDoc(ref, { ...configData, updatedAt: new Date().toISOString() }, { merge: true });
    return { success: true };
  } catch (err) {
    console.error('[FirebaseStore] Error saving appConfig:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getAppConfigFromFirestore(configId) {
  try {
    const docId = toSafeDocId(configId, 'CFG');
    const ref = doc(firestoreDb, 'appConfig', docId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { success: true, data: snap.data() };
    }
    return { success: false, error: 'Not found' };
  } catch (err) {
    console.error('[FirebaseStore] Error reading appConfig:', err.message);
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// TRANSFER HISTORY LOGS
// -------------------------------------------------------------
export async function syncTransferHistoryToFirestore(log) {
  if (!log) return { success: false, error: 'Invalid transfer log' };
  try {
    const docId = toSafeDocId(log.id, 'TR');
    const ref = doc(firestoreDb, 'transferHistory', docId);
    await setDoc(ref, {
      id: String(log.id || docId),
      timestamp: log.timestamp || new Date().toISOString(),
      dateFormatted: log.dateFormatted || '',
      employeeName: log.employeeName || '',
      designation: log.designation || '',
      fromUpkendra: log.fromUpkendra || '',
      toUpkendra: log.toUpkendra || '',
      previousVillages: Array.isArray(log.previousVillages) ? log.previousVillages : [],
      newVillages: Array.isArray(log.newVillages) ? log.newVillages : [],
      bsCode: log.bsCode || '',
      reason: log.reason || '',
      orderNo: log.orderNo || '',
      transferredBy: log.transferredBy || '',
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { success: true, docId };
  } catch (err) {
    console.error('[FirebaseStore] Error syncing transfer history:', err.message);
    return { success: false, error: err.message };
  }
}

export async function syncBatchTransferHistoryToFirestore(logsArray) {
  if (!Array.isArray(logsArray) || logsArray.length === 0) return { success: true, count: 0 };
  let count = 0;
  for (const log of logsArray) {
    if (!log) continue;
    const res = await syncTransferHistoryToFirestore(log);
    if (res.success) count++;
  }
  return { success: true, count };
}

export async function getTransferHistoryFromFirestore() {
  try {
    const snap = await getDocs(collection(firestoreDb, 'transferHistory'));
    const list = [];
    snap.forEach(docSnap => {
      list.push(docSnap.data());
    });
    return { success: true, data: list };
  } catch (err) {
    console.error('[FirebaseStore] Error fetching transfer history from Firestore:', err.message);
    return { success: false, error: err.message, data: [] };
  }
}

// -------------------------------------------------------------
// TRANSFER ALL DATASETS TO FIRESTORE
// -------------------------------------------------------------
export async function transferAllDataToFirestore(storeData) {
  try {
    const results = {
      bsDataCount: 0,
      subcenterCount: 0,
      employeeCount: 0,
      villageMasterCount: 0,
      villageDetailCount: 0,
      dengueCount: 0,
      transferHistoryCount: 0,
      errors: []
    };

    // 1. BS Data Entries
    if (Array.isArray(storeData.bsDataEntry) && storeData.bsDataEntry.length > 0) {
      for (const bs of storeData.bsDataEntry) {
        const res = await syncBsDataEntryToFirestore(bs);
        if (res.success) results.bsDataCount++;
        else results.errors.push(`BS entry ${bs[0]}: ${res.error}`);
      }
    }

    // 2. Subcenter Master
    if (Array.isArray(storeData.subcenterMaster) && storeData.subcenterMaster.length > 0) {
      const scRes = await syncBatchSubcentersToFirestore(storeData.subcenterMaster);
      results.subcenterCount = scRes.count || 0;
    }

    // 3. Employee Master
    if (Array.isArray(storeData.employeeMaster) && storeData.employeeMaster.length > 0) {
      const empRes = await syncBatchEmployeesToFirestore(storeData.employeeMaster);
      results.employeeCount = empRes.count || 0;
    }

    // 4. Villages Master
    if (Array.isArray(storeData.villagesMaster) && storeData.villagesMaster.length > 0) {
      const vilRes = await syncBatchVillagesToFirestore(storeData.villagesMaster);
      results.villageMasterCount = vilRes.count || 0;
    }

    // 5. Village Details
    if (Array.isArray(storeData.villageDetails) && storeData.villageDetails.length > 0) {
      for (const vd of storeData.villageDetails) {
        const res = await syncVillageDetailToFirestore(vd);
        if (res.success) results.villageDetailCount++;
        else if (results.errors.length < 5) results.errors.push(`Village detail ${vd[0]}: ${res.error}`);
      }
    }

    // 6. Dengue Entries
    if (Array.isArray(storeData.dengueChikungunyaEntries) && storeData.dengueChikungunyaEntries.length > 0) {
      for (const d of storeData.dengueChikungunyaEntries) {
        const res = await syncDengueEntryToFirestore(d);
        if (res.success) results.dengueCount++;
      }
    }

    // 7. Month Master (Monthly OPD, Home Visits, Smears, Progressive Indicators)
    if (Array.isArray(storeData.monthMaster) && storeData.monthMaster.length > 0) {
      results.monthMasterCount = 0;
      for (const m of storeData.monthMaster) {
        const res = await syncMonthMasterToFirestore(m);
        if (res.success) results.monthMasterCount++;
      }
    }

    // 8. Transfer History
    if (Array.isArray(storeData.transferHistory) && storeData.transferHistory.length > 0) {
      const tfRes = await syncBatchTransferHistoryToFirestore(storeData.transferHistory);
      results.transferHistoryCount = tfRes.count || 0;
    }

    return { success: true, results };
  } catch (err) {
    console.error('[FirebaseStore] Error transferring all data to Firestore:', err.message);
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// NWBDCP DEDICATED FIRESTORE SYNC CONTROLLERS
// -------------------------------------------------------------
export async function syncNwbdcpWaterSourceToFirestore(source) {
  if (!source || !source.id) return { success: false, error: 'Invalid source object' };
  try {
    const rawId = String(source.id || source.sourceCode || source.sourceId).trim();
    const docId = toSafeDocId(rawId, 'SRC');
    const ref = doc(firestoreDb, 'NWBDCP_WaterSources', docId);

    const payload = {};
    for (const [k, v] of Object.entries(source)) {
      if (v !== undefined) payload[k] = v;
    }
    payload.id = docId;
    payload.updatedAt = new Date().toISOString();

    await setDoc(ref, payload, { merge: true });
    return { success: true, docId };
  } catch (err) {
    console.error('[FirebaseStore] Error writing NWBDCP Water Source to Firestore:', err.message);
    return { success: false, error: err.message };
  }
}

export async function syncBatchNwbdcpWaterSourcesToFirestore(sourcesArray) {
  if (!Array.isArray(sourcesArray) || sourcesArray.length === 0) return { success: true, count: 0 };
  try {
    let count = 0;
    for (const s of sourcesArray) {
      if (!s) continue;
      const res = await syncNwbdcpWaterSourceToFirestore(s);
      if (res.success) count++;
    }
    return { success: true, count };
  } catch (err) {
    console.error('[FirebaseStore] Error writing batch NWBDCP Water Sources to Firestore:', err.message);
    return { success: false, error: err.message, count: 0 };
  }
}

export async function syncNwbdcpSampleDispatchToFirestore(sample) {
  if (!sample || !sample.sampleId) return { success: false, error: 'Invalid sample object' };
  try {
    const docId = toSafeDocId(sample.sampleId, 'SMP');
    const ref = doc(firestoreDb, 'NWBDCP_SampleDispatch', docId);

    const payload = {};
    for (const [k, v] of Object.entries(sample)) {
      if (v !== undefined) payload[k] = v;
    }
    payload.id = docId;
    payload.updatedAt = new Date().toISOString();

    await setDoc(ref, payload, { merge: true });
    return { success: true, docId };
  } catch (err) {
    console.error('[FirebaseStore] Error writing NWBDCP Sample Dispatch to Firestore:', err.message);
    return { success: false, error: err.message };
  }
}

export async function syncBatchNwbdcpSampleDispatchesToFirestore(samplesArray) {
  if (!Array.isArray(samplesArray) || samplesArray.length === 0) return { success: true, count: 0 };
  try {
    let count = 0;
    for (const smp of samplesArray) {
      if (!smp) continue;
      const res = await syncNwbdcpSampleDispatchToFirestore(smp);
      if (res.success) count++;
    }
    return { success: true, count };
  } catch (err) {
    console.error('[FirebaseStore] Error writing batch NWBDCP Samples to Firestore:', err.message);
    return { success: false, error: err.message, count: 0 };
  }
}

export async function syncNwbdcpRetestToFirestore(retest) {
  if (!retest || !retest.retestId) return { success: false, error: 'Invalid retest object' };
  try {
    const docId = toSafeDocId(retest.retestId, 'RET');
    const ref = doc(firestoreDb, 'NWBDCP_Retest', docId);

    const payload = {};
    for (const [k, v] of Object.entries(retest)) {
      if (v !== undefined) payload[k] = v;
    }
    payload.id = docId;
    payload.updatedAt = new Date().toISOString();

    await setDoc(ref, payload, { merge: true });
    return { success: true, docId };
  } catch (err) {
    console.error('[FirebaseStore] Error writing NWBDCP Retest to Firestore:', err.message);
    return { success: false, error: err.message };
  }
}

export async function fetchAllNwbdcpDataFromFirestore() {
  try {
    const sourcesSnap = await getDocs(collection(firestoreDb, 'NWBDCP_WaterSources'));
    const dispatchesSnap = await getDocs(collection(firestoreDb, 'NWBDCP_SampleDispatch'));
    const retestsSnap = await getDocs(collection(firestoreDb, 'NWBDCP_Retest'));

    const waterSources = [];
    sourcesSnap.forEach(d => waterSources.push(d.data()));

    const sampleDispatches = [];
    dispatchesSnap.forEach(d => sampleDispatches.push(d.data()));

    const retests = [];
    retestsSnap.forEach(d => retests.push(d.data()));

    return {
      success: true,
      waterSources,
      sampleDispatches,
      retests
    };
  } catch (err) {
    console.error('[FirebaseStore] Error fetching NWBDCP data from Firestore:', err.message);
    return { success: false, error: err.message, waterSources: [], sampleDispatches: [], retests: [] };
  }
}

// -------------------------------------------------------------
// FETCH ALL FOR STARTUP
// -------------------------------------------------------------
export async function fetchAllDataFromFirestore() {
  try {
    const dengueRes = await getDengueEntriesFromFirestore();
    const bsRes = await getBsDataEntriesFromFirestore();
    const vilRes = await getVillageDetailsFromFirestore();
    const monthRes = await getMonthMasterFromFirestore();
    const subRes = await getSubcentersFromFirestore();
    const empRes = await getEmployeesFromFirestore();
    const vilMasterRes = await getVillagesFromFirestore();
    const transferRes = await getTransferHistoryFromFirestore();

    return {
      success: true,
      dengueList: dengueRes.data || [],
      bsList: bsRes.data || [],
      villageList: vilRes.data || [],
      monthList: monthRes.data || [],
      subcenterList: subRes.data || [],
      employeeList: empRes.data || [],
      villageMasterList: vilMasterRes.data || [],
      transferList: transferRes.data || []
    };
  } catch (err) {
    console.error('[FirebaseStore] Error fetching all from Firestore:', err.message);
    return { success: false, error: err.message };
  }
}
