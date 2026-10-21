// =========================================================================
// PHC BHADA — NCD MANAGEMENT MODULE CLIENT CONTROLLER & RENDERER
// Supports 6 Main Screens: Dashboard (+ Line Listing), Replace Dataset,
// Subcenter Report, Village Report, Period/Disease Report, Import History
// Strictly uses SHC & Village names from the Active Uploaded NCD CSV Dataset
// =========================================================================

let currentNcdTab = 'dashboard';
let currentNcdFilters = {
  shc: 'ALL',
  village: 'ALL',
  disease: 'ALL',
  fromDate: '',
  toDate: ''
};
let currentNcdPage = 1;
let currentNcdLineSearch = '';
let currentNcdOnlyDiscrepancies = false;
let ncdStagedFiles = [];
let currentNcdUploadSessionId = null;
let cachedNcdVillagesByShc = {};
let cachedNcdAllVillages = [];

// Initialize NCD UI
window.initNcdUI = async function() {
  console.log('[NCD] Initializing NCD UI...');
  await populateNcdFilterDropdowns();
  await loadNcdTabContent(currentNcdTab);
};

// Switch NCD Subtab (6 Main Screens)
window.switchNcdSubtab = async function(tabName) {
  currentNcdTab = tabName;
  const tabs = ['dashboard', 'replaceDataset', 'subcenter', 'village', 'periodDisease', 'importHistory'];

  tabs.forEach(t => {
    const btn = document.getElementById(`ncdBtnTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const pane = document.getElementById(`ncdTab${t.charAt(0).toUpperCase() + t.slice(1)}`);

    if (btn) {
      if (t === tabName) {
        btn.classList.add('active');
        btn.style.background = '#0d9488';
        btn.style.color = '#ffffff';
      } else {
        btn.classList.remove('active');
        btn.style.background = '#f1f5f9';
        btn.style.color = '#475569';
      }
    }
    if (pane) {
      pane.style.display = (t === tabName) ? 'block' : 'none';
    }
  });

  await loadNcdTabContent(tabName);
};

// Dynamic Filter Dropdowns (Subcenters & Villages derived strictly from Active CSV Dataset)
async function populateNcdFilterDropdowns(scList, vilList, vilByShc) {
  let subcenters = scList;
  let villages = vilList;
  let villagesByShc = vilByShc;

  if (!Array.isArray(subcenters) || !Array.isArray(villages)) {
    const info = await callNcdRpc('getActiveDatasetInfo');
    if (info) {
      if (Array.isArray(info.subcentersList)) subcenters = info.subcentersList;
      if (Array.isArray(info.villagesList)) villages = info.villagesList;
      if (info.villagesByShc) villagesByShc = info.villagesByShc;
    }
  }

  if (Array.isArray(villages)) cachedNcdAllVillages = villages;
  if (villagesByShc && typeof villagesByShc === 'object') cachedNcdVillagesByShc = villagesByShc;

  const scSelects = document.querySelectorAll('.ncd-shc-filter');
  const vilSelects = document.querySelectorAll('.ncd-village-filter');

  if (Array.isArray(subcenters)) {
    scSelects.forEach(sel => {
      const currentVal = currentNcdFilters.shc || sel.value || 'ALL';
      sel.innerHTML = '<option value="ALL">सर्व उपकेंद्रे (All Subcenters - CSV)</option>';
      subcenters.forEach(sc => {
        const opt = document.createElement('option');
        opt.value = sc;
        opt.textContent = sc;
        sel.appendChild(opt);
      });
      if (currentVal && Array.from(sel.options).some(o => o.value === currentVal)) {
        sel.value = currentVal;
      } else {
        sel.value = 'ALL';
      }
    });
  }

  const activeShc = currentNcdFilters.shc || 'ALL';
  const effectiveVillages = (activeShc !== 'ALL' && cachedNcdVillagesByShc[activeShc])
    ? cachedNcdVillagesByShc[activeShc]
    : cachedNcdAllVillages;

  if (Array.isArray(effectiveVillages)) {
    vilSelects.forEach(sel => {
      const currentVal = currentNcdFilters.village || sel.value || 'ALL';
      sel.innerHTML = '<option value="ALL">सर्व गावे (All Villages - CSV)</option>';
      effectiveVillages.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        sel.appendChild(opt);
      });
      if (currentVal && Array.from(sel.options).some(o => o.value === currentVal)) {
        sel.value = currentVal;
      } else {
        sel.value = 'ALL';
        currentNcdFilters.village = 'ALL';
      }
    });
  }

  updateNcdExportLinks();
}

function updateNcdExportLinks() {
  const qs = new URLSearchParams();
  if (currentNcdFilters.shc && currentNcdFilters.shc !== 'ALL') qs.set('shc', currentNcdFilters.shc);
  if (currentNcdFilters.village && currentNcdFilters.village !== 'ALL') qs.set('village', currentNcdFilters.village);
  if (currentNcdFilters.disease && currentNcdFilters.disease !== 'ALL') qs.set('disease', currentNcdFilters.disease);
  if (currentNcdFilters.fromDate) qs.set('fromDate', currentNcdFilters.fromDate);
  if (currentNcdFilters.toDate) qs.set('toDate', currentNcdFilters.toDate);
  if (currentNcdLineSearch) qs.set('search', currentNcdLineSearch);
  if (currentNcdOnlyDiscrepancies) qs.set('onlyDiscrepancies', 'true');

  const queryStr = qs.toString() ? `?${qs.toString()}` : '';
  document.querySelectorAll('a[href^="/api/export/ncd-subcenter"]').forEach(a => {
    const base = a.getAttribute('href').split('?')[0];
    a.setAttribute('href', `${base}${queryStr}`);
  });
  document.querySelectorAll('a[href^="/api/export/ncd-village"]').forEach(a => {
    const base = a.getAttribute('href').split('?')[0];
    a.setAttribute('href', `${base}${queryStr}`);
  });
  document.querySelectorAll('a[href^="/api/export/ncd-line-listing"]').forEach(a => {
    const base = a.getAttribute('href').split('?')[0];
    a.setAttribute('href', `${base}${queryStr}`);
  });
}

// Global Filter Change
window.applyNcdFilters = function() {
  const sc = document.getElementById('ncdGlobalShcSelect')?.value || 'ALL';
  let vil = document.getElementById('ncdGlobalVillageSelect')?.value || 'ALL';
  const dis = document.getElementById('ncdGlobalDiseaseSelect')?.value || 'ALL';
  const fromD = document.getElementById('ncdGlobalFromDate')?.value || '';
  const toD = document.getElementById('ncdGlobalToDate')?.value || '';

  // If SHC changed and selected village does not belong to new SHC, reset village to ALL
  if (sc !== 'ALL' && vil !== 'ALL' && cachedNcdVillagesByShc[sc] && !cachedNcdVillagesByShc[sc].includes(vil)) {
    vil = 'ALL';
  }

  currentNcdFilters = { shc: sc, village: vil, disease: dis, fromDate: fromD, toDate: toD };
  currentNcdPage = 1;
  populateNcdFilterDropdowns(null, cachedNcdAllVillages, cachedNcdVillagesByShc);
  loadNcdTabContent(currentNcdTab);
};

window.resetNcdFilters = function() {
  currentNcdFilters = { shc: 'ALL', village: 'ALL', disease: 'ALL', fromDate: '', toDate: '' };
  currentNcdPage = 1;
  currentNcdLineSearch = '';
  currentNcdOnlyDiscrepancies = false;

  const scSel = document.getElementById('ncdGlobalShcSelect');
  const vilSel = document.getElementById('ncdGlobalVillageSelect');
  const disSel = document.getElementById('ncdGlobalDiseaseSelect');
  const fromD = document.getElementById('ncdGlobalFromDate');
  const toD = document.getElementById('ncdGlobalToDate');
  const searchInp = document.getElementById('ncdLineListingSearchInput');

  if (scSel) scSel.value = 'ALL';
  if (vilSel) vilSel.value = 'ALL';
  if (disSel) disSel.value = 'ALL';
  if (fromD) fromD.value = '';
  if (toD) toD.value = '';
  if (searchInp) searchInp.value = '';

  populateNcdFilterDropdowns(null, cachedNcdAllVillages, cachedNcdVillagesByShc);
  loadNcdTabContent(currentNcdTab);
};

// RPC Dispatch Helper
async function callNcdRpc(method, args = []) {
  try {
    const res = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, args })
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status}: ${txt.slice(0, 120)}`);
    }
    const json = await res.json();
    if (json && json.result) return json.result;
    if (json && json.error) throw new Error(json.error);
    return json;
  } catch (err) {
    console.error(`[NCD RPC Error] ${method}:`, err);
    showToast(`NCD डेटा एरर: ${err.message}`, 'error');
    return null;
  }
}

// Load Content for Current Active Subtab
async function loadNcdTabContent(tabName) {
  if (tabName === 'dashboard') {
    await renderNcdDashboard();
  } else if (tabName === 'replaceDataset') {
    await renderNcdActiveDatasetBanner();
  } else if (tabName === 'subcenter') {
    await renderNcdSubcenterReport();
  } else if (tabName === 'village') {
    await renderNcdVillageReport();
  } else if (tabName === 'periodDisease') {
    await renderNcdPeriodDiseaseReport();
  } else if (tabName === 'importHistory') {
    await renderNcdImportBatches();
  }
}

// -------------------------------------------------------------------------
// 1. DASHBOARD & LINE LISTING RENDERER
// -------------------------------------------------------------------------
async function renderNcdDashboard() {
  const stats = await callNcdRpc('getNcdDashboardStats', [currentNcdFilters]);
  if (!stats || !stats.kpis) return;

  if (stats.meta && stats.meta.subcentersList && stats.meta.villagesList) {
    await populateNcdFilterDropdowns(stats.meta.subcentersList, stats.meta.villagesList, stats.meta.villagesByShc);
  }

  const kpis = stats.kpis;
  const info = await callNcdRpc('getActiveDatasetInfo');
  const bannerEl = document.getElementById('ncdActiveDatasetBanner');
  if (bannerEl && info) {
    const discCount = info.crossFileConsistency?.locationDiscrepancyCount || 0;
    const discBadge = discCount > 0
      ? `<span class="badge bg-warning text-dark" style="cursor:pointer;" onclick="filterNcdLineListingDiscrepancies(true)">⚠️ SHC/Village विसंगती: ${discCount.toLocaleString('en-IN')}</span>`
      : `<span class="badge bg-success">✅ सर्व फाईल्समध्ये SHC व Village १००% सुसंगत (0 Discrepancies)</span>`;

    bannerEl.innerHTML = `
      <div style="background:#ccfbf1; border:1.5px solid #99f6e4; border-radius:10px; padding:12px 16px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:20px;">🟢</span>
          <div>
            <div style="font-size:13px; font-weight:800; color:#0f766e; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span>सध्या कार्यरत ॲक्टिव्ह NCD डेटासेट (Active CSV Dataset)</span>
              ${discBadge}
            </div>
            <div style="font-size:12px; font-weight:600; color:#115e59; margin-top:2px;">
              बॅच आयडी: <strong>${info.activeDatasetVersion}</strong> |
              एकूण CSV उपकेंद्रे (SHC): <strong>${(info.subcentersList || []).length} (${(info.subcentersList || []).join(', ') || '-'})</strong> |
              एकूण CSV गावे (Villages): <strong>${(info.villagesList || []).length}</strong> |
              अंतिम अपडेट: <strong>${new Date(info.lastReplacementTime).toLocaleString('mr-IN')}</strong>
            </div>
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-teal" style="background:#0d9488; color:#fff; font-weight:700;" onclick="switchNcdSubtab('replaceDataset')">
          🔄 नवीन डेटासेट रिप्लेस करा
        </button>
      </div>
    `;
  }

  document.getElementById('ncdKpiTotalIndividuals').innerText = (kpis.totalIndividuals || 0).toLocaleString('en-IN');
  document.getElementById('ncdKpiCbacCompleted').innerText = (kpis.cbacCompleted || 0).toLocaleString('en-IN');
  document.getElementById('ncdKpiScreeningEvents').innerText = (kpis.screeningCompletedEvents || 0).toLocaleString('en-IN');
  document.getElementById('ncdKpiUniqueScreened').innerText = (kpis.uniqueScreenedIndividuals || 0).toLocaleString('en-IN');

  const diagEl = document.getElementById('ncdKpiDiagnosed');
  if (diagEl) {
    diagEl.innerText = kpis.newlyDiagnosedCases > 0 ? kpis.newlyDiagnosedCases.toLocaleString('en-IN') : 'N/A*';
  }

  document.getElementById('ncdKpiUnderTreatment').innerText = (kpis.underTreatmentCases || 0).toLocaleString('en-IN');
  document.getElementById('ncdKpiUniqueTreatment').innerText = `${(kpis.uniqueUnderTreatmentIndividuals || 0).toLocaleString('en-IN')} (Adhering: ${(kpis.adheringFollowupCases || 0).toLocaleString('en-IN')})`;
  document.getElementById('ncdKpiMissedFollowup').innerText = (kpis.followupMissedCases || 0).toLocaleString('en-IN');
  document.getElementById('ncdKpiRescreening').innerText = 'N/A*';

  // Render Subcenter Breakdown Bar Chart
  const scReport = await callNcdRpc('getNcdSubcenterReport', [currentNcdFilters]);
  if (scReport && scReport.rows) {
    renderNcdSubcenterChart(scReport.rows);
  }

  // Render Disease Breakdown Chart
  const disReport = await callNcdRpc('getNcdDiseaseReport', [currentNcdFilters]);
  if (disReport && disReport.rows) {
    renderNcdDiseaseChart(disReport.rows);
  }

  // Render Paginated Line Listing Table on Dashboard
  await renderNcdLineListingSection();
}

function renderNcdSubcenterChart(rows) {
  const container = document.getElementById('ncdSubcenterChartContainer');
  if (!container) return;

  if (!rows || rows.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;">डेटा उपलब्ध नाही.</div>';
    return;
  }

  let html = '<div style="display:flex; flex-direction:column; gap:12px; margin-top:10px;">';
  const maxVal = Math.max(...rows.map(r => Math.max(r.totalScreenedEvents || 0, r.underTreatment || 0, 1)));

  rows.forEach(r => {
    const scrPct = Math.min(100, Math.round(((r.totalScreenedEvents || 0) / maxVal) * 100));
    const trtPct = Math.min(100, Math.round(((r.underTreatment || 0) / maxVal) * 100));

    html += `
      <div style="background:#f8fafc; border-radius:8px; padding:10px 14px; border:1px solid #e2e8f0;">
        <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
          <span>🏥 ${r.shc} (एकूण नागरिक: ${(r.totalIndividuals || 0).toLocaleString('en-IN')})</span>
          <span>स्क्रीनिंग: ${(r.totalScreenedEvents || 0).toLocaleString('en-IN')} (व्यक्ती: ${(r.uniqueScreenedIndividuals || 0).toLocaleString('en-IN')}) | उपचार: ${(r.underTreatment || 0).toLocaleString('en-IN')}</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:11px; font-weight:700; width:70px; color:#0f766e;">स्क्रीनिंग:</span>
            <div style="flex:1; background:#ccfbf1; height:12px; border-radius:6px; overflow:hidden;">
              <div style="width:${scrPct}%; background:#0d9488; height:100%; border-radius:6px;"></div>
            </div>
            <span style="font-size:11px; font-weight:700; width:55px; text-align:right;">${(r.totalScreenedEvents || 0).toLocaleString('en-IN')}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:11px; font-weight:700; width:70px; color:#c2410c;">उपचार:</span>
            <div style="flex:1; background:#ffedd5; height:12px; border-radius:6px; overflow:hidden;">
              <div style="width:${trtPct}%; background:#ea580c; height:100%; border-radius:6px;"></div>
            </div>
            <span style="font-size:11px; font-weight:700; width:55px; text-align:right;">${(r.underTreatment || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderNcdDiseaseChart(rows) {
  const container = document.getElementById('ncdDiseaseChartContainer');
  if (!container) return;

  if (!rows || rows.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;">डेटा उपलब्ध नाही.</div>';
    return;
  }

  let html = '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-top:10px;">';

  rows.forEach(r => {
    html += `
      <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:14px; text-align:center;">
        <div style="font-size:12px; font-weight:800; color:#166534; text-transform:uppercase;">${r.diseaseName}</div>
        <div style="margin-top:8px; font-size:24px; font-weight:800; color:#15803d;">${(r.screenedTotal || 0).toLocaleString('en-IN')}</div>
        <div style="font-size:11px; font-weight:700; color:#166534;">पूर्ण तपासणी (Completed)</div>
        <div style="margin-top:8px; padding-top:8px; border-top:1px dashed #86efac; display:flex; justify-content:space-between; font-size:11px; font-weight:700; color:#334155;">
          <span>उपचार: <strong style="color:#c2410c;">${(r.underTreatment || 0).toLocaleString('en-IN')}</strong></span>
          <span>नियंत्रित: <strong style="color:#15803d;">${(r.controlledCount || 0).toLocaleString('en-IN')}</strong></span>
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

// Individual Line Listing Section Renderer (STEP NCD-08 #5)
async function renderNcdLineListingSection() {
  let sectionEl = document.getElementById('ncdLineListingContainer');
  if (!sectionEl) {
    const dashEl = document.getElementById('ncdTabDashboard');
    if (!dashEl) return;
    sectionEl = document.createElement('div');
    sectionEl.id = 'ncdLineListingContainer';
    sectionEl.style.marginTop = '20px';
    dashEl.appendChild(sectionEl);
  }

  const listing = await callNcdRpc('getNcdLineListing', [{
    shc: currentNcdFilters.shc,
    village: currentNcdFilters.village,
    page: currentNcdPage,
    limit: 25,
    search: currentNcdLineSearch,
    onlyDiscrepancies: currentNcdOnlyDiscrepancies
  }]);

  if (!listing || !listing.success) return;

  const items = listing.items || [];
  updateNcdExportLinks();

  sectionEl.innerHTML = `
    <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:12px; padding:18px; box-shadow:0 4px 12px rgba(0,0,0,0.03);">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
        <div>
          <div style="font-size:15px; font-weight:800; color:#0f172a;">👥 नागरिक निहाय एकत्रित यादी (Individual Line Listing — CSV Authoritative SHC & Village)</div>
          <div style="font-size:12px; font-weight:600; color:#64748b;">
            एकूण नोंदी: <strong>${(listing.total || 0).toLocaleString('en-IN')}</strong> | पृष्ठ: <strong>${listing.page} / ${listing.totalPages}</strong>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <input type="text" id="ncdLineListingSearchInput" class="form-control form-control-sm" style="width:220px;" placeholder="ID, नाव, SHC किंवा गाव शोधा..." value="${currentNcdLineSearch.replace(/"/g, '&quot;')}" onkeydown="if(event.key==='Enter') searchNcdLineListing()">
          <button type="button" class="btn btn-sm btn-primary" onclick="searchNcdLineListing()">🔍 शोधा</button>
          <a href="/api/export/ncd-line-listing.xlsx" target="_blank" download class="btn btn-outline-success btn-sm font-weight-bold">📊 Line Listing Excel</a>
          <a href="/api/export/ncd-line-listing.csv" target="_blank" download class="btn btn-outline-secondary btn-sm font-weight-bold">📄 CSV</a>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-sm table-bordered table-striped align-middle" style="font-size:12.5px;">
          <thead style="background:#0f766e; color:#ffffff;">
            <tr>
              <th class="text-center">#</th>
              <th>Individual ID</th>
              <th>नागरिकाचे नाव (Name)</th>
              <th class="text-center">वय / लिंग</th>
              <th>उपकेंद्र (SHC - CSV)</th>
              <th>गाव (Village - CSV)</th>
              <th>CBAC स्थिती / गुण</th>
              <th>पूर्ण स्क्रिनिंग (Completed Screenings)</th>
              <th>उपचार स्थिती (Treatment Status)</th>
            </tr>
          </thead>
          <tbody>
            ${items.length === 0 ? `
              <tr><td colspan="9" class="text-center py-3 text-muted">निवडलेल्या फिल्टरनुसार कोणतीही नोंद आढळली नाही.</td></tr>
            ` : items.map((item, idx) => {
              const rowNum = (listing.page - 1) * listing.limit + idx + 1;
              const fullName = [item.first_name, item.middle_name, item.last_name].filter(Boolean).join(' ') || '-';
              return `
                <tr>
                  <td class="text-center">${rowNum}</td>
                  <td><code>${item.individual_id}</code></td>
                  <td><strong>${fullName}</strong></td>
                  <td class="text-center">${item.age || '-'} / ${item.sex || '-'}</td>
                  <td><strong>${item.shc || '-'}</strong></td>
                  <td><strong>${item.village || '-'}</strong></td>
                  <td>${item.cbac_status || '-'} ${item.cbac_risk_score ? `(Score: ${item.cbac_risk_score})` : ''} ${item.cbac_date ? `<br><small class="text-muted">${item.cbac_date}</small>` : ''}</td>
                  <td><small>${item.completed_screenings || '-'}</small></td>
                  <td><small>${item.active_treatments || '-'}</small></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; flex-wrap:wrap; gap:8px;">
        <div style="font-size:12px; color:#475569;">
          एकूण <strong>${(listing.total || 0).toLocaleString('en-IN')}</strong> नागरिकांपैकी <strong>${items.length}</strong> दर्शविले आहेत.
        </div>
        <div style="display:flex; gap:6px;">
          <button type="button" class="btn btn-outline-secondary btn-sm" ${listing.page <= 1 ? 'disabled' : ''} onclick="changeNcdLineListingPage(${listing.page - 1})">⬅️ मागील</button>
          <span class="btn btn-light btn-sm disabled" style="font-weight:700;">पृष्ठ ${listing.page} / ${listing.totalPages}</span>
          <button type="button" class="btn btn-outline-secondary btn-sm" ${listing.page >= listing.totalPages ? 'disabled' : ''} onclick="changeNcdLineListingPage(${listing.page + 1})">पुढील ➡️</button>
        </div>
      </div>
    </div>
  `;
}

window.searchNcdLineListing = function() {
  const inp = document.getElementById('ncdLineListingSearchInput');
  currentNcdLineSearch = inp ? inp.value.trim() : '';
  currentNcdPage = 1;
  renderNcdLineListingSection();
};

window.changeNcdLineListingPage = function(newPage) {
  currentNcdPage = Math.max(1, newPage);
  renderNcdLineListingSection();
};

window.filterNcdLineListingDiscrepancies = function(onlyDisc) {
  currentNcdOnlyDiscrepancies = Boolean(onlyDisc);
  currentNcdPage = 1;
  renderNcdLineListingSection();
};

// -------------------------------------------------------------------------
// 2. DATASET REPLACEMENT & CHUNKED MULTI-FILE UPLOAD RENDERER
// -------------------------------------------------------------------------
async function renderNcdActiveDatasetBanner() {
  const info = await callNcdRpc('getActiveDatasetInfo');
  const el = document.getElementById('ncdReplaceActiveInfo');
  if (!el || !info) return;

  el.innerHTML = `
    <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:10px; padding:16px; margin-bottom:20px;">
      <div style="font-size:14px; font-weight:800; color:#166534;">📊 सध्याचा ॲक्टिव्ह डेटासेट तपशील (Current Active Dataset)</div>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-top:10px; font-size:12.5px;">
        <div>ॲक्टिव्ह व्हर्जन: <strong>${info.activeDatasetVersion}</strong></div>
        <div>एकूण नागरिक: <strong>${(info.totalIndividuals || 0).toLocaleString('en-IN')}</strong></div>
        <div>एकूण CBAC नोंदी: <strong>${(info.totalCbacRecords || 0).toLocaleString('en-IN')}</strong></div>
        <div>एकूण स्क्रिनिंग नोंदी: <strong>${(info.totalScreeningRecords || 0).toLocaleString('en-IN')}</strong></div>
        <div>उपचार नोंदी: <strong>${(info.totalTreatmentRecords || 0).toLocaleString('en-IN')}</strong></div>
        <div>CSV उपकेंद्रे (SHC): <strong>${(info.subcentersList || []).length} (${(info.subcentersList || []).join(', ') || '-'})</strong></div>
        <div>CSV गावे (Villages): <strong>${(info.villagesList || []).length}</strong></div>
      </div>
    </div>
  `;
}

window.handleNcdMultiFileSelect = async function(event) {
  const fileList = Array.from(event.target.files);
  if (fileList.length === 0) return;

  ncdStagedFiles = [];
  const container = document.getElementById('ncdMultiFilePreviewContainer');
  if (container) {
    container.style.display = 'block';
    container.innerHTML = `
      <div style="background:#ffffff; border:2px solid #0d9488; border-radius:12px; padding:24px; text-align:center;">
        <div style="font-size:15px; font-weight:800; color:#0f766e; margin-bottom:8px;">⏳ निवडलेल्या CSV फाईल्स वाचल्या व व्हॅलिडेट केल्या जात आहेत...</div>
        <div id="ncdUploadProgressText" style="font-size:13px; color:#475569;">फाईल वाचन प्रगतीपथावर...</div>
      </div>
    `;
  }

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const content = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = err => reject(err);
      reader.readAsText(file, 'UTF-8');
    });
    ncdStagedFiles.push({ filename: file.name, csvContent: content });
  }

  await processNcdMultiFilePreview();
};

async function processNcdMultiFilePreview() {
  const container = document.getElementById('ncdMultiFilePreviewContainer');
  if (!container) return;

  try {
    // Stage files in 2MB chunks on backend to avoid Cloud Run 32MB single-request limit
    currentNcdUploadSessionId = `NCD_UPLOAD_${Date.now()}`;
    const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB per request

    for (let fIdx = 0; fIdx < ncdStagedFiles.length; fIdx++) {
      const fileObj = ncdStagedFiles[fIdx];
      const text = String(fileObj.csvContent || '');
      const totalChunks = Math.max(1, Math.ceil(text.length / CHUNK_SIZE));

      for (let cIdx = 0; cIdx < totalChunks; cIdx++) {
        const chunkData = text.slice(cIdx * CHUNK_SIZE, (cIdx + 1) * CHUNK_SIZE);
        const progEl = document.getElementById('ncdUploadProgressText');
        if (progEl) {
          progEl.innerText = `फाईल ${fIdx + 1}/${ncdStagedFiles.length} (${fileObj.filename}) — भाग ${cIdx + 1}/${totalChunks} अपलोड होत आहे...`;
        }
        const stageRes = await callNcdRpc('stageNcdCsvChunk', [{
          sessionId: currentNcdUploadSessionId,
          fileIndex: fIdx,
          filename: fileObj.filename,
          chunkIndex: cIdx,
          totalChunks,
          chunkData,
          resetSession: fIdx === 0 && cIdx === 0
        }]);
        if (!stageRes || !stageRes.success) {
          throw new Error(`फाईल ${fileObj.filename} अपलोड करताना त्रुटी आली.`);
        }
      }
    }

    const progEl = document.getElementById('ncdUploadProgressText');
    if (progEl) progEl.innerText = 'सर्व फाईल्सचे हेडर, Individual ID व SHC/Village व्हॅलिडेशन सुरु आहे...';

    const preview = await callNcdRpc('previewNcdMultiFileImport', [[], currentNcdUploadSessionId]);

    if (!preview || !preview.success) {
      showToast('फाईल्स व्हॅलिडेट करताना एरर निर्माण झाला.', 'error');
      return;
    }

    const cfc = preview.crossFileConsistency || {};

    let html = `
      <div style="background:#ffffff; border:2px solid #0d9488; border-radius:12px; padding:20px; margin-bottom:20px; box-shadow:0 10px 25px -5px rgba(13,148,136,0.15);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:12px; margin-bottom:14px;">
          <div style="font-size:16px; font-weight:800; color:#0f172a;">📋 निवडलेल्या फाईल्सचे व्हॅलिडेशन पुरावलोकन (Pre-Import Validation & CSV SHC/Village Audit)</div>
          <span class="badge ${preview.validationPassed ? 'bg-success' : 'bg-danger'}" style="font-size:13px;">
            ${preview.validationPassed ? '✅ व्हॅलिडेशन यशस्वी' : '❌ व्हॅलिडेशन त्रुटी'}
          </span>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:12px; margin-bottom:16px;">
          <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #cbd5e1; text-align:center;">
            <div style="font-size:11px; font-weight:700; color:#64748b;">एकूण फाईल्स</div>
            <div style="font-size:20px; font-weight:800; color:#0f172a;">${preview.totalFiles}</div>
          </div>
          <div style="background:#f0fdf4; padding:12px; border-radius:8px; border:1px solid #86efac; text-align:center;">
            <div style="font-size:11px; font-weight:700; color:#166534;">युनिक नागरिक (Individual IDs)</div>
            <div style="font-size:20px; font-weight:800; color:#15803d;">${(preview.totalUniqueIndividuals || 0).toLocaleString('en-IN')}</div>
          </div>
          <div style="background:#fef3c7; padding:12px; border-radius:8px; border:1px solid #fde68a; text-align:center;">
            <div style="font-size:11px; font-weight:700; color:#92400e;">एकूण मूळ ओळी (Source Rows)</div>
            <div style="font-size:20px; font-weight:800; color:#78350f;">${(preview.totalRowsSum || 0).toLocaleString('en-IN')}</div>
          </div>
          <div style="background:#e0f2fe; padding:12px; border-radius:8px; border:1px solid #bae6fd; text-align:center;">
            <div style="font-size:11px; font-weight:700; color:#0369a1;">CSV मधील उपकेंद्रे (SHC)</div>
            <div style="font-size:20px; font-weight:800; color:#0284c7;">${(preview.distinctShcs || []).length}</div>
          </div>
          <div style="background:#f3e8ff; padding:12px; border-radius:8px; border:1px solid #d8b4fe; text-align:center;">
            <div style="font-size:11px; font-weight:700; color:#6b21a8;">CSV मधील गावे (Villages)</div>
            <div style="font-size:20px; font-weight:800; color:#7e22ce;">${(preview.distinctVillages || []).length}</div>
          </div>
        </div>

        <div style="font-size:13px; font-weight:800; color:#334155; margin-bottom:8px;">फाईल निहाय तपशील (File-by-File Source Counts & Headers):</div>
        <div class="table-responsive" style="margin-bottom:16px;">
          <table class="table table-sm table-bordered align-middle" style="font-size:12.5px;">
            <thead style="background:#f1f5f9;">
              <tr>
                <th>फाईल नाव</th>
                <th>प्रकार</th>
                <th>एकूण कॉलम्स (Headers)</th>
                <th>एकूण मूळ ओळी</th>
                <th>स्वीकृत (Accepted)</th>
                <th>अस्वीकृत (Rejected)</th>
                <th>युनिक Individual IDs</th>
                <th>CSV उपकेंद्रे (SHC)</th>
                <th>CSV गावे (Villages)</th>
              </tr>
            </thead>
            <tbody>
              ${preview.filesSummary.map(f => `
                <tr>
                  <td><strong>${f.filename}</strong></td>
                  <td><span class="badge bg-info text-dark">${f.fileType}</span></td>
                  <td class="text-center">${f.headersCount} (SHC: <code>${f.detectedShcHeader || '-'}</code>, Village: <code>${f.detectedVillageHeader || '-'}</code>)</td>
                  <td class="text-end fw-bold">${(f.totalRows || 0).toLocaleString('en-IN')}</td>
                  <td class="text-end text-success fw-bold">${(f.validRows || 0).toLocaleString('en-IN')}</td>
                  <td class="text-end text-danger">${(f.invalidRows || 0).toLocaleString('en-IN')}</td>
                  <td class="text-end text-primary fw-bold">${(f.uniqueIdsInFile || f.validRows || 0).toLocaleString('en-IN')}</td>
                  <td><small>${(f.distinctShcs || []).join(', ') || '-'}</small></td>
                  <td class="text-center"><strong>${f.distinctVillagesCount || 0}</strong> गावे</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:12px 16px; margin-bottom:16px; font-size:12.5px;">
          <div style="font-weight:800; color:#0f172a; margin-bottom:6px;">🔗 क्रॉस-फाईल Individual ID व SHC/Village सुसंगतता तपासणी (Cross-File Consistency Check):</div>
          <div style="display:flex; flex-wrap:wrap; gap:16px;">
            <div>CBAC व Screening जुळणारे IDs: <strong>${(cfc.cbacScreeningMatchedCount || 0).toLocaleString('en-IN')}</strong></div>
            <div>Treatment व CBAC जुळणारे IDs: <strong>${(cfc.treatmentMatchedInCbacCount || 0).toLocaleString('en-IN')}</strong></div>
            <div>Treatment व Screening जुळणारे IDs: <strong>${(cfc.treatmentMatchedInScreeningCount || 0).toLocaleString('en-IN')}</strong></div>
            <div>SHC / Village विसंगती (Discrepancies): <strong class="${(cfc.locationDiscrepancyCount || 0) > 0 ? 'text-danger' : 'text-success'}">${(cfc.locationDiscrepancyCount || 0).toLocaleString('en-IN')}</strong></div>
          </div>
          <div style="margin-top:6px; font-size:12px; color:#334155;">
            <strong>आढळलेली उपकेंद्रे (SHC):</strong> ${(preview.distinctShcs || []).join(', ') || '-'}<br>
            <strong>आढळलेली गावे (Villages - ${(preview.distinctVillages || []).length}):</strong> ${(preview.distinctVillages || []).join(', ') || '-'}
          </div>
        </div>

        <div style="background:#fffbeb; border:1.5px solid #fde68a; border-radius:10px; padding:14px; margin-bottom:16px; display:flex; gap:12px; align-items:center;">
          <span style="font-size:24px;">⚠️</span>
          <div style="font-size:12.5px; font-weight:700; color:#92400e;">
            <strong>इशारा (Important Notice):</strong> डेटासेट रिप्लेसमेंट स्वीकारल्यानंतर सध्याचा NCD डेटासेट पूर्णपणे नवीन डेटासेटने रिप्लेस केला जाईल. (NVBDCP व NWBDCP डेटा सुरक्षित राहील).
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="cancelNcdDatasetReplacement()">रद्द करा</button>
          <button type="button" id="btnConfirmNcdReplacement" class="btn btn-danger btn-sm" style="background:#dc2626; border-color:#b91c1c; font-weight:800; padding:8px 20px;" ${!preview.validationPassed ? 'disabled' : ''} onclick="confirmAndExecuteDatasetReplacement()">
            🔄 मागील डेटासेट रिप्लेस करा व ॲक्टिव्हेट करा (Confirm Replacement)
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;
    container.style.display = 'block';
  } catch (err) {
    console.error('[NCD Preview Error]:', err);
    showToast(`व्हॅलिडेशन त्रुटी: ${err.message}`, 'error');
  }
}

window.cancelNcdDatasetReplacement = function() {
  const container = document.getElementById('ncdMultiFilePreviewContainer');
  if (container) container.style.display = 'none';
  if (currentNcdUploadSessionId) {
    callNcdRpc('clearNcdStagedSession', [currentNcdUploadSessionId]);
    currentNcdUploadSessionId = null;
  }
  ncdStagedFiles = [];
};

window.confirmAndExecuteDatasetReplacement = async function() {
  if ((!ncdStagedFiles || ncdStagedFiles.length === 0) && !currentNcdUploadSessionId) {
    showToast('रिप्लेस करण्यासाठी कोणत्याही फाईल्स निवडलेल्या नाहीत.', 'warning');
    return;
  }

  const btn = document.getElementById('btnConfirmNcdReplacement');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Supabase मध्ये डेटासेट सेव्ह व ॲक्टिव्हेट होत आहे... कृपया थांबा...';
  }

  showToast('NCD डेटासेट रिप्लेस व ॲक्टिव्हेट सुरु आहे...', 'info');
  const payload = currentNcdUploadSessionId
    ? { sessionId: currentNcdUploadSessionId, userEmail: 'phbhada@gmail.com' }
    : { files: ncdStagedFiles, userEmail: 'phbhada@gmail.com' };

  const res = await callNcdRpc('replaceNcdDataset', [payload]);

  if (res && res.success) {
    showToast(`✅ ${res.message}`, 'success');
    cancelNcdDatasetReplacement();
    await populateNcdFilterDropdowns();
    await renderNcdActiveDatasetBanner();
    await renderNcdDashboard();
    await switchNcdSubtab('dashboard');
  } else {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🔄 मागील डेटासेट रिप्लेस करा व ॲक्टिव्हेट करा (Confirm Replacement)';
    }
    showToast(res?.message || 'डेटासेट रिप्लेसमेंट करताना त्रुटी आली.', 'error');
  }
};

async function renderNcdImportBatches() {
  const data = await callNcdRpc('getNcdImportBatches');
  const tbody = document.getElementById('ncdImportBatchesTbody');
  if (!tbody) return;

  if (!data || !data.batches || data.batches.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3 text-muted">अजून कोणताही डेटासेट रिप्लेस केलेला नाही.</td></tr>';
    return;
  }

  tbody.innerHTML = data.batches.map((b, idx) => `
    <tr class="${b.status === 'ACTIVE' ? 'table-success' : ''}">
      <td>${idx + 1}</td>
      <td><strong>${b.batch_id}</strong></td>
      <td>
        <span class="badge ${b.status === 'ACTIVE' ? 'bg-success' : 'bg-secondary'}">
          ${b.status === 'ACTIVE' ? '🟢 ACTIVE DATASET' : 'SUPERSEDED'}
        </span>
      </td>
      <td>${(b.filenames || [b.file_name]).join(', ')}</td>
      <td>${new Date(b.imported_at).toLocaleString('mr-IN')}</td>
      <td>${b.imported_by || 'Authorized User'}</td>
      <td><strong>${(b.total_individuals || b.total_rows || 0).toLocaleString('en-IN')} नागरिक</strong></td>
    </tr>
  `).join('');
}

// -------------------------------------------------------------------------
// 3. SUBCENTER-WISE REPORT RENDERER (CSV AUTHORITATIVE SHC NAMES)
// -------------------------------------------------------------------------
async function renderNcdSubcenterReport() {
  const report = await callNcdRpc('getNcdSubcenterReport', [currentNcdFilters]);
  const tbody = document.getElementById('ncdSubcenterReportTbody');
  const noteEl = document.getElementById('ncdSubcenterReportNote');
  if (!tbody) return;

  if (noteEl) noteEl.innerText = report?.notes || '';

  if (!report || !report.rows || report.rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" class="text-center py-3 text-muted">डेटा उपलब्ध नाही.</td></tr>';
    return;
  }

  let totInd = 0, totCbac = 0, totHtn = 0, totDm = 0, totOc = 0, totBc = 0, totCc = 0, totScr = 0, totDiag = 0, totTrt = 0;

  let html = report.rows.map(r => {
    totInd += r.totalIndividuals || 0;
    totCbac += r.cbacCompleted || 0;
    totHtn += r.htnScreened || 0;
    totDm += r.dmScreened || 0;
    totOc += r.ocScreened || 0;
    totBc += r.bcScreened || 0;
    totCc += r.ccScreened || 0;
    totScr += r.totalScreenedEvents || 0;
    totDiag += r.newlyDiagnosed || 0;
    totTrt += r.underTreatment || 0;

    return `
      <tr>
        <td class="text-center">${r.srNo}</td>
        <td><strong>🏥 ${r.shc}</strong></td>
        <td class="text-end fw-bold">${(r.totalIndividuals || 0).toLocaleString('en-IN')}</td>
        <td class="text-end text-primary">${(r.cbacCompleted || 0).toLocaleString('en-IN')}</td>
        <td class="text-end">${(r.htnScreened || 0).toLocaleString('en-IN')}</td>
        <td class="text-end">${(r.dmScreened || 0).toLocaleString('en-IN')}</td>
        <td class="text-end">${(r.ocScreened || 0).toLocaleString('en-IN')}</td>
        <td class="text-end">${(r.bcScreened || 0).toLocaleString('en-IN')}</td>
        <td class="text-end">${(r.ccScreened || 0).toLocaleString('en-IN')}</td>
        <td class="text-end fw-bold text-success">${(r.totalScreenedEvents || 0).toLocaleString('en-IN')}<br><small class="text-muted">(व्यक्ती: ${(r.uniqueScreenedIndividuals || 0).toLocaleString('en-IN')})</small></td>
        <td class="text-center text-muted">${r.newlyDiagnosed > 0 ? r.newlyDiagnosed.toLocaleString('en-IN') : 'N/A*'}</td>
        <td class="text-end text-warning fw-bold">${(r.underTreatment || 0).toLocaleString('en-IN')}<br><small class="text-muted">(Adhering: ${r.adheringFollowup || 0} | Missed: ${r.missedFollowup || 0})</small></td>
      </tr>
    `;
  }).join('');

  html += `
    <tr style="background:#e0f2fe; font-weight:800; border-top:2px solid #0284c7;">
      <td colspan="2" class="text-center">एकूण बेरीज (Total):</td>
      <td class="text-end">${totInd.toLocaleString('en-IN')}</td>
      <td class="text-end text-primary">${totCbac.toLocaleString('en-IN')}</td>
      <td class="text-end">${totHtn.toLocaleString('en-IN')}</td>
      <td class="text-end">${totDm.toLocaleString('en-IN')}</td>
      <td class="text-end">${totOc.toLocaleString('en-IN')}</td>
      <td class="text-end">${totBc.toLocaleString('en-IN')}</td>
      <td class="text-end">${totCc.toLocaleString('en-IN')}</td>
      <td class="text-end text-success">${totScr.toLocaleString('en-IN')}</td>
      <td class="text-center text-muted">${totDiag > 0 ? totDiag.toLocaleString('en-IN') : 'N/A*'}</td>
      <td class="text-end text-warning">${totTrt.toLocaleString('en-IN')}</td>
    </tr>
  `;

  tbody.innerHTML = html;
}

// -------------------------------------------------------------------------
// 4. VILLAGE-WISE REPORT RENDERER (CSV AUTHORITATIVE SHC & VILLAGE NAMES)
// -------------------------------------------------------------------------
async function renderNcdVillageReport() {
  const report = await callNcdRpc('getNcdVillageReport', [currentNcdFilters]);
  const tbody = document.getElementById('ncdVillageReportTbody');
  if (!tbody) return;

  if (!report || !report.rows || report.rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" class="text-center py-3 text-muted">डेटा उपलब्ध नाही.</td></tr>';
    return;
  }

  let totInd = 0, totCbac = 0, totHtn = 0, totDm = 0, totOc = 0, totBc = 0, totCc = 0, totScr = 0, totTrt = 0;

  let html = report.rows.map(r => {
    totInd += r.totalIndividuals || 0;
    totCbac += r.cbacCompleted || 0;
    totHtn += r.htnScreened || 0;
    totDm += r.dmScreened || 0;
    totOc += r.ocScreened || 0;
    totBc += r.bcScreened || 0;
    totCc += r.ccScreened || 0;
    totScr += r.totalScreenedEvents || 0;
    totTrt += r.underTreatment || 0;

    return `
      <tr>
        <td class="text-center">${r.srNo}</td>
        <td><strong>${r.shc}</strong></td>
        <td><strong>🏡 ${r.village}</strong></td>
        <td class="text-end fw-bold">${(r.totalIndividuals || 0).toLocaleString('en-IN')}</td>
        <td class="text-end text-primary">${(r.cbacCompleted || 0).toLocaleString('en-IN')}</td>
        <td class="text-end">${(r.htnScreened || 0).toLocaleString('en-IN')}</td>
        <td class="text-end">${(r.dmScreened || 0).toLocaleString('en-IN')}</td>
        <td class="text-end">${(r.ocScreened || 0).toLocaleString('en-IN')}</td>
        <td class="text-end">${(r.bcScreened || 0).toLocaleString('en-IN')}</td>
        <td class="text-end">${(r.ccScreened || 0).toLocaleString('en-IN')}</td>
        <td class="text-end fw-bold text-success">${(r.totalScreenedEvents || 0).toLocaleString('en-IN')}<br><small class="text-muted">(व्यक्ती: ${(r.uniqueScreenedIndividuals || 0).toLocaleString('en-IN')})</small></td>
        <td class="text-end text-warning fw-bold">${(r.underTreatment || 0).toLocaleString('en-IN')}<br><small class="text-muted">(Adhering: ${r.adheringFollowup || 0} | Missed: ${r.missedFollowup || 0})</small></td>
      </tr>
    `;
  }).join('');

  html += `
    <tr style="background:#e0f2fe; font-weight:800; border-top:2px solid #0284c7;">
      <td colspan="3" class="text-center">एकूण बेरीज (Total):</td>
      <td class="text-end">${totInd.toLocaleString('en-IN')}</td>
      <td class="text-end text-primary">${totCbac.toLocaleString('en-IN')}</td>
      <td class="text-end">${totHtn.toLocaleString('en-IN')}</td>
      <td class="text-end">${totDm.toLocaleString('en-IN')}</td>
      <td class="text-end">${totOc.toLocaleString('en-IN')}</td>
      <td class="text-end">${totBc.toLocaleString('en-IN')}</td>
      <td class="text-end">${totCc.toLocaleString('en-IN')}</td>
      <td class="text-end text-success">${totScr.toLocaleString('en-IN')}</td>
      <td class="text-end text-warning">${totTrt.toLocaleString('en-IN')}</td>
    </tr>
  `;

  tbody.innerHTML = html;
}

// -------------------------------------------------------------------------
// 5. PERIOD-WISE & DISEASE-WISE REPORT RENDERER (WITH CSV SHC/VILLAGE BREAKDOWN)
// -------------------------------------------------------------------------
async function renderNcdPeriodDiseaseReport() {
  const [stats, disReport, scReport, vilReport] = await Promise.all([
    callNcdRpc('getNcdDashboardStats', [currentNcdFilters]),
    callNcdRpc('getNcdDiseaseReport', [currentNcdFilters]),
    callNcdRpc('getNcdSubcenterReport', [currentNcdFilters]),
    callNcdRpc('getNcdVillageReport', [currentNcdFilters])
  ]);

  const container = document.getElementById('ncdPeriodDiseaseContainer');
  if (!container) return;

  if (!stats || !stats.kpis) {
    container.innerHTML = '<div class="text-center py-3 text-muted">डेटा उपलब्ध नाही.</div>';
    return;
  }

  const k = stats.kpis;
  const f = stats.filters || {};

  let html = `
    <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:12px; padding:20px; margin-bottom:20px; box-shadow:0 4px 12px rgba(0,0,0,0.03);">
      <div style="font-size:16px; font-weight:800; color:#0f172a; margin-bottom:8px;">
        📅 कालावधी निहाय NCD अहवाल (Period-wise NCD Activity Summary)
      </div>
      <div style="font-size:13px; font-weight:600; color:#475569; margin-bottom:16px;">
        निवडलेला कालावधी: <strong>${f.fromDate || 'प्रारंभ'}</strong> पासून <strong>${f.toDate || 'आजपर्यंत'}</strong> |
        उपकेंद्र (SHC): <strong>${f.shc && f.shc !== 'ALL' ? f.shc : 'सर्व (All CSV Subcenters)'}</strong> |
        गाव (Village): <strong>${f.village && f.village !== 'ALL' ? f.village : 'सर्व (All CSV Villages)'}</strong>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:14px; margin-bottom:20px;">
        <div style="background:#fef3c7; border:1px solid #fde68a; border-radius:10px; padding:16px;">
          <div style="font-size:12px; font-weight:800; color:#92400e;">CBAC फॉर्म्स (CBAC Date)</div>
          <div style="font-size:28px; font-weight:800; color:#78350f; margin-top:6px;">${(k.cbacCompleted || 0).toLocaleString('en-IN')}</div>
          <div style="font-size:11px; font-weight:600; color:#92400e;">पूर्ण CBAC मूल्यमापन नोंदी</div>
        </div>

        <div style="background:#ccfbf1; border:1px solid #99f6e4; border-radius:10px; padding:16px;">
          <div style="font-size:12px; font-weight:800; color:#115e59;">पूर्ण स्क्रीनिंग चाचण्या (Completed Screenings)</div>
          <div style="font-size:28px; font-weight:800; color:#0f766e; margin-top:6px;">${(k.screeningCompletedEvents || 0).toLocaleString('en-IN')}</div>
          <div style="font-size:11px; font-weight:600; color:#115e59;">युनिक व्यक्ती: ${(k.uniqueScreenedIndividuals || 0).toLocaleString('en-IN')} | प्रलंबित: ${(k.screeningPendingEvents || 0).toLocaleString('en-IN')}</div>
        </div>

        <div style="background:#ffedd5; border:1px solid #fed7aa; border-radius:10px; padding:16px;">
          <div style="font-size:12px; font-weight:800; color:#9a3412;">उपचार व फॉलो-अप नोंदी (Treatment)</div>
          <div style="font-size:28px; font-weight:800; color:#c2410c; margin-top:6px;">${(k.underTreatmentCases || 0).toLocaleString('en-IN')}</div>
          <div style="font-size:11px; font-weight:600; color:#9a3412;">युनिक व्यक्ती: ${(k.uniqueUnderTreatmentIndividuals || 0).toLocaleString('en-IN')} | Adhering: ${(k.adheringFollowupCases || 0).toLocaleString('en-IN')} | Missed: ${(k.followupMissedCases || 0).toLocaleString('en-IN')}</div>
        </div>
      </div>
    </div>

    <!-- Disease-wise Table Section -->
    <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:12px; padding:20px; margin-bottom:20px; box-shadow:0 4px 12px rgba(0,0,0,0.03);">
      <div style="font-size:16px; font-weight:800; color:#0f172a; margin-bottom:16px;">🩺 आजार निहाय NCD अहवाल (Disease-wise Summary — HTN, DM, OC, BC, CC)</div>
      
      <div class="table-responsive">
        <table class="table table-bordered table-striped align-middle" style="font-size:13px;">
          <thead style="background:#3730a3; color:#ffffff;">
            <tr>
              <th class="text-center">अ.क्र.</th>
              <th>आजार (Disease)</th>
              <th class="text-end">पूर्ण तपासणी (Completed Screening)</th>
              <th class="text-end">प्रलंबित तपासणी (Pending)</th>
              <th class="text-center">नवीन निदान (Newly Diagnosed)</th>
              <th class="text-end">उपचाराखालील (Under Treatment)</th>
              <th class="text-end">Adhering / Missed Follow-up</th>
              <th class="text-end">नियंत्रित / अनियंत्रित</th>
            </tr>
          </thead>
          <tbody>
            ${(disReport?.rows || []).map(r => `
              <tr>
                <td class="text-center">${r.srNo}</td>
                <td><strong>${r.diseaseName}</strong></td>
                <td class="text-end fw-bold text-success">${(r.screenedTotal || 0).toLocaleString('en-IN')} <small class="text-muted">(व्यक्ती: ${(r.uniqueScreenedIndividuals || 0).toLocaleString('en-IN')})</small></td>
                <td class="text-end text-secondary">${(r.pendingScreeningCount || 0).toLocaleString('en-IN')}</td>
                <td class="text-center">${r.newlyDiagnosedCount > 0 ? `<span class="badge bg-purple text-dark">${r.newlyDiagnosedCount.toLocaleString('en-IN')}</span>` : '<span class="badge bg-secondary">Source Data Unavailable*</span>'}</td>
                <td class="text-end fw-bold text-warning">${(r.underTreatment || 0).toLocaleString('en-IN')}</td>
                <td class="text-end">${(r.adheringFollowupCount || 0).toLocaleString('en-IN')} / <span class="text-danger">${(r.missedFollowupCount || 0).toLocaleString('en-IN')}</span></td>
                <td class="text-end text-primary">${(r.controlledCount || 0).toLocaleString('en-IN')} / ${(r.uncontrolledCount || 0).toLocaleString('en-IN')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Period-wise Subcenter & Village Summary (CSV Authoritative) -->
    <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:12px; padding:20px; box-shadow:0 4px 12px rgba(0,0,0,0.03);">
      <div style="font-size:16px; font-weight:800; color:#0f172a; margin-bottom:12px;">🏡 कालावधी निहाय उपकेंद्र व गाव सारांश (Period-wise CSV Subcenter & Village Breakdown)</div>
      <div class="table-responsive">
        <table class="table table-sm table-bordered table-striped align-middle" style="font-size:12.5px;">
          <thead style="background:#0f766e; color:#ffffff;">
            <tr>
              <th class="text-center">#</th>
              <th>उपकेंद्र (SHC - CSV)</th>
              <th>गाव (Village - CSV)</th>
              <th class="text-end">एकूण नागरिक</th>
              <th class="text-end">CBAC पूर्ण (कालावधीत)</th>
              <th class="text-end">पूर्ण स्क्रिनिंग (कालावधीत)</th>
              <th class="text-end">उपचाराखालील (कालावधीत)</th>
            </tr>
          </thead>
          <tbody>
            ${(vilReport?.rows || []).map(r => `
              <tr>
                <td class="text-center">${r.srNo}</td>
                <td><strong>${r.shc}</strong></td>
                <td><strong>${r.village}</strong></td>
                <td class="text-end">${(r.totalIndividuals || 0).toLocaleString('en-IN')}</td>
                <td class="text-end text-primary">${(r.cbacCompleted || 0).toLocaleString('en-IN')}</td>
                <td class="text-end text-success fw-bold">${(r.totalScreenedEvents || 0).toLocaleString('en-IN')}</td>
                <td class="text-end text-warning fw-bold">${(r.underTreatment || 0).toLocaleString('en-IN')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;
}
