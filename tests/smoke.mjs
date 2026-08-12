import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const referenced = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
const localRefs = referenced.filter((ref) => !ref.startsWith('http') && !ref.startsWith('#'));
const missing = localRefs.filter((ref) => !fs.existsSync(path.join(root, ref)));
if (missing.length) {
  console.error(`Missing local files: ${missing.join(', ')}`);
  process.exit(1);
}
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) {
  console.error(`Duplicate IDs: ${[...new Set(duplicates)].join(', ')}`);
  process.exit(1);
}
const cacheVersion = sw.match(/const CACHE = '([^']+)'/);
if (!cacheVersion) {
  console.error('Service Worker cache version is missing');
  process.exit(1);
}
const cached = [...sw.matchAll(/'\.\/([^']+)'/g)].map((match) => match[1]).filter((ref) => ref.endsWith('.js') || ref.endsWith('.css'));
const localAssets = localRefs.filter((ref) => ref.endsWith('.js') || ref.endsWith('.css'));
const uncached = localAssets.filter((ref) => !cached.includes(ref) && !cached.includes(ref.replace(/^\.\//, '')));
if (uncached.length) {
  console.error(`Service Worker cache missing: ${uncached.join(', ')}`);
  process.exit(1);
}
console.log(`Smoke OK: ${localRefs.length} local references, ${ids.length} unique IDs, cache ${cacheVersion[1]}`);
