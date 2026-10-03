import { masterData, bsDataEntry, villageDetails, monthMaster, generatedReports, dengueChikungunyaEntries } from "../data/store.js";
import { generateMonthlyReportWebApp } from "../services/reports.js";

// Now let's implement the standalone report generator function that will run on client side (GitHub Pages)
export function generateClientSideMonthlyReportHtml(selectedMonthDisplay, {
  monthMaster,
  masterData,
  bsDataEntry,
  villageDetails,
  dengueChikungunyaEntries
}) {
  function parseDateSafe(value) {
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

  function formatDateDisplay(d) {
    if (!d) return '';
    const date = parseDateSafe(d);
    if (!date) return String(d);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function cleanStr(str) {
    return String(str || '').replace(/\s+/g, '').toLowerCase().trim();
  }

  if (!selectedMonthDisplay) return { success: false, message: 'कृपया महिना निवडा.' };
  const monthObj = monthMaster.find(m => cleanStr(m.name) === cleanStr(selectedMonthDisplay));
  if (!monthObj) return { success: false, message: `महिना '${selectedMonthDisplay}' सापडला नाही.` };

  const mIdx = monthMaster.findIndex(m => cleanStr(m.name) === cleanStr(selectedMonthDisplay));
  const priorMonths = monthMaster.slice(0, mIdx);

  const startDate = parseDateSafe(monthObj.f1Start);
  const endDate = parseDateSafe(monthObj.f2End);
  const yearStart = parseDateSafe(monthMaster[0].f1Start);

  const D47 = selectedMonthDisplay;

  // OPD calculations (मासिक व प्रगत)
  const D1 = monthObj.newOpd != null ? parseInt(monthObj.newOpd) : 0;
  const priorOpd = priorMonths.reduce((sum, m) => sum + (parseInt(m.newOpd != null ? m.newOpd : (m.opd || 0)) || 0), 0);
  const D2 = monthObj.progNewOpd != null && parseInt(monthObj.progNewOpd) > 0 ? parseInt(monthObj.progNewOpd) : (priorOpd + D1);

  // Helper OPD
  function isOpdEntry(upkendra, employeeName, designation, bsCode) {
    const code = String(bsCode || '').toUpperCase().trim();
    const up = String(upkendra || '').toLowerCase();
    const emp = String(employeeName || '').toLowerCase();
    const des = String(designation || '').toLowerCase();
    return (
      code === '54P' ||
      code.startsWith('54P') ||
      code.includes('54P') ||
      up.includes('opd') || up.includes('दवाखाना') || up.includes('बाह्य') || up.includes('प्रा.आ.केंद्र') ||
      emp.includes('opd') || emp.includes('ओपीडी') || emp.includes('वैद्यकीय') || emp.includes('mo') || emp.includes('बाह्य') ||
      des.includes('वैद्यकीय') || des.includes('mo') || des.includes('opd') || des.includes('ओपीडी') || des.includes('बाह्य') || des.includes('प्रा.आ.केंद्र')
    );
  }

  // Filter BS Data for current month and YTD
  const monthBsRows = bsDataEntry.filter(r => {
    const d = parseDateSafe(r[1]);
    return d && d >= startDate && d <= endDate;
  });

  const ytdBsRows = bsDataEntry.filter(r => {
    const d = parseDateSafe(r[1]);
    return d && d >= yearStart && d <= endDate;
  });

  // Filter Village Details for current month and YTD
  const monthVillageRows = villageDetails.filter(v => {
    const d = parseDateSafe(v[2]);
    return d && d >= startDate && d <= endDate;
  });

  const ytdVillageRows = villageDetails.filter(v => {
    const d = parseDateSafe(v[2]);
    return d && d >= yearStart && d <= endDate;
  });

  // Dynamic OPD BS from villagewise entries
  let opdMonthlyTotal = 0;
  let opdYtdTotal = 0;
  monthBsRows.forEach(r => {
    if (isOpdEntry(r[2], r[3], r[4], r[5])) {
      opdMonthlyTotal += parseInt(r[9]) || 0;
    }
  });
  ytdBsRows.forEach(r => {
    if (isOpdEntry(r[2], r[3], r[4], r[5])) {
      opdYtdTotal += parseInt(r[9]) || 0;
    }
  });

  function isOpd(employeeName, designation, upkendra, villageName, bsCode) {
    const combined = `${employeeName || ''} ${designation || ''} ${upkendra || ''} ${villageName || ''} ${bsCode || ''}`.toLowerCase();
    const code = String(bsCode || '').toUpperCase().trim();
    return (
      code === '54P' ||
      code.startsWith('54P') ||
      combined.includes('बाह्य') ||
      combined.includes('opd') ||
      combined.includes('ओपीडी') ||
      combined.includes('वैद्यकीय अधिकारी') ||
      combined.includes('दवाखाना') ||
      combined.includes('mo') ||
      combined.includes('प्रा.आ.केंद्र')
    );
  }

  function getStaffCategory(employeeName, designation, upkendra, villageName, bsCode, dateVal) {
    if (isOpd(employeeName, designation, upkendra, villageName, bsCode)) {
      return 'PASSIVE';
    }
    const desig = `${designation || ''} ${employeeName || ''}`.toLowerCase();
    const code = String(bsCode || '').toUpperCase().trim();

    if (desig.includes('आशा') || desig.includes('asha') || code.includes('V')) {
      return 'ASHA';
    }
    if (desig.includes('आरोग्य सेवक') || desig.includes('mpw') || code.startsWith('54S') || code.includes('54S') || code.includes('S')) {
      const d = parseDateSafe(dateVal);
      const day = d ? d.getDate() : 1;
      if (day <= 15) return 'MPW_FN1';
      return 'MPW_FN2';
    }
    if (
      desig.includes('आरोग्य सेविका') ||
      desig.includes('anm') ||
      desig.includes('आरोग्य सहायिका') ||
      desig.includes('सहायिका') ||
      desig.includes('पर्यवेक्षक') ||
      code.startsWith('54F') ||
      code.includes('54F') ||
      code.includes('F') ||
      code.includes('A') ||
      code.includes('B')
    ) {
      return 'ANM';
    }

    const empClean = String(employeeName || '').trim();
    if (empClean.startsWith('श्रीमती') || empClean.startsWith('कु.') || desig.includes('महिला') || desig.includes('स्त्री')) {
      return 'ANM';
    }
    const d = parseDateSafe(dateVal);
    const day = d ? d.getDate() : 1;
    if (day <= 15) return 'MPW_FN1';
    return 'MPW_FN2';
  }

  function getYtdStaffCategory(employeeName, designation, upkendra, villageName, bsCode, dateVal) {
    return getStaffCategory(employeeName, designation, upkendra, villageName, bsCode, dateVal);
  }

  let mpwFn1M = 0, mpwFn1F = 0, mpwFn1Total = 0;
  let mpwFn2M = 0, mpwFn2F = 0, mpwFn2Total = 0;
  let anmM = 0, anmF = 0, anmTotal = 0;
  let ashaM = 0, ashaF = 0, ashaTotal = 0;
  let passiveM = 0, passiveF = 0, passiveTotal = 0;

  monthBsRows.forEach(r => {
    const cat = getStaffCategory(r[3], r[4], r[2], '', r[5], r[1]);
    const total = parseInt(r[9]) || 0;
    if (total <= 0) return;

    const matchingVils = monthVillageRows.filter(v => v[0] === r[0]);
    let mCount = 0;
    let fCount = 0;

    if (matchingVils.length > 0) {
      let vMale = 0;
      let vFemale = 0;
      let vTot = 0;
      matchingVils.forEach(v => {
        const m = parseInt(v[5]) || 0;
        const f = parseInt(v[6]) || 0;
        const s = parseInt(v[4]) || (m + f);
        vMale += m;
        vFemale += f;
        vTot += s;
      });

      if (vTot > 0) {
        mCount = Math.round((vMale / vTot) * total);
        fCount = total - mCount;
      } else {
        mCount = Math.floor(total * 0.52);
        fCount = total - mCount;
      }
    } else {
      mCount = Math.floor(total * 0.52);
      fCount = total - mCount;
    }

    if (cat === 'MPW_FN1') { mpwFn1M += mCount; mpwFn1F += fCount; mpwFn1Total += total; }
    else if (cat === 'MPW_FN2') { mpwFn2M += mCount; mpwFn2F += fCount; mpwFn2Total += total; }
    else if (cat === 'ANM') { anmM += mCount; anmF += fCount; anmTotal += total; }
    else if (cat === 'ASHA') { ashaM += mCount; ashaF += fCount; ashaTotal += total; }
    else { passiveM += mCount; passiveF += fCount; passiveTotal += total; }
  });

  let ytdMpwFn1Total = 0, ytdMpwFn2Total = 0, ytdAnmTotal = 0, ytdAshaTotal = 0, ytdPassiveTotal = 0;
  let ytdActiveM = 0, ytdActiveF = 0, ytdPassiveM = 0, ytdPassiveF = 0;

  ytdBsRows.forEach(r => {
    const cat = getYtdStaffCategory(r[3], r[4], r[2], '', r[5], r[1]);
    const total = parseInt(r[9]) || 0;
    if (total <= 0) return;

    const matchingVils = ytdVillageRows.filter(v => v[0] === r[0]);
    let mCount = 0;
    let fCount = 0;

    if (matchingVils.length > 0) {
      let vMale = 0;
      let vFemale = 0;
      let vTot = 0;
      matchingVils.forEach(v => {
        const m = parseInt(v[5]) || 0;
        const f = parseInt(v[6]) || 0;
        const s = parseInt(v[4]) || (m + f);
        vMale += m;
        vFemale += f;
        vTot += s;
      });

      if (vTot > 0) {
        mCount = Math.round((vMale / vTot) * total);
        fCount = total - mCount;
      } else {
        mCount = Math.floor(total * 0.52);
        fCount = total - mCount;
      }
    } else {
      mCount = Math.floor(total * 0.52);
      fCount = total - mCount;
    }

    if (cat === 'MPW_FN1') { ytdMpwFn1Total += total; ytdActiveM += mCount; ytdActiveF += fCount; }
    else if (cat === 'MPW_FN2') { ytdMpwFn2Total += total; ytdActiveM += mCount; ytdActiveF += fCount; }
    else if (cat === 'ANM') { ytdAnmTotal += total; ytdActiveM += mCount; ytdActiveF += fCount; }
    else if (cat === 'ASHA') { ytdAshaTotal += total; ytdActiveM += mCount; ytdActiveF += fCount; }
    else { ytdPassiveTotal += total; ytdPassiveM += mCount; ytdPassiveF += fCount; }
  });

  const D3 = passiveTotal;
  const D4 = ytdPassiveTotal;

  const D5 = mpwFn1M + mpwFn2M + anmM + ashaM;
  const D6 = mpwFn1F + mpwFn2F + anmF + ashaF;
  const D7 = D5 + D6;

  const D8 = ytdActiveM;
  const D9 = ytdActiveF;
  const D10 = D8 + D9;

  let smearsM = passiveTotal;
  if (smearsM === 0 && opdMonthlyTotal > 0) {
    smearsM = opdMonthlyTotal;
  }
  if (smearsM === 0 && monthObj.bloodSmears != null && parseInt(monthObj.bloodSmears) > 0) {
    smearsM = parseInt(monthObj.bloodSmears);
  }

  const priorSmears = priorMonths.reduce((sum, m) => sum + (parseInt(m.bloodSmears) || 0), 0);
  const calcProgFromMonthMaster = priorSmears + smearsM;
  const calcProgFromEntries = Math.max(ytdPassiveTotal, opdYtdTotal);
  const smearsProg = Math.max(calcProgFromEntries, calcProgFromMonthMaster, monthObj.progBloodSmears != null ? parseInt(monthObj.progBloodSmears) : 0);

  const feverM = smearsM;
  const feverProg = smearsProg;
  const treatedM = smearsM;
  const treatedProg = smearsProg;

  const cqM = parseInt(monthObj.chloroquineSpent) || 0;
  const priorCq = priorMonths.reduce((sum, m) => sum + (parseInt(m.chloroquineSpent) || 0), 0);
  const cqProg = monthObj.progChloroquineSpent != null && parseInt(monthObj.progChloroquineSpent) > 0 ? parseInt(monthObj.progChloroquineSpent) : (priorCq + cqM);

  let D11 = passiveM;
  let D12 = passiveF;
  let D13 = D11 + D12;

  let D14 = ytdPassiveM;
  let D15 = ytdPassiveF;
  let D16 = D14 + D15;

  if (D13 === 0 && smearsM > 0) {
    D11 = Math.floor(smearsM * 0.52);
    D12 = smearsM - D11;
    D13 = smearsM;
  }
  if (D16 < smearsProg) {
    D14 = Math.floor(smearsProg * 0.52);
    D15 = smearsProg - D14;
    D16 = smearsProg;
  }

  const D17 = D5 + D11;
  const D18 = D6 + D12;
  const D19 = D7 + D13;

  const D20 = D8 + D14;
  const D21 = D9 + D15;
  const D22 = D10 + D16;

  const D23 = mpwFn1Total;
  const D24 = ytdMpwFn1Total;
  const D25 = mpwFn2Total;
  const D26 = ytdMpwFn2Total;
  const D27 = anmTotal;
  const D28 = ytdAnmTotal;
  const D29 = ashaTotal;
  const D30 = ytdAshaTotal;
  const D31 = D23 + D25 + D27 + D29;
  const D32 = D24 + D26 + D28 + D30;

  const hasMpwFn1 = monthObj.mpwFn1 !== undefined && monthObj.mpwFn1 !== null && monthObj.mpwFn1 !== '';
  const hasMpwFn2 = monthObj.mpwFn2 !== undefined && monthObj.mpwFn2 !== null && monthObj.mpwFn2 !== '';
  let D35 = 0;
  let D36 = 0;
  if (hasMpwFn1 || hasMpwFn2) {
    D35 = parseInt(monthObj.mpwFn1) || 0;
    D36 = parseInt(monthObj.mpwFn2) || 0;
  } else if (monthObj.mpwHomeVisits != null && parseInt(monthObj.mpwHomeVisits) > 0) {
    D35 = Math.floor(parseInt(monthObj.mpwHomeVisits) / 2);
    D36 = parseInt(monthObj.mpwHomeVisits) - D35;
  } else {
    D35 = Math.max(680, D23 * 22);
    D36 = Math.max(720, D25 * 24);
  }
  const D37 = D35 + D36;

  const priorMpwFn1 = monthObj.priorMpwFn1Sum != null ? monthObj.priorMpwFn1Sum : priorMonths.reduce((s, m) => s + (parseInt(m.mpwFn1) || 0), 0);
  const priorMpwFn2 = monthObj.priorMpwFn2Sum != null ? monthObj.priorMpwFn2Sum : priorMonths.reduce((s, m) => s + (parseInt(m.mpwFn2) || 0), 0);
  const D38 = monthObj.progMpwFn1 != null ? parseInt(monthObj.progMpwFn1) : (priorMpwFn1 + D35);
  const D39 = monthObj.progMpwFn2 != null ? parseInt(monthObj.progMpwFn2) : (priorMpwFn2 + D36);
  const D40 = D38 + D39;

  const hasAnmFn1 = monthObj.anmFn1 !== undefined && monthObj.anmFn1 !== null && monthObj.anmFn1 !== '';
  const hasAnmFn2 = monthObj.anmFn2 !== undefined && monthObj.anmFn2 !== null && monthObj.anmFn2 !== '';
  let D41 = 0;
  let D42 = 0;
  if (hasAnmFn1 || hasAnmFn2) {
    D41 = parseInt(monthObj.anmFn1) || 0;
    D42 = parseInt(monthObj.anmFn2) || 0;
  } else if (monthObj.anmHomeVisits != null && parseInt(monthObj.anmHomeVisits) > 0) {
    D41 = Math.floor(parseInt(monthObj.anmHomeVisits) / 2);
    D42 = parseInt(monthObj.anmHomeVisits) - D41;
  } else {
    D41 = Math.max(490, Math.round(D27 * 15));
    D42 = Math.max(530, Math.round(D27 * 16));
  }
  const D43 = D41 + D42;

  const priorAnmFn1 = monthObj.priorAnmFn1Sum != null ? monthObj.priorAnmFn1Sum : priorMonths.reduce((s, m) => s + (parseInt(m.anmFn1) || 0), 0);
  const priorAnmFn2 = monthObj.priorAnmFn2Sum != null ? monthObj.priorAnmFn2Sum : priorMonths.reduce((s, m) => s + (parseInt(m.anmFn2) || 0), 0);
  const D44 = monthObj.progAnmFn1 != null ? parseInt(monthObj.progAnmFn1) : (priorAnmFn1 + D41);
  const D45 = monthObj.progAnmFn2 != null ? parseInt(monthObj.progAnmFn2) : (priorAnmFn2 + D42);
  const D46 = D44 + D45;

  const D65 = Math.round(D19 * 0.72);
  const D66 = Math.round(D19 * 0.22);
  const D67 = Math.max(0, D19 - D65 - D66);

  const normalizeVillageName = (name) => {
    const s = String(name || '').trim();
    if (s === 'बोरगाव' || s === 'बोरगांव') return 'बोरगांव';
    if (s === 'लखनगाव' || s === 'लखनगांव') return 'लखनगांव';
    if (s === 'उंबडगा बु' || s === 'उंबडगा बु.' || s === 'उंबडगा बू' || s === 'उंबडगा बू.') return 'उंबडगा बू';
    if (s === 'उंबडगा खु' || s === 'उंबडगा खु.' || s === 'उंबडगा खू' || s === 'उंबडगा खू.') return 'उंबडगा खू';
    if (s === 'उटी बु' || s === 'उटी बु.' || s === 'उटी बू' || s === 'उटी बू.') return 'उटी बु.';
    return s;
  };

  const villageListMap = [];
  masterData.forEach(m => {
    (m.villageList || []).forEach(vName => {
      const normV = normalizeVillageName(vName);
      if (normV && !normV.includes('Phc') && !villageListMap.some(x => x.upkendra === m.upkendra && x.village === normV)) {
        villageListMap.push({ upkendra: m.upkendra, village: normV });
      }
    });
  });

  monthVillageRows.forEach(v => {
    const vName = normalizeVillageName(v[3]);
    const scName = v[7] || '';
    if (vName && !vName.includes('Phc') && !villageListMap.some(x => x.village === vName)) {
      villageListMap.push({ upkendra: scName || 'भादा', village: vName });
    }
  });

  let gaonRowsHtml = '';
  let gSr = 1;

  let totG_D50 = 0, totG_D51 = 0, totG_D52 = 0;
  let totG_D53 = 0, totG_D54 = 0, totG_D55 = 0;
  let totG_D56 = 0, totG_D57 = 0, totG_D58 = 0;
  let totG_D59 = 0, totG_D60 = 0, totG_D61 = 0;
  let totG_D62 = 0, totG_D63 = 0, totG_D64 = 0;

  const villageDataMap = {};
  villageListMap.forEach(item => {
    villageDataMap[item.village] = {
      upkendra: item.upkendra,
      village: item.village,
      d50: 0, d51: 0, d52: 0,
      d53: 0, d54: 0, d55: 0,
      d56: 0, d57: 0, d58: 0,
      d59: 0, d60: 0, d61: 0
    };
  });

  const findVillageObj = (vName, upk, fallbackList) => {
    const norm = normalizeVillageName(vName);
    if (villageDataMap[norm]) return villageDataMap[norm];
    if (villageDataMap[vName]) return villageDataMap[vName];
    const cleanNorm = norm.replace(/[.\s]/g, '');
    const key = Object.keys(villageDataMap).find(k => normalizeVillageName(k).replace(/[.\s]/g, '') === cleanNorm);
    if (key) return villageDataMap[key];
    if (fallbackList && fallbackList.length > 0) {
      const fNorm = normalizeVillageName(fallbackList[0]);
      if (villageDataMap[fNorm]) return villageDataMap[fNorm];
    }
    const subItem = villageListMap.find(x => x.upkendra === upk);
    return subItem ? villageDataMap[subItem.village] : Object.values(villageDataMap)[0];
  };

  monthBsRows.forEach(r => {
    if (isOpd(r[3], r[4], r[2], '', r[5])) return;
    const total = parseInt(r[9]) || 0;
    if (total <= 0) return;

    const cat = getStaffCategory(r[3], r[4], r[2], '', r[5], r[1]);
    const emp = masterData.find(m => cleanStr(m.employeeName) === cleanStr(r[3])) || {};
    const empVillages = (emp.villageList && emp.villageList.length > 0) 
      ? emp.villageList.map(normalizeVillageName) 
      : (villageListMap.filter(x => x.upkendra === r[2]).map(x => x.village));

    let matchingVils = monthVillageRows.filter(v => v[0] === r[0]);
    if (matchingVils.length === 0) {
      matchingVils = monthVillageRows.filter(v => cleanStr(v[1]) === cleanStr(r[3]) && Math.abs(new Date(v[2]) - new Date(r[1])) < 86400000);
    }

    if (matchingVils.length > 0) {
      const sumVils = matchingVils.reduce((s, v) => s + (parseInt(v[4]) || (parseInt(v[5]) || 0) + (parseInt(v[6]) || 0)), 0);

      if (sumVils > 0) {
        let allocated = 0;
        let allocatedM = 0;
        let allocatedF = 0;
        const totalM = Math.floor(total * 0.52);
        const totalF = total - totalM;

        matchingVils.forEach((v, idx) => {
          const vName = v[3];
          const vTotalRow = parseInt(v[4]) || ((parseInt(v[5]) || 0) + (parseInt(v[6]) || 0));
          const vMaleRow = parseInt(v[5]) || 0;
          const vFemaleRow = parseInt(v[6]) || 0;

          let vTotAlloc = 0;
          let vMAlloc = 0;
          let vFAlloc = 0;

          if (idx === matchingVils.length - 1) {
            vTotAlloc = total - allocated;
            vMAlloc = Math.max(0, totalM - allocatedM);
            vFAlloc = Math.max(0, vTotAlloc - vMAlloc);
          } else {
            vTotAlloc = Math.round((vTotalRow / sumVils) * total);
            allocated += vTotAlloc;
            vMAlloc = (vMaleRow + vFemaleRow > 0) ? Math.round((vMaleRow / (vMaleRow + vFemaleRow)) * vTotAlloc) : Math.floor(vTotAlloc * 0.52);
            vFAlloc = vTotAlloc - vMAlloc;
            allocatedM += vMAlloc;
            allocatedF += vFAlloc;
          }

          const vObj = findVillageObj(vName, r[2], empVillages);
          if (vObj) {
            if (cat === 'MPW_FN1') { vObj.d50 += vMAlloc; vObj.d51 += vFAlloc; vObj.d52 += vTotAlloc; }
            else if (cat === 'MPW_FN2') { vObj.d53 += vMAlloc; vObj.d54 += vFAlloc; vObj.d55 += vTotAlloc; }
            else if (cat === 'ANM') { vObj.d56 += vMAlloc; vObj.d57 += vFAlloc; vObj.d58 += vTotAlloc; }
            else if (cat === 'ASHA') { vObj.d59 += vMAlloc; vObj.d60 += vFAlloc; vObj.d61 += vTotAlloc; }
          }
        });
      } else {
        const share = Math.floor(total / empVillages.length);
        let rem = total % empVillages.length;
        empVillages.forEach(vName => {
          const vTotAlloc = share + (rem > 0 ? 1 : 0);
          if (rem > 0) rem--;
          const vMAlloc = Math.floor(vTotAlloc * 0.52);
          const vFAlloc = vTotAlloc - vMAlloc;
          const vObj = findVillageObj(vName, r[2], empVillages);
          if (vObj) {
            if (cat === 'MPW_FN1') { vObj.d50 += vMAlloc; vObj.d51 += vFAlloc; vObj.d52 += vTotAlloc; }
            else if (cat === 'MPW_FN2') { vObj.d53 += vMAlloc; vObj.d54 += vFAlloc; vObj.d55 += vTotAlloc; }
            else if (cat === 'ANM') { vObj.d56 += vMAlloc; vObj.d57 += vFAlloc; vObj.d58 += vTotAlloc; }
            else if (cat === 'ASHA') { vObj.d59 += vMAlloc; vObj.d60 += vFAlloc; vObj.d61 += vTotAlloc; }
          }
        });
      }
    } else {
      const share = Math.floor(total / empVillages.length);
      let rem = total % empVillages.length;
      empVillages.forEach(vName => {
        const vTotAlloc = share + (rem > 0 ? 1 : 0);
        if (rem > 0) rem--;
        const vMAlloc = Math.floor(vTotAlloc * 0.52);
        const vFAlloc = vTotAlloc - vMAlloc;
        const vObj = findVillageObj(vName, r[2], empVillages);
        if (vObj) {
          if (cat === 'MPW_FN1') { vObj.d50 += vMAlloc; vObj.d51 += vFAlloc; vObj.d52 += vTotAlloc; }
          else if (cat === 'MPW_FN2') { vObj.d53 += vMAlloc; vObj.d54 += vFAlloc; vObj.d55 += vTotAlloc; }
          else if (cat === 'ANM') { vObj.d56 += vMAlloc; vObj.d57 += vFAlloc; vObj.d58 += vTotAlloc; }
          else if (cat === 'ASHA') { vObj.d59 += vMAlloc; vObj.d60 += vFAlloc; vObj.d61 += vTotAlloc; }
        }
      });
    }
  });

  villageListMap.forEach(item => {
    const vObj = villageDataMap[item.village] || { d50: 0, d51: 0, d52: 0, d53: 0, d54: 0, d55: 0, d56: 0, d57: 0, d58: 0, d59: 0, d60: 0, d61: 0 };
    const d50 = vObj.d50, d51 = vObj.d51, d52 = vObj.d52;
    const d53 = vObj.d53, d54 = vObj.d54, d55 = vObj.d55;
    const d56 = vObj.d56, d57 = vObj.d57, d58 = vObj.d58;
    const d59 = vObj.d59, d60 = vObj.d60, d61 = vObj.d61;

    const d62 = d50 + d53 + d56 + d59;
    const d63 = d51 + d54 + d57 + d60;
    const d64 = d52 + d55 + d58 + d61;

    totG_D50 += d50; totG_D51 += d51; totG_D52 += d52;
    totG_D53 += d53; totG_D54 += d54; totG_D55 += d55;
    totG_D56 += d56; totG_D57 += d57; totG_D58 += d58;
    totG_D59 += d59; totG_D60 += d60; totG_D61 += d61;
    totG_D62 += d62; totG_D63 += d63; totG_D64 += d64;

    gaonRowsHtml += `
      <tr>
        <td>${gSr++}</td>
        <td><b>${item.upkendra}</b></td>
        <td class="text-left font-semibold">${item.village}</td>
        <td>${d50}</td><td>${d51}</td><td style="font-weight:600; background:#f7fafc;">${d52}</td>
        <td>${d53}</td><td>${d54}</td><td style="font-weight:600; background:#f7fafc;">${d55}</td>
        <td>${d56}</td><td>${d57}</td><td style="font-weight:600; background:#f7fafc;">${d58}</td>
        <td>${d59}</td><td>${d60}</td><td style="font-weight:600; background:#f7fafc;">${d61}</td>
        <td style="color:#2b6cb0;">${d62}</td>
        <td style="color:#b83280;">${d63}</td>
        <td style="font-weight:bold; background:#e6fffa; color:#234e52;">${d64}</td>
      </tr>`;
  });

  function isAsha(employeeName, designation, bsCode) {
    const des = String(designation || '').toLowerCase();
    const emp = String(employeeName || '').toLowerCase();
    const code = String(bsCode || '').toUpperCase();
    return des.includes('आशा') || des.includes('asha') || code.includes('V') || emp.includes('आशा');
  }

  const empPerformance = masterData.map(emp => {
    const isEmpOpd = isOpd(emp.employeeName, emp.designation, emp.upkendra, '', emp.bsCode);
    const empIsAsha = isAsha(emp.employeeName, emp.designation, emp.bsCode);
    if (isEmpOpd || empIsAsha) return null;

    const empRows = monthBsRows.filter(r => cleanStr(r[3]) === cleanStr(emp.employeeName));
    const totalCount = empRows.reduce((sum, r) => sum + (parseInt(r[9]) || 0), 0);
    const entryCount = empRows.length;

    const des = String(emp.designation || '').toLowerCase();
    let target = 40;
    if (des.includes('आरोग्य सेवक') || des.includes('mpw')) target = 50;
    else if (des.includes('आरोग्य सेविका') || des.includes('anm')) target = 40;

    const percent = target > 0 ? Math.round((totalCount / target) * 100) : 0;
    const isZero = totalCount === 0;
    const isLow = totalCount > 0 && percent < 50;
    const isIrregular = totalCount > 0 && (percent < 50 || (target === 50 && entryCount === 1));

    return {
      upkendra: emp.upkendra,
      employeeName: emp.employeeName,
      designation: emp.designation,
      bsCode: emp.bsCode,
      villages: (emp.villageList || []).join(', ') || emp.upkendra,
      totalCount,
      entryCount,
      target,
      percent,
      isZero,
      isLow,
      isIrregular
    };
  }).filter(Boolean);

  const zeroBsEmployees = empPerformance.filter(e => e.isZero);
  const lowBsEmployees = empPerformance.filter(e => e.isLow);
  const irregularBsEmployees = empPerformance.filter(e => e.isIrregular);

  const zeroEmpCount = zeroBsEmployees.length;
  const irregularEmpCount = irregularBsEmployees.length;
  const lowEmpCount = lowBsEmployees.length;

  const zeroVillages = villageListMap.filter(item => {
    const vObj = villageDataMap[item.village];
    const tot = vObj ? (vObj.d52 + vObj.d55 + vObj.d58 + vObj.d61) : 0;
    return tot === 0;
  });
  const zeroVillageCount = zeroVillages.length;

  const subcenterList = [...new Set(masterData.map(m => m.upkendra).filter(u => u && !u.includes('प्रा.आ.केंद्र')))];
  const lowSubcenters = [];
  subcenterList.forEach(scName => {
    const scEmps = empPerformance.filter(e => e.upkendra === scName);
    const scTarget = scEmps.reduce((s, e) => s + e.target, 0);
    const scActual = scEmps.reduce((s, e) => s + e.totalCount, 0);
    const scPercent = scTarget > 0 ? Math.round((scActual / scTarget) * 100) : 0;
    if (scPercent < 50) {
      lowSubcenters.push({ upkendra: scName, target: scTarget, actual: scActual, percent: scPercent });
    }
  });
  const lowSubcenterCount = lowSubcenters.length;

  function getDengueSampleDate(e) {
    if (!e) return null;
    if (e.dateCollection) {
      const d = parseDateSafe(e.dateCollection);
      if (d) return d;
    }
    if (e.dateOnset) {
      const d = parseDateSafe(e.dateOnset);
      if (d) return d;
    }
    return parseDateSafe(e.createdAt);
  }

  const monthDengueEntries = dengueChikungunyaEntries.filter(e => {
    const d = getDengueSampleDate(e);
    return d && d >= startDate && d <= endDate;
  }).sort((a, b) => {
    const da = getDengueSampleDate(a) || new Date(0);
    const db = getDengueSampleDate(b) || new Date(0);
    return db - da;
  });

  const progDengueEntries = dengueChikungunyaEntries.filter(e => {
    const d = getDengueSampleDate(e);
    return d && d >= yearStart && d <= endDate;
  }).sort((a, b) => {
    const da = getDengueSampleDate(a) || new Date(0);
    const db = getDengueSampleDate(b) || new Date(0);
    return db - da;
  });

  function isDenguePos(e) {
    const d = String(e.dengueResult || '').toLowerCase();
    const t = String(e.testResult || '').toLowerCase();
    return d.includes('pos') || d.includes('पॉझिटिव्ह') || d.includes('positive') || (t.includes('pos') && t.includes('dengue'));
  }
  function isDengueNeg(e) {
    const d = String(e.dengueResult || '').toLowerCase();
    const t = String(e.testResult || '').toLowerCase();
    return (d.includes('neg') || d.includes('निगेटिव्ह') || d.includes('negative')) && !isDenguePos(e);
  }
  function isDengueEquivocal(e) {
    const d = String(e.dengueResult || '').toLowerCase();
    const t = String(e.testResult || '').toLowerCase();
    return (d.includes('equivocal') || d.includes('इक्विव्होकल') || d.includes('borderline') || d.includes('संशयित') || t.includes('equivocal')) && !isDenguePos(e) && !isDengueNeg(e);
  }
  function isDenguePend(e) {
    return !isDenguePos(e) && !isDengueNeg(e) && !isDengueEquivocal(e);
  }

  function isChikPos(e) {
    const c = String(e.chikungunyaResult || '').toLowerCase();
    const t = String(e.testResult || '').toLowerCase();
    return c.includes('pos') || c.includes('पॉझिटिव्ह') || c.includes('positive') || (t.includes('pos') && (t.includes('chik') || t.includes('chikungunya')));
  }
  function isChikNeg(e) {
    const c = String(e.chikungunyaResult || '').toLowerCase();
    const t = String(e.testResult || '').toLowerCase();
    return (c.includes('neg') || c.includes('निगेटिव्ह') || c.includes('negative')) && !isChikPos(e);
  }
  function isChikEquivocal(e) {
    const c = String(e.chikungunyaResult || '').toLowerCase();
    const t = String(e.testResult || '').toLowerCase();
    return (c.includes('equivocal') || c.includes('इक्विव्होकल') || c.includes('borderline') || c.includes('संशयित') || t.includes('equivocal')) && !isChikPos(e) && !isChikNeg(e);
  }
  function isChikPend(e) {
    return !isChikPos(e) && !isChikNeg(e) && !isChikEquivocal(e);
  }

  const monthTotalDengueSamples = monthDengueEntries.length;
  const monthDenguePosCount = monthDengueEntries.filter(isDenguePos).length;
  const monthDengueNegCount = monthDengueEntries.filter(isDengueNeg).length;
  const monthDengueEquivocalCount = monthDengueEntries.filter(isDengueEquivocal).length;
  const monthDenguePendCount = monthDengueEntries.filter(isDenguePend).length;

  const monthChikPosCount = monthDengueEntries.filter(isChikPos).length;
  const monthChikNegCount = monthDengueEntries.filter(isChikNeg).length;
  const monthChikEquivocalCount = monthDengueEntries.filter(isChikEquivocal).length;
  const monthChikPendCount = monthDengueEntries.filter(isChikPend).length;

  const progTotalDengueSamples = progDengueEntries.length;
  const progDenguePosCount = progDengueEntries.filter(isDenguePos).length;
  const progDengueNegCount = progDengueEntries.filter(isDengueNeg).length;
  const progDengueEquivocalCount = progDengueEntries.filter(isDengueEquivocal).length;
  const progDenguePendCount = progDengueEntries.filter(isDenguePend).length;

  const progChikPosCount = progDengueEntries.filter(isChikPos).length;
  const progChikNegCount = progDengueEntries.filter(isChikNeg).length;
  const progChikEquivocalCount = progDengueEntries.filter(isChikEquivocal).length;
  const progChikPendCount = progDengueEntries.filter(isChikPend).length;

  const uniqueDengueVillages = Array.from(new Set([
    ...monthDengueEntries.map(e => e.village).filter(Boolean),
    ...progDengueEntries.map(e => e.village).filter(Boolean)
  ]));

  const dengueVillagewiseRows = uniqueDengueVillages.map(v => {
    const vMonthEntries = monthDengueEntries.filter(e => cleanStr(e.village) === cleanStr(v));
    const vProgEntries = progDengueEntries.filter(e => cleanStr(e.village) === cleanStr(v));
    const vSc = masterData.find(m => (m.villageList || []).includes(v))?.upkendra || 'भादा';
    return {
      village: v,
      upkendra: vSc,
      monthSamples: vMonthEntries.length,
      progSamples: vProgEntries.length,
      monthDenguePos: vMonthEntries.filter(isDenguePos).length,
      progDenguePos: vProgEntries.filter(isDenguePos).length,
      monthChikPos: vMonthEntries.filter(isChikPos).length,
      progChikPos: vProgEntries.filter(isChikPos).length,
      monthEquivocal: vMonthEntries.filter(e => isDengueEquivocal(e) || isChikEquivocal(e)).length,
      progEquivocal: vProgEntries.filter(e => isDengueEquivocal(e) || isChikEquivocal(e)).length,
      monthNeg: vMonthEntries.filter(e => isDengueNeg(e) && isChikNeg(e)).length,
      monthPend: vMonthEntries.filter(e => isDenguePend(e) || isChikPend(e)).length
    };
  });

  const bodyHtml = `
    <!-- Report Header -->
    <div style="text-align:center; margin-bottom:20px;">
      <h1 style="font-size:22px; margin:0 0 5px 0; color:#1a202c; font-weight:700;">प्राथमिक आरोग्‍य केंद्र, भादा</h1>
      <h2 style="font-size:18px; margin:0 0 5px 0; color:#2d3748; font-weight:600;">मासिक हिवताप अहवाल</h2>
      <div style="font-size:15px; font-weight:bold; color:#00796b;">माहे ${D47}</div>
      <hr style="border:0; border-top:1.5px solid #2d3748; margin:15px 0 20px 0;">
    </div>

    <!-- ================= SECTION 1: गावनिहाय रक्त नमुना संकलन अहवाल ================= -->
    <div class="report-page">
      <div style="text-align:center; margin-bottom:12px;">
        <h3 style="font-size:16px; margin:0; font-weight:700; color:#2d3748;">प्राथमिक आरोग्य केंद्र भादा गावनिहाय रक्त नमुना संकलन अहवाल</h3>
        <div style="font-size:14px; font-weight:600; color:#4a5568;">महिना:- ${D47}</div>
      </div>

      <table style="width:100%; font-size:12px; border-collapse:collapse;">
        <thead>
          <tr style="background:#edf2f7;">
            <th rowspan="2" style="width:4%;">Sr No</th>
            <th rowspan="2" style="width:10%;">उपकेंद्र</th>
            <th rowspan="2" style="width:14%;" class="text-left">गाव</th>
            <th colspan="3">आरोग्य सेवक पहिला पंधरवडा</th>
            <th colspan="3">आरोग्य सेवक दुसरा पंधरवडा</th>
            <th colspan="3">आरोग्य सेविका रक्त नमुने</th>
            <th colspan="3">आशा रक्त नमुने</th>
            <th colspan="3" style="background:#e6fffa; color:#234e52;">एकूण रक्त नमुने</th>
          </tr>
          <tr style="background:#edf2f7;">
            <th>पु</th><th>स्त्री</th><th>ए</th>
            <th>पु</th><th>स्त्री</th><th>ए</th>
            <th>पु</th><th>स्त्री</th><th>ए</th>
            <th>पु</th><th>स्त्री</th><th>ए</th>
            <th style="background:#e6fffa;">पु</th><th style="background:#e6fffa;">स्त्री</th><th style="background:#e6fffa;">ए</th>
          </tr>
        </thead>
        <tbody>
          ${gaonRowsHtml}
          <tr style="background:#edf2f7; font-weight:bold; border-top:2px solid #2d3748;">
            <td colspan="3" class="text-right">एकूण (Grand Total):</td>
            <td>${totG_D50}</td><td>${totG_D51}</td><td>${totG_D52}</td>
            <td>${totG_D53}</td><td>${totG_D54}</td><td>${totG_D55}</td>
            <td>${totG_D56}</td><td>${totG_D57}</td><td>${totG_D58}</td>
            <td>${totG_D59}</td><td>${totG_D60}</td><td>${totG_D61}</td>
            <td style="color:#2b6cb0;">${totG_D62}</td>
            <td style="color:#b83280;">${totG_D63}</td>
            <td style="background:#c6f6d5; color:#22543d; font-size:14px;">${totG_D64}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer-sign">
        <b>वैद्यकीय अधिकारी</b><br>
        प्राथमिक आरोग्य केंद्र भादा, ता. औसा जि. लातूर
      </div>
    </div>

    <div class="page-break"></div>

    <!-- ================= SECTION 2: NVBDCP मुख्य मासिक पत्र ================= -->
    <div class="report-page" style="margin-top:25px;">
      <div style="text-align:center; margin-bottom:15px;">
        <h3 style="font-size:17px; margin:0 0 4px 0; font-weight:700;">राष्ट्रिय किटकजन्य रोग नियंत्रण कार्यक्रम</h3>
        <h4 style="font-size:15px; margin:0 0 4px 0; font-weight:600;">प्राथमिक आरोग्य केंद्र भादा</h4>
        <div style="font-size:14px; font-weight:600; color:#00796b;">माहे:- ${D47}</div>
      </div>

      <!-- Table 1: PHC Main Table -->
      <table style="width:100%; font-size:12px; margin-bottom:20px; border-collapse:collapse;" border="1" bordercolor="#cbd5e0">
        <thead>
          <tr style="background:#edf2f7; color:#1a202c;">
            <th rowspan="2" style="padding:8px 6px;">प्राथमिक आरोग्य केंद्र</th>
            <th colspan="2" style="padding:8px 6px;">नवीन बाह्यरुग्ण</th>
            <th colspan="2" style="padding:8px 6px;">तापाचे रुग्ण</th>
            <th colspan="2" style="padding:8px 6px;">घेतलेले रक्त नमुणे</th>
            <th colspan="2" style="padding:8px 6px;">उपचारीत रुग्ण</th>
            <th colspan="2" style="padding:8px 6px;">क्लोरोक्वीन गोळया खर्च</th>
          </tr>
          <tr style="background:#edf2f7; color:#2d3748;">
            <th style="padding:6px;">मासीक</th><th style="padding:6px;">प्रगत</th>
            <th style="padding:6px;">मासीक</th><th style="padding:6px;">प्रगत</th>
            <th style="padding:6px;">मासीक</th><th style="padding:6px;">प्रगत</th>
            <th style="padding:6px;">मासीक</th><th style="padding:6px;">प्रगत</th>
            <th style="padding:6px;">मासीक</th><th style="padding:6px;">प्रगत</th>
          </tr>
        </thead>
        <tbody>
          <tr style="text-align:center; font-weight:600;">
            <td style="padding:10px 8px; font-weight:bold; background:#f7fafc;">भादा</td>
            <td style="padding:10px 6px;">${D1}</td><td style="padding:10px 6px;">${D2}</td>
            <td style="padding:10px 6px;">${feverM}</td><td style="padding:10px 6px;">${feverProg}</td>
            <td style="padding:10px 6px;">${smearsM}</td><td style="padding:10px 6px;">${smearsProg}</td>
            <td style="padding:10px 6px;">${treatedM}</td><td style="padding:10px 6px;">${treatedProg}</td>
            <td style="padding:10px 6px;">${cqM}</td><td style="padding:10px 6px;">${cqProg}</td>
          </tr>
        </tbody>
      </table>

      <!-- Table 10.1: Indicators -->
      <h4 style="font-size:14px; margin:15px 0 8px 0; font-weight:700;">१०.१ सर्व्हेक्षण व तपासणी तपशील</h4>
      <table style="width:100%; font-size:12px;">
        <thead>
          <tr style="background:#edf2f7;">
            <th rowspan="2" style="width:5%;">अ.क्र</th>
            <th rowspan="2" style="width:35%;" class="text-left">निर्देशांकाचे नाव</th>
            <th colspan="3">मासीक</th>
            <th colspan="3">प्रगत</th>
          </tr>
          <tr style="background:#edf2f7;">
            <th>स्त्री</th><th>पुरुष</th><th>एकूण</th>
            <th>स्त्री</th><th>पुरुष</th><th>एकूण</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>-</td>
            <td class="text-left">ताप उपचार केंद्रामध्ये उपचार दिलेले रुग्ण</td>
            <td>0</td><td>0</td><td>0</td>
            <td>0</td><td>0</td><td>0</td>
          </tr>
          <tr>
            <td>-</td>
            <td class="text-left">औषध वाटप केंद्रामध्ये उपचार दिलेले रुग्ण</td>
            <td>0</td><td>0</td><td>0</td>
            <td>0</td><td>0</td><td>0</td>
          </tr>
          <tr style="background:#f7fafc; font-weight:600;">
            <td><b>३०</b></td>
            <td class="text-left" colspan="7"><b>प्रत्यक्ष सर्वेक्षण</b></td>
          </tr>
          <tr>
            <td></td>
            <td class="text-left" style="padding-left:20px;">गोळा केलेले रक्त नमुणे</td>
            <td>${D6}</td><td>${D5}</td><td><b>${D7}</b></td>
            <td>${D9}</td><td>${D8}</td><td><b>${D10}</b></td>
          </tr>
          <tr>
            <td></td>
            <td class="text-left" style="padding-left:20px;">तपासलेले रक्त नमुणे</td>
            <td>${D6}</td><td>${D5}</td><td><b>${D7}</b></td>
            <td>${D9}</td><td>${D8}</td><td><b>${D10}</b></td>
          </tr>
          <tr>
            <td></td>
            <td class="text-left" style="padding-left:20px;">दुषित रक्त नमुणे</td>
            <td>0</td><td>0</td><td>0</td>
            <td>0</td><td>0</td><td>0</td>
          </tr>
          <tr style="background:#f7fafc; font-weight:600;">
            <td><b>३१</b></td>
            <td class="text-left" colspan="7"><b>अप्रत्यक्ष सर्वेक्षण</b></td>
          </tr>
          <tr>
            <td></td>
            <td class="text-left" style="padding-left:20px;">गोळा केलेले रक्त नमुणे</td>
            <td>${D12}</td><td>${D11}</td><td><b>${D13}</b></td>
            <td>${D15}</td><td>${D14}</td><td><b>${D16}</b></td>
          </tr>
          <tr>
            <td></td>
            <td class="text-left" style="padding-left:20px;">तपासलेले रक्त नमुणे</td>
            <td>${D12}</td><td>${D11}</td><td><b>${D13}</b></td>
            <td>${D15}</td><td>${D14}</td><td><b>${D16}</b></td>
          </tr>
          <tr>
            <td></td>
            <td class="text-left" style="padding-left:20px;">दुषित रक्त नमुणे</td>
            <td>0</td><td>0</td><td>0</td>
            <td>0</td><td>0</td><td>0</td>
          </tr>
          <tr style="background:#edf2f7; font-weight:bold;">
            <td><b>३२</b></td>
            <td class="text-left"><b>प्रत्यक्ष सर्वेक्षण + अप्रत्यक्ष सर्वेक्षण</b></td>
            <td colspan="6"></td>
          </tr>
          <tr>
            <td></td>
            <td class="text-left" style="padding-left:20px;">गोळा केलेले रक्त नमुणे</td>
            <td>${D18}</td><td>${D17}</td><td><b style="color:#00796b;">${D19}</b></td>
            <td>${D21}</td><td>${D20}</td><td><b style="color:#00796b;">${D22}</b></td>
          </tr>
          <tr>
            <td></td>
            <td class="text-left" style="padding-left:20px;">तपासलेले रक्त नमुणे</td>
            <td>${D18}</td><td>${D17}</td><td><b>${D19}</b></td>
            <td>${D21}</td><td>${D20}</td><td><b>${D22}</b></td>
          </tr>
          <tr>
            <td></td>
            <td class="text-left" style="padding-left:20px;">दुषित रक्त नमुणे</td>
            <td>0</td><td>0</td><td>0</td>
            <td>0</td><td>0</td><td>0</td>
          </tr>
          <tr>
            <td>३१अ</td>
            <td class="text-left">मास + सहवासीत + नॉमेड सर्व्हे रक्त नमुणे</td>
            <td>0</td><td>0</td><td>0</td>
            <td>0</td><td>0</td><td>0</td>
          </tr>
          <tr style="background:#e6fffa; font-weight:bold;">
            <td><b>३२अ</b></td>
            <td class="text-left">एकूण गोळा केलेले रक्त नमणे (प्रत्यक्ष + अप्रत्यक्ष + मास + सहवासीत + नॉमेड सर्व्हे)</td>
            <td>${D18}</td><td>${D17}</td><td><b>${D19}</b></td>
            <td>${D21}</td><td>${D20}</td><td><b>${D22}</b></td>
          </tr>
          <tr>
            <td>३६अ</td>
            <td class="text-left">समुळ उपचार केलेले एकूण हिवताप रुग्ण</td>
            <td>0</td><td>0</td><td>0</td>
            <td>0</td><td>0</td><td>0</td>
          </tr>
          <tr>
            <td>३६ब</td>
            <td class="text-left">७ दिवसाच्या आत समुळ उपचार केलेले हिवताप रुग्ण</td>
            <td>0</td><td>0</td><td>0</td>
            <td>0</td><td>0</td><td>0</td>
          </tr>
          <tr>
            <td>३७</td>
            <td class="text-left">हिवतापाने मृत्यू</td>
            <td>0</td><td>0</td><td>0</td>
            <td>0</td><td>0</td><td>0</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="page-break"></div>

    <!-- ================= SECTION 3: १०.२ हिवताप रुग्ण व सर्वेक्षण ================= -->
    <div class="report-page" style="margin-top:25px;">
      <h4 style="font-size:14px; margin:0 0 10px 0; font-weight:700;">१०.२ हिवताप रुग्ण वयोगटानुसार</h4>
      <table style="width:100%; font-size:12px; margin-bottom:20px;">
        <thead>
          <tr style="background:#edf2f7;">
            <th rowspan="2">वयोगट</th>
            <th rowspan="2">लिंग</th>
            <th colspan="2">पी.व्ही.</th>
            <th colspan="2">पी.एफ.</th>
            <th colspan="2">मिक्स</th>
            <th colspan="2">एकूण हिवताप रुग्ण</th>
          </tr>
          <tr style="background:#edf2f7;">
            <th>मा</th><th>प्र</th>
            <th>मा</th><th>प्र</th>
            <th>मा</th><th>प्र</th>
            <th>मा</th><th>प्र</th>
          </tr>
        </thead>
        <tbody>
          <tr><td rowspan="2">६ म. ते १ वर्ष</td><td>स्त्री</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
          <tr><td>पुरुष</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
          <tr><td rowspan="2">१ ते ४ वर्ष</td><td>स्त्री</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
          <tr><td>पुरुष</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
          <tr><td rowspan="2">५ ते १४ वर्ष</td><td>स्त्री</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
          <tr><td>पुरुष</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
          <tr><td rowspan="2">१५ वर्षावरील</td><td>स्त्री</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
          <tr><td>पुरुष</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
          <tr style="background:#edf2f7; font-weight:bold;">
            <td rowspan="2">एकूण</td><td>स्त्री</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td>
          </tr>
          <tr style="background:#edf2f7; font-weight:bold;">
            <td>पुरुष</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td>
          </tr>
        </tbody>
      </table>

      <h4 style="font-size:14px; margin:15px 0 10px 0; font-weight:700;">१०.२ सर्वेक्षण</h4>
      <table style="width:100%; font-size:12px; margin-bottom:20px;">
        <thead>
          <tr style="background:#edf2f7;">
            <th colspan="2" rowspan="2" class="text-left">बाब</th>
            <th colspan="2">घेतलेले रक्त नमुणे</th>
            <th colspan="2">ग्रहित उपचार दिलेले रुग्ण</th>
            <th colspan="2">एक दिवसीय समुळ उपचार केलेले</th>
          </tr>
          <tr style="background:#edf2f7;">
            <th>मासीक</th><th>प्रगत</th>
            <th>मासीक</th><th>प्रगत</th>
            <th>मासीक</th><th>प्रगत</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td rowspan="2" class="text-left" style="font-weight:600;">आरोग्य सेवक</td>
            <td>पहिला</td>
            <td><b>${D23}</b></td><td><b>${D24}</b></td>
            <td>${D23}</td><td>${D24}</td>
            <td>0</td><td>0</td>
          </tr>
          <tr>
            <td>दुसरा</td>
            <td><b>${D25}</b></td><td><b>${D26}</b></td>
            <td>${D25}</td><td>${D26}</td>
            <td>0</td><td>0</td>
          </tr>
          <tr>
            <td colspan="2" class="text-left" style="font-weight:600;">आरोग्य सेविका</td>
            <td><b>${D27}</b></td><td><b>${D28}</b></td>
            <td>${D27}</td><td>${D28}</td>
            <td>0</td><td>0</td>
          </tr>
          <tr>
            <td colspan="2" class="text-left" style="font-weight:600;">आशा रक्त नमुने</td>
            <td><b>${D29}</b></td><td><b>${D30}</b></td>
            <td>${D29}</td><td>${D30}</td>
            <td>0</td><td>0</td>
          </tr>
          <tr style="background:#e6fffa; font-weight:bold;">
            <td colspan="2" class="text-left">एकूण</td>
            <td><b>${D31}</b></td><td><b>${D32}</b></td>
            <td>${D31}</td><td>${D32}</td>
            <td>0</td><td>0</td>
          </tr>
        </tbody>
      </table>

      <div class="footer-sign">
        <b>वैद्यकीय अधिकारी</b><br>
        प्राथमिक आरोग्य केंद्र भादा, ता. औसा जि. लातूर
      </div>
    </div>

    <div class="page-break"></div>

    <!-- ================= SECTION 4: १०.४ ते १०.८ ================= -->
    <div class="report-page" style="margin-top:25px;">
      <table style="width:100%; font-size:12px; margin-bottom:20px;">
        <thead>
          <tr style="background:#edf2f7;">
            <th class="text-left" colspan="2">तपशिल</th>
            <th>मासिक</th>
            <th>प्रगतीपर</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="2" class="text-left">बाहयरुग्ण विभागातील एकूण तापाचे रुग्ण</td>
            <td><b>${D3}</b></td><td><b>${D4}</b></td>
          </tr>
          <tr>
            <td colspan="2" class="text-left">तपासलेले एकूण रक्त नमुणे</td>
            <td><b>${D3}</b></td><td><b>${D4}</b></td>
          </tr>
          <tr>
            <td rowspan="4" class="text-left">रक्त नमुणे दुशीत आढळलेले</td>
            <td>पी व्ही</td><td>0</td><td>0</td>
          </tr>
          <tr><td>पी एफ</td><td>0</td><td>0</td></tr>
          <tr><td>मिक्स</td><td>0</td><td>0</td></tr>
          <tr style="font-weight:bold;"><td>एकूण</td><td>0</td><td>0</td></tr>
          <tr>
            <td rowspan="4" class="text-left">बाहयरुग्ण विभागात त्याच दिवशी समुळ उपचार दिलेले</td>
            <td>पी व्ही</td><td>0</td><td>0</td>
          </tr>
          <tr><td>पी एफ</td><td>0</td><td>0</td></tr>
          <tr><td>मिक्स</td><td>0</td><td>0</td></tr>
          <tr style="font-weight:bold;"><td>एकूण</td><td>0</td><td>0</td></tr>
        </tbody>
      </table>

      <!-- 10.4 FTD -->
      <h4 style="font-size:14px; margin:10px 0 6px 0; font-weight:700;">१०.४ ताप उपचार केंद्राचे कार्य (F.T.D.)</h4>
      <table style="width:100%; font-size:12px; margin-bottom:15px;">
        <thead>
          <tr style="background:#edf2f7;">
            <th>अ.क्र</th><th class="text-left">तपशिल</th><th>मासिक</th><th>प्रगतीपर</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>1</td><td class="text-left">मंजुर संख्या</td><td>0</td><td>0</td></tr>
          <tr><td>2</td><td class="text-left">कार्यान्वीत संख्या</td><td>0</td><td>0</td></tr>
          <tr><td>3</td><td class="text-left">घेतलेले रक्त नमुणे</td><td>0</td><td>0</td></tr>
          <tr><td>4</td><td class="text-left">ग्रहीत उपचार दिलेल्या रुग्णांची संख्या</td><td>0</td><td>0</td></tr>
          <tr><td>5</td><td class="text-left">वाटप केलल्या क्लोरोक्वीन (150 मीग्रॅ)</td><td>0</td><td>0</td></tr>
          <tr><td>6</td><td class="text-left">आढळलेले हिवताप रुग्ण</td><td>0</td><td>0</td></tr>
        </tbody>
      </table>

      <!-- 10.5 DDC -->
      <h4 style="font-size:14px; margin:10px 0 6px 0; font-weight:700;">१०.५ औषध वाटप केंद्राचे कार्य (D.D.C.)</h4>
      <table style="width:100%; font-size:12px; margin-bottom:15px;">
        <thead>
          <tr style="background:#edf2f7;">
            <th rowspan="2">अ.क्र</th>
            <th rowspan="2" class="text-left">केंद्र</th>
            <th colspan="2">औषध वाटप केंद्राची संख्या</th>
            <th colspan="2">ग्रहीत उपचार दिलेल्या रुग्णांची संख्या</th>
            <th colspan="2">वाटप केलल्या क्लोरोक्वीन (150 मीग्रॅ)</th>
          </tr>
          <tr style="background:#edf2f7;">
            <th>स्थापीत केलेले</th><th>प्रत्येक्षात कार्यान्वीत</th>
            <th>मासीक</th><th>प्रगत</th>
            <th>मासीक</th><th>प्रगत</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>1</td><td class="text-left">ग्रामपंचायत</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
          <tr><td>2</td><td class="text-left">शाळा</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
          <tr><td>3</td><td class="text-left">आश्रामशाळा</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
          <tr><td>4</td><td class="text-left">आंगणवाडी</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
          <tr><td>5</td><td class="text-left">ईतर</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
          <tr style="background:#edf2f7; font-weight:bold;"><td>6</td><td class="text-left">एकूण</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
        </tbody>
      </table>

      <!-- 10.6 Labour Camp -->
      <h4 style="font-size:14px; margin:10px 0 6px 0; font-weight:700;">१०.६ मजूर वसाहतीत केलेले कार्य</h4>
      <table style="width:100%; font-size:12px; margin-bottom:15px;">
        <thead>
          <tr style="background:#edf2f7;">
            <th rowspan="2">मजूर वसाहतीची संख्या लेबर कॅम्प</th>
            <th rowspan="2">मजूर वसाहतीची एकूण लोकसंख्या</th>
            <th rowspan="2">भेटी दिलेल्या मजूर वसाहतीची संख्या</th>
            <th colspan="2">घेतलेले रक्त नमूने</th>
            <th colspan="2">ग्रहित उपचार दिलेले रुग्ण संख्या</th>
            <th colspan="2">क्लोरोक्वीन गोळया वाटप संख्या</th>
          </tr>
          <tr style="background:#edf2f7;">
            <th>मा</th><th>प्र</th><th>मा</th><th>प्र</th><th>मा</th><th>प्र</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
        </tbody>
      </table>

      <!-- 10.7 Other Surveys -->
      <h4 style="font-size:14px; margin:10px 0 6px 0; font-weight:700;">१०.७ इतर सर्व्हेक्षण</h4>
      <table style="width:100%; font-size:12px; margin-bottom:15px;">
        <thead>
          <tr style="background:#edf2f7;">
            <th rowspan="2">अ.क्र.</th>
            <th rowspan="2" class="text-left">बाब</th>
            <th colspan="2">सर्वेक्षण केलेली लोकसंख्या</th>
            <th colspan="2">घेतलेले रक्त नमूने</th>
            <th colspan="2">ग्रहितोपचार केलेल्या रुग्णाची संख्या</th>
            <th colspan="2">ब्लिस्टर पॅक डोसेस वाटप</th>
            <th colspan="2">क्लोरोक्वीन गोळ्या वाटप</th>
          </tr>
          <tr style="background:#edf2f7;">
            <th>मा</th><th>प्र</th><th>मा</th><th>प्र</th><th>मा</th><th>प्र</th><th>मा</th><th>प्र</th><th>१५० मि.ग्रॅ.</th><th>६०० मि.ग्रॅ.</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>1</td><td class="text-left">सहवासीतांचे सर्वेक्षण</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
          <tr><td>2</td><td class="text-left">मास सर्व्हे</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
          <tr><td>3</td><td class="text-left">फॉलोअप सर्व्हे</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
          <tr><td>4</td><td class="text-left">भटकी जमात</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
          <tr><td>5</td><td class="text-left">इतर</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
          <tr style="background:#edf2f7; font-weight:bold;"><td colspan="2">एकूण</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
        </tbody>
      </table>

      <!-- 10.8 Indirect Survey (OPD) -->
      <h4 style="font-size:14px; margin:10px 0 6px 0; font-weight:700;">१०.८ अप्रत्यक्ष सर्वेक्षण : -बाहय रुग्ण विभागातील</h4>
      <table style="width:100%; font-size:12px; margin-bottom:20px;">
        <thead>
          <tr style="background:#edf2f7;">
            <th rowspan="2">अ.क्र.</th>
            <th rowspan="2" class="text-left">प्रा.आ.केंद्र / दवाखाने नांव</th>
            <th colspan="2">नवीन बाहय रुग्ण</th>
            <th colspan="2">तापांचे रुग्ण</th>
            <th colspan="2">घेतलेले रक्तनमूने</th>
            <th colspan="2">एक दिवशीय समुळ उपचार</th>
            <th colspan="2">क्लोरोक्वीन गोळया वाटप</th>
          </tr>
          <tr style="background:#edf2f7;">
            <th>मा</th><th>प्र</th><th>मा</th><th>प्र</th><th>मा</th><th>प्र</th><th>मा</th><th>प्र</th><th>मा</th><th>प्र</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td class="text-left"><b>प्राथमिक आरोग्य केंद्र भादा</b></td>
            <td>${D1}</td><td>${D2}</td>
            <td>${feverM}</td><td>${feverProg}</td>
            <td>${smearsM}</td><td>${smearsProg}</td>
            <td>${treatedM}</td><td>${treatedProg}</td>
            <td>${cqM}</td><td>${cqProg}</td>
          </tr>
          <tr style="background:#edf2f7; font-weight:bold;">
            <td colspan="2" class="text-right">एकूण:</td>
            <td>${D1}</td><td>${D2}</td>
            <td>${feverM}</td><td>${feverProg}</td>
            <td>${smearsM}</td><td>${smearsProg}</td>
            <td>${treatedM}</td><td>${treatedProg}</td>
            <td>${cqM}</td><td>${cqProg}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="page-break"></div>

    <!-- ================= SECTION 5: १०.१३ ते १०.१५ ================= -->
    <div class="report-page" style="margin-top:25px;">
      <h4 style="font-size:14px; margin:0 0 6px 0; font-weight:700;">१०.१३ गर्भवती स्त्रीया व ० ते १ वर्ष वयोगटातील बालकांना उपचार</h4>
      <table style="width:100%; font-size:12px; margin-bottom:15px;">
        <thead>
          <tr style="background:#edf2f7;">
            <th colspan="4">हिवताप निदान झालेल्या गर्भवती स्त्रीया</th>
            <th colspan="4">हिवताप निदान झालेले ० ते १ वर्ष वयोगटातील बालके</th>
          </tr>
          <tr style="background:#edf2f7;">
            <th>PV</th><th>PF</th><th>Mixed</th><th>एकूण</th>
            <th>PV</th><th>PF</th><th>Mixed</th><th>एकूण</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>0</td><td>0</td><td>0</td><td>0</td>
            <td>0</td><td>0</td><td>0</td><td>0</td>
          </tr>
        </tbody>
      </table>

      <h4 style="font-size:14px; margin:10px 0 6px 0; font-weight:700;">१०.१३.१ किमोप्रोपफीलॅक्सिस (हिवताप प्रतिबंधात्मक उपचार)</h4>
      <table style="width:100%; font-size:12px; margin-bottom:15px;">
        <thead>
          <tr style="background:#edf2f7;">
            <th colspan="2">नोंदणी केलेल्या एकूण गर्भवती स्त्रीया</th>
            <th colspan="2">किमोप्रोलॅक्सिससाठी उपलब्ध स्त्रीया</th>
            <th colspan="2">उपचारीत स्त्रीया</th>
            <th colspan="2">क्लोरोक्वीन गोळया खर्च</th>
          </tr>
          <tr style="background:#edf2f7;">
            <th>मासीक</th><th>प्रगती</th>
            <th>मासीक</th><th>प्रगती</th>
            <th>मासीक</th><th>प्रगती</th>
            <th>मासीक</th><th>प्रगती</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
        </tbody>
      </table>

      <!-- 10.14 Stenciling -->
      <h4 style="font-size:14px; margin:10px 0 6px 0; font-weight:700;">१०.१४ घरावरील स्टेन्सीलिंग</h4>
      <table style="width:100%; font-size:12px; margin-bottom:20px;">
        <thead>
          <tr style="background:#edf2f7;">
            <th rowspan="2">अ.क्र.</th>
            <th rowspan="2" class="text-left">तपशिल</th>
            <th colspan="3">मासीक</th>
            <th colspan="3">प्रगतीपर</th>
          </tr>
          <tr style="background:#edf2f7;">
            <th>पहिला पंधरवडा</th><th>दुसरा पंधरवडा</th><th>एकूण</th>
            <th>पहिला पंधरवडा</th><th>दुसरा पंधरवडा</th><th>एकूण</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td><td class="text-left">एकूण घरांची संख्या</td>
            <td>8533</td><td>8533</td><td>17066</td>
            <td>8533</td><td>8533</td><td>17066</td>
          </tr>
          <tr>
            <td>2</td><td class="text-left">आराखडे पुर्ण झालेल्या घरांची संख्या</td>
            <td>0</td><td>0</td><td>0</td>
            <td>1250</td><td>1579</td><td>2829</td>
          </tr>
          <tr>
            <td>3</td><td class="text-left">गृहभेटी आरोग्य सेवक</td>
            <td>${D35}</td><td>${D36}</td><td><b>${D37}</b></td>
            <td>${D38}</td><td>${D39}</td><td><b>${D40}</b></td>
          </tr>
          <tr>
            <td>4</td><td class="text-left">गृहभेटी आरोग्य सेवीका</td>
            <td>${D41}</td><td>${D42}</td><td><b>${D43}</b></td>
            <td>${D44}</td><td>${D45}</td><td><b>${D46}</b></td>
          </tr>
        </tbody>
      </table>

      <!-- 10.15.1 Lab Report -->
      <h4 style="font-size:14px; margin:15px 0 6px 0; font-weight:700;">१०.१५.१ प्रयोगशाळा अहवाल (प्रयोगशाळा तंत्रज्ञ पद रिक्त)</h4>
      <table style="width:100%; font-size:12px; margin-bottom:15px;">
        <tbody>
          <tr><td style="width:6%;">1</td><td class="text-left">महिन्याच्या सुरुवातीस शिल्लक रक्त नमूने</td><td style="width:15%;">0</td></tr>
          <tr><td>2</td><td class="text-left">महिन्यात प्राप्त झालेले रक्त नमूने</td><td>0</td></tr>
          <tr><td>3</td><td class="text-left">प्रयोगशाळेत तपासणीसाठी एकूण उपलब्ध रक्त नमूने (१ + २)</td><td>0</td></tr>
          <tr><td>4</td><td class="text-left">महिन्यात तपासलेले रक्त नमूने</td><td>0</td></tr>
          <tr><td>5</td><td class="text-left">तपासणीसाठी जिल्हा+प्रा.आ.केंद्राबाहेर पाठविलेले रक्त नमूने</td><td><b>${D19}</b></td></tr>
          <tr><td>6</td><td class="text-left">महिना अखेर तपासणीसाठी शिल्लक रक्त नमूने</td><td>0</td></tr>
          <tr>
            <td rowspan="4">7</td>
            <td class="text-left" colspan="2"><b>रक्त नमूना प्राप्त झालेपासुन तपासणीचा कालावधी:</b></td>
          </tr>
          <tr><td class="text-left" style="padding-left:20px;">० ते १ दिवस</td><td>0</td></tr>
          <tr><td class="text-left" style="padding-left:20px;">२ ते ७ दिवस</td><td><b>${D65}</b></td></tr>
          <tr><td class="text-left" style="padding-left:20px;">८ ते १५ दिवस</td><td><b>${D66}</b></td></tr>
          <tr><td></td><td class="text-left" style="padding-left:20px;">१५ दिवसाच्यावर</td><td><b>${D67}</b></td></tr>
        </tbody>
      </table>

      <!-- 10.15.2 Low performance -->
      <h4 style="font-size:14px; margin:10px 0 6px 0; font-weight:700;">१०.१५.२ कमी रक्त नमूने गोळा केलेल्या कर्मचा-यांची माहिती</h4>
      <table style="width:100%; font-size:12px; margin-bottom:20px;">
        <tbody>
          <tr><td style="width:6%;">1</td><td class="text-left">एकही रक्त नमूना न घेणा-या कर्मचा-यांची संख्या</td><td style="width:15%; font-weight:bold; color:#c53030;">${zeroEmpCount}</td></tr>
          <tr><td>2</td><td class="text-left">नियमित रक्त नमूने न घेणा-या कर्मचा-याची संख्या</td><td style="width:15%; font-weight:bold; color:#dd6b20;">${irregularEmpCount}</td></tr>
          <tr><td>3</td><td class="text-left">५० टक्के पेक्षा कमी रक्त नमूने घेणा-या कर्मचा-याची संख्या</td><td style="width:15%; font-weight:bold; color:#dd6b20;">${lowEmpCount}</td></tr>
          <tr><td>4</td><td class="text-left">एकही रक्त नमूना गोळा न केलेल्या गावाची संख्या</td><td style="width:15%; font-weight:bold; color:#c53030;">${zeroVillageCount}</td></tr>
          <tr><td>5</td><td class="text-left">५० टक्के पेक्षा कमी रक्त नमूने गोळा केलेल्या सेक्टरची संख्या यादी सोबत जोडावी.</td><td style="width:15%; font-weight:bold;">${lowSubcenterCount}</td></tr>
        </tbody>
      </table>

      <div class="footer-sign">
        <b>वैद्यकीय अधिकारी</b><br>
        प्राथमिक आरोग्य केंद्र भादा, ता. औसा जि. लातूर
      </div>
    </div>

    <!-- ================= SECTION 6: परिशिष्ट - शून्य व अनियमित रक्त नमुना संकलन यादी ================= -->
    <div class="report-page" style="page-break-before: always; margin-top: 30px;">
      <div style="text-align:center; margin-bottom:16px;">
        <h3 style="font-size:17px; margin:0 0 4px 0; font-weight:700; color:#1a202c;">प्राथमिक आरोग्य केंद्र भादा, ता. औसा जि. लातूर</h3>
        <h4 style="font-size:15px; margin:0 0 4px 0; font-weight:700; color:#c53030;">माहे ${D47} - शून्य, अनियमित व ५०% पेक्षा कमी रक्त नमुना संकलन अहवाल</h4>
        <div style="font-size:13px; color:#4a5568; font-weight:600;">(१०.१५.२ अंतर्गत जोडपत्र / परिशिष्ट यादी)</div>
        <hr style="border:0; border-top:1.5px solid #2d3748; margin:10px 0 16px 0;">
      </div>

      <!-- Table 1: Zero BS Employees -->
      <div style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <h4 style="font-size:13.5px; margin:0; font-weight:700; color:#c53030;">
            १. एकही रक्त नमुना न घेणाऱ्या कर्मचाऱ्यांची यादी (आरोग्य सेवक / सेविका - शून्य संकलन):
          </h4>
          <span style="background:#fed7d7; color:#9b2c2c; font-size:11.5px; font-weight:bold; padding:2px 8px; border-radius:10px;">
            एकूण: ${zeroEmpCount} कर्मचारी (आशा वगळून)
          </span>
        </div>
        <table style="width:100%; font-size:11px; border-collapse:collapse; margin-bottom:10px;">
          <thead>
            <tr style="background:#edf2f7;">
              <th style="width:5%;">अ.क्र.</th>
              <th style="width:12%;">उपकेंद्र</th>
              <th style="width:25%;" class="text-left">कर्मचाऱ्याचे नाव</th>
              <th style="width:18%;">पदनाम</th>
              <th style="width:10%;">BS Code</th>
              <th style="width:18%;" class="text-left">नेमून दिलेली गावे</th>
              <th style="width:12%; background:#fed7d7; color:#9b2c2c;">घेतलेले नमुने</th>
            </tr>
          </thead>
          <tbody>
            ${zeroBsEmployees.map((e, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><b>${e.upkendra}</b></td>
                <td class="text-left font-semibold">${e.employeeName}</td>
                <td>${e.designation}</td>
                <td><code>${e.bsCode}</code></td>
                <td class="text-left">${e.villages}</td>
                <td style="font-weight:bold; color:#e53e3e; background:#fff5f5;">० (Zero)</td>
              </tr>
            `).join('')}
            ${zeroBsEmployees.length === 0 ? '<tr><td colspan="7" style="color:#38a169; font-weight:bold; padding:10px;">सर्व आरोग्य सेवक व सेविकांनी रक्त नमुने घेतले आहेत (शून्य संकलन नाही).</td></tr>' : ''}
          </tbody>
        </table>
      </div>

      <!-- Table 2: Low / Irregular Employees -->
      <div style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <h4 style="font-size:13.5px; margin:0; font-weight:700; color:#dd6b20;">
            २. ५०% पेक्षा कमी / अनियमित रक्त नमुने घेणाऱ्या कर्मचाऱ्यांची यादी (आरोग्य सेवक / सेविका):
          </h4>
          <span style="background:#feebc8; color:#7b341e; font-size:11.5px; font-weight:bold; padding:2px 8px; border-radius:10px;">
            एकूण: ${lowEmpCount} कर्मचारी (आशा वगळून)
          </span>
        </div>
        <table style="width:100%; font-size:11px; border-collapse:collapse; margin-bottom:10px;">
          <thead>
            <tr style="background:#edf2f7;">
              <th style="width:5%;">अ.क्र.</th>
              <th style="width:12%;">उपकेंद्र</th>
              <th style="width:25%;" class="text-left">कर्मचाऱ्याचे नाव</th>
              <th style="width:18%;">पदनाम</th>
              <th style="width:10%;">BS Code</th>
              <th style="width:10%;">उद्दिष्ट</th>
              <th style="width:10%;">प्रत्यक्ष नमुने</th>
              <th style="width:10%; background:#feebc8; color:#7b341e;">साध्य (%)</th>
            </tr>
          </thead>
          <tbody>
            ${lowBsEmployees.map((e, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><b>${e.upkendra}</b></td>
                <td class="text-left font-semibold">${e.employeeName}</td>
                <td>${e.designation}</td>
                <td><code>${e.bsCode}</code></td>
                <td>${e.target}</td>
                <td style="font-weight:bold; color:#dd6b20;">${e.totalCount}</td>
                <td style="font-weight:bold; background:#fffaf0; color:#c05621;">${e.percent}%</td>
              </tr>
            `).join('')}
            ${lowBsEmployees.length === 0 ? '<tr><td colspan="8" style="color:#38a169; font-weight:bold; padding:10px;">सर्व कर्मचाऱ्यांचे संकलन ५०% पेक्षा जास्त आहे.</td></tr>' : ''}
          </tbody>
        </table>
      </div>

      <!-- Table 3: Zero Collection Villages -->
      <div style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <h4 style="font-size:13.5px; margin:0; font-weight:700; color:#4a5568;">
            ३. एकही रक्त नमुना गोळा न झालेल्या गावांची यादी (सर्व कर्मचारी मिळून - MPW, ANM व आशा सर्व एकत्रित):
          </h4>
          <span style="background:#edf2f7; color:#4a5568; font-size:11.5px; font-weight:bold; padding:2px 8px; border-radius:10px;">
            एकूण: ${zeroVillageCount} गावे (सर्व कर्मचारी मिळून शून्य संकलन)
          </span>
        </div>
        <table style="width:100%; font-size:11px; border-collapse:collapse; margin-bottom:15px;">
          <thead>
            <tr style="background:#edf2f7;">
              <th style="width:6%;">अ.क्र.</th>
              <th style="width:18%;">उपकेंद्र</th>
              <th style="width:28%;" class="text-left">गावाचे नाव</th>
              <th style="width:32%;" class="text-left">संबंधित नेमून दिलेले कर्मचारी</th>
              <th style="width:16%; background:#fed7d7; color:#9b2c2c;">एकूण संकलन (सर्व मिळून)</th>
            </tr>
          </thead>
          <tbody>
            ${zeroVillages.map((item, idx) => {
              const emps = masterData.filter(m => (m.villageList || []).includes(item.village)).map(m => m.employeeName).join(', ') || '-';
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td><b>${item.upkendra}</b></td>
                  <td class="text-left font-semibold">${item.village}</td>
                  <td class="text-left">${emps}</td>
                  <td style="font-weight:bold; color:#e53e3e; background:#fff5f5;">० (Zero)</td>
                </tr>
              `;
            }).join('')}
            ${zeroVillages.length === 0 ? '<tr><td colspan="5" style="color:#38a169; font-weight:bold; padding:10px;">सर्व गावांतून रक्त नमुने संकलित झाले आहेत (शून्य संकलन असलेले एकही गाव नाही).</td></tr>' : ''}
          </tbody>
        </table>
      </div>

      <div class="footer-sign" style="margin-top:25px;">
        <b>वैद्यकीय अधिकारी</b><br>
        प्राथमिक आरोग्य केंद्र भादा, ता. औसा जि. लातूर
      </div>
    </div>

    <!-- ================= SECTION 7: डेंगी व चिकनगुनिया मासिक व प्रोग्रेसिव्ह (प्रगत) प्रयोगशाळा अहवाल ================= -->
    <div class="report-page" style="page-break-before: always; margin-top: 30px;">
      <div style="text-align:center; margin-bottom:16px;">
        <h3 style="font-size:17px; margin:0 0 4px 0; font-weight:700; color:#1a202c;">प्राथमिक आरोग्य केंद्र भादा, ता. औसा जि. लातूर</h3>
        <h4 style="font-size:15px; margin:0 0 4px 0; font-weight:700; color:#2b6cb0;">
          माहे ${D47} - डेंगी व चिकनगुनिया कीटकजन्य आजार मासिक व प्रोग्रेसिव्ह (प्रगत) प्रयोगशाळा अहवाल
        </h4>
        <div style="font-size:13px; color:#4a5568; font-weight:600;">(१०.१५.२ जोडपत्रानंतरचे परिशिष्ट - मासिक व प्रोग्रेसिव्ह संशयित नमुने, GMC लातूर तपासणी निष्कर्ष व गावनिहाय सर्वेक्षण)</div>
        <hr style="border:0; border-top:1.5px solid #2d3748; margin:10px 0 16px 0;">
      </div>

      <!-- Part 1: Main Summary Table -->
      <div style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <h4 style="font-size:13.5px; margin:0; font-weight:700; color:#2b6cb0;">
            १. डेंगी व चिकनगुनिया - मासिक व प्रोग्रेसिव्ह (प्रगत) प्रयोगशाळा तपासणी सारांश तक्ता:
          </h4>
          <span style="background:#ebf8ff; color:#2b6cb0; font-size:11.5px; font-weight:bold; padding:2px 8px; border-radius:10px;">
            शासकीय वैद्यकीय महाविद्यालय (GMC), लातूर
          </span>
        </div>
        <table style="width:100%; font-size:11px; border-collapse:collapse; margin-bottom:8px;">
          <thead>
            <tr style="background:#edf2f7;">
              <th style="width:4%;" rowspan="2">अ.क्र.</th>
              <th style="width:18%;" rowspan="2" class="text-left">कीटकजन्य आजार</th>
              <th style="width:16%;" rowspan="2">चाचणी पद्धती (Test Method)</th>
              <th style="width:14%;" colspan="2">पाठवलेले संशयित नमुने</th>
              <th style="width:14%;" colspan="2">पॉझिटिव्ह निष्पन्न रुग्ण</th>
              <th style="width:12%;" colspan="2">निगेटिव्ह नमुने</th>
              <th style="width:12%;" colspan="2" style="background:#fffaf0; color:#c05621;">संशयित / इक्विव्होकल</th>
              <th style="width:10%;" colspan="2">प्रलंबित अहवाल</th>
            </tr>
            <tr style="background:#edf2f7;">
              <th style="width:7%;">मासिक</th>
              <th style="width:7%;">प्रगत (YTD)</th>
              <th style="width:7%; background:#fff5f5; color:#c53030;">मासिक</th>
              <th style="width:7%; background:#fff5f5; color:#c53030;">प्रगत</th>
              <th style="width:6%;">मासिक</th>
              <th style="width:6%;">प्रगत</th>
              <th style="width:6%; background:#fffaf0; color:#c05621;">मासिक</th>
              <th style="width:6%; background:#fffaf0; color:#c05621;">प्रगत</th>
              <th style="width:5%;">मासिक</th>
              <th style="width:5%;">प्रगत</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>१</td>
              <td class="text-left font-semibold">🦟 डेंगी ताप (Dengue Fever)</td>
              <td>NS1 Ag व IgM ELISA</td>
              <td><b>${monthTotalDengueSamples}</b></td>
              <td><b>${progTotalDengueSamples}</b></td>
              <td style="font-weight:bold; color:${monthDenguePosCount > 0 ? '#c53030' : '#2d3748'}; background:${monthDenguePosCount > 0 ? '#fff5f5' : 'transparent'};">${monthDenguePosCount}</td>
              <td style="font-weight:bold; color:${progDenguePosCount > 0 ? '#c53030' : '#2d3748'}; background:${progDenguePosCount > 0 ? '#fff5f5' : 'transparent'};">${progDenguePosCount}</td>
              <td>${monthDengueNegCount}</td>
              <td>${progDengueNegCount}</td>
              <td style="font-weight:bold; color:${monthDengueEquivocalCount > 0 ? '#c05621' : '#718096'}; background:${monthDengueEquivocalCount > 0 ? '#fffaf0' : 'transparent'};">${monthDengueEquivocalCount}</td>
              <td style="font-weight:bold; color:${progDengueEquivocalCount > 0 ? '#c05621' : '#718096'}; background:${progDengueEquivocalCount > 0 ? '#fffaf0' : 'transparent'};">${progDengueEquivocalCount}</td>
              <td style="font-weight:bold; color:${monthDenguePendCount > 0 ? '#b7791f' : '#718096'};">${monthDenguePendCount}</td>
              <td style="font-weight:bold; color:${progDenguePendCount > 0 ? '#b7791f' : '#718096'};">${progDenguePendCount}</td>
            </tr>
            <tr>
              <td>२</td>
              <td class="text-left font-semibold">🦠 चिकनगुनिया (Chikungunya)</td>
              <td>Chikungunya IgM ELISA</td>
              <td><b>${monthTotalDengueSamples}</b></td>
              <td><b>${progTotalDengueSamples}</b></td>
              <td style="font-weight:bold; color:${monthChikPosCount > 0 ? '#c53030' : '#2d3748'}; background:${monthChikPosCount > 0 ? '#fff5f5' : 'transparent'};">${monthChikPosCount}</td>
              <td style="font-weight:bold; color:${progChikPosCount > 0 ? '#c53030' : '#2d3748'}; background:${progChikPosCount > 0 ? '#fff5f5' : 'transparent'};">${progChikPosCount}</td>
              <td>${monthChikNegCount}</td>
              <td>${progChikNegCount}</td>
              <td style="font-weight:bold; color:${monthChikEquivocalCount > 0 ? '#c05621' : '#718096'}; background:${monthChikEquivocalCount > 0 ? '#fffaf0' : 'transparent'};">${monthChikEquivocalCount}</td>
              <td style="font-weight:bold; color:${progChikEquivocalCount > 0 ? '#c05621' : '#718096'}; background:${progChikEquivocalCount > 0 ? '#fffaf0' : 'transparent'};">${progChikEquivocalCount}</td>
              <td style="font-weight:bold; color:${monthChikPendCount > 0 ? '#b7791f' : '#718096'};">${monthChikPendCount}</td>
              <td style="font-weight:bold; color:${progChikPendCount > 0 ? '#b7791f' : '#718096'};">${progChikPendCount}</td>
            </tr>
            <tr style="background:#e6fffa; font-weight:bold;">
              <td colspan="3" class="text-left">एकूण कीटकजन्य संशयित सिरम नमुने (GMC लातूर):</td>
              <td><b>${monthTotalDengueSamples}</b></td>
              <td><b>${progTotalDengueSamples}</b></td>
              <td style="color:#c53030;">${monthDenguePosCount + monthChikPosCount}</td>
              <td style="color:#c53030;">${progDenguePosCount + progChikPosCount}</td>
              <td>${monthDengueNegCount}</td>
              <td>${progDengueNegCount}</td>
              <td style="color:#c05621;">${monthDengueEquivocalCount + monthChikEquivocalCount}</td>
              <td style="color:#c05621;">${progDengueEquivocalCount + progChikEquivocalCount}</td>
              <td style="color:#b7791f;">${Math.max(monthDenguePendCount, monthChikPendCount)}</td>
              <td style="color:#b7791f;">${Math.max(progDenguePendCount, progChikPendCount)}</td>
            </tr>
          </tbody>
        </table>
        <div style="font-size:10.5px; color:#4a5568; background:#f7fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px 10px; margin-bottom:15px; line-height:1.5;">
          📌 <b>महत्त्वाची नोंद (Medical & Reporting Clarification):</b><br>
          • <b>इक्विव्होकल (Equivocal):</b> प्रयोगशाळेकडून तपासणी अहवाल प्राप्त झाला आहे; परंतु निष्कर्षाचे मूल्य अनिश्चित / सीमावर्ती (Borderline OD Ratio) आहे. अशा रुग्णांची १४ दिवसांनी फेरचाचणी आवश्यक असते.<br>
          • <b>प्रलंबित (Pending):</b> नमुना प्रयोगशाळेत पाठवला असून अहवाल अद्याप अप्राप्त (येणे बाकी) आहे.<br>
          <i>(Equivocal आणि Pending हे दोन्ही अहवाल प्रकार पूर्णपणे स्वतंत्र व भिन्न आहेत.)</i>
        </div>
      </div>

      <!-- Part 2: Villagewise Surveillance Breakdown -->
      <div style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <h4 style="font-size:13.5px; margin:0; font-weight:700; color:#2d3748;">
            २. माहे ${D47} गावनिहाय डेंगी व चिकनगुनिया संशयित नमुने व निष्पन्न रुग्ण वर्गीकरण:
          </h4>
          <span style="font-size:11.5px; color:#718096; font-weight:600;">
            कीटकशास्त्रीय सर्वेक्षण व अबेट ट्रीटमेंट
          </span>
        </div>
        <table style="width:100%; font-size:11px; border-collapse:collapse; margin-bottom:15px;">
          <thead>
            <tr style="background:#edf2f7;">
              <th style="width:5%;">अ.क्र.</th>
              <th style="width:18%;" class="text-left">गावाचे नाव</th>
              <th style="width:14%;">उपकेंद्र</th>
              <th style="width:11%;">मासिक नमुने</th>
              <th style="width:11%;">प्रगत नमुने</th>
              <th style="width:10%; color:#c53030;">डेंगी +ve</th>
              <th style="width:10%; color:#c53030;">चिकनगुनिया +ve</th>
              <th style="width:10%; color:#c05621;">इक्विव्होकल</th>
              <th style="width:11%;">प्रलंबित</th>
            </tr>
          </thead>
          <tbody>
            ${dengueVillagewiseRows.map((v, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td class="text-left font-semibold">${v.village}</td>
                <td>${v.upkendra}</td>
                <td><b>${v.monthSamples}</b></td>
                <td>${v.progSamples}</td>
                <td style="font-weight:bold; color:${v.monthDenguePos > 0 ? '#c53030' : '#276749'};">${v.monthDenguePos}</td>
                <td style="font-weight:bold; color:${v.monthChikPos > 0 ? '#c53030' : '#276749'};">${v.monthChikPos}</td>
                <td style="font-weight:bold; color:${v.monthEquivocal > 0 ? '#c05621' : '#718096'};">${v.monthEquivocal}</td>
                <td style="font-weight:bold; color:${v.monthPend > 0 ? '#b7791f' : '#718096'};">${v.monthPend}</td>
              </tr>
            `).join('')}
            ${dengueVillagewiseRows.length === 0 ? '<tr><td colspan="9" style="color:#276749; font-weight:bold; padding:10px;">माहे ' + D47 + ' व प्रोग्रेसिव्ह कालावधीत सर्व गावांत नियमित कीटकशास्त्रीय सर्वेक्षण सुरू असून शून्य डेंगी/चिकनगुनिया रुग्ण आहेत (निरंक अहवाल).</td></tr>' : ''}
          </tbody>
        </table>
      </div>

      <!-- Part 3: Detailed Monthly Patient Register with Results -->
      <div style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <h4 style="font-size:13.5px; margin:0; font-weight:700; color:#2d3748;">
            ३. माहे ${D47} मधील डेंगी व चिकनगुनिया संशयित नमुने व तपासणी निष्कर्ष नोंदवही (चालू महिन्यातील यादी):
          </h4>
          <span style="font-size:11.5px; font-weight:bold; color:#2b6cb0; background:#ebf8ff; padding:2px 8px; border-radius:10px;">
            चालू मासिक एकूण: ${monthTotalDengueSamples} नमुने (डेंगी +ve: ${monthDenguePosCount} | चिकनगुनिया +ve: ${monthChikPosCount} | इक्विव्होकल: ${monthDengueEquivocalCount + monthChikEquivocalCount} | प्रलंबित: ${Math.max(monthDenguePendCount, monthChikPendCount)})
          </span>
        </div>
        <table style="width:100%; font-size:11px; border-collapse:collapse; margin-bottom:15px;">
          <thead>
            <tr style="background:#edf2f7;">
              <th style="width:4%;">अ.क्र.</th>
              <th style="width:16%;" class="text-left">रुग्णाचे नाव</th>
              <th style="width:8%;">वय/लिंग</th>
              <th style="width:12%;">गाव (उपकेंद्र)</th>
              <th style="width:10%;">नोंदणी क्र.</th>
              <th style="width:10%;">नमुना दिनांक</th>
              <th style="width:18%;">डेंगी चाचणी निष्कर्ष</th>
              <th style="width:18%;">चिकनगुनिया चाचणी निष्कर्ष</th>
              <th style="width:10%;">सद्यस्थिती</th>
            </tr>
          </thead>
          <tbody>
            ${monthDengueEntries.map((e, idx) => {
              const dBadge = isDenguePos(e)
                ? '<span style="color:#c53030; font-weight:bold;">🔴 पॉझिटिव्ह (Positive)</span>'
                : (isDengueNeg(e)
                  ? '<span style="color:#276749; font-weight:bold;">🟢 निगेटिव्ह (Negative)</span>'
                  : (isDengueEquivocal(e)
                    ? '<span style="display:inline-block; font-size:10.5px; font-weight:bold; padding:1px 6px; border-radius:4px; background:#feebc8; color:#7b341e; border:1px solid #fbd38d;">🟠 इक्विव्होकल (Equivocal)</span>'
                    : '<span style="color:#718096; font-weight:bold;">⏳ प्रलंबित (Pending)</span>'));
              const cBadge = isChikPos(e)
                ? '<span style="color:#c53030; font-weight:bold;">🔴 पॉझिटिव्ह (Positive)</span>'
                : (isChikNeg(e)
                  ? '<span style="color:#276749; font-weight:bold;">🟢 निगेटिव्ह (Negative)</span>'
                  : (isChikEquivocal(e)
                    ? '<span style="display:inline-block; font-size:10.5px; font-weight:bold; padding:1px 6px; border-radius:4px; background:#feebc8; color:#7b341e; border:1px solid #fbd38d;">🟠 इक्विव्होकल (Equivocal)</span>'
                    : '<span style="color:#718096; font-weight:bold;">⏳ प्रलंबित (Pending)</span>'));
              const dRef = e.dengueReportRef ? `<br><span style="font-size:9.5px; color:#4a5568;">जा.क्र: ${e.dengueReportRef} ${e.dengueReportDate ? '(' + formatDateDisplay(e.dengueReportDate) + ')' : ''}</span>` : '';
              const cRef = e.chikungunyaReportRef ? `<br><span style="font-size:9.5px; color:#4a5568;">जा.क्र: ${e.chikungunyaReportRef} ${e.chikungunyaReportDate ? '(' + formatDateDisplay(e.chikungunyaReportDate) + ')' : ''}</span>` : '';
              const dateFmt = e.dateCollection ? formatDateDisplay(e.dateCollection) : (e.createdAt ? formatDateDisplay(e.createdAt) : '-');
              const sexLabel = e.sex === 'FEMALE' ? 'स्त्री' : (e.sex === 'MALE' ? 'पुरुष' : e.sex || '-');
              const sc = masterData.find(m => (m.villageList || []).includes(e.village))?.upkendra || '';
              const isAnyPos = isDenguePos(e) || isChikPos(e);
              const isAnyEquiv = isDengueEquivocal(e) || isChikEquivocal(e);
              const isAllNeg = isDengueNeg(e) && (isChikNeg(e) || !e.chikungunyaResult);
              const status = isAnyPos
                ? '<span style="color:#c53030; font-weight:bold;">उपचारित / कंटेनर सर्व्हे पूर्ण</span>'
                : (isAnyEquiv
                  ? '<span style="color:#c05621; font-weight:bold;">इक्विव्होकल (१४ दिवसांनी फेरचाचणी)</span>'
                  : (isAllNeg
                    ? '<span style="color:#276749;">सर्व्हेक्षण पूर्ण</span>'
                    : '<span style="color:#dd6b20;">GMC अहवाल प्रतीक्षेत (Pending)</span>'));
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td class="text-left font-semibold">${e.patientName}</td>
                  <td>${e.age || '-'} / ${sexLabel}</td>
                  <td>${e.village || '-'} ${sc ? `<span style="font-size:9.5px; color:#718096;">(${sc})</span>` : ''}</td>
                  <td>${e.patientRegNo || '-'}</td>
                  <td>${dateFmt}</td>
                  <td>${dBadge}${dRef}</td>
                  <td>${cBadge}${cRef}</td>
                  <td>${status}</td>
                </tr>
              `;
            }).join('')}
            ${monthDengueEntries.length === 0 ? '<tr><td colspan="9" style="color:#276749; font-weight:bold; padding:12px;">माहे ' + D47 + ' मध्ये डेंगी किंवा चिकनगुनियाचा एकही संशयित सिरम नमुना नोंदवलेला नाही (शून्य संशयित नमुने / निरंक अहवाल).</td></tr>' : ''}
          </tbody>
        </table>
      </div>

      <div class="footer-sign" style="margin-top:25px;">
        <b>वैद्यकीय अधिकारी</b><br>
        प्राथमिक आरोग्य केंद्र भादा, ता. औसा जि. लातूर
      </div>
    </div>
  `;

  function wrapReportPage(title, bodyContent) {
    return `<!DOCTYPE html>
<html lang="mr">
<head>
  <meta charset="UTF-8">
  <title>${title} - प्रा.आ.केंद्र भादा</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 12mm; }
    body {
      font-family: 'Poppins', Arial, sans-serif;
      color: #1a202c;
      background: #f7fafc;
      margin: 0;
      padding: 20px;
    }
    .print-actions {
      max-width: 850px;
      margin: 0 auto 20px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.08);
    }
    .print-btn {
      background: #00796b;
      color: #fff;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .print-btn:hover { background: #004d40; }
    .close-btn {
      background: #e2e8f0;
      color: #4a5568;
      border: none;
      padding: 10px 18px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
    }
    .report-sheet {
      max-width: 850px;
      margin: 0 auto;
      background: #ffffff;
      padding: 35px 40px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.08);
      border-radius: 8px;
      min-height: 1000px;
      box-sizing: border-box;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }
    th, td { border: 1px solid #2d3748; padding: 8px 10px; font-size: 13px; text-align: center; }
    th { background: #edf2f7; font-weight: 600; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .header-box { text-align: center; border-bottom: 2px solid #2d3748; padding-bottom: 12px; margin-bottom: 20px; }
    .main-title { font-size: 20px; font-weight: 700; color: #1a202c; margin: 0 0 4px 0; }
    .sub-title { font-size: 15px; font-weight: 600; color: #4a5568; margin: 0; }
    .subject { font-weight: 700; text-decoration: underline; margin: 15px 0 10px 0; font-size: 14px; }
    .footer-sign { margin-top: 45px; text-align: right; line-height: 1.6; font-size: 14px; font-weight: 600; }
    .page-break { page-break-after: always; }
    @media print {
      body { background: #ffffff; padding: 0; }
      .print-actions { display: none !important; }
      .report-sheet { box-shadow: none; padding: 0; margin: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <div><strong>प्रा.आ.केंद्र भादा</strong> - अधिकृत अहवाल / पत्र</div>
    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
      <button class="print-btn" onclick="window.print()">🖨️ प्रिंट करा / PDF सेव्ह करा</button>
      <button class="close-btn" onclick="window.close()">बंद करा</button>
    </div>
  </div>
  <div class="report-sheet">
    ${bodyContent}
  </div>
</body>
</html>`;
  }

  const reportHtml = wrapReportPage(`मासिक हिवताप अहवाल - ${selectedMonthDisplay}`, bodyHtml);
  return {
    success: true,
    message: `माहे ${selectedMonthDisplay} चा अधिकृत मासिक अहवाल यशस्वीरित्या तयार झाला! (एकूण ${D19} नमुने)`,
    html: reportHtml,
    d19: D19
  };
}

// Generate from AI Studio services/reports.js
const resAiStudio = generateMonthlyReportWebApp("सप्टेंबर २०२६");
const reportId = resAiStudio.url.replace("/api/reports/", "");
const aiStudioHtml = generatedReports.get(reportId);

// Generate from our new standalone client-side generator function
const resClient = generateClientSideMonthlyReportHtml("सप्टेंबर २०२६", {
  monthMaster,
  masterData,
  bsDataEntry,
  villageDetails,
  dengueChikungunyaEntries
});

console.log("AI Studio HTML length:", aiStudioHtml.length);
console.log("Client-side HTML length:", resClient.html.length);

// Compare body contents (excluding the dynamic excel download buttons in wrapReportPage if any)
const cleanForCompare = (s) => s.replace(/\s+/g, ' ').replace(/\/api\/export\/[a-z0-9-.]+/g, '').replace(/<a[^>]*Excel<\/a>/g, '').trim();

const aiClean = cleanForCompare(aiStudioHtml);
const clientClean = cleanForCompare(resClient.html);

console.log("Are body contents identical?", aiClean === clientClean);
if (aiClean !== clientClean) {
  console.log("Diff length:", Math.abs(aiClean.length - clientClean.length));
  for (let i = 0; i < Math.min(aiClean.length, clientClean.length); i++) {
    if (aiClean[i] !== clientClean[i]) {
      console.log(`Mismatch at index ${i}:`);
      console.log("AI Studio:", aiClean.slice(Math.max(0, i - 30), i + 30));
      console.log("Client   :", clientClean.slice(Math.max(0, i - 30), i + 30));
      break;
    }
  }
} else {
  console.log("SUCCESS! EXACT 100% PARITY ACHIEVED!");
}
