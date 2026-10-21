// =========================================================================
// NVBDCP SUPABASE PRIMARY DATABASE SERVICE
// Application: PHC Bhada NVBDCP Management System
// Security: Server-side only with SUPABASE_SERVICE_ROLE_KEY (RLS bypass)
// =========================================================================
import { createClient } from '@supabase/supabase-js';
import dns from 'node:dns';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export let supabaseClient = null;

let isSupabaseReachable = true;
let lastReachabilityCheck = 0;
const REACHABILITY_COOLDOWN = 60000;

export function isSupabaseOnline() {
  if (!supabaseClient) return false;
  if (!isSupabaseReachable && (Date.now() - lastReachabilityCheck < REACHABILITY_COOLDOWN)) {
    return false;
  }
  return true;
}

export function markSupabaseOffline(reason = '') {
  if (isSupabaseReachable) {
    console.warn(`⚠️ [NVBDCP Supabase] Supabase host is currently unreachable (${reason || 'network/DNS error'}). Safely operating in offline fallback mode with local cache & Cloud Firestore.`);
  }
  isSupabaseReachable = false;
  lastReachabilityCheck = Date.now();
}

export function markSupabaseOnline() {
  isSupabaseReachable = true;
}

// Proactive non-blocking DNS resolution check at startup
if (SUPABASE_URL) {
  try {
    const parsedUrl = new URL(SUPABASE_URL);
    if (parsedUrl.hostname) {
      dns.lookup(parsedUrl.hostname, (err) => {
        if (err) {
          markSupabaseOffline(`DNS resolution failed for ${parsedUrl.hostname} (${err.code || err.message})`);
        }
      });
    }
  } catch (err) {
    markSupabaseOffline(`Invalid URL: ${err.message}`);
  }
}

if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log('✅ [NVBDCP Supabase] Service-Role client initialized successfully.');
  } catch (err) {
    console.warn('⚠️ [NVBDCP Supabase] Client initialization error:', err.message);
  }
} else {
  console.warn('⚠️ [NVBDCP Supabase] SUPABASE_SERVICE_ROLE_KEY not configured. Supabase operations will fall back to local store.');
}

// Helper for paginated fetch to guarantee retrieving all records beyond 1000 limit
async function fetchAllPaginated(tableName, selectQuery = '*', orderCol = 'id') {
  if (!supabaseClient || !isSupabaseOnline()) return [];
  const results = [];
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const { data, error } = await supabaseClient
        .from(tableName)
        .select(selectQuery)
        .order(orderCol, { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        markSupabaseOffline(error.message);
        return [];
      }

      markSupabaseOnline();
      if (Array.isArray(data) && data.length > 0) {
        results.push(...data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          from += pageSize;
        }
      } else {
        hasMore = false;
      }
    } catch (err) {
      markSupabaseOffline(err.message);
      return [];
    }
  }

  return results;
}

// =========================================================================
// 1. SUBCENTERS (NVBDCP_Subcenters)
// =========================================================================
export async function fetchSubcentersFromSupabase() {
  if (!supabaseClient || !isSupabaseOnline()) return null;
  try {
    const data = await fetchAllPaginated('NVBDCP_Subcenters', '*', 'name');
    return data.map(s => ({
      id: s.id,
      name: s.name,
      headquarter: s.headquarter || s.name,
      population: Number(s.population) || 0,
      houses: Number(s.houses) || 0,
      villages: Array.isArray(s.villages) ? s.villages : (typeof s.villages === 'string' ? JSON.parse(s.villages) : []),
      contactPerson: s.contact_person || '',
      contactPhone: s.contact_phone || '',
      updatedAt: s.updated_at
    }));
  } catch (err) {
    markSupabaseOffline(err.message);
    return null;
  }
}

export async function syncSubcenterToSupabase(subcenter) {
  if (!supabaseClient || !isSupabaseOnline() || !subcenter) return { success: false, offline: true };
  try {
    const payload = {
      id: subcenter.id || `SC_${Date.now()}`,
      name: subcenter.name,
      headquarter: subcenter.headquarter || subcenter.name,
      population: Number(subcenter.population) || 0,
      houses: Number(subcenter.houses) || 0,
      villages: Array.isArray(subcenter.villages) ? subcenter.villages : [],
      contact_person: subcenter.contactPerson || '',
      contact_phone: subcenter.contactPhone || '',
      updated_at: new Date().toISOString()
    };
    const { error } = await supabaseClient
      .from('NVBDCP_Subcenters')
      .upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    markSupabaseOnline();
    return { success: true };
  } catch (err) {
    markSupabaseOffline(err.message);
    return { success: false, offline: true, error: err.message };
  }
}

export async function deleteSubcenterFromSupabase(subcenterId) {
  if (!supabaseClient || !isSupabaseOnline() || !subcenterId) return { success: false, offline: true };
  try {
    const { error } = await supabaseClient
      .from('NVBDCP_Subcenters')
      .delete()
      .eq('id', subcenterId);
    if (error) throw error;
    markSupabaseOnline();
    return { success: true };
  } catch (err) {
    markSupabaseOffline(err.message);
    return { success: false, offline: true, error: err.message };
  }
}

// =========================================================================
// 2. VILLAGES (NVBDCP_Villages)
// =========================================================================
export async function fetchVillagesFromSupabase() {
  if (!supabaseClient || !isSupabaseOnline()) return null;
  try {
    const data = await fetchAllPaginated('NVBDCP_Villages', '*', 'id');
    return data.map(v => ({
      id: v.id,
      villageName: v.village_name,
      subcenter: v.subcenter,
      population: Number(v.population) || 0,
      houses: Number(v.houses) || 0,
      households: Number(v.households) || Number(v.houses) || 0,
      annualSmearTarget: Number(v.annual_smear_target) || 0,
      ashaName: v.asha_name || '',
      assignedEmployees: Array.isArray(v.assigned_employees) ? v.assigned_employees : [],
      updatedAt: v.updated_at
    }));
  } catch (err) {
    markSupabaseOffline(err.message);
    return null;
  }
}

export async function syncVillageToSupabase(village) {
  if (!supabaseClient || !isSupabaseOnline() || !village) return { success: false, offline: true };
  try {
    const payload = {
      id: village.id || `VIL_${Date.now()}`,
      village_name: village.villageName,
      subcenter: village.subcenter,
      population: Number(village.population) || 0,
      houses: Number(village.houses) || 0,
      households: Number(village.households) || Number(village.houses) || 0,
      annual_smear_target: Number(village.annualSmearTarget) || 0,
      asha_name: village.ashaName || '',
      assigned_employees: Array.isArray(village.assignedEmployees) ? village.assignedEmployees : [],
      updated_at: new Date().toISOString()
    };
    const { error } = await supabaseClient
      .from('NVBDCP_Villages')
      .upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    markSupabaseOnline();
    return { success: true };
  } catch (err) {
    markSupabaseOffline(err.message);
    return { success: false, offline: true, error: err.message };
  }
}

export async function deleteVillageFromSupabase(villageId) {
  if (!supabaseClient || !isSupabaseOnline() || !villageId) return { success: false, offline: true };
  try {
    const { error } = await supabaseClient
      .from('NVBDCP_Villages')
      .delete()
      .eq('id', villageId);
    if (error) throw error;
    markSupabaseOnline();
    return { success: true };
  } catch (err) {
    markSupabaseOffline(err.message);
    return { success: false, offline: true, error: err.message };
  }
}

// =========================================================================
// 3. EMPLOYEES (NVBDCP_Employees)
// =========================================================================
export async function fetchEmployeesFromSupabase() {
  if (!supabaseClient || !isSupabaseOnline()) return null;
  try {
    const data = await fetchAllPaginated('NVBDCP_Employees', '*', 'id');
    return data.map(e => ({
      id: e.id,
      employeeName: e.employee_name,
      designation: e.designation,
      upkendra: e.upkendra,
      bsCode: e.bs_code || '',
      villageList: Array.isArray(e.village_list) ? e.village_list : [],
      mobile: e.mobile || '',
      updatedAt: e.updated_at
    }));
  } catch (err) {
    markSupabaseOffline(err.message);
    return null;
  }
}

export async function syncEmployeeToSupabase(employee) {
  if (!supabaseClient || !isSupabaseOnline() || !employee) return { success: false, offline: true };
  try {
    const payload = {
      id: employee.id || `EMP_${Date.now()}`,
      employee_name: employee.employeeName,
      designation: employee.designation,
      upkendra: employee.upkendra,
      bs_code: employee.bsCode || '',
      village_list: Array.isArray(employee.villageList) ? employee.villageList : [],
      mobile: employee.mobile || '',
      updated_at: new Date().toISOString()
    };
    const { error } = await supabaseClient
      .from('NVBDCP_Employees')
      .upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    markSupabaseOnline();
    return { success: true };
  } catch (err) {
    markSupabaseOffline(err.message);
    return { success: false, offline: true, error: err.message };
  }
}

export async function deleteEmployeeFromSupabase(employeeId) {
  if (!supabaseClient || !isSupabaseOnline() || !employeeId) return { success: false, offline: true };
  try {
    const { error } = await supabaseClient
      .from('NVBDCP_Employees')
      .delete()
      .eq('id', employeeId);
    if (error) throw error;
    markSupabaseOnline();
    return { success: true };
  } catch (err) {
    markSupabaseOffline(err.message);
    return { success: false, offline: true, error: err.message };
  }
}

// =========================================================================
// 4. MONTH MASTER (NVBDCP_MonthMaster)
// =========================================================================
export async function fetchMonthMasterFromSupabase() {
  if (!supabaseClient || !isSupabaseOnline()) return null;
  try {
    const data = await fetchAllPaginated('NVBDCP_MonthMaster', '*', 'name');
    return data.map(m => ({
      name: m.name,
      f1Start: m.f1_start ? new Date(m.f1_start) : null,
      f1End: m.f1_end ? new Date(m.f1_end) : null,
      f2Start: m.f2_start ? new Date(m.f2_start) : null,
      f2End: m.f2_end ? new Date(m.f2_end) : null,
      newOpd: Number(m.new_opd) || 0,
      progNewOpd: Number(m.prog_new_opd) || 0,
      mpwFn1: Number(m.mpw_fn1) || 0,
      mpwFn2: Number(m.mpw_fn2) || 0,
      mpwHomeVisits: Number(m.mpw_home_visits) || 0,
      progMpwFn1: Number(m.prog_mpw_fn1) || 0,
      progMpwFn2: Number(m.prog_mpw_fn2) || 0,
      progMpwHomeVisits: Number(m.prog_mpw_home_visits) || 0,
      anmFn1: Number(m.anm_fn1) || 0,
      anmFn2: Number(m.anm_fn2) || 0,
      anmHomeVisits: Number(m.anm_home_visits) || 0,
      progAnmFn1: Number(m.prog_anm_fn1) || 0,
      progAnmFn2: Number(m.prog_anm_fn2) || 0,
      progAnmHomeVisits: Number(m.prog_anm_home_visits) || 0,
      ashaHomeVisits: Number(m.asha_home_visits) || 0,
      progAshaHomeVisits: Number(m.prog_asha_home_visits) || 0,
      feverCases: Number(m.fever_cases) || 0,
      progFeverCases: Number(m.prog_fever_cases) || 0,
      bloodSmears: Number(m.blood_smears) || 0,
      progBloodSmears: Number(m.prog_blood_smears) || 0,
      treatedCases: Number(m.treated_cases) || 0,
      progTreatedCases: Number(m.prog_treated_cases) || 0,
      chloroquineSpent: Number(m.chloroquine_spent) || 0,
      progChloroquineSpent: Number(m.prog_chloroquine_spent) || 0,
      priorOpdSum: Number(m.prior_opd_sum) || 0,
      priorFeverSum: Number(m.prior_fever_sum) || 0,
      priorSmearsSum: Number(m.prior_smears_sum) || 0,
      priorTreatedSum: Number(m.prior_treated_sum) || 0,
      priorCqSum: Number(m.prior_cq_sum) || 0,
      priorMpwSum: Number(m.prior_mpw_sum) || 0,
      priorAnmSum: Number(m.prior_anm_sum) || 0,
      priorAshaSum: Number(m.prior_asha_sum) || 0,
      bloodSmearsManual: m.blood_smears_manual !== false,
      priorMpwFn1Sum: Number(m.prior_mpw_fn1_sum) || 0,
      priorMpwFn2Sum: Number(m.prior_mpw_fn2_sum) || 0,
      priorAnmFn1Sum: Number(m.prior_anm_fn1_sum) || 0,
      priorAnmFn2Sum: Number(m.prior_anm_fn2_sum) || 0
    }));
  } catch (err) {
    markSupabaseOffline(err.message);
    return null;
  }
}

export async function syncMonthMasterToSupabase(month) {
  if (!supabaseClient || !isSupabaseOnline() || !month || !month.name) return { success: false, offline: true };
  try {
    const payload = {
      name: month.name,
      f1_start: month.f1Start ? new Date(month.f1Start).toISOString() : null,
      f1_end: month.f1End ? new Date(month.f1End).toISOString() : null,
      f2_start: month.f2Start ? new Date(month.f2Start).toISOString() : null,
      f2_end: month.f2End ? new Date(month.f2End).toISOString() : null,
      new_opd: Number(month.newOpd) || 0,
      prog_new_opd: Number(month.progNewOpd) || 0,
      mpw_fn1: Number(month.mpwFn1) || 0,
      mpw_fn2: Number(month.mpwFn2) || 0,
      mpw_home_visits: Number(month.mpwHomeVisits) || 0,
      prog_mpw_fn1: Number(month.progMpwFn1) || 0,
      prog_mpw_fn2: Number(month.progMpwFn2) || 0,
      prog_mpw_home_visits: Number(month.progMpwHomeVisits) || 0,
      anm_fn1: Number(month.anmFn1) || 0,
      anm_fn2: Number(month.anmFn2) || 0,
      anm_home_visits: Number(month.anmHomeVisits) || 0,
      prog_anm_fn1: Number(month.progAnmFn1) || 0,
      prog_anm_fn2: Number(month.progAnmFn2) || 0,
      prog_anm_home_visits: Number(month.progAnmHomeVisits) || 0,
      asha_home_visits: Number(month.ashaHomeVisits) || 0,
      prog_asha_home_visits: Number(month.progAshaHomeVisits) || 0,
      fever_cases: Number(month.feverCases) || 0,
      prog_fever_cases: Number(month.progFeverCases) || 0,
      blood_smears: Number(month.bloodSmears) || 0,
      prog_blood_smears: Number(month.progBloodSmears) || 0,
      treated_cases: Number(month.treatedCases) || 0,
      prog_treated_cases: Number(month.progTreatedCases) || 0,
      chloroquine_spent: Number(month.chloroquineSpent) || 0,
      prog_chloroquine_spent: Number(month.progChloroquineSpent) || 0,
      prior_opd_sum: Number(month.priorOpdSum) || 0,
      prior_fever_sum: Number(month.priorFeverSum) || 0,
      prior_smears_sum: Number(month.priorSmearsSum) || 0,
      prior_treated_sum: Number(month.priorTreatedSum) || 0,
      prior_cq_sum: Number(month.priorCqSum) || 0,
      prior_mpw_sum: Number(month.priorMpwSum) || 0,
      prior_anm_sum: Number(month.priorAnmSum) || 0,
      prior_asha_sum: Number(month.priorAshaSum) || 0,
      blood_smears_manual: month.bloodSmearsManual !== false,
      prior_mpw_fn1_sum: Number(month.priorMpwFn1Sum) || 0,
      prior_mpw_fn2_sum: Number(month.priorMpwFn2Sum) || 0,
      prior_anm_fn1_sum: Number(month.priorAnmFn1Sum) || 0,
      prior_anm_fn2_sum: Number(month.priorAnmFn2Sum) || 0,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabaseClient
      .from('NVBDCP_MonthMaster')
      .upsert(payload, { onConflict: 'name' });
    if (error) throw error;
    markSupabaseOnline();
    return { success: true };
  } catch (err) {
    markSupabaseOffline(err.message);
    return { success: false, offline: true, error: err.message };
  }
}

// =========================================================================
// 5. BLOOD SMEAR DATA ENTRY (NVBDCP_BsDataEntry)
// Array representation in store: [id, dateObj, upkendra, employeeName, designation, bsCode, bundleNumber, pasun, paraynt, total]
// =========================================================================
export async function fetchBsDataFromSupabase() {
  if (!supabaseClient || !isSupabaseOnline()) return null;
  try {
    const data = await fetchAllPaginated('NVBDCP_BsDataEntry', '*', 'date');
    return data.map(r => [
      r.id,
      new Date(r.date),
      r.upkendra || '',
      r.employee_name || '',
      r.designation || '',
      r.bs_code || '',
      r.bundle_number || '',
      Number(r.pasun) || 0,
      Number(r.paraynt) || 0,
      Number(r.total) || 0
    ]);
  } catch (err) {
    markSupabaseOffline(err.message);
    return null;
  }
}

export async function syncBsDataToSupabase(entries) {
  if (!supabaseClient || !isSupabaseOnline() || !entries) return { success: false, offline: true };
  const arr = Array.isArray(entries) ? entries : [entries];
  if (arr.length === 0) return { success: true };

  try {
    const payloads = arr.map(e => {
      if (Array.isArray(e)) {
        return {
          id: String(e[0]).trim(),
          date: e[1] ? new Date(e[1]).toISOString() : new Date().toISOString(),
          upkendra: e[2] || '',
          employee_name: e[3] || '',
          designation: e[4] || '',
          bs_code: e[5] || '',
          bundle_number: e[6] || '',
          pasun: Number(e[7]) || 0,
          paraynt: Number(e[8]) || 0,
          total: Number(e[9]) || 0
        };
      }
      return {
        id: String(e.id).trim(),
        date: e.date ? new Date(e.date).toISOString() : new Date().toISOString(),
        upkendra: e.upkendra || '',
        employee_name: e.employeeName || e.employee_name || '',
        designation: e.designation || '',
        bs_code: e.bsCode || e.bs_code || '',
        bundle_number: e.bundleNumber || e.bundle_number || '',
        pasun: Number(e.pasun) || 0,
        paraynt: Number(e.paraynt) || 0,
        total: Number(e.total) || 0
      };
    });

    for (let i = 0; i < payloads.length; i += 500) {
      const chunk = payloads.slice(i, i + 500);
      const { error } = await supabaseClient
        .from('NVBDCP_BsDataEntry')
        .upsert(chunk, { onConflict: 'id' });
      if (error) throw error;
    }

    markSupabaseOnline();
    return { success: true, count: payloads.length };
  } catch (err) {
    markSupabaseOffline(err.message);
    return { success: false, offline: true, error: err.message };
  }
}

export async function deleteBsEntryFromSupabase(entryId) {
  if (!supabaseClient || !isSupabaseOnline() || !entryId) return { success: false, offline: true };
  try {
    const p1 = supabaseClient.from('NVBDCP_BsDataEntry').delete().eq('id', entryId);
    const p2 = supabaseClient.from('NVBDCP_VillageDetails').delete().eq('bs_id', entryId);
    const [r1, r2] = await Promise.all([p1, p2]);
    if (r1.error) throw r1.error;
    if (r2.error) throw r2.error;
    markSupabaseOnline();
    return { success: true };
  } catch (err) {
    markSupabaseOffline(err.message);
    return { success: false, offline: true, error: err.message };
  }
}

// =========================================================================
// 6. VILLAGE DETAILS (NVBDCP_VillageDetails)
// Array representation in store: [bs_id, employeeName, dateObj, villageName, sampleCount, maleCount, femaleCount, upkendra]
// =========================================================================
export async function fetchVillageDetailsFromSupabase() {
  if (!supabaseClient || !isSupabaseOnline()) return null;
  try {
    const data = await fetchAllPaginated('NVBDCP_VillageDetails', '*', 'id');
    return data.map(r => [
      r.bs_id,
      r.employee_name || '',
      new Date(r.date),
      r.village_name || '',
      Number(r.sample_count) || 0,
      Number(r.male_count) || 0,
      Number(r.female_count) || 0,
      r.upkendra || ''
    ]);
  } catch (err) {
    markSupabaseOffline(err.message);
    return null;
  }
}

export async function syncVillageDetailsToSupabase(details) {
  if (!supabaseClient || !isSupabaseOnline() || !details) return { success: false, offline: true };
  const arr = Array.isArray(details) ? details : [details];
  if (arr.length === 0) return { success: true };

  try {
    const payloads = arr.map((d, idx) => {
      if (Array.isArray(d)) {
        const bsId = String(d[0]).trim();
        const vName = d[3] || '';
        const vHex = Buffer.from(String(vName).trim(), 'utf8').toString('hex').slice(0, 24);
        return {
          id: d._id || `VD_${bsId}_${vHex}_${idx}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100),
          bs_id: bsId,
          employee_name: d[1] || '',
          date: d[2] ? new Date(d[2]).toISOString() : new Date().toISOString(),
          village_name: vName,
          sample_count: Number(d[4]) || 0,
          male_count: Number(d[5]) || 0,
          female_count: Number(d[6]) || 0,
          upkendra: d[7] || ''
        };
      }
      const bsId = String(d.uniqueId || d.bs_id || d.bsId).trim();
      const vName = d.villageName || d.village_name || '';
      const vHex = Buffer.from(String(vName).trim(), 'utf8').toString('hex').slice(0, 24);
      return {
        id: d.id || `VD_${bsId}_${vHex}_${idx}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100),
        bs_id: bsId,
        employee_name: d.employeeName || d.employee_name || '',
        date: d.date ? new Date(d.date).toISOString() : new Date().toISOString(),
        village_name: vName,
        sample_count: Number(d.sampleCount || d.sample_count) || 0,
        male_count: Number(d.maleCount || d.male_count) || 0,
        female_count: Number(d.femaleCount || d.female_count) || 0,
        upkendra: d.upkendra || ''
      };
    });

    for (let i = 0; i < payloads.length; i += 500) {
      const chunk = payloads.slice(i, i + 500);
      const { error } = await supabaseClient
        .from('NVBDCP_VillageDetails')
        .upsert(chunk, { onConflict: 'id' });
      if (error) throw error;
    }

    markSupabaseOnline();
    return { success: true, count: payloads.length };
  } catch (err) {
    markSupabaseOffline(err.message);
    return { success: false, offline: true, error: err.message };
  }
}

// =========================================================================
// 7. TRANSFER HISTORY (NVBDCP_TransferHistory)
// =========================================================================
export async function fetchTransferHistoryFromSupabase() {
  if (!supabaseClient || !isSupabaseOnline()) return null;
  try {
    const data = await fetchAllPaginated('NVBDCP_TransferHistory', '*', 'id');
    return data;
  } catch (err) {
    markSupabaseOffline(err.message);
    return null;
  }
}

export async function syncTransferHistoryToSupabase(transfer) {
  if (!supabaseClient || !isSupabaseOnline() || !transfer) return { success: false, offline: true };
  try {
    const payload = {
      id: transfer.id || `TR_${Date.now()}`,
      employee_id: transfer.employeeId || transfer.empId || '',
      employee_name: transfer.employeeName || '',
      old_upkendra: transfer.oldUpkendra || '',
      new_upkendra: transfer.newUpkendra || '',
      old_villages: Array.isArray(transfer.oldVillages) ? transfer.oldVillages : [],
      new_villages: Array.isArray(transfer.newVillages) ? transfer.newVillages : [],
      old_bscode: transfer.oldBsCode || '',
      new_bscode: transfer.newBsCode || '',
      order_no: transfer.orderNo || '',
      reason: transfer.reason || '',
      transfer_date: transfer.transferDate || new Date().toISOString()
    };
    const { error } = await supabaseClient
      .from('NVBDCP_TransferHistory')
      .upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    markSupabaseOnline();
    return { success: true };
  } catch (err) {
    markSupabaseOffline(err.message);
    return { success: false, offline: true, error: err.message };
  }
}

// =========================================================================
// 8. DENGUE / CHIKUNGUNYA ENTRIES (NVBDCP_DengueChikungunya)
// =========================================================================
export async function fetchDengueChikungunyaFromSupabase() {
  if (!supabaseClient || !isSupabaseOnline()) return null;
  try {
    const data = await fetchAllPaginated('NVBDCP_DengueChikungunya', '*', 'id');
    return data;
  } catch (err) {
    markSupabaseOffline(err.message);
    return null;
  }
}

export async function syncDengueEntryToSupabase(entry) {
  if (!supabaseClient || !isSupabaseOnline() || !entry) return { success: false, offline: true };
  try {
    const payload = {
      id: entry.id || `DNG_${Date.now()}`,
      patient_name: entry.patientName || '',
      age: Number(entry.age) || 0,
      gender: entry.gender || '',
      village: entry.village || '',
      upkendra: entry.upkendra || '',
      date_collection: entry.dateCollection || '',
      date_reporting: entry.dateReporting || '',
      disease_type: entry.diseaseType || 'डेंग्यू',
      lab_result: entry.labResult || 'प्रलंबित',
      created_at: entry.createdAt || new Date().toISOString()
    };
    const { error } = await supabaseClient
      .from('NVBDCP_DengueChikungunya')
      .upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    markSupabaseOnline();
    return { success: true };
  } catch (err) {
    markSupabaseOffline(err.message);
    return { success: false, offline: true, error: err.message };
  }
}

export async function deleteDengueEntryFromSupabase(id) {
  if (!supabaseClient || !isSupabaseOnline() || !id) return { success: false, offline: true };
  try {
    const { error } = await supabaseClient
      .from('NVBDCP_DengueChikungunya')
      .delete()
      .eq('id', id);
    if (error) throw error;
    markSupabaseOnline();
    return { success: true };
  } catch (err) {
    markSupabaseOffline(err.message);
    return { success: false, offline: true, error: err.message };
  }
}
