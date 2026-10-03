import fs from 'fs';

// Read scripts/testParity.js to extract generateClientSideMonthlyReportHtml function
const testParityContent = fs.readFileSync('scripts/testParity.js', 'utf8');

const funcMatch = testParityContent.match(/export function generateClientSideMonthlyReportHtml([\s\S]*?)\n\}\n\n\/\/ Generate from AI Studio/);
if (!funcMatch) {
  console.error("Could not find function in testParity.js");
  process.exit(1);
}

const funcBody = "function generateClientSideMonthlyReportHtml" + funcMatch[1] + "\n}";

// Read index.html
let indexHtml = fs.readFileSync('index.html', 'utf8');

// Replace wrapReportPageLocal
const wrapStartStr = "function wrapReportPageLocal(title, bodyContent) {";
const wrapEndStr = "'<' + '/html>';\n      }";

const wrapStartIndex = indexHtml.indexOf(wrapStartStr);
const wrapEndIndex = indexHtml.indexOf(wrapEndStr, wrapStartIndex);

if (wrapStartIndex === -1 || wrapEndIndex === -1) {
  console.error("Could not find wrapReportPageLocal boundaries in index.html");
  process.exit(1);
}

const newWrapFunc = `function wrapReportPageLocal(title, bodyContent) {
        return '<!DOCTYPE html>' +
          '<html lang="mr">' +
          '<head>' +
          '<meta charset="UTF-8">' +
          '<title>' + title + ' - प्रा.आ.केंद्र भादा</title>' +
          '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">' +
          '<' + 'style>' +
          '@page { size: A4; margin: 12mm; }' +
          'body { font-family: \\'Poppins\\', Arial, sans-serif; color: #1a202c; background: #f7fafc; margin: 0; padding: 20px; }' +
          '.print-actions { max-width: 850px; margin: 0 auto 20px auto; display: flex; justify-content: space-between; align-items: center; background: #ffffff; padding: 12px 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.08); }' +
          '.print-btn { background: #00796b; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; display: inline-flex; align-items: center; gap: 6px; }' +
          '.print-btn:hover { background: #004d40; }' +
          '.close-btn { background: #e2e8f0; color: #4a5568; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-weight: 600; }' +
          '.report-sheet { max-width: 850px; margin: 0 auto; background: #ffffff; padding: 35px 40px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); border-radius: 8px; min-height: 1000px; box-sizing: border-box; }' +
          'table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; font-size: 12px; }' +
          'th, td { border: 1px solid #2d3748; padding: 8px 10px; font-size: 12px; text-align: center; }' +
          'th { background: #edf2f7; font-weight: 600; }' +
          '.text-left { text-align: left; }' +
          '.text-right { text-align: right; }' +
          '.header-box { text-align: center; border-bottom: 2px solid #2d3748; padding-bottom: 12px; margin-bottom: 20px; }' +
          '.main-title { font-size: 20px; font-weight: 700; color: #1a202c; margin: 0 0 4px 0; }' +
          '.sub-title { font-size: 15px; font-weight: 600; color: #4a5568; margin: 0; }' +
          '.subject { font-weight: 700; text-decoration: underline; margin: 15px 0 10px 0; font-size: 14px; }' +
          '.footer-sign { margin-top: 45px; text-align: right; line-height: 1.6; font-size: 14px; font-weight: 600; }' +
          '.page-break { page-break-after: always; }' +
          '@media print { body { background: #ffffff; padding: 0; } .print-actions { display: none !important; } .report-sheet { box-shadow: none; padding: 0; margin: 0; max-width: 100%; } }' +
          '<' + '/style>' +
          '<' + '/head>' +
          '<' + 'body>' +
          '<div class="print-actions">' +
          '<div><strong>प्रा.आ.केंद्र भादा</strong> - अधिकृत अहवाल / पत्र</div>' +
          '<div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">' +
          '<button class="print-btn" onclick="window.print()">🖨️ प्रिंट करा / PDF सेव्ह करा</button>' +
          '<button class="close-btn" onclick="window.close()">बंद करा</button>' +
          '</div>' +
          '</div>' +
          '<div class="report-sheet">' +
          bodyContent +
          '</div>' +
          '<' + '/body>' +
          '<' + '/html>';
      }`;

indexHtml = indexHtml.slice(0, wrapStartIndex) + newWrapFunc + indexHtml.slice(wrapEndIndex + wrapEndStr.length);

// Now find case 'generateMonthlyReportWebApp': in executeClientSideRpc
const caseStartStr = "case 'generateMonthlyReportWebApp': {";
const caseEndStr = "return {\n              result: {\n                success: true,\n                message: 'माहे ' + monthName + ' चा अधिकृत मासिक अहवाल यशस्वीरित्या तयार झाला!',\n                html: wrapReportPageLocal('मासिक अहवाल - ' + monthName, bodyHtml)\n              }\n            };\n          }";

const caseStartIndex = indexHtml.indexOf(caseStartStr);
const caseEndIndex = indexHtml.indexOf(caseEndStr, caseStartIndex);

if (caseStartIndex === -1 || caseEndIndex === -1) {
  console.error("Could not find case 'generateMonthlyReportWebApp' boundaries in index.html");
  process.exit(1);
}

const newCase = `case 'generateMonthlyReportWebApp': {
            const [monthInput] = args;
            const res = generateClientSideMonthlyReportHtml(monthInput, {
              monthMaster: clientMonthMaster,
              masterData: clientMasterData,
              bsDataEntry: clientBsData,
              villageDetails: clientVillageDetails,
              dengueChikungunyaEntries: clientDengueEntries
            });
            return {
              result: res
            };
          }`;

indexHtml = indexHtml.slice(0, caseStartIndex) + newCase + indexHtml.slice(caseEndIndex + caseEndStr.length);

// Place generateClientSideMonthlyReportHtml right before executeClientSideRpc
const rpcSig = "async function executeClientSideRpc(prop, args) {";
const rpcSigIndex = indexHtml.indexOf(rpcSig);
if (rpcSigIndex === -1) {
  console.error("Could not find executeClientSideRpc in index.html");
  process.exit(1);
}

indexHtml = indexHtml.slice(0, rpcSigIndex) + funcBody + "\n\n      " + indexHtml.slice(rpcSigIndex);

fs.writeFileSync('index.html', indexHtml, 'utf8');
console.log("Successfully injected generateClientSideMonthlyReportHtml into index.html!");
