// Renders the 1200x630 social image to public/og.png. Run: node scripts/build-og.mjs
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
const font = readFileSync('node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2').toString('base64');
const screen = readFileSync('public/showcase/qr-receipt.svg', 'utf8');
const html = `<!doctype html><html><head><style>
@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:200 800}
body{margin:0;width:1200px;height:630px;background:#F7F8F4;font-family:Manrope;display:flex;align-items:center;overflow:hidden}
.copy{padding:0 0 0 88px;flex:1}
.k{font:600 20px ui-monospace,Consolas,monospace;letter-spacing:.08em;color:#5B675F;text-transform:uppercase}
h1{font-size:84px;margin:16px 0 8px;letter-spacing:-.03em;color:#131a15}
p{font-size:30px;color:#3f4b43;margin:0;max-width:600px;line-height:1.35}
.bar{width:96px;height:8px;background:#166534;border-radius:4px;margin-top:36px}
.phone{margin-right:96px;padding:12px;border-radius:48px;background:#1b231e;transform:rotate(-4deg);box-shadow:0 30px 60px -20px #10171370}
.phone svg{display:block;width:250px;height:auto;border-radius:38px}
</style></head><body><div class="copy"><div class="k">Senior Android Developer</div><h1>Rio Wirawan</h1>
<p>Native Android features in Kotlin for mobile banking.</p><div class="bar"></div></div><div class="phone">${screen}</div></body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(html, { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: 'public/og.png' });
await b.close();
console.log('Wrote public/og.png');
