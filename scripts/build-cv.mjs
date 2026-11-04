// Builds the public CV PDF from verified profile content (no phone number or street address).
// Run: npm run cv:build   (renders HTML with Playwright, then scripts/clean_cv.py rewrites metadata)
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [p] = JSON.parse(readFileSync('src/content/profile.json', 'utf8'));
const fontCss = readFileSync('node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2').toString('base64');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(p.name)} — ${esc(p.title)}</title>
<style>
@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${fontCss}) format('woff2');font-weight:200 800}
@page{size:A4;margin:16mm 16mm 14mm}
*{box-sizing:border-box}
body{margin:0;font-family:Manrope,Arial,sans-serif;color:#131a15;font-size:9.6pt;line-height:1.45}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #166534;padding-bottom:8pt;margin-bottom:12pt}
h1{font-size:24pt;margin:0;letter-spacing:-.02em;line-height:1.1}
.title{color:#166534;font-weight:700;font-size:11pt;margin-top:2pt}
.contact{text-align:right;font-size:9pt;color:#3f4b43}
.contact a{color:#166534;text-decoration:none}
h2{font-size:10pt;text-transform:uppercase;letter-spacing:.08em;color:#166534;margin:14pt 0 6pt}
.summary{font-size:10pt;color:#2b352f;margin:0}
.job{margin-bottom:10pt;break-inside:avoid}
.job-head{display:flex;justify-content:space-between;gap:12pt}
.role{font-weight:800;font-size:10.5pt}
.org{font-weight:600;color:#3f4b43}
.period{color:#5b675f;white-space:nowrap;font-size:9pt}
ul{margin:4pt 0 0;padding-left:13pt}
li{margin:1.5pt 0}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:0 24pt}
.small{font-size:9pt;color:#3f4b43}
</style></head><body>
<header><div><h1>${esc(p.name)}</h1><div class="title">${esc(p.title)}</div></div>
<div class="contact"><a href="mailto:${esc(p.email)}">${esc(p.email)}</a><br>
<a href="https://oriorasajambu.github.io/android-portfolio/">oriorasajambu.github.io/android-portfolio</a><br>
${p.links.map((l) => `<a href="${esc(l.href)}">${esc(l.href.replace(/^https:\/\//, ''))}</a>`).join('<br>')}</div></header>
<p class="summary">${esc(p.summary)}</p>
<h2>Experience</h2>
${p.experience
  .map(
    (e) => `<div class="job"><div class="job-head"><div><span class="role">${esc(e.role)}</span> · <span class="org">${esc(e.org)}</span></div><span class="period">${esc(e.period)}</span></div>
<div>${esc(e.summary)}</div><ul>${e.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>`,
  )
  .join('')}
<div class="cols">
<div><h2>Education</h2>${p.education.map((ed) => `<div><strong>${esc(ed.title)}</strong><br><span class="small">${esc(ed.org)} · ${esc(ed.period)}</span></div>`).join('')}
<h2>Languages</h2><div>${p.languages.map(esc).join(' · ')}</div></div>
<div><h2>Courses</h2><ul>${p.courses.map((c) => `<li>${esc(c.title)} <span class="small">— ${esc(c.provider)}, ${c.year}</span></li>`).join('')}</ul></div>
</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: 'public/rio-wirawan-cv.raw.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log('Rendered public/rio-wirawan-cv.raw.pdf');
