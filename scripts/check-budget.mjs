// Checks compressed transfer budgets over dist/ (run after `npm run build`).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const BASE = '/android-portfolio/';
const KB = 1024;
const BUDGET = { initial: 600 * KB, initialJs: 75 * KB, enhancement: 1024 * KB, desktop10s: 1.6 * 1024 * KB };

const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const toFile = (url) => join(DIST, decodeURI(url.replace(BASE, '')));
const size = (file) => {
  const buf = readFileSync(file);
  // woff2/png are already compressed; servers don't gzip them.
  return /\.(woff2|png|jpe?g|webp|pdf)$/.test(file) ? buf.length : gz(buf);
};

const pages = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.html')) pages.push(p);
  }
})(DIST);

/** JS files reachable via static imports from an entry (dynamic import() excluded). */
function staticJsClosure(entry, seen = new Set()) {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const src = readFileSync(entry, 'utf8');
  const re = /(?:^|[;\n}])\s*import\s*(?:[\w*{}\s,$]+from\s*)?["']([^"']+\.js)["']/g;
  for (const m of src.matchAll(re)) staticJsClosure(join(entry, '..', m[1]), seen);
  return seen;
}

let failed = false;
const fmt = (n) => `${(n / KB).toFixed(1)}KB`;
const check = (label, value, limit) => {
  const ok = value <= limit;
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(44)} ${fmt(value).padStart(9)} / ${fmt(limit)}`);
};

// Fonts: browsers fetch only the subset matching page text (latin) via unicode-range.
const latinFont = readdirSync(join(DIST, '_astro')).filter((f) => /manrope-latin-wght/.test(f));
const fontBytes = latinFont.reduce((s, f) => s + size(join(DIST, '_astro', f)), 0);

let enhancementTotal = 0;
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const rel = posix.normalize(page.replaceAll('\\', '/'));
  const css = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => toFile(m[1]));
  const jsEntries = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => toFile(m[1]));
  const js = new Set(jsEntries.flatMap((e) => [...staticJsClosure(e)]));
  const eagerImgs = [...html.matchAll(/<img[^>]+>/g)]
    .map((m) => m[0])
    .filter((t) => !/loading="lazy"/.test(t))
    .map((t) => toFile(t.match(/src="([^"]+)"/)[1]));

  const jsBytes = [...js].reduce((s, f) => s + size(f), 0) + gz(Buffer.from([...html.matchAll(/<script(?![^>]+src)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('')));
  const initial = gz(Buffer.from(html)) + css.reduce((s, f) => s + size(f), 0) + jsBytes + eagerImgs.reduce((s, f) => s + size(f), 0) + fontBytes;

  console.log(`\n${rel}`);
  check('initial critical transfer (excl. CV)', initial, BUDGET.initial);
  check('initial JavaScript', jsBytes, BUDGET.initialJs);

  if (html.includes('data-showcase-config')) {
    const scene = readdirSync(join(DIST, '_astro')).filter((f) => /^phone-scene\..*\.js$/.test(f));
    const sceneJs = scene.flatMap((f) => [...staticJsClosure(join(DIST, '_astro', f))]).filter((f) => !js.has(f));
    const textures = readdirSync(join(DIST, 'showcase')).map((f) => join(DIST, 'showcase', f));
    enhancementTotal = [...sceneJs, ...textures].reduce((s, f) => s + size(f), 0);
    check('optional Three.js module + showcase assets', enhancementTotal, BUDGET.enhancement);
    check('desktop first-ten-second transfer', initial + enhancementTotal, BUDGET.desktop10s);
  }
}

console.log(failed ? '\nBudget check FAILED' : '\nAll budgets met');
process.exit(failed ? 1 : 0);
