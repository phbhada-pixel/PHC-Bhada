// Comprehensive Indian & NVBDCP date parser for PHC Bhada

const MONTH_NAMES = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

export function parseIndianDate(rawDate, entryId = '') {
  if (!rawDate && !entryId) return new Date();
  
  const str = String(rawDate || '').trim();

  // Try parsing from entryId if starts with BS_YYYYMMDD (e.g. BS_20260105, BS_20251211)
  const idMatch = String(entryId || '').match(/BS_(\d{4})(\d{2})(\d{2})/);
  
  // 1. Check for named month (e.g. 25-Feb-2025, 7-Apr-2025, 30-Dec-2025)
  const namedMatch = str.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,})[-/ ](\d{2,4})$/);
  if (namedMatch) {
    const day = parseInt(namedMatch[1], 10);
    const monStr = namedMatch[2].toLowerCase().slice(0, 3);
    let year = parseInt(namedMatch[3], 10);
    if (year < 100) year += 2000;
    const month = MONTH_NAMES[monStr] !== undefined ? MONTH_NAMES[monStr] : 0;
    return new Date(year, month, day, 12, 0, 0);
  }

  // 2. Check for DD-MM-YYYY or DD-MM-YY (e.g. 11-12-25, 27-10-25, 11-12-2025)
  if (str.includes('-')) {
    const parts = str.split('-').map(p => p.trim());
    if (parts.length === 3) {
      // Check if first part is 4-digit year (YYYY-MM-DD)
      if (parts[0].length === 4) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day, 12, 0, 0);
      }
      // Standard dd-mm-yyyy or dd-mm-yy
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      return new Date(year, month, day, 12, 0, 0);
    }
  }

  // 3. Check for slash formats (e.g. 11/12/2025, 1/21/2026, 1/5/2026)
  if (str.includes('/')) {
    const parts = str.split('/').map(p => p.trim());
    if (parts.length === 3) {
      let p1 = parseInt(parts[0], 10);
      let p2 = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;

      // If entryId provides exact YYYYMMDD, use it to resolve ambiguity
      if (idMatch) {
        const idYear = parseInt(idMatch[1], 10);
        const idMonth = parseInt(idMatch[2], 10) - 1;
        const idDay = parseInt(idMatch[3], 10);
        return new Date(idYear, idMonth, idDay, 12, 0, 0);
      }

      // If p1 > 12 -> definitely dd/mm/yyyy (e.g. 25/02/2025)
      if (p1 > 12) {
        return new Date(year, p2 - 1, p1, 12, 0, 0);
      }
      // If p2 > 12 -> definitely mm/dd/yyyy (e.g. 1/21/2026)
      if (p2 > 12) {
        return new Date(year, p1 - 1, p2, 12, 0, 0);
      }

      // Default: dd/mm/yyyy as per Indian standard
      return new Date(year, p2 - 1, p1, 12, 0, 0);
    }
  }

  // Fallback to entryId if available
  if (idMatch) {
    const idYear = parseInt(idMatch[1], 10);
    const idMonth = parseInt(idMatch[2], 10) - 1;
    const idDay = parseInt(idMatch[3], 10);
    return new Date(idYear, idMonth, idDay, 12, 0, 0);
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function formatIndianDateStr(dateObj) {
  if (!dateObj) return '';
  const d = (dateObj instanceof Date && !isNaN(dateObj.getTime())) ? dateObj : new Date(dateObj);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function validateDateDdMmYyyy(rawDate, entryId = '') {
  const str = String(rawDate || '').trim();
  if (!str && !entryId) {
    return {
      isValid: false,
      isStrictDdMmYyyy: false,
      isAutoNormalized: false,
      formattedDdMmYyyy: '',
      errorMsg: 'तारीख रिकामी आहे (Missing Date)'
    };
  }

  // Check if exactly dd-mm-yyyy with 4-digit year
  const strictPattern = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
  const strictMatch = str.match(strictPattern);
  if (strictMatch) {
    const day = parseInt(strictMatch[1], 10);
    const month = parseInt(strictMatch[2], 10);
    const year = parseInt(strictMatch[3], 10);

    if (month < 1 || month > 12) {
      return { isValid: false, isStrictDdMmYyyy: false, isAutoNormalized: false, formattedDdMmYyyy: '', errorMsg: `अवैध महिना (${month})` };
    }
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) {
      return { isValid: false, isStrictDdMmYyyy: false, isAutoNormalized: false, formattedDdMmYyyy: '', errorMsg: `अवैध दिवस (${day})` };
    }

    const pad = n => String(n).padStart(2, '0');
    return {
      isValid: true,
      isStrictDdMmYyyy: true,
      isAutoNormalized: false,
      formattedDdMmYyyy: `${pad(day)}-${pad(month)}-${year}`,
      parsedDate: new Date(year, month - 1, day, 12, 0, 0),
      errorMsg: ''
    };
  }

  // Parse using fallback and normalize to dd-mm-yyyy
  const parsed = parseIndianDate(str, entryId);
  if (parsed && !isNaN(parsed.getTime())) {
    const formatted = formatIndianDateStr(parsed);
    return {
      isValid: true,
      isStrictDdMmYyyy: false,
      isAutoNormalized: true,
      formattedDdMmYyyy: formatted,
      parsedDate: parsed,
      errorMsg: `मूळ स्वरूप: "${str}" -> ऑटो-फॉर्मेट: ${formatted}`
    };
  }

  return {
    isValid: false,
    isStrictDdMmYyyy: false,
    isAutoNormalized: false,
    formattedDdMmYyyy: '',
    errorMsg: `अवैध तारीख स्वरूप: "${str}" (अपेक्षित dd-mm-yyyy)`
  };
}
