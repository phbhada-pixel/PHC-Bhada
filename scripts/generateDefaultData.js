import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dbPath = path.join(rootDir, 'data', 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Build defaultData.js
const defaultDataJs = 'window.DEFAULT_DB_SNAPSHOT = ' + JSON.stringify(db) + ';\n';
fs.writeFileSync(path.join(rootDir, 'defaultData.js'), defaultDataJs, 'utf8');
console.log('✅ Generated defaultData.js with snapshot size:', defaultDataJs.length);
