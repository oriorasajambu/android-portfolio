// Verifies every internal href/src in dist/ resolves under the GitHub Pages base path,
// and that same-page / cross-page #fragments exist.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const BASE = '/android-portfolio/';
const SITE = 'https://oriorasajambu.github.io';

const pages = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.html')) pages.push(p);
  }
})(DIST);

const ids = new Map();
const idsFor = (file) => {
  if (!ids.has(file)) ids.set(file, new Set([...readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  return ids.get(file);
};
const resolveFile = (path) => {
  const rel = decodeURI(path.slice(BASE.length));
  const f = join(DIST, rel);
  if (rel === '' || rel.endsWith('/')) return join(f, 'index.html');
  return f;
};

const errors = [];
const external = new Set();
let count = 0;
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const urls = [
    ...[...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((m) => m[1]),
    // meta content only when it is a URL (og:image, og:url)
    ...[...html.matchAll(/\scontent="(https?:[^"]+)"/g)].map((m) => m[1]),
  ];
  for (let url of urls) {
    if (/^(mailto:|data:|tel:)/.test(url)) continue;
    if (url.startsWith(SITE)) url = url.slice(SITE.length);
    else if (/^https?:\/\//.test(url)) {
      external.add(url);
      continue;
    }
    if (!url.startsWith('/') && !url.startsWith('#')) continue; // meta content values etc.
    count++;
    if (url.startsWith('#')) {
      if (url.length > 1 && !idsFor(page).has(url.slice(1))) errors.push(`${page}: missing anchor ${url}`);
      continue;
    }
    if (!url.startsWith(BASE)) {
      errors.push(`${page}: link outside base path: ${url}`);
      continue;
    }
    const [path, frag] = url.split('#');
    const file = resolveFile(path.split('?')[0]);
    if (!existsSync(file)) errors.push(`${page}: broken link ${url}`);
    else if (frag && file.endsWith('.html') && !idsFor(file).has(frag)) errors.push(`${page}: missing anchor ${url}`);
  }
}

console.log(`Checked ${count} internal references across ${pages.length} pages.`);
console.log(`External (not fetched): ${[...external].join(', ') || 'none'}`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('All internal links resolve.');
