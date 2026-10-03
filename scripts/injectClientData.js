import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Read db.json
const dbPath = path.join(rootDir, 'data', 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// 1. Generate defaultData.js
const defaultDataJs = `// PHC Bhada NVBDCP Client-side Database & Reporting Engine for Standalone / GitHub Pages Mode
window.DEFAULT_DB_SNAPSHOT = ${JSON.stringify(db)};
`;
fs.writeFileSync(path.join(rootDir, 'defaultData.js'), defaultDataJs, 'utf8');
console.log('defaultData.js generated successfully! Bytes:', defaultDataJs.length);

// 2. Read index.html
let indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

// Ensure <script src="defaultData.js"></script> is in head
if (!indexHtml.includes('<script src="defaultData.js"></script>')) {
  indexHtml = indexHtml.replace(
    '<!-- Google Apps Script Client Bridge',
    '<!-- Standalone Database Snapshot for GitHub Pages / Static Hosting -->\n  <script src="defaultData.js"></script>\n  <!-- Google Apps Script Client Bridge'
  );
}

fs.writeFileSync(path.join(rootDir, 'index.html'), indexHtml, 'utf8');
fs.writeFileSync(path.join(rootDir, 'Form.html'), indexHtml, 'utf8');
console.log('index.html and Form.html synced with defaultData.js script tag!');
