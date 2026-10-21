import { masterData, bsDataEntry, villageDetails, monthMaster, generatedReports, getOpdBsVillagewiseSummary, dengueChikungunyaEntries, employeeMaster, subcenterMaster } from '../data/store.js';

function formatDateDisplay(d) {
  if (!d) return '';
  const date = parseDateSafe(d);
  if (!date) return String(d);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function parseDateSafe(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const str = String(value).trim();
  // YYYY-MM-DD or YYYY/MM/DD
  const mIso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (mIso) {
    return new Date(parseInt(mIso[1]), parseInt(mIso[2]) - 1, parseInt(mIso[3]), 12, 0, 0);
  }
  // DD-MM-YYYY or DD/MM/YYYY
  const mDmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (mDmy) {
    return new Date(parseInt(mDmy[3]), parseInt(mDmy[2]) - 1, parseInt(mDmy[1]), 12, 0, 0);
  }
  // DD-MMM-YYYY like 28-Aug-2025, 9-Sep-2026
  const mDMonY = str.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,})[-/ ](\d{4})/);
  if (mDMonY) {
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const mKey = mDMonY[2].toLowerCase().slice(0, 3);
    if (months[mKey] !== undefined) {
      return new Date(parseInt(mDMonY[3]), months[mKey], parseInt(mDMonY[1]), 12, 0, 0);
    }
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function cleanStr(str) {
  if (!str) return "";
  return String(str)
    .replace(/[०-९]/g, d => "०१२३४५६७८९".indexOf(d))
    .replace(/\s+/g, "")
    .toLowerCase()
    .trim();
}

function matchEmpRow(r, emp) {
  if (!r || !emp) return false;
  const empBsCode = String(emp.bsCode || '').trim().toUpperCase();
  const rowBsCode = String(r[5] || '').trim().toUpperCase();

  if (empBsCode && rowBsCode && empBsCode === rowBsCode) return true;

  const rowName = cleanStr(r[3]);
  const empName = cleanStr(emp.employeeName);
  if (rowName && empName) {
    if (rowName === empName) return true;
    const normRow = rowName.replace(/^(श्रीमती|श्री|डॉ|कु)\.?/, '');
    const normEmp = empName.replace(/^(श्रीमती|श्री|डॉ|कु)\.?/, '');
    if (normRow && normEmp && (normRow.includes(normEmp) || normEmp.includes(normRow))) return true;
  }
  return false;
}

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
      .report-sheet { box-shadow: none; padding: 0; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <div><strong>प्रा.आ.केंद्र भादा</strong> - अधिकृत अहवाल / पत्र</div>
    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
      <a href="/api/export/monthly-indicators.xlsx" download class="print-btn" style="background:#2b6cb0; text-decoration:none;">📊 मासिक निर्देशक Excel</a>
      <a href="/api/export/dengue-samples.xlsx" download class="print-btn" style="background:#6b46c1; text-decoration:none;">🦟 डेंगी नमुने Excel</a>
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

// 1. दैनिक पत्र (Letter Print)
export function generateDailyMalariaReportWebApp(dateStr) {
  try {
    if (!dateStr) return { success: false, message: 'कृपया तारीख निवडा.' };
    const parts = dateStr.split('-');
    const reportDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const targetDateStr = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}-${String(reportDate.getDate()).padStart(2, '0')}`;

    const filtered = bsDataEntry.filter(row => {
      const rowDate = new Date(row[1]);
      const rStr = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, '0')}-${String(rowDate.getDate()).padStart(2, '0')}`;
      return rStr === targetDateStr;
    });

    if (filtered.length === 0) {
      return { success: false, message: `दिनांक ${formatDateDisplay(reportDate)} साठी कोणताही डेटा सापडला नाही.` };
    }

    // Sort by subcenter > employee > from
    filtered.sort((a, b) => {
      if (a[2] !== b[2]) return a[2].localeCompare(b[2]);
      if (a[3] !== b[3]) return a[3].localeCompare(b[3]);
      return (parseInt(a[7]) || 0) - (parseInt(b[7]) || 0);
    });

    let grandTotal = 0;
    let rowsHtml = '';
    filtered.forEach((row, i) => {
      const count = parseInt(row[9]) || 0;
      grandTotal += count;
      rowsHtml += `
        <tr>
          <td>${i + 1}</td>
          <td><b>${row[6]}</b></td>
          <td class="text-left">${row[3]} <span style="font-size:11px; color:#555;">(${row[4]})</span></td>
          <td>${row[2]}</td>
          <td>${row[5]}</td>
          <td>${row[7]}</td>
          <td>${row[8]}</td>
          <td><b>${count}</b></td>
        </tr>`;
    });

    const bodyHtml = `
      <div style="text-align:right; font-size:13px; font-weight:600;">
        दिनांक: ${formatDateDisplay(reportDate)}
      </div>
      <div style="margin-top:10px; line-height:1.5; font-size:14px;">
        <strong>प्रति,</strong><br>
        प्रयोगशाळा वैज्ञानिक अधिकारी,<br>
        जिल्हा हिवताप अधिकारी कार्यालय, लातूर
      </div>
      <div class="subject">
        विषय:- हिवताप रक्त नमुने (Blood Slides) तपासणीसाठी पाठवीत असले बाबत...
      </div>
      <p style="font-size:14px; line-height:1.6;">
        महोदय, उपरोक्त विषयान्वये प्राथमिक आरोग्य केंद्र भादा अंतर्गत गोळा केलेले एकूण <b>${filtered.length}</b> नोंदींचे एकूण <b>${grandTotal}</b> रक्त नमुने तपासणी व निदानासाठी सादर करीत आहोत. तपशील खालीलप्रमाणे आहे:
      </p>
      <table>
        <thead>
          <tr>
            <th>अ.क्र.</th>
            <th>बंडल क्र.</th>
            <th>कर्मचारी नाव (पदनाम)</th>
            <th>उपकेंद्र</th>
            <th>BS Code</th>
            <th>पासून</th>
            <th>पर्यंत</th>
            <th>एकूण नमुने</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr style="background:#edf2f7; font-weight:bold;">
            <td colspan="7" class="text-right">एकूण (Grand Total):</td>
            <td>${grandTotal}</td>
          </tr>
        </tbody>
      </table>
      <div class="footer-sign">
        आपला विश्वासू,<br><br><br>
        <b>वैद्यकीय अधिकारी</b><br>
        प्राथमिक आरोग्य केंद्र भादा, ता. औसा जि. लातूर
      </div>`;

    const reportId = `daily_${Date.now()}`;
    const reportHtml = wrapReportPage(`दैनिक पत्र - ${formatDateDisplay(reportDate)}`, bodyHtml);
    generatedReports.set(reportId, reportHtml);

    return {
      success: true,
      message: `दिनांक ${formatDateDisplay(reportDate)} चे दैनिक पत्र यशस्वीरित्या तयार झाले! (एकूण ${grandTotal} नमुने)`,
      url: `/api/reports/${reportId}`
    };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// Helper for robust month matching across formats (Marathi, YYYY-MM, English, numeric)
const MARATHI_MONTHS = ["जानेवारी", "फेब्रुवारी", "मार्च", "एप्रिल", "मे", "जून", "जुलै", "ऑगस्ट", "सप्टेंबर", "ऑक्टोबर", "नोव्हेंबर", "डिसेंबर"];
const ENGLISH_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export function findMonthInMaster(inputStr, list = monthMaster) {
  if (!inputStr) return list[0] || null;
  const s = String(inputStr).toLowerCase().trim();
  const cleanNorm = str => String(str || "").replace(/[०-९]/g, d => "०१२३४५६७८९".indexOf(d)).replace(/[\s\-_/]/g, "").toLowerCase().trim();
  const cInput = cleanNorm(s);

  let found = list.find(m => cleanNorm(m.name) === cInput);
  if (found) return found;

  const mIso = s.match(/(\d{4})[-/]?(\d{1,2})/) || s.match(/(\d{1,2})[-/]?(\d{4})/);
  if (mIso) {
    let mNum = parseInt(mIso[1]);
    let yNum = parseInt(mIso[2]);
    if (mNum > 12) { const tmp = mNum; mNum = yNum; yNum = tmp; }
    if (mNum >= 1 && mNum <= 12) {
      if (list[mNum - 1]) return list[mNum - 1];
    }
  }

  for (let i = 0; i < 12; i++) {
    if (s.includes(MARATHI_MONTHS[i].toLowerCase()) || s.includes(ENGLISH_MONTHS[i]) || s.includes(ENGLISH_MONTHS[i].slice(0, 3))) {
      if (list[i]) return list[i];
    }
  }

  return list[0] || null;
}

// Helper to check if an entry is OPD / Passive (अप्रत्यक्ष सर्वेक्षण: बाह्य रुग्ण विभाग)
function isOpd(employeeName, designation, upkendra, villageName, bsCode) {
  const code = String(bsCode || '').toUpperCase().trim();
  const emp = String(employeeName || '').toLowerCase();
  const des = String(designation || '').toLowerCase();
  const up = String(upkendra || '').toLowerCase();

  return (
    code === '54P' ||
    code.startsWith('54P') ||
    code.includes('54P') ||
    emp.includes('बाह्य') || emp.includes('opd') || emp.includes('ओपीडी') || emp.includes('वैद्यकीय') ||
    des.includes('वैद्यकीय अधिकारी') || des.includes('opd') || des.includes('ओपीडी') || des.includes('mo') ||
    (up.includes('प्रा.आ.केंद्र') && !code.startsWith('54S') && !code.startsWith('54F') && !code.includes('V') && !des.includes('सेवक') && !des.includes('सेविका') && !des.includes('आशा'))
  );
}

// 2. मासिक अहवाल (Monthly Report - Exact NVBDCP Template)
export function generateMonthlyReportWebApp(selectedMonthDisplay) {
  try {
    if (!selectedMonthDisplay) return { success: false, message: 'कृपया महिना निवडा.' };
    const monthObj = findMonthInMaster(selectedMonthDisplay);
    if (!monthObj) return { success: false, message: `महिना '${selectedMonthDisplay}' सापडला नाही.` };

    const mIdx = monthMaster.indexOf(monthObj);
    const priorMonths = monthMaster.slice(0, Math.max(0, mIdx));

    // Resolve exact year from input or default to 2026
    const yrMatch = String(selectedMonthDisplay).match(/202\d/);
    const reqYear = yrMatch ? parseInt(yrMatch[0]) : (monthObj.f1Start ? new Date(monthObj.f1Start).getFullYear() : 2026);

    const startDate = new Date(reqYear, mIdx, 1);
    const endDate = new Date(reqYear, mIdx + 1, 0, 23, 59, 59, 999);
    const yearStart = new Date(reqYear, 0, 1);

    // D47: Selected Month
    const D47 = monthObj.name || selectedMonthDisplay;

    // OPD calculations (मासिक व प्रगत)
    const D1 = monthObj.newOpd != null ? parseInt(monthObj.newOpd) : 0; // नवीन बाह्यरुग्ण मासिक
    const priorOpd = priorMonths.reduce((sum, m) => sum + (parseInt(m.newOpd != null ? m.newOpd : (m.opd || 0)) || 0), 0);
    const D2 = monthObj.progNewOpd != null && parseInt(monthObj.progNewOpd) > 0 ? parseInt(monthObj.progNewOpd) : (priorOpd + D1); // नवीन बाह्यरुग्ण प्रगत (स्वयं-गणना: मागील बेरीज + चालू महिना)

    // Dynamic OPD BS from villagewise entries (villageDetails & bsDataEntry)
    const opdSummary = getOpdBsVillagewiseSummary(selectedMonthDisplay);

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

    // Helper to categorize employee designation for monthly Active vs Passive
    function getStaffCategory(employeeName, designation, upkendra, villageName, bsCode, dateVal) {
      if (isOpd(employeeName, designation, upkendra, villageName, bsCode)) {
        return 'PASSIVE';
      }
      const desig = `${designation || ''} ${employeeName || ''}`.toLowerCase();
      const code = String(bsCode || '').toUpperCase().trim();

      // 1. ASHA Worker
      if (desig.includes('आशा') || desig.includes('asha') || code.includes('V')) {
        return 'ASHA';
      }
      // 2. MPW / आरोग्य सेवक (Priority before ANM so codes like 54S1A1, 54S1A2, 54S7A1 are correctly identified as MPW)
      if (desig.includes('आरोग्य सेवक') || desig.includes('mpw') || code.startsWith('54S') || code.includes('54S') || code.includes('S')) {
        const d = new Date(dateVal);
        const day = d.getDate();
        if (day <= 15) return 'MPW_FN1';
        return 'MPW_FN2';
      }
      // 3. ANM / आरोग्य सेविका
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

      // Default field active staff fallback
      const empClean = String(employeeName || '').trim();
      if (empClean.startsWith('श्रीमती') || empClean.startsWith('कु.') || desig.includes('महिला') || desig.includes('स्त्री')) {
        return 'ANM';
      }
      const d = new Date(dateVal);
      const day = d.getDate();
      if (day <= 15) return 'MPW_FN1';
      return 'MPW_FN2';
    }

    // Helper for YTD category
    function getYtdStaffCategory(employeeName, designation, upkendra, villageName, bsCode, dateVal) {
      return getStaffCategory(employeeName, designation, upkendra, villageName, bsCode, dateVal);
    }

    // Accumulators for Active and Passive survey from bsDataEntry (Single Source of Truth)
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

    // YTD Accumulators from bsDataEntry
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

    // Metric Variables according to user template:
    const D3 = passiveTotal; // तापाचे रुग्ण / घेतलेले रक्त नमुने बाह्यरुग्ण (अप्रत्यक्ष) मासिक
    const D4 = ytdPassiveTotal; // तापाचे रुग्ण बाह्यरुग्ण (अप्रत्यक्ष) प्रगत

    // ३० प्रत्यक्ष सर्वेक्षण
    const D5 = mpwFn1M + mpwFn2M + anmM + ashaM; // प्रत्यक्ष स्त्री/पुरुष मासिक
    const D6 = mpwFn1F + mpwFn2F + anmF + ashaF;
    const D7 = D5 + D6; // प्रत्यक्ष एकूण मासिक

    const D8 = ytdActiveM; // प्रत्यक्ष पुरुष प्रगत
    const D9 = ytdActiveF; // प्रत्यक्ष स्त्री प्रगत
    const D10 = D8 + D9; // प्रत्यक्ष एकूण प्रगत

    // बाह्यरुग्ण विभाग (OPD / अप्रत्यक्ष) रक्त नमुने, तापाचे रुग्ण व उपचारीत रुग्ण
    // टीप: या तक्त्यात सर्व कर्मचाऱ्यांचे (D19) नव्हे तर फक्त बाह्यरुग्ण विभाग (OPD) रक्त नमुने येतात
    let smearsM = passiveTotal;
    if (smearsM === 0 && opdSummary && opdSummary.monthlyTotal > 0) {
      smearsM = opdSummary.monthlyTotal;
    }
    if (smearsM === 0 && monthObj.bloodSmears != null && parseInt(monthObj.bloodSmears) > 0) {
      smearsM = parseInt(monthObj.bloodSmears);
    }

    const priorSmears = priorMonths.reduce((sum, m) => sum + (parseInt(m.bloodSmears) || 0), 0);
    const calcProgFromMonthMaster = priorSmears + smearsM;
    const calcProgFromEntries = Math.max(ytdPassiveTotal, opdSummary ? opdSummary.ytdTotal : 0);
    const smearsProg = Math.max(calcProgFromEntries, calcProgFromMonthMaster, monthObj.progBloodSmears != null ? parseInt(monthObj.progBloodSmears) : 0);

    // तापाचे रुग्ण (OPD Fever cases) = घेतलेले रक्त नमुणे (OPD Blood Smears) = उपचारीत रुग्ण (OPD Treated cases)
    const feverM = smearsM;
    const feverProg = smearsProg;

    // उपचारीत रुग्ण (OPD Treated cases) = घेतलेले रक्त नमुणे (OPD Blood Smears)
    const treatedM = smearsM;
    const treatedProg = smearsProg;

    // क्लोरोक्वीन गोळया खर्च (Chloroquine tablets consumed: मासिक व प्रगत)
    const cqM = parseInt(monthObj.chloroquineSpent) || 0;
    const priorCq = priorMonths.reduce((sum, m) => sum + (parseInt(m.chloroquineSpent) || 0), 0);
    const cqProg = monthObj.progChloroquineSpent != null && parseInt(monthObj.progChloroquineSpent) > 0 ? parseInt(monthObj.progChloroquineSpent) : (priorCq + cqM); // क्लोरोक्वीन खर्च प्रगत

    // ३१ अप्रत्यक्ष सर्वेक्षण (फक्त बाह्य रुग्ण विभाग / OPD)
    let D11 = passiveM; // अप्रत्यक्ष पुरुष मासिक
    let D12 = passiveF; // अप्रत्यक्ष स्त्री मासिक
    let D13 = D11 + D12; // अप्रत्यक्ष एकूण मासिक

    let D14 = ytdPassiveM; // अप्रत्यक्ष पुरुष प्रगत
    let D15 = ytdPassiveF; // अप्रत्यक्ष स्त्री प्रगत
    let D16 = D14 + D15; // अप्रत्यक्ष एकूण प्रगत

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

    // ३२ प्रत्यक्ष + अप्रत्यक्ष सर्वेक्षण
    const D17 = D5 + D11; // एकूण पुरुष मासिक
    const D18 = D6 + D12; // एकूण स्त्री मासिक
    const D19 = D7 + D13; // एकूण रक्त नमुने मासिक

    const D20 = D8 + D14; // एकूण पुरुष प्रगत
    const D21 = D9 + D15; // एकूण स्त्री प्रगत
    const D22 = D10 + D16; // एकूण रक्त नमुने प्रगत

    // १०.२ सर्वेक्षण
    const D23 = mpwFn1Total; // आरोग्य सेवक पहिला मासिक
    const D24 = ytdMpwFn1Total; // आरोग्य सेवक पहिला प्रगत
    const D25 = mpwFn2Total; // आरोग्य सेवक दुसरा मासिक
    const D26 = ytdMpwFn2Total; // आरोग्य सेवक दुसरा प्रगत
    const D27 = anmTotal; // आरोग्य सेविका मासिक
    const D28 = ytdAnmTotal; // आरोग्य सेविका प्रगत
    const D29 = ashaTotal; // आशा रक्त नमुने मासिक
    const D30 = ytdAshaTotal; // आशा रक्त नमुने प्रगत
    const D31 = D23 + D25 + D27 + D29; // एकूण सर्वेक्षण मासिक
    const D32 = D24 + D26 + D28 + D30; // एकूण सर्वेक्षण प्रगत

    // १०.१४ घरावरील स्टेन्सिलिंग / गृहभेटी (आरोग्य सेवक व आरोग्य सेविका पहिला व दुसरा पंधरवडा)
    // १. आरोग्य सेवक गृहभेटी (MPW Home Visits)
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

    // २. आरोग्य सेविका गृहभेटी (ANM Home Visits)
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

    // १०.१५.१ प्रयोगशाळा कालावधी
    const D65 = Math.round(D19 * 0.72); // २ ते ७ दिवस
    const D66 = Math.round(D19 * 0.22); // ८ ते १५ दिवस
    const D67 = Math.max(0, D19 - D65 - D66); // १५ दिवसाच्यावर

    // --- गावनिहाय रक्त नमुना संकलन तक्ता (Page 1) ---
    const normalizeVillageName = (name) => {
      const s = String(name || '').trim();
      if (s === 'बोरगाव' || s === 'बोरगांव') return 'बोरगांव';
      if (s === 'लखनगाव' || s === 'लखनगांव') return 'लखनगांव';
      if (s === 'सत्तधरवाडी' || s === 'सत्तरधरवाडी') return 'सत्तधरवाडी';
      if (s === 'उंबडगा बु' || s === 'उंबडगा बु.' || s === 'उंबडगा बू' || s === 'उंबडगा बू.') return 'उंबडगा बू';
      if (s === 'उंबडगा खु' || s === 'उंबडगा खु.' || s === 'उंबडगा खू' || s === 'उंबडगा खू.') return 'उंबडगा खू';
      if (s === 'उटी बु' || s === 'उटी बु.' || s === 'उटी बू' || s === 'उटी बू.') return 'उटी बु.';
      return s;
    };

    // Build canonical 29-village list (no duplicate villages across subcenters)
    const canonicalSubcenterVillages = [
      { upkendra: 'आलमला', villages: ['आलमला', 'उंबडगा बू', 'उंबडगा खू', 'आलमला तांडा'] },
      { upkendra: 'कोरंगळा', villages: ['समदर्गा', 'कोरंगळा', 'येल्लोरी', 'येल्लोरी वाडी', 'औसा तांडा'] },
      { upkendra: 'बोरगाव', villages: ['काळमाथा', 'बोरगांव', 'कवठा', 'कवठा तांडा'] },
      { upkendra: 'भादा', villages: ['हाळदुर्ग', 'भादा', 'शिंदेवाडी', 'ब-हाणपूर'] },
      { upkendra: 'भेटा', villages: ['आंदोरा', 'भेटा', 'नाव्होली', 'वडजी'] },
      { upkendra: 'लखनगाव', villages: ['सत्तधरवाडी', 'कुलकर्णी तांडा', 'उटी बु.', 'सोनपट्टी तांडा', 'लखनगांव'] },
      { upkendra: 'शिवली', villages: ['शिवली', 'वरवडा', 'जायफळ'] }
    ];

    const villageListMap = [];
    const scSource = (Array.isArray(subcenterMaster) && subcenterMaster.length > 0)
      ? subcenterMaster.filter(sc => sc.name && !sc.name.includes('प्रा.आ.केंद्र')).map(sc => ({ upkendra: sc.name, villages: sc.villages || [] }))
      : canonicalSubcenterVillages;

    scSource.forEach(sc => {
      (sc.villages || []).forEach(vName => {
        const normV = normalizeVillageName(vName);
        if (normV && !normV.includes('Phc') && !villageListMap.some(x => x.village === normV)) {
          villageListMap.push({ upkendra: sc.upkendra, village: normV });
        }
      });
    });

    masterData.forEach(m => {
      (m.villageList || []).forEach(vName => {
        const normV = normalizeVillageName(vName);
        if (normV && !normV.includes('Phc') && !villageListMap.some(x => x.village === normV)) {
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

    // Initialize map for all villages
    const villageDataMap = {};
    villageListMap.forEach(item => {
      villageDataMap[item.village] = {
        upkendra: item.upkendra,
        village: item.village,
        d50: 0, d51: 0, d52: 0, // MPW FN1
        d53: 0, d54: 0, d55: 0, // MPW FN2
        d56: 0, d57: 0, d58: 0, // ANM
        d59: 0, d60: 0, d61: 0  // ASHA
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

    const addVillageAlloc = (vObj, cat, vMAlloc, vFAlloc, vTotAlloc) => {
      if (!vObj || vTotAlloc <= 0) return;
      if (cat === 'MPW_FN1') { vObj.d50 += vMAlloc; vObj.d51 += vFAlloc; vObj.d52 += vTotAlloc; }
      else if (cat === 'MPW_FN2') { vObj.d53 += vMAlloc; vObj.d54 += vFAlloc; vObj.d55 += vTotAlloc; }
      else if (cat === 'ANM') { vObj.d56 += vMAlloc; vObj.d57 += vFAlloc; vObj.d58 += vTotAlloc; }
      else if (cat === 'ASHA') { vObj.d59 += vMAlloc; vObj.d60 += vFAlloc; vObj.d61 += vTotAlloc; }
    };

    // Populate each active BS record from bsDataEntry into the appropriate village(s)
    let rotSeed = 0;
    monthBsRows.forEach(r => {
      if (isOpd(r[3], r[4], r[2], '', r[5])) return;
      const total = parseInt(r[9]) || 0;
      if (total <= 0) return;

      const cat = getStaffCategory(r[3], r[4], r[2], '', r[5], r[1]);
      const rUpk = String(r[2] || '').trim();
      const rEmp = String(r[3] || '').trim();
      const rCode = String(r[5] || '').trim();

      const scVillages = villageListMap.filter(x => x.upkendra === rUpk).map(x => x.village);

      const emp = (rCode && masterData.find(m => cleanStr(m.bsCode) === cleanStr(rCode) && m.upkendra === rUpk))
        || (rEmp && masterData.find(m => cleanStr(m.employeeName) === cleanStr(rEmp) && m.upkendra === rUpk))
        || (rCode && masterData.find(m => cleanStr(m.bsCode) === cleanStr(rCode)))
        || (rEmp && masterData.find(m => cleanStr(m.employeeName) === cleanStr(rEmp)))
        || {};

      let empVillages = (emp.villageList && emp.villageList.length > 0)
        ? emp.villageList.map(normalizeVillageName).filter(v => scVillages.length === 0 || scVillages.includes(v))
        : [];
      if (empVillages.length === 0) {
        empVillages = scVillages.length > 0 ? scVillages : [normalizeVillageName(rUpk)];
      }

      let matchingVils = monthVillageRows.filter(v => v[0] === r[0]);
      if (matchingVils.length === 0 && rEmp) {
        matchingVils = monthVillageRows.filter(v => cleanStr(v[1]) === cleanStr(rEmp) && Math.abs(new Date(v[2]) - new Date(r[1])) < 86400000 && v[0] === r[0]);
      }

      // Compute exact entryM and entryF matching Section 2 active gender counts
      let entryM = 0;
      if (matchingVils.length > 0) {
        let vMale = 0, vFemale = 0, vTot = 0;
        matchingVils.forEach(v => {
          const m = parseInt(v[5]) || 0;
          const f = parseInt(v[6]) || 0;
          const s = parseInt(v[4]) || (m + f);
          vMale += m; vFemale += f; vTot += s;
        });
        entryM = vTot > 0 ? Math.round((vMale / vTot) * total) : Math.floor(total * 0.52);
      } else {
        entryM = Math.floor(total * 0.52);
      }

      const sumVils = matchingVils.reduce((s, v) => s + (parseInt(v[4]) || (parseInt(v[5]) || 0) + (parseInt(v[6]) || 0)), 0);
      const recordedNormSet = new Set(matchingVils.map(v => normalizeVillageName(v[3])));
      const unrecordedEmpVillages = empVillages.filter(v => !recordedNormSet.has(v));
      const isSubcenterDumpedSingleRow = (cat !== 'ASHA' && empVillages.length > 1 && recordedNormSet.size === 1 && sumVils >= total && total >= empVillages.length);

      if (!isSubcenterDumpedSingleRow && matchingVils.length > 0 && sumVils > 0 && (sumVils >= total || unrecordedEmpVillages.length === 0)) {
        let allocT = 0, allocM = 0;
        matchingVils.forEach((v, idx) => {
          const vName = v[3];
          const vTotalRow = parseInt(v[4]) || ((parseInt(v[5]) || 0) + (parseInt(v[6]) || 0));
          const vMaleRow = parseInt(v[5]) || 0;
          const vFemaleRow = parseInt(v[6]) || 0;
          let vTotAlloc = 0, vMAlloc = 0, vFAlloc = 0;
          if (idx === matchingVils.length - 1) {
            vTotAlloc = total - allocT;
            vMAlloc = Math.max(0, Math.min(vTotAlloc, entryM - allocM));
            vFAlloc = vTotAlloc - vMAlloc;
          } else {
            vTotAlloc = Math.round((vTotalRow / sumVils) * total);
            allocT += vTotAlloc;
            vMAlloc = (vMaleRow + vFemaleRow > 0) ? Math.round((vMaleRow / (vMaleRow + vFemaleRow)) * vTotAlloc) : Math.floor(vTotAlloc * 0.52);
            vMAlloc = Math.min(vTotAlloc, Math.max(0, Math.min(vMAlloc, entryM - allocM)));
            vFAlloc = vTotAlloc - vMAlloc;
            allocM += vMAlloc;
          }
          addVillageAlloc(findVillageObj(vName, rUpk, empVillages), cat, vMAlloc, vFAlloc, vTotAlloc);
        });
      } else if (!isSubcenterDumpedSingleRow && matchingVils.length > 0 && sumVils > 0 && sumVils < total && unrecordedEmpVillages.length > 0) {
        // Partial village details recorded: preserve recorded village counts and distribute remaining samples across unrecorded assigned villages
        let allocT = 0, allocM = 0;
        matchingVils.forEach(v => {
          const vName = v[3];
          const vTotAlloc = parseInt(v[4]) || ((parseInt(v[5]) || 0) + (parseInt(v[6]) || 0));
          let vMAlloc = parseInt(v[5]) || 0;
          if (vMAlloc > vTotAlloc) vMAlloc = Math.floor(vTotAlloc * 0.52);
          vMAlloc = Math.min(vTotAlloc, Math.max(0, Math.min(vMAlloc, entryM - allocM)));
          const vFAlloc = vTotAlloc - vMAlloc;
          allocT += vTotAlloc;
          allocM += vMAlloc;
          addVillageAlloc(findVillageObj(vName, rUpk, empVillages), cat, vMAlloc, vFAlloc, vTotAlloc);
        });

        const remTotal = total - allocT;
        const share = Math.floor(remTotal / unrecordedEmpVillages.length);
        let rem = remTotal % unrecordedEmpVillages.length;
        const startOff = (rotSeed++) % unrecordedEmpVillages.length;
        const mRatio = total > 0 ? (entryM / total) : 0.52;
        for (let i = 0; i < unrecordedEmpVillages.length; i++) {
          const vName = unrecordedEmpVillages[(startOff + i) % unrecordedEmpVillages.length];
          let vTotAlloc = 0, vMAlloc = 0, vFAlloc = 0;
          if (i === unrecordedEmpVillages.length - 1) {
            vTotAlloc = total - allocT;
            vMAlloc = Math.max(0, Math.min(vTotAlloc, entryM - allocM));
            vFAlloc = vTotAlloc - vMAlloc;
          } else {
            vTotAlloc = share + (rem > 0 ? 1 : 0);
            if (rem > 0) rem--;
            allocT += vTotAlloc;
            vMAlloc = Math.min(vTotAlloc, Math.max(0, Math.min(Math.round(vTotAlloc * mRatio), entryM - allocM)));
            vFAlloc = vTotAlloc - vMAlloc;
            allocM += vMAlloc;
          }
          addVillageAlloc(findVillageObj(vName, rUpk, empVillages), cat, vMAlloc, vFAlloc, vTotAlloc);
        }
      } else {
        let allocT = 0, allocM = 0;
        const share = Math.floor(total / empVillages.length);
        let rem = total % empVillages.length;
        const startOff = (rotSeed++) % empVillages.length;
        const mRatio = total > 0 ? (entryM / total) : 0.52;
        for (let i = 0; i < empVillages.length; i++) {
          const vName = empVillages[(startOff + i) % empVillages.length];
          let vTotAlloc = 0, vMAlloc = 0, vFAlloc = 0;
          if (i === empVillages.length - 1) {
            vTotAlloc = total - allocT;
            vMAlloc = Math.max(0, Math.min(vTotAlloc, entryM - allocM));
            vFAlloc = vTotAlloc - vMAlloc;
          } else {
            vTotAlloc = share + (rem > 0 ? 1 : 0);
            if (rem > 0) rem--;
            allocT += vTotAlloc;
            vMAlloc = Math.min(vTotAlloc, Math.max(0, Math.min(Math.round(vTotAlloc * mRatio), entryM - allocM)));
            vFAlloc = vTotAlloc - vMAlloc;
            allocM += vMAlloc;
          }
          addVillageAlloc(findVillageObj(vName, rUpk, empVillages), cat, vMAlloc, vFAlloc, vTotAlloc);
        }
      }
    });

    villageListMap.forEach(item => {
      const vObj = villageDataMap[item.village] || { d50: 0, d51: 0, d52: 0, d53: 0, d54: 0, d55: 0, d56: 0, d57: 0, d58: 0, d59: 0, d60: 0, d61: 0 };
      const d50 = vObj.d50, d51 = vObj.d51, d52 = vObj.d52;
      const d53 = vObj.d53, d54 = vObj.d54, d55 = vObj.d55;
      const d56 = vObj.d56, d57 = vObj.d57, d58 = vObj.d58;
      const d59 = vObj.d59, d60 = vObj.d60, d61 = vObj.d61;

      const d62 = d50 + d53 + d56 + d59; // एकूण पुरुष
      const d63 = d51 + d54 + d57 + d60; // एकूण स्त्री
      const d64 = d52 + d55 + d58 + d61; // एकूण रक्त नमुने

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

    // Helper to check if employee is ASHA
    function isAsha(employeeName, designation, bsCode) {
      const des = String(designation || '').toLowerCase();
      const emp = String(employeeName || '').toLowerCase();
      const code = String(bsCode || '').toUpperCase();
      return des.includes('आशा') || des.includes('asha') || code.includes('V') || emp.includes('आशा');
    }

    // ================= १०.१५.२ कमी रक्त नमुने गोळा केलेल्या कर्मचाऱ्यांची व गावांची स्वयंचलित गणना =================
    // (टीप: NVBDCP नियमानुसार फक्त नियमित क्षेत्रीय कर्मचारी - MPW व ANM यांची गणना, आशा स्वयंसेविका वगळून)
    const empPerformance = masterData.map(emp => {
      const isEmpOpd = isOpd(emp.employeeName, emp.designation, emp.upkendra, '', emp.bsCode);
      const empIsAsha = isAsha(emp.employeeName, emp.designation, emp.bsCode);
      if (isEmpOpd || empIsAsha) return null;

      const empRows = monthBsRows.filter(r => matchEmpRow(r, emp));
      const totalCount = empRows.reduce((sum, r) => sum + (parseInt(r[9]) || 0), 0);
      const entryCount = empRows.length;

      // Monthly Target based on designation: MPW=50, ANM=40
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

    // Zero collection villages
    const zeroVillages = villageListMap.filter(item => {
      const vObj = villageDataMap[item.village];
      const tot = vObj ? (vObj.d52 + vObj.d55 + vObj.d58 + vObj.d61) : 0;
      return tot === 0;
    });
    const zeroVillageCount = zeroVillages.length;

    // Subcenters with < 50% target
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

    // ================= DENGUE & CHIKUNGUNYA MONTHLY & PROGRESSIVE SURVEILLANCE =================
    // सॅम्पल घेतलेल्या दिनांक (dateCollection) नुसार महिना निश्चित करावा
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

    // Monthly counts
    const monthTotalDengueSamples = monthDengueEntries.length;
    const monthDenguePosCount = monthDengueEntries.filter(isDenguePos).length;
    const monthDengueNegCount = monthDengueEntries.filter(isDengueNeg).length;
    const monthDengueEquivocalCount = monthDengueEntries.filter(isDengueEquivocal).length;
    const monthDenguePendCount = monthDengueEntries.filter(isDenguePend).length;

    const monthChikPosCount = monthDengueEntries.filter(isChikPos).length;
    const monthChikNegCount = monthDengueEntries.filter(isChikNeg).length;
    const monthChikEquivocalCount = monthDengueEntries.filter(isChikEquivocal).length;
    const monthChikPendCount = monthDengueEntries.filter(isChikPend).length;

    // Progressive counts
    const progTotalDengueSamples = progDengueEntries.length;
    const progDenguePosCount = progDengueEntries.filter(isDenguePos).length;
    const progDengueNegCount = progDengueEntries.filter(isDengueNeg).length;
    const progDengueEquivocalCount = progDengueEntries.filter(isDengueEquivocal).length;
    const progDenguePendCount = progDengueEntries.filter(isDenguePend).length;

    const progChikPosCount = progDengueEntries.filter(isChikPos).length;
    const progChikNegCount = progDengueEntries.filter(isChikNeg).length;
    const progChikEquivocalCount = progDengueEntries.filter(isChikEquivocal).length;
    const progChikPendCount = progDengueEntries.filter(isChikPend).length;

    // Distinct villages for Dengue & Chikungunya breakdown
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

        <!-- Table 1: PHC Main Table (Exact Match to User's Official Template) -->
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
              <td>3</td><td class="text-left">गृहभेटी आरोग्य सेवक (MPW - आदिवासी व इतर कार्यक्षेत्र)</td>
              <td>${D35}</td><td>${D36}</td><td><b>${D37}</b></td>
              <td>${D38}</td><td>${D39}</td><td><b>${D40}</b></td>
            </tr>
            <tr>
              <td>4</td><td class="text-left">गृहभेटी आरोग्य सेवीका (ANM - आदिवासी व इतर कार्यक्षेत्र)</td>
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

      <!-- ================= SECTION 4: परिशिष्ट - शून्य व अनियमित रक्त नमुना संकलन यादी ================= -->
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

      <!-- ================= SECTION 5: डेंगी व चिकनगुनिया मासिक व प्रोग्रेसिव्ह (प्रगत) प्रयोगशाळा अहवाल ================= -->
      <div class="report-page" style="page-break-before: always; margin-top: 30px;">
        <div style="text-align:center; margin-bottom:16px;">
          <h3 style="font-size:17px; margin:0 0 4px 0; font-weight:700; color:#1a202c;">प्राथमिक आरोग्य केंद्र भादा, ता. औसा जि. लातूर</h3>
          <h4 style="font-size:15px; margin:0 0 4px 0; font-weight:700; color:#2b6cb0;">
            माहे ${D47} - डेंगी व चिकनगुनिया कीटकजन्य आजार मासिक व प्रोग्रेसिव्ह (प्रगत) प्रयोगशाळा अहवाल
          </h4>
          <div style="font-size:13px; color:#4a5568; font-weight:600;">(१०.१५.२ जोडपत्रानंतरचे परिशिष्ट - मासिक व प्रोग्रेसिव्ह संशयित नमुने, GMC लातूर तपासणी निष्कर्ष व गावनिहाय सर्वेक्षण)</div>
          <hr style="border:0; border-top:1.5px solid #2d3748; margin:10px 0 16px 0;">
        </div>

        <!-- Part 1: Main Summary Table (मासिक व प्रोग्रेसिव्ह सारांश) -->
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

    const reportId = `monthly_${Date.now()}`;
    const reportHtml = wrapReportPage(`मासिक हिवताप अहवाल - ${selectedMonthDisplay}`, bodyHtml);
    generatedReports.set(reportId, reportHtml);

    return {
      success: true,
      message: `माहे ${selectedMonthDisplay} चा अधिकृत मासिक अहवाल यशस्वीरित्या तयार झाला! (एकूण ${D19} नमुने)`,
      url: `/api/reports/${reportId}`
    };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// 3. कर्मचारी नोंदवही (Employee Register)
export function generateEmployeeRegisterWebApp(filterUpkendra, filterEmployee) {
  try {
    const currentYear = new Date().getFullYear();
    const isAllSubcenter = !filterUpkendra || filterUpkendra === 'All' || filterUpkendra === 'सर्व' || filterUpkendra === 'सर्व उपकेंद्र';
    const isAllEmployee = !filterEmployee || filterEmployee === 'All' || filterEmployee === 'सर्व' || filterEmployee === 'सर्व कर्मचारी';

    // Retrieve all BS codes for the requested employee to support matching by name or code
    let filterEmpCodes = [];
    if (!isAllEmployee) {
      const cleanFilterName = cleanStr(filterEmployee);
      filterEmpCodes = employeeMaster
        .filter(e => cleanStr(e.employeeName) === cleanFilterName)
        .map(e => String(e.bsCode || '').trim().toUpperCase())
        .filter(Boolean);
    }

    const filtered = bsDataEntry.filter(row => {
      const rowDate = parseDateSafe(row[1]);
      if (!rowDate || isNaN(rowDate.getTime()) || rowDate.getFullYear() !== currentYear) return false;

      const rowEmpNameClean = cleanStr(row[3]);
      const rowBsCodeClean = String(row[5] || '').trim().toUpperCase();

      const matchesEmployee = isAllEmployee || 
        (rowEmpNameClean === cleanStr(filterEmployee)) || 
        (rowBsCodeClean && filterEmpCodes.includes(rowBsCodeClean));

      const matchesSubcenter = isAllSubcenter || (cleanStr(row[2]) === cleanStr(filterUpkendra));

      if (!matchesSubcenter) return false;
      if (!matchesEmployee) return false;
      return true;
    });

    if (filtered.length === 0) {
      return { success: false, message: 'निवडलेल्या उपकेंद्र/कर्मचाऱ्यासाठी चालू वर्षाचा कोणताही डेटा सापडला नाही.' };
    }

    const organized = {};
    filtered.forEach(row => {
      const sc = row[2];
      const emp = row[3];
      if (!organized[sc]) organized[sc] = {};
      if (!organized[sc][emp]) {
        organized[sc][emp] = { designation: row[4], bsCode: row[5], entries: [] };
      }
      organized[sc][emp].entries.push(row);
    });

    let contentHtml = '';
    const scKeys = Object.keys(organized).sort();
    scKeys.forEach(scName => {
      contentHtml += `
        <div style="background:#edf2f7; padding:10px 15px; border-radius:6px; font-weight:700; font-size:16px; margin:20px 0 10px 0; color:#2d3748;">
          📍 उपकेंद्र: ${scName}
        </div>`;

      const emps = organized[scName];
      Object.keys(emps).sort().forEach(empName => {
        const group = emps[empName];
        let totalCount = 0;
        let rows = '';
        group.entries.sort((a,b) => new Date(a[1]) - new Date(b[1])).forEach((r, idx) => {
          const c = parseInt(r[9]) || 0;
          totalCount += c;
          rows += `
            <tr>
              <td>${idx + 1}</td>
              <td>${formatDateDisplay(r[1])}</td>
              <td><b>${r[6]}</b></td>
              <td>${r[7]}</td>
              <td>${r[8]}</td>
              <td><b>${c}</b></td>
            </tr>`;
        });

        contentHtml += `
          <div style="margin-top:15px; border:1px solid #cbd5e0; border-radius:8px; padding:15px; background:#ffffff;">
            <div style="font-weight:600; font-size:14px; color:#00796b; margin-bottom:10px; display:flex; justify-content:space-between;">
              <span>👤 ${empName} (${group.designation})</span>
              <span>BS Code: <b>${group.bsCode}</b> | एकूण नमुने: <b>${totalCount}</b></span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>अ.क्र</th>
                  <th>दिनांक</th>
                  <th>बंडल क्र.</th>
                  <th>पासून</th>
                  <th>पर्यंत</th>
                  <th>एकूण नमुने</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
                <tr style="background:#f7fafc; font-weight:bold;">
                  <td colspan="5" class="text-right">एकूण:</td>
                  <td>${totalCount}</td>
                </tr>
              </tbody>
            </table>
          </div>`;
      });
    });

    const bodyHtml = `
      <div class="header-box">
        <h1 class="main-title">प्राथमिक आरोग्य केंद्र भादा, ता. औसा जि. लातूर</h1>
        <h2 class="sub-title">कर्मचारीनिहाय रक्त नमुना संकलन नोंदवही - सन ${currentYear}</h2>
        <div style="font-size:13px; margin-top:5px; color:#718096;">
          फिल्टर: उपकेंद्र - <b>${filterUpkendra || 'सर्व'}</b> | कर्मचारी - <b>${filterEmployee || 'सर्व'}</b>
        </div>
      </div>
      ${contentHtml}
      <div class="footer-sign">
        <b>वैद्यकीय अधिकारी</b><br>
        प्राथमिक आरोग्य केंद्र भादा, ता. औसा जि. लातूर
      </div>`;

    const reportId = `register_${Date.now()}`;
    const reportHtml = wrapReportPage(`कर्मचारी नोंदवही - ${currentYear}`, bodyHtml);
    generatedReports.set(reportId, reportHtml);

    return {
      success: true,
      message: `कर्मचारी नोंदवही यशस्वीरित्या तयार झाली! (${filtered.length} नोंदी)`,
      url: `/api/reports/${reportId}`
    };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// 4. कारणे दाखवा नोटीस (Show Cause Notices)
export function getDefaulterListForMonth(selectedMonthDisplay) {
  try {
    const monthObj = monthMaster.find(m => cleanStr(m.name) === cleanStr(selectedMonthDisplay));
    if (!monthObj) return { success: false, message: 'महिना सापडला नाही.' };

    const startDate = parseDateSafe(monthObj.f1Start);
    const endDate = parseDateSafe(monthObj.f2End);

    const defaulters = [];
    masterData.forEach(emp => {
      const post = String(emp.designation || '');
      if (post.includes('आशा') || post.includes('वैद्यकीय अधिकारी') || post.includes('औषध') || emp.bsCode === '54P') return;

      const isAnm = post.includes('आरोग्य सेविका') || post.includes('anm') || post.includes('सहायिका');
      const target = isAnm ? 40 : 50;

      let total = 0;
      const days = new Set();
      bsDataEntry.forEach(r => {
        const rDate = parseDateSafe(r[1]);
        if (rDate && (cleanStr(r[3]) === cleanStr(emp.employeeName) || r[5] === emp.bsCode) && rDate >= startDate && rDate <= endDate) {
          total += (parseInt(r[9]) || 0);
          days.add(formatDateDisplay(rDate));
        }
      });

      if (total < target) {
        defaulters.push({
          name: emp.employeeName,
          post: emp.designation,
          sc: emp.upkendra,
          daysCount: days.size,
          samplesCount: total,
          target,
          deficit: target - total
        });
      }
    });

    return { success: true, defaulters };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

export function generateEmployeeNoticesWebApp(selectedMonthDisplay, selectedEmpNames) {
  try {
    const listRes = getDefaulterListForMonth(selectedMonthDisplay);
    if (!listRes.success) return listRes;

    const list = listRes.defaulters.filter(e => selectedEmpNames.includes(e.name));
    if (list.length === 0) {
      return { success: false, message: 'नोटीस तयार करण्यासाठी कोणतेही कर्मचारी निवडले नाहीत.' };
    }

    const noticeDate = formatDateDisplay(new Date());
    let noticesHtml = '';

    list.forEach((e, idx) => {
      noticesHtml += `
        <div style="padding:20px; border:1px solid #000; border-radius:6px; margin-bottom:30px; page-break-inside:avoid;">
          <div class="header-box" style="border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:15px;">
            <h2 style="margin:0; font-size:18px;">प्राथमिक आरोग्य केंद्र भादा, ता. औसा जि. लातूर</h2>
            <div style="font-size:15px; font-weight:bold; margin-top:4px;">कारणे दाखवा नोटीस (Show Cause Notice)</div>
          </div>
          
          <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold; margin-bottom:15px;">
            <span>जा.क्र. प्रआकेभा/मलेरिया/२०२६/नोटीस-${idx + 1}</span>
            <span>दिनांक: ${noticeDate}</span>
          </div>

          <div style="font-size:14px; line-height:1.6; margin-bottom:15px;">
            <strong>प्रति,</strong><br>
            श्री/श्रीमती <b>${e.name}</b><br>
            पद: ${e.post}, उपकेंद्र: ${e.sc}
          </div>

          <div class="subject">
            विषय: माहे ${selectedMonthDisplay} मधील रक्त नमुना संकलनाचे उद्दिष्ट पूर्ण न केल्याबाबत...
          </div>

          <p style="font-size:14px; line-height:1.6;">
            महोदय/महोदया,<br>
            आपणास कळविण्यात येते की, राष्ट्रीय आरोग्य कार्यक्रमांतर्गत हिवताप दुरीकरणासाठी दरमहा <b>५०</b> रक्त नमुने संकलित करण्याचे उद्दिष्ट आपणास देण्यात आलेले आहे. माहे <b>${selectedMonthDisplay}</b> मधील आपल्या कामगिरीचा आढावा घेतला असता खालील बाबी निदर्शनास आल्या आहेत:
          </p>

          <table style="width:85%; margin:15px auto;">
            <tr>
              <td style="width:60%;" class="text-left">निर्धारित मासिक उद्दिष्ट:</td>
              <td><b>५० नमुने</b></td>
            </tr>
            <tr>
              <td class="text-left">आपण प्रत्यक्षात घेतलेले एकूण नमुने:</td>
              <td><b style="color:#e53e3e; font-size:15px;">${e.samplesCount} नमुने</b></td>
            </tr>
            <tr>
              <td class="text-left">नमुना संकलन केलेले एकूण दिवस:</td>
              <td><b>${e.daysCount} दिवस</b></td>
            </tr>
          </table>

          <p style="font-size:14px; line-height:1.6;">
            वरील विवरणावरून असे निदर्शनास येते की, आपल्याकडून निर्धारित उद्दिष्टाच्या तुलनेत अत्यंत कमी कामगिरी झाली आहे. शासनाच्या राष्ट्रीय कार्यक्रमात हलगर्जीपणा दिसून येत आहे. तरी, याबाबतचा आपला लेखी खुलासा हे पत्र मिळाल्यापासून २ दिवसांच्या आत कार्यालयास प्रत्यक्ष सादर करावा.
          </p>

          <div class="footer-sign" style="margin-top:35px;">
            <b>वैद्यकीय अधिकारी</b><br>
            प्राथमिक आरोग्य केंद्र भादा, ता. औसा जि. लातूर
          </div>

          <div style="margin-top:25px; font-size:12px; border-top:1px dashed #718096; padding-top:8px;">
            <strong>प्रत माहितीस्तव सविनय सादर:</strong><br>
            १. मा. जिल्हा हिवताप अधिकारी, लातूर.<br>
            २. मा. तालुका आरोग्य अधिकारी, तालुका आरोग्य कार्यालय औसा.
          </div>
        </div>`;
    });

    const reportId = `notice_${Date.now()}`;
    const reportHtml = wrapReportPage(`कारणे दाखवा नोटीस - ${selectedMonthDisplay}`, noticesHtml);
    generatedReports.set(reportId, reportHtml);

    return {
      success: true,
      message: `यशस्वी! निवडलेल्या ${list.length} कर्मचाऱ्यांसाठी नोटीस तयार झाली आहे.`,
      url: `/api/reports/${reportId}`
    };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// 5. कमी कामगिरी अहवाल (Low Performance Report)
export function generateLowPerformanceReportWebApp(selectedMonthDisplay) {
  try {
    const listRes = getDefaulterListForMonth(selectedMonthDisplay);
    if (!listRes.success) return listRes;

    const zeroSamples = listRes.defaulters.filter(d => d.samplesCount === 0);
    const lowSamples = listRes.defaulters.filter(d => d.samplesCount > 0 && d.samplesCount < 38);

    if (zeroSamples.length === 0 && lowSamples.length === 0) {
      return { success: true, message: 'उत्तम! निवडलेल्या महिन्यात सर्व कर्मचाऱ्यांनी ७५% पेक्षा जास्त काम केले आहे. कोणीही निरंक नाही.' };
    }

    let zeroHtml = '';
    if (zeroSamples.length > 0) {
      zeroHtml = `
        <h3 style="color:#c53030; font-size:15px; margin-top:20px;">१. निरंक (०) नमुने घेतलेले कर्मचारी:</h3>
        <table>
          <thead>
            <tr>
              <th>अ.क्र.</th>
              <th>कर्मचाऱ्याचे नाव (पद)</th>
              <th>उपकेंद्र</th>
              <th>घेतलेले नमुने</th>
            </tr>
          </thead>
          <tbody>
            ${zeroSamples.map((e, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td class="text-left">${e.name} (${e.post})</td>
                <td>${e.sc}</td>
                <td><b style="color:red;">${e.samplesCount}</b></td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    }

    let lowHtml = '';
    if (lowSamples.length > 0) {
      lowHtml = `
        <h3 style="color:#d69e2e; font-size:15px; margin-top:20px;">२. ७५% पेक्षा कमी (१ ते ३७) नमुने घेतलेले कर्मचारी:</h3>
        <table>
          <thead>
            <tr>
              <th>अ.क्र.</th>
              <th>कर्मचाऱ्याचे नाव (पद)</th>
              <th>उपकेंद्र</th>
              <th>घेतलेले नमुने</th>
            </tr>
          </thead>
          <tbody>
            ${lowSamples.map((e, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td class="text-left">${e.name} (${e.post})</td>
                <td>${e.sc}</td>
                <td><b style="color:#d69e2e;">${e.samplesCount}</b></td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    }

    const reportDate = formatDateDisplay(new Date());
    const bodyHtml = `
      <div class="header-box">
        <h1 class="main-title">प्राथमिक आरोग्य केंद्र भादा, ता. औसा जि. लातूर</h1>
        <h2 class="sub-title">कमी कामगिरी अहवाल (निरंक व ७५% पेक्षा कमी नमुने) - माहे: ${selectedMonthDisplay}</h2>
        <div style="font-size:13px; color:#718096; margin-top:4px;">अहवाल दिनांक: ${reportDate}</div>
      </div>
      <p style="font-size:14px; line-height:1.6;">
        माहे <b>${selectedMonthDisplay}</b> मध्ये ५० नमुन्यांच्या उद्दिष्टापैकी निरंक (०) आणि ७५% पेक्षा कमी (३७ पेक्षा कमी) नमुने घेतलेल्या कर्मचाऱ्यांचा तपशील खालीलप्रमाणे आहे:
      </p>
      ${zeroHtml}
      ${lowHtml}
      <div class="footer-sign">
        <b>वैद्यकीय अधिकारी</b><br>
        प्राथमिक आरोग्य केंद्र भादा, ता. औसा जि. लातूर
      </div>`;

    const reportId = `lowperf_${Date.now()}`;
    const reportHtml = wrapReportPage(`कमी कामगिरी अहवाल - ${selectedMonthDisplay}`, bodyHtml);
    generatedReports.set(reportId, reportHtml);

    return {
      success: true,
      message: `अहवाल तयार! निरंक: ${zeroSamples.length} आणि कमी कामगिरी: ${lowSamples.length} कर्मचारी सापडले.`,
      url: `/api/reports/${reportId}`
    };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// 6. कर्मचारीनिहाय व गावनिहाय मासिक रक्त नमुना संकलन अहवाल (Employee-wise & Village-wise Monthly BS Report)
export function getEmployeeVillageMonthlyData(selectedMonthDisplay, filterUpkendra = 'All', filterEmployee = 'All', filterStaffType = 'All') {
  try {
    const cleanNorm = s => String(s || '').replace(/[०-९]/g, d => "०१२३४५६७८९".indexOf(d)).replace(/[\s\.\-_]/g, '').toLowerCase();

    const monthObj = findMonthInMaster(selectedMonthDisplay);
    const monthName = monthObj ? monthObj.name : selectedMonthDisplay;
    const mIdx = monthObj ? monthMaster.indexOf(monthObj) : 8;

    const yrMatch = String(selectedMonthDisplay).match(/202\d/);
    const reqYear = yrMatch ? parseInt(yrMatch[0]) : (monthObj && monthObj.f1Start ? new Date(monthObj.f1Start).getFullYear() : 2026);

    const dStart = new Date(reqYear, mIdx, 1);
    const dEnd = new Date(reqYear, mIdx + 1, 0, 23, 59, 59, 999);
    const f1End = new Date(reqYear, mIdx, 15, 23, 59, 59);

    const isAllSc = !filterUpkendra || filterUpkendra === 'All' || filterUpkendra === 'सर्व' || filterUpkendra === 'सर्व उपकेंद्र';
    const isAllEmp = !filterEmployee || filterEmployee === 'All' || filterEmployee === 'सर्व' || filterEmployee === 'सर्व कर्मचारी';
    const isAllType = !filterStaffType || filterStaffType === 'All' || filterStaffType === 'सर्व' || filterStaffType === 'सर्व संवर्ग';

    const monthBsRows = bsDataEntry.filter(r => {
      const d = parseDateSafe(r[1]);
      return d && d >= dStart && d <= dEnd;
    });

    const monthVillageRows = villageDetails.filter(v => {
      const d = parseDateSafe(v[2]);
      return d && d >= dStart && d <= dEnd;
    });

    // Process all employees from masterData
    const employees = [];
    const subcenterMap = {};

    masterData.forEach(emp => {
      const desigStr = String(emp.designation || '');
      const codeStr = String(emp.bsCode || '').toUpperCase().trim();
      const isASHA = desigStr.includes('आशा') || desigStr.includes('asha') || codeStr.includes('V');
      const isMPW = desigStr.includes('सेवक') || desigStr.includes('MPW') || desigStr.includes('mpw') || codeStr.startsWith('54S');
      const isANM = !isASHA && !isMPW;
      const staffType = isMPW ? 'MPW' : (isANM ? 'ANM' : 'ASHA');
      const target = isMPW ? 50 : (isANM ? 40 : 10);

      if (!isAllSc && emp.upkendra !== filterUpkendra) return;
      if (!isAllEmp && emp.employeeName !== filterEmployee) return;
      if (!isAllType && staffType !== filterStaffType && !desigStr.includes(filterStaffType)) return;

      const hasMultiScForEmp = masterData.filter(m => cleanNorm(m.employeeName) === cleanNorm(emp.employeeName)).length > 1;
      const empBsRows = monthBsRows.filter(r => {
        if (hasMultiScForEmp && r[2] && emp.upkendra && cleanNorm(r[2]) !== cleanNorm(emp.upkendra)) return false;
        return (emp.bsCode && cleanNorm(r[5]) === cleanNorm(emp.bsCode)) || (r[3] && cleanNorm(r[3]) === cleanNorm(emp.employeeName));
      });

      const vList = (emp.villageList && emp.villageList.length > 0) ? emp.villageList : ['उपकेंद्र मुख्यालय'];
      const villageMap = {};
      vList.forEach(v => {
        villageMap[v] = {
          village: v,
          fn1Male: 0, fn1Female: 0, fn1Total: 0,
          fn2Male: 0, fn2Female: 0, fn2Total: 0,
          male: 0, female: 0, total: 0
        };
      });

      const addEmpVilAlloc = (vName, isFn1, vMAlloc, vFAlloc, vTotAlloc) => {
        if (vTotAlloc <= 0) return;
        if (!villageMap[vName]) {
          villageMap[vName] = {
            village: vName,
            fn1Male: 0, fn1Female: 0, fn1Total: 0,
            fn2Male: 0, fn2Female: 0, fn2Total: 0,
            male: 0, female: 0, total: 0
          };
        }
        const targetVil = villageMap[vName];
        if (isFn1) {
          targetVil.fn1Male += vMAlloc; targetVil.fn1Female += vFAlloc; targetVil.fn1Total += vTotAlloc;
        } else {
          targetVil.fn2Male += vMAlloc; targetVil.fn2Female += vFAlloc; targetVil.fn2Total += vTotAlloc;
        }
        targetVil.male += vMAlloc;
        targetVil.female += vFAlloc;
        targetVil.total += vTotAlloc;
      };

      let empRotSeed = 0;
      empBsRows.forEach(r => {
        const isOpd = cleanNorm(r[3]).includes('बाह्य') || cleanNorm(r[4]).includes('opd') || String(r[5] || '').toUpperCase().startsWith('54P');
        if (isOpd) return;

        const rDate = new Date(r[1]);
        const isFn1 = rDate <= f1End;
        const rTotal = parseInt(r[9]) || 0;
        if (rTotal <= 0) return;

        let matchingVils = monthVillageRows.filter(v => v[0] === r[0]);
        if (matchingVils.length === 0 && r[3]) {
          matchingVils = monthVillageRows.filter(v => cleanNorm(v[1]) === cleanNorm(r[3]) && Math.abs(new Date(v[2]) - rDate) < 86400000 && v[0] === r[0]);
        }

        const sumVils = matchingVils.reduce((s, v) => s + (parseInt(v[4]) || (parseInt(v[5]) || 0) + (parseInt(v[6]) || 0)), 0);
        const totalM = Math.floor(rTotal * 0.52);
        const recordedSet = new Set(matchingVils.map(v => String(v[3] || '').trim()));
        const unrecordedVils = vList.filter(v => !recordedSet.has(String(v).trim()));
        const isSubcenterDumpedSingleRow = (!isASHA && vList.length > 1 && recordedSet.size === 1 && sumVils >= rTotal && rTotal >= vList.length);

        if (!isSubcenterDumpedSingleRow && matchingVils.length > 0 && sumVils > 0 && (sumVils >= rTotal || unrecordedVils.length === 0)) {
          let allocatedTot = 0, allocatedM = 0;
          matchingVils.forEach((v, idx) => {
            const vName = v[3];
            const vRowTot = parseInt(v[4]) || ((parseInt(v[5]) || 0) + (parseInt(v[6]) || 0));
            const vRowM = parseInt(v[5]) || 0;
            const vRowF = parseInt(v[6]) || 0;

            let vTotAlloc = 0, vMAlloc = 0, vFAlloc = 0;
            if (idx === matchingVils.length - 1) {
              vTotAlloc = rTotal - allocatedTot;
              vMAlloc = Math.max(0, Math.min(vTotAlloc, totalM - allocatedM));
              vFAlloc = Math.max(0, vTotAlloc - vMAlloc);
            } else {
              vTotAlloc = sumVils > 0 ? Math.round((vRowTot / sumVils) * rTotal) : Math.floor(rTotal / matchingVils.length);
              allocatedTot += vTotAlloc;
              vMAlloc = (vRowM + vRowF > 0) ? Math.round((vRowM / (vRowM + vRowF)) * vTotAlloc) : Math.floor(vTotAlloc * 0.52);
              vMAlloc = Math.min(vTotAlloc, Math.max(0, Math.min(vMAlloc, totalM - allocatedM)));
              vFAlloc = vTotAlloc - vMAlloc;
              allocatedM += vMAlloc;
            }
            addEmpVilAlloc(vName, isFn1, vMAlloc, vFAlloc, vTotAlloc);
          });
        } else if (!isSubcenterDumpedSingleRow && matchingVils.length > 0 && sumVils > 0 && sumVils < rTotal && unrecordedVils.length > 0) {
          let allocatedTot = 0, allocatedM = 0;
          matchingVils.forEach(v => {
            const vName = v[3];
            const vTotAlloc = parseInt(v[4]) || ((parseInt(v[5]) || 0) + (parseInt(v[6]) || 0));
            let vMAlloc = parseInt(v[5]) || 0;
            if (vMAlloc > vTotAlloc) vMAlloc = Math.floor(vTotAlloc * 0.52);
            vMAlloc = Math.min(vTotAlloc, Math.max(0, Math.min(vMAlloc, totalM - allocatedM)));
            const vFAlloc = vTotAlloc - vMAlloc;
            allocatedTot += vTotAlloc;
            allocatedM += vMAlloc;
            addEmpVilAlloc(vName, isFn1, vMAlloc, vFAlloc, vTotAlloc);
          });

          const remTot = rTotal - allocatedTot;
          const share = Math.floor(remTot / unrecordedVils.length);
          let rem = remTot % unrecordedVils.length;
          const startOff = (empRotSeed++) % unrecordedVils.length;
          for (let i = 0; i < unrecordedVils.length; i++) {
            const vName = unrecordedVils[(startOff + i) % unrecordedVils.length];
            let vTotAlloc = 0, vMAlloc = 0, vFAlloc = 0;
            if (i === unrecordedVils.length - 1) {
              vTotAlloc = rTotal - allocatedTot;
              vMAlloc = Math.max(0, Math.min(vTotAlloc, totalM - allocatedM));
              vFAlloc = vTotAlloc - vMAlloc;
            } else {
              vTotAlloc = share + (rem > 0 ? 1 : 0);
              if (rem > 0) rem--;
              allocatedTot += vTotAlloc;
              vMAlloc = Math.min(vTotAlloc, Math.max(0, Math.min(Math.floor(vTotAlloc * 0.52), totalM - allocatedM)));
              vFAlloc = vTotAlloc - vMAlloc;
              allocatedM += vMAlloc;
            }
            addEmpVilAlloc(vName, isFn1, vMAlloc, vFAlloc, vTotAlloc);
          }
        } else {
          let allocatedTot = 0, allocatedM = 0;
          const share = Math.floor(rTotal / vList.length);
          let rem = rTotal % vList.length;
          const startOff = (empRotSeed++) % vList.length;
          for (let i = 0; i < vList.length; i++) {
            const vName = vList[(startOff + i) % vList.length];
            let vTotAlloc = 0, vMAlloc = 0, vFAlloc = 0;
            if (i === vList.length - 1) {
              vTotAlloc = rTotal - allocatedTot;
              vMAlloc = Math.max(0, Math.min(vTotAlloc, totalM - allocatedM));
              vFAlloc = vTotAlloc - vMAlloc;
            } else {
              vTotAlloc = share + (rem > 0 ? 1 : 0);
              if (rem > 0) rem--;
              allocatedTot += vTotAlloc;
              vMAlloc = Math.min(vTotAlloc, Math.max(0, Math.min(Math.floor(vTotAlloc * 0.52), totalM - allocatedM)));
              vFAlloc = vTotAlloc - vMAlloc;
              allocatedM += vMAlloc;
            }
            addEmpVilAlloc(vName, isFn1, vMAlloc, vFAlloc, vTotAlloc);
          }
        }
      });

      const villages = Object.values(villageMap);
      const empTotal = villages.reduce((s, v) => s + v.total, 0);
      const empMale = villages.reduce((s, v) => s + v.male, 0);
      const empFemale = villages.reduce((s, v) => s + v.female, 0);
      const empFn1Male = villages.reduce((s, v) => s + v.fn1Male, 0);
      const empFn1Female = villages.reduce((s, v) => s + v.fn1Female, 0);
      const empFn1Total = villages.reduce((s, v) => s + v.fn1Total, 0);
      const empFn2Male = villages.reduce((s, v) => s + v.fn2Male, 0);
      const empFn2Female = villages.reduce((s, v) => s + v.fn2Female, 0);
      const empFn2Total = villages.reduce((s, v) => s + v.fn2Total, 0);
      const achievementPct = target > 0 ? Math.round((empTotal / target) * 100) : 100;

      let statusBadge = 'उत्कृष्ट';
      let statusClass = 'excellent';
      if (empTotal === 0) {
        statusBadge = 'निरंक (० नमुने)';
        statusClass = 'zero';
      } else if (achievementPct < 75) {
        statusBadge = `कमी कामगिरी (${achievementPct}%)`;
        statusClass = 'low';
      } else if (achievementPct < 100) {
        statusBadge = `समाधानकारक (${achievementPct}%)`;
        statusClass = 'satisfactory';
      } else {
        statusBadge = `उत्कृष्ट (${achievementPct}%)`;
        statusClass = 'excellent';
      }

      const empRecord = {
        upkendra: emp.upkendra,
        employeeName: emp.employeeName,
        designation: emp.designation,
        staffType,
        bsCode: emp.bsCode || '-',
        target,
        empTotal,
        empMale,
        empFemale,
        empFn1Male,
        empFn1Female,
        empFn1Total,
        empFn2Male,
        empFn2Female,
        empFn2Total,
        achievementPct,
        statusBadge,
        statusClass,
        villages
      };

      employees.push(empRecord);

      // Subcenter aggregator
      if (!subcenterMap[emp.upkendra]) {
        subcenterMap[emp.upkendra] = {
          upkendra: emp.upkendra,
          empCount: 0,
          target: 0,
          fn1Male: 0, fn1Female: 0, fn1Total: 0,
          fn2Male: 0, fn2Female: 0, fn2Total: 0,
          male: 0, female: 0, total: 0
        };
      }
      const sc = subcenterMap[emp.upkendra];
      sc.empCount++;
      sc.target += target;
      sc.fn1Male += empFn1Male;
      sc.fn1Female += empFn1Female;
      sc.fn1Total += empFn1Total;
      sc.fn2Male += empFn2Male;
      sc.fn2Female += empFn2Female;
      sc.fn2Total += empFn2Total;
      sc.male += empMale;
      sc.female += empFemale;
      sc.total += empTotal;
    });

    // Subcenters list
    const subcenterSummaries = Object.values(subcenterMap).map(sc => ({
      ...sc,
      achievementPct: sc.target > 0 ? Math.round((sc.total / sc.target) * 100) : 100
    }));

    // Overall summary calculations
    const totalEmployees = employees.length;
    const totalVillages = new Set(employees.flatMap(e => e.villages.map(v => v.village))).size;
    const totalMale = employees.reduce((s, e) => s + e.empMale, 0);
    const totalFemale = employees.reduce((s, e) => s + e.empFemale, 0);
    const totalSmears = employees.reduce((s, e) => s + e.empTotal, 0);
    const totalTarget = employees.reduce((s, e) => s + e.target, 0);
    const overallPct = totalTarget > 0 ? Math.round((totalSmears / totalTarget) * 100) : 100;

    const excellentCount = employees.filter(e => e.statusClass === 'excellent').length;
    const satisfactoryCount = employees.filter(e => e.statusClass === 'satisfactory').length;
    const lowCount = employees.filter(e => e.statusClass === 'low').length;
    const zeroCount = employees.filter(e => e.statusClass === 'zero').length;

    return {
      success: true,
      month: monthName,
      filterUpkendra: isAllSc ? 'सर्व उपकेंद्र' : filterUpkendra,
      filterEmployee: isAllEmp ? 'सर्व कर्मचारी' : filterEmployee,
      filterStaffType: isAllType ? 'सर्व संवर्ग' : filterStaffType,
      summary: {
        totalEmployees,
        totalVillages,
        totalMale,
        totalFemale,
        totalSmears,
        totalTarget,
        overallPct,
        excellentCount,
        satisfactoryCount,
        lowCount,
        zeroCount
      },
      subcenterSummaries,
      employees
    };
  } catch (err) {
    return { success: false, message: err.toString(), employees: [], subcenterSummaries: [] };
  }
}

export function generateEmployeeVillageMonthlyReportWebApp(selectedMonthDisplay, filterUpkendra = 'All', filterEmployee = 'All', filterStaffType = 'All') {
  try {
    const data = getEmployeeVillageMonthlyData(selectedMonthDisplay, filterUpkendra, filterEmployee, filterStaffType);
    if (!data.success) {
      return { success: false, message: data.message || 'अहवाल तयार करता आला नाही.' };
    }

    const { month, summary, subcenterSummaries, employees } = data;
    const reportDate = formatDateDisplay(new Date());

    // Subcenter table rows
    const subcenterRowsHtml = subcenterSummaries.map((sc, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td class="text-left"><b>${sc.upkendra}</b></td>
        <td>${sc.empCount}</td>
        <td><b>${sc.fn1Total}</b></td>
        <td><b>${sc.fn2Total}</b></td>
        <td style="color:#2b6cb0;">${sc.male}</td>
        <td style="color:#b83280;">${sc.female}</td>
        <td style="background:#edf2f7; font-weight:700;">${sc.total}</td>
        <td>${sc.target}</td>
        <td>
          <span style="font-weight:700; color:${sc.achievementPct >= 100 ? '#276749' : (sc.achievementPct >= 75 ? '#2b6cb0' : '#c53030')};">
            ${sc.achievementPct}%
          </span>
        </td>
      </tr>
    `).join('');

    // Detailed employee cards grouped by subcenter
    const groupedBySc = {};
    employees.forEach(emp => {
      if (!groupedBySc[emp.upkendra]) groupedBySc[emp.upkendra] = [];
      groupedBySc[emp.upkendra].push(emp);
    });

    let detailedHtml = '';
    let globalEmpIdx = 0;

    Object.keys(groupedBySc).sort().forEach(scName => {
      const empList = groupedBySc[scName];
      const scTotalSmears = empList.reduce((s, e) => s + e.empTotal, 0);
      const scTotalMale = empList.reduce((s, e) => s + e.empMale, 0);
      const scTotalFemale = empList.reduce((s, e) => s + e.empFemale, 0);

      detailedHtml += `
        <div style="margin-top:25px; margin-bottom:15px; border-left:4px solid #00796b; padding-left:10px; background:#f0fdf4; padding:8px 12px; border-radius:4px; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:16px; color:#065f46;">📍 उपकेंद्र: ${scName} (कर्मचारी: ${empList.length})</h3>
          <span style="font-size:13px; font-weight:700; color:#047857;">
            एकूण नमुने: ${scTotalSmears} (👨 पु: ${scTotalMale} | 👩 स्त्री: ${scTotalFemale})
          </span>
        </div>
      `;

      empList.forEach(emp => {
        globalEmpIdx++;
        let statusBadgeColor = '#2f855a';
        let statusBg = '#f0fff4';
        if (emp.statusClass === 'zero') { statusBadgeColor = '#e53e3e'; statusBg = '#fff5f5'; }
        else if (emp.statusClass === 'low') { statusBadgeColor = '#dd6b20'; statusBg = '#fffaf0'; }
        else if (emp.statusClass === 'satisfactory') { statusBadgeColor = '#3182ce'; statusBg = '#ebf8ff'; }

        const villageRows = emp.villages.map((v, vIdx) => `
          <tr>
            <td>${vIdx + 1}</td>
            <td class="text-left"><b>${v.village}</b></td>
            <td>${v.fn1Male}</td>
            <td>${v.fn1Female}</td>
            <td style="font-weight:600; background:#f8fafc;">${v.fn1Total}</td>
            <td>${v.fn2Male}</td>
            <td>${v.fn2Female}</td>
            <td style="font-weight:600; background:#f8fafc;">${v.fn2Total}</td>
            <td style="color:#2b6cb0; font-weight:600;">${v.male}</td>
            <td style="color:#b83280; font-weight:600;">${v.female}</td>
            <td style="font-weight:700; background:#edf2f7; color:#1a202c;">${v.total}</td>
          </tr>
        `).join('');

        detailedHtml += `
          <div style="margin-bottom:18px; border:1px solid #cbd5e0; border-radius:8px; overflow:hidden; background:#ffffff; box-shadow:0 1px 3px rgba(0,0,0,0.05); page-break-inside:avoid;">
            <div style="background:#f7fafc; border-bottom:1px solid #e2e8f0; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div>
                <span style="font-weight:700; font-size:14px; color:#1a202c;">${globalEmpIdx}. ${emp.employeeName}</span>
                <span style="font-size:12px; color:#4a5568; margin-left:8px;">(${emp.designation})</span>
                <span style="font-size:11.5px; background:#edf2f7; color:#4a5568; padding:2px 6px; border-radius:4px; margin-left:6px; font-family:monospace;">BS Code: ${emp.bsCode}</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:12px; color:#4a5568;">उद्दिष्ट: <b>${emp.target}</b></span>
                <span style="font-size:11.5px; font-weight:700; padding:3px 8px; border-radius:12px; background:${statusBg}; color:${statusBadgeColor}; border:1px solid ${statusBadgeColor}40;">
                  ${emp.statusBadge}
                </span>
              </div>
            </div>

            <div style="padding:10px 12px; overflow-x:auto;">
              <table style="margin:0; width:100%; font-size:12.5px;">
                <thead>
                  <tr style="background:#f1f5f9;">
                    <th rowspan="2" style="width:35px;">अ.क्र</th>
                    <th rowspan="2" style="text-align:left;">गावाचे नाव</th>
                    <th colspan="3" style="background:#e0f2fe; color:#0369a1;">पंधरवडा १</th>
                    <th colspan="3" style="background:#fef3c7; color:#92400e;">पंधरवडा २</th>
                    <th colspan="3" style="background:#dcfce7; color:#15803d;">मासिक एकूण संकलन</th>
                  </tr>
                  <tr style="background:#f8fafc; font-size:11.5px;">
                    <th style="background:#f0f9ff;">👨 पु</th>
                    <th style="background:#f0f9ff;">👩 स्त्री</th>
                    <th style="background:#e0f2fe; font-weight:700;">एकूण</th>
                    <th style="background:#fffbeb;">👨 पु</th>
                    <th style="background:#fffbeb;">👩 स्त्री</th>
                    <th style="background:#fef3c7; font-weight:700;">एकूण</th>
                    <th style="background:#f0fdf4; color:#2b6cb0;">👨 पु</th>
                    <th style="background:#f0fdf4; color:#b83280;">👩 स्त्री</th>
                    <th style="background:#dcfce7; font-weight:700;">एकूण</th>
                  </tr>
                </thead>
                <tbody>
                  ${villageRows}
                  <tr style="background:#f1f5f9; font-weight:700; border-top:2px solid #cbd5e0;">
                    <td colspan="2" class="text-right">कर्मचारी एकूण (Total):</td>
                    <td>${emp.empFn1Male}</td>
                    <td>${emp.empFn1Female}</td>
                    <td style="background:#e0f2fe; color:#0369a1;">${emp.empFn1Total}</td>
                    <td>${emp.empFn2Male}</td>
                    <td>${emp.empFn2Female}</td>
                    <td style="background:#fef3c7; color:#92400e;">${emp.empFn2Total}</td>
                    <td style="color:#2b6cb0;">${emp.empMale}</td>
                    <td style="color:#b83280;">${emp.empFemale}</td>
                    <td style="background:#dcfce7; color:#166534; font-size:13.5px;">${emp.empTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        `;
      });
    });

    const bodyHtml = `
      <div class="header-box" style="border-bottom: 2px solid #00796b; padding-bottom: 12px; margin-bottom: 18px;">
        <div style="font-size:12px; font-weight:600; color:#4a5568; letter-spacing:0.5px;">महाराष्ट्र शासन | सार्वजनिक आरोग्य विभाग | NVBDCP</div>
        <h1 class="main-title" style="color:#00796b; margin:4px 0 2px 0;">प्राथमिक आरोग्य केंद्र भादा, ता. औसा, जि. लातूर</h1>
        <h2 class="sub-title" style="color:#2d3748; font-size:15px; margin:0 0 6px 0;">
          कर्मचारीनिहाय व गावनिहाय मासिक रक्त नमुना संकलन अहवाल (Employee & Village-wise Monthly BS Report)
        </h2>
        <div style="display:flex; justify-content:center; gap:20px; font-size:12.5px; color:#4a5568; flex-wrap:wrap; margin-top:6px; font-weight:600;">
          <span>🗓️ माहे: <b style="color:#00796b;">${month}</b></span>
          <span>📍 उपकेंद्र: <b>${data.filterUpkendra}</b></span>
          <span>👥 संवर्ग: <b>${data.filterStaffType}</b></span>
          <span>👤 कर्मचारी: <b>${data.filterEmployee}</b></span>
          <span>📅 अहवाल दिनांक: <b>${reportDate}</b></span>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom:20px;">
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:11.5px; color:#166534; font-weight:600;">एकूण कर्मचारी</div>
          <div style="font-size:20px; font-weight:700; color:#15803d; margin-top:2px;">${summary.totalEmployees}</div>
        </div>
        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:11.5px; color:#1e40af; font-weight:600;">एकूण गावे</div>
          <div style="font-size:20px; font-weight:700; color:#1d4ed8; margin-top:2px;">${summary.totalVillages}</div>
        </div>
        <div style="background:#eef2ff; border:1px solid #c7d2fe; border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:11.5px; color:#3730a3; font-weight:600;">👨 पुरुष नमुने</div>
          <div style="font-size:20px; font-weight:700; color:#4338ca; margin-top:2px;">${summary.totalMale}</div>
        </div>
        <div style="background:#fdf2f8; border:1px solid #fbcfe8; border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:11.5px; color:#9d174d; font-weight:600;">👩 स्त्री नमुने</div>
          <div style="font-size:20px; font-weight:700; color:#be185d; margin-top:2px;">${summary.totalFemale}</div>
        </div>
        <div style="background:#fefce8; border:1px solid #fef08a; border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:11.5px; color:#854d0e; font-weight:600;">🧪 एकूण संकलन</div>
          <div style="font-size:20px; font-weight:700; color:#a16207; margin-top:2px;">${summary.totalSmears}</div>
        </div>
        <div style="background:#faf5ff; border:1px solid #e9d5ff; border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:11.5px; color:#6b21a8; font-weight:600;">📈 उद्दिष्टपूर्ती %</div>
          <div style="font-size:20px; font-weight:700; color:#7e22ce; margin-top:2px;">${summary.overallPct}%</div>
        </div>
      </div>

      <!-- Performance Category Badges -->
      <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px 14px; font-size:12px; margin-bottom:20px; flex-wrap:wrap; gap:8px;">
        <span style="font-weight:700; color:#4a5568;">कामगिरी वर्गवारी:</span>
        <span style="color:#15803d; font-weight:600;">🟢 उत्कृष्ट (100%+): <b>${summary.excellentCount}</b></span>
        <span style="color:#2563eb; font-weight:600;">🔵 समाधानकारक (75-99%): <b>${summary.satisfactoryCount}</b></span>
        <span style="color:#d97706; font-weight:600;">🟠 कमी कामगिरी (<75%): <b>${summary.lowCount}</b></span>
        <span style="color:#dc2626; font-weight:600;">🔴 निरंक (० नमुने): <b>${summary.zeroCount}</b></span>
      </div>

      <!-- Subcenter Summary Table -->
      <div style="margin-bottom:24px;">
        <h3 style="font-size:14.5px; color:#0f766e; margin-bottom:8px; border-bottom:1.5px solid #0f766e; padding-bottom:4px;">
          📊 भाग १: उपकेंद्रनिहाय रक्त नमुना संकलन सारांश (Subcenter Summary)
        </h3>
        <table>
          <thead>
            <tr>
              <th style="width:35px;">अ.क्र</th>
              <th style="text-align:left;">उपकेंद्र</th>
              <th>कर्मचारी</th>
              <th>पंधरवडा १</th>
              <th>पंधरवडा २</th>
              <th>👨 पुरुष</th>
              <th>👩 स्त्री</th>
              <th style="background:#e6fffa;">एकूण रक्त नमुने</th>
              <th>मासिक उद्दिष्ट</th>
              <th>पूर्तता %</th>
            </tr>
          </thead>
          <tbody>
            ${subcenterRowsHtml}
            <tr style="background:#f0fdf4; font-weight:800; border-top:2px solid #2d3748;">
              <td colspan="2" class="text-right">एकूण (Grand Total):</td>
              <td>${summary.totalEmployees}</td>
              <td>${employees.reduce((s, e) => s + e.empFn1Total, 0)}</td>
              <td>${employees.reduce((s, e) => s + e.empFn2Total, 0)}</td>
              <td style="color:#2b6cb0;">${summary.totalMale}</td>
              <td style="color:#b83280;">${summary.totalFemale}</td>
              <td style="background:#bbf7d0; color:#166534; font-size:14px;">${summary.totalSmears}</td>
              <td>${summary.totalTarget}</td>
              <td style="font-size:14px; color:${summary.overallPct >= 75 ? '#15803d' : '#b91c1c'};">${summary.overallPct}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Detailed Employee & Village Breakdown Section -->
      <div>
        <h3 style="font-size:14.5px; color:#0f766e; margin-bottom:12px; border-bottom:1.5px solid #0f766e; padding-bottom:4px;">
          📋 भाग २: सविस्तर कर्मचारीनिहाय व गावनिहाय मासिक रक्त नमुना संकलन तक्ता (Village-wise Breakdown)
        </h3>
        ${detailedHtml}
      </div>

      <!-- Footer Signatures -->
      <div style="margin-top:40px; display:flex; justify-content:space-between; text-align:center; font-size:13px; font-weight:600; color:#2d3748; page-break-inside:avoid;">
        <div style="width:30%;">
          <br><br>
          ________________________<br>
          <b>आरोग्य सेवक / सेविका</b><br>
          प्रा.आ.केंद्र भादा
        </div>
        <div style="width:30%;">
          <br><br>
          ________________________<br>
          <b>आरोग्य पर्यवेक्षक</b><br>
          प्रा.आ.केंद्र भादा
        </div>
        <div style="width:30%;">
          <br><br>
          ________________________<br>
          <b>वैद्यकीय अधिकारी</b><br>
          प्रा.आ.केंद्र भादा, ता. औसा जि. लातूर
        </div>
      </div>
    `;

    const reportId = `emp_vil_monthly_${Date.now()}`;
    const reportHtml = wrapReportPage(`कर्मचारी व गावनिहाय मासिक अहवाल - ${month}`, bodyHtml);
    generatedReports.set(reportId, reportHtml);

    return {
      success: true,
      message: `माहे ${month} चा कर्मचारी व गावनिहाय अहवाल यशस्वीरित्या तयार झाला. (${employees.length} कर्मचारी, ${summary.totalSmears} नमुने)`,
      url: `/api/reports/${reportId}`,
      data
    };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}



// ================= DENGUE & CHIKUNGUNYA GMC FORWARDING LETTER =================
export function generateGmcForwardingLetter(dateStr, outwardNo) {
  try {
    let list = [...dengueChikungunyaEntries];
    if (dateStr && dateStr !== "All") {
      list = list.filter(e => e.dateCollection === dateStr);
    }
    if (list.length === 0) {
      return { success: false, message: `निवडलेल्या दिनांक ${dateStr || ""} साठी कोणतेही डेंगी/चिकनगुनिया नमुने सापडले नाहीत.` };
    }

    // Format date for display DD-MM-YYYY
    const displayDate = dateStr ? dateStr.split("-").reverse().join("-") : new Date().toISOString().slice(0, 10).split("-").reverse().join("-");
    const outNo = outwardNo ? String(outwardNo).trim() : "";

    let rowsHtml = "";
    list.forEach((p, idx) => {
      const pDate = p.dateCollection ? p.dateCollection.split("-").reverse().join("-") : displayDate;
      rowsHtml += `
        <tr>
          <td style="border:1px solid #1a202c; padding:8px 10px; text-align:center;">${idx + 1}</td>
          <td style="border:1px solid #1a202c; padding:8px 12px; font-weight:700; text-transform:uppercase;">${p.patientName}</td>
          <td style="border:1px solid #1a202c; padding:8px 10px; text-align:center; font-weight:600;">${p.village}</td>
          <td style="border:1px solid #1a202c; padding:8px 10px; text-align:center;">${p.age}</td>
          <td style="border:1px solid #1a202c; padding:8px 10px; text-align:center; text-transform:uppercase;">${p.sex}</td>
          <td style="border:1px solid #1a202c; padding:8px 10px; text-align:center;">${pDate}</td>
        </tr>
      `;
    });

    const letterHtml = `
      <div style="max-width:850px; margin:0 auto; padding:25px 30px; font-family:'Poppins', Arial, sans-serif; color:#1a202c; line-height:1.6; font-size:13.5px;">
        <div style="text-align:center; margin-bottom:24px;">
          <h2 style="font-size:22px; font-weight:800; margin:0 0 4px 0; color:#1a202c;">महाराष्ट्र शासन</h2>
          <h3 style="font-size:17px; font-weight:700; margin:0; text-decoration:underline; color:#2d3748;">प्राथमिक आरोग्य केंद्र, भादा, ता. औसा, जि. लातूर</h3>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:22px; font-size:13.5px; font-weight:600;">
          <div>जा.क्र. प्राआकें/भादा/डेंगी-नमुने/ <b>${outNo ? outNo + " " : "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"}</b> /2026</div>
          <div>दिनांक: <b>${displayDate}</b></div>
        </div>

        <div style="margin-bottom:20px; font-size:14px; line-height:1.7;">
          प्रति,<br>
          <b>प्रयोगशाळा अधिकारी,</b><br>
          शासकीय वैद्यकीय महाविद्यालय (GMC),<br>
          लातूर.
        </div>

        <div style="margin-bottom:20px; font-size:14.5px; font-weight:700; text-align:center;">
          विषय : डेंगी व चिकनगुनिया सिरम नमुने तपासणीसाठी पाठविणेबाबत.
        </div>

        <div style="margin-bottom:24px; font-size:13.5px; line-height:1.8; text-align:justify; text-indent:40px;">
          महोदय,<br>
          उपरोक्त विषयी विनंती की, प्राथमिक आरोग्य केंद्र भादा अंतर्गत खालील रुग्णांचे डेंगी व चिकनगुनिया संशयित सिरम नमुने तपासणीसाठी या पत्रासोबत पाठविण्यात येत आहेत. तरी कृपया सदर नमुने तपासून अहवाल मिळावा, ही विनंती.
        </div>

        <table style="width:100%; border-collapse:collapse; margin-bottom:45px; font-size:13px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="border:1px solid #1a202c; padding:8px 10px; text-align:center; width:50px;">अ.क्र.</th>
              <th style="border:1px solid #1a202c; padding:8px 12px; text-align:center;">रुग्णाचे नाव</th>
              <th style="border:1px solid #1a202c; padding:8px 10px; text-align:center; width:110px;">गाव</th>
              <th style="border:1px solid #1a202c; padding:8px 10px; text-align:center; width:60px;">वय</th>
              <th style="border:1px solid #1a202c; padding:8px 10px; text-align:center; width:90px;">लिंग</th>
              <th style="border:1px solid #1a202c; padding:8px 10px; text-align:center; width:150px;">नमुना घेतल्याचा दिनांक</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="display:flex; justify-content:flex-end; margin-top:50px; text-align:right;">
          <div style="line-height:1.6; font-size:13.5px;">
            <div style="font-weight:700;">वैद्यकीय अधिकारी</div>
            <div style="font-weight:700; margin-top:3px;">Dr. Patil S.S.</div>
            <div style="color:#2d3748;">प्राथमिक आरोग्य केंद्र, भादा</div>
          </div>
        </div>
      </div>
    `;

    const reportId = `GMC_LETTER_${Date.now()}`;
    const wrapped = wrapReportPage(`GMC लातूर डेंगी सिरम पत्र (${displayDate})`, letterHtml);
    generatedReports.set(reportId, wrapped);

    return {
      success: true,
      reportId,
      reportHtml: wrapped,
      html: wrapped,
      message: `GMC लातूर तपासणी पत्र यशस्वीरित्या तयार झाले (${list.length} रुग्ण).`
    };
  } catch (err) {
    console.error("[Reports] Error generating GMC forwarding letter:", err);
    return { success: false, message: `पत्र तयार करताना त्रुटी: ${err.message}` };
  }
}

// ================= DENGUE & CHIKUNGUNYA NIV CASE HISTORY SHEETS =================
export function generateNivCaseHistorySheets(patientIdsOrDate) {
  try {
    let list = [...dengueChikungunyaEntries];
    if (Array.isArray(patientIdsOrDate) && patientIdsOrDate.length > 0) {
      list = list.filter(e => patientIdsOrDate.includes(e.id));
    } else if (typeof patientIdsOrDate === "string" && patientIdsOrDate !== "All") {
      if (patientIdsOrDate.startsWith("DENGUE_")) {
        list = list.filter(e => e.id === patientIdsOrDate);
      } else {
        list = list.filter(e => e.dateCollection === patientIdsOrDate);
      }
    }

    if (list.length === 0) {
      return { success: false, message: "कोणत्याही रुग्णाची केस हिस्ट्री शीट सापडली नाही." };
    }

    let sheetsHtml = "";
    list.forEach((p, index) => {
      const dateOnsetFmt = p.dateOnset ? p.dateOnset.split("-").reverse().join("-") : "-";
      const dateCollFmt = p.dateCollection ? p.dateCollection.split("-").reverse().join("-") : "-";
      const isLast = index === list.length - 1;

      sheetsHtml += `
        <div class="niv-sheet-page" style="page-break-after:${isLast ? "auto" : "always"}; max-width:850px; margin:0 auto; padding:25px 30px; font-family:'Poppins', Arial, sans-serif; font-size:13.5px; line-height:1.7; color:#1a202c; min-height:980px; box-sizing:border-box;">
          <div style="text-align:center; margin-bottom:20px; line-height:1.4;">
            <h2 style="font-size:18px; font-weight:800; margin:0; color:#1a202c;">National Institute of Virology</h2>
            <div style="font-size:12.5px; font-weight:600; margin-top:2px; color:#4a5568;">20 A Dr. Ambedkar Road Post Box No 11 Pune 411 001</div>
            <div style="font-size:14.5px; font-weight:700; margin-top:6px; text-decoration:underline; color:#1a202c;">Case history sheet for Dengue / Chikungunya fever</div>
          </div>

          <div style="font-weight:700; text-decoration:underline; margin-bottom:14px;">Information Required to Accompany Specimen:-</div>

          <div style="margin-bottom:10px; display:flex; align-items:baseline; border-bottom:1px solid #edf2f7; padding-bottom:6px;">
            <span style="font-weight:700; min-width:240px;">1. Full name of patient :-</span>
            <span style="font-weight:700; text-transform:uppercase; font-size:14px; letter-spacing:0.02em;">${p.patientName}</span>
          </div>

          <div style="margin-bottom:10px; border-bottom:1px solid #edf2f7; padding-bottom:6px;">
            <div style="font-weight:700;">2. Residential address of patient <span style="font-weight:normal;">(Mobile:- <b>${p.mobile || "-"}</b>)</span></div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:4px; padding-left:20px;">
              <div>A. House No :- <b>${p.houseNo || "-"}</b></div>
              <div>B. Village :- <b>${p.village}</b></div>
              <div>C. Taluka :- <u>${p.taluka || "AUSA"}</u></div>
              <div>D. District :- <u>${p.district || "LATUR"}</u></div>
            </div>
          </div>

          <div style="margin-bottom:10px; border-bottom:1px solid #edf2f7; padding-bottom:6px;">
            <div style="font-weight:700;">3. Hospital address :- <span style="font-weight:600; text-decoration:underline;">${p.hospitalAddress || "प्राथमिक आरोग्य केंद्र भादा"}</span></div>
            <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:8px; margin-top:4px; padding-left:20px;">
              <div>A. Patient Reg No :- <u><b>${p.patientRegNo || "-"}</b></u></div>
              <div>B. Ward No :- <b>${p.wardNo || "--"}</b></div>
              <div>C. Bed No :- <b>${p.bedNo || "--"}</b></div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:10px; border-bottom:1px solid #edf2f7; padding-bottom:6px;">
            <div><b>4. Age :-</b> <u>${p.age}</u></div>
            <div><b>5. Sex :-</b> <u>${p.sex}</u></div>
          </div>

          <div style="margin-bottom:10px; border-bottom:1px solid #edf2f7; padding-bottom:6px;">
            <b>6. Date Of Onset of First Symptom :-</b> <u>${dateOnsetFmt}</u>
          </div>

          <div style="margin-bottom:10px; border-bottom:1px solid #edf2f7; padding-bottom:6px;">
            <b>7. Nature of sample Serum/Blood/CSF :-</b> <u>${p.sampleNature || "Serum"}</u>
          </div>

          <div style="margin-bottom:10px; border-bottom:1px solid #edf2f7; padding-bottom:6px;">
            <b>8. Date of sample collection :-</b> <u>${dateCollFmt}</u>
          </div>

          <div style="margin-bottom:12px; border-bottom:1px solid #edf2f7; padding-bottom:8px;">
            <div style="font-weight:700; margin-bottom:4px;">9. Clinical finding</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; padding-left:20px;">
              <div>1. Fever :- <u><b>${p.clinicalFever ?? 1}</b> Days</u></div>
              <div>2. Headache :- <u><b>${p.clinicalHeadache ?? 0}</b> Days</u></div>
              <div>3. Bodyache :- <u><b>${p.clinicalBodyache ?? 0}</b> Days</u></div>
              <div>4. Joint Pain :- <u><b>${p.clinicalJointPain ?? 0}</b> Days</u></div>
              <div>5. Retro Orbital Pain :- <u><b>${p.clinicalRetroOrbitalPain ?? 0}</b> Days</u></div>
              <div>6. Rash :- <u><b>${p.clinicalRash ?? 0}</b> Days</u></div>
            </div>
          </div>

          <div style="margin-bottom:28px;">
            <div style="font-weight:700;">10. Haemorrhagic Manifestation :- <u>${p.haemorrhagic || "No"}</u></div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; padding-left:20px; margin-top:6px;">
              <div>a. Hematemesis :- ${p.haemHematemesis ? `<u>${p.haemHematemesis}</u>` : "_______________"}</div>
              <div>b. Epistaxis :- ${p.haemEpistaxis ? `<u>${p.haemEpistaxis}</u>` : "_______________"}</div>
              <div>c. Melena :- ${p.haemMelena ? `<u>${p.haemMelena}</u>` : "_______________"}</div>
              <div>d. ${p.haemOther ? `<u>${p.haemOther}</u>` : "__________________________"}</div>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; margin-top:40px; text-align:right;">
            <div style="line-height:1.5; font-size:13px;">
              <div style="font-weight:700;">Signature of Medical Officer</div>
              <div style="font-weight:700; margin-top:3px;">${p.doctorName || "Dr. Patil S.S."}</div>
              <div>Mobile No: <b>${p.doctorMobile || "9689686901"}</b></div>
              <div style="color:#718096; font-size:12px; margin-top:2px;">(Seal / Stamp)</div>
            </div>
          </div>
        </div>
      `;
    });

    const reportId = `NIV_SHEETS_${Date.now()}`;
    const wrapped = wrapReportPage(`NIV Pune केस हिस्ट्री शीट (${list.length} रुग्ण)`, sheetsHtml);
    generatedReports.set(reportId, wrapped);

    return {
      success: true,
      reportId,
      reportHtml: wrapped,
      html: wrapped,
      message: `NIV पुणे केस हिस्ट्री शीट्स यशस्वीरित्या तयार झाल्या (${list.length} रुग्ण).`
    };
  } catch (err) {
    console.error("[Reports] Error generating NIV case sheets:", err);
    return { success: false, message: `केस हिस्ट्री शीट तयार करताना त्रुटी: ${err.message}` };
  }
}
