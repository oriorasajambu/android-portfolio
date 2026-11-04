// Generates the original, synthetic phone-screen illustrations and study diagrams.
// Run: node scripts/gen-illustrations.mjs  (outputs to public/showcase and public/diagrams)
import { mkdirSync, writeFileSync } from 'node:fs';

const W = 360;
const H = 760;
const FONT = "Manrope, 'Segoe UI', Roboto, Arial, sans-serif";
const C = {
  bg: '#F4F6F1',
  surface: '#FFFFFF',
  ink: '#16201A',
  muted: '#5B675F',
  line: '#DCE3DA',
  accent: '#166534',
  accentSoft: '#DCFCE7',
  warn: '#9A3412',
  warnSoft: '#FFEDD5',
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (x, y, s, { size = 14, weight = 500, fill = C.ink, anchor = 'start' } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;
const rect = (x, y, w, h, { r = 16, fill = C.surface, stroke = 'none' } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;

function screen(title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<rect width="${W}" height="${H}" fill="${C.bg}"/>
${text(24, 30, '9:41', { size: 13, weight: 700 })}
<g fill="${C.ink}"><rect x="300" y="20" width="18" height="10" rx="2"/><rect x="322" y="22" width="14" height="8" rx="2" opacity=".5"/></g>
<path d="M24 74 l8 -8 M24 74 l8 8" stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
${text(48, 80, title, { size: 18, weight: 700 })}
${body}
${text(W / 2, H - 22, 'Illustration · synthetic data', { size: 11, fill: C.muted, anchor: 'middle' })}
</svg>`;
}

// Deterministic, decorative QR-like pattern (not a scannable code).
function qrPattern(x, y, size, cells = 25) {
  const cell = size / cells;
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  let out = '';
  const finder = (cx, cy) =>
    `<rect x="${x + cx * cell}" y="${y + cy * cell}" width="${7 * cell}" height="${7 * cell}" fill="${C.ink}"/>` +
    `<rect x="${x + (cx + 1) * cell}" y="${y + (cy + 1) * cell}" width="${5 * cell}" height="${5 * cell}" fill="#fff"/>` +
    `<rect x="${x + (cx + 2) * cell}" y="${y + (cy + 2) * cell}" width="${3 * cell}" height="${3 * cell}" fill="${C.ink}"/>`;
  for (let i = 0; i < cells; i++)
    for (let j = 0; j < cells; j++) {
      const inFinder = (i < 8 && j < 8) || (i > cells - 9 && j < 8) || (i < 8 && j > cells - 9);
      if (!inFinder && rnd() > 0.52)
        out += `<rect x="${(x + i * cell).toFixed(1)}" y="${(y + j * cell).toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" fill="${C.ink}"/>`;
    }
  return out + finder(0, 0) + finder(cells - 7, 0) + finder(0, cells - 7);
}

const account = (y) =>
  rect(24, y, 312, 64) +
  `<circle cx="56" cy="${y + 32}" r="16" fill="${C.accentSoft}"/>` +
  text(84, y + 28, 'Everyday Savings', { size: 14, weight: 700 }) +
  text(84, y + 48, '•••• 4821', { size: 13, fill: C.muted });

const button = (y, label, { fill = C.accent, color = '#fff', stroke = 'none' } = {}) =>
  rect(24, y, 312, 52, { r: 26, fill, stroke }) + text(W / 2, y + 32, label, { size: 15, weight: 700, fill: color, anchor: 'middle' });

const screens = {
  'qr-present': screen(
    'Pay with QR',
    account(104) +
      rect(24, 188, 312, 360) +
      text(W / 2, 222, 'Show this code to the cashier', { size: 14, weight: 600, fill: C.muted, anchor: 'middle' }) +
      `<rect x="70" y="240" width="220" height="220" fill="#fff"/>` +
      qrPattern(80, 250, 200) +
      rect(112, 486, 136, 36, { r: 18, fill: C.accentSoft }) +
      text(W / 2, 509, 'Refreshes in 0:42', { size: 13, weight: 700, fill: C.accent, anchor: 'middle' }) +
      text(W / 2, 590, 'Keep this screen open until the', { size: 13, fill: C.muted, anchor: 'middle' }) +
      text(W / 2, 610, 'merchant confirms the payment.', { size: 13, fill: C.muted, anchor: 'middle' }) +
      button(660, 'Refresh code', { fill: C.surface, color: C.accent, stroke: C.line }),
  ),
  'qr-waiting': screen(
    'Payment in progress',
    rect(24, 120, 312, 420) +
      `<circle cx="180" cy="250" r="56" fill="none" stroke="${C.line}" stroke-width="10"/>` +
      `<path d="M180 194 a56 56 0 0 1 56 56" fill="none" stroke="${C.accent}" stroke-width="10" stroke-linecap="round"/>` +
      text(W / 2, 360, 'Waiting for the merchant', { size: 18, weight: 700, anchor: 'middle' }) +
      text(W / 2, 390, 'The cashier has scanned your code.', { size: 13, fill: C.muted, anchor: 'middle' }) +
      text(W / 2, 410, 'This usually takes a few seconds.', { size: 13, fill: C.muted, anchor: 'middle' }) +
      rect(48, 446, 264, 66, { r: 14, fill: C.accentSoft }) +
      text(W / 2, 474, 'You can leave the app — the receipt', { size: 12.5, weight: 600, fill: C.accent, anchor: 'middle' }) +
      text(W / 2, 494, 'will also arrive as a notification.', { size: 12.5, weight: 600, fill: C.accent, anchor: 'middle' }),
  ),
  'qr-receipt': screen(
    'Receipt',
    rect(16, 96, 328, 68, { r: 18, fill: C.ink }) +
      `<circle cx="48" cy="130" r="14" fill="${C.accent}"/>` +
      text(72, 124, 'Payment successful', { size: 13, weight: 700, fill: '#fff' }) +
      text(72, 144, 'Rp 48.500 · Sample Coffee Bar', { size: 12, fill: '#C9D3CC' }) +
      rect(24, 184, 312, 400) +
      `<circle cx="180" cy="248" r="34" fill="${C.accentSoft}"/>` +
      `<path d="M164 248 l11 11 l21 -23" stroke="${C.accent}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      text(W / 2, 314, 'Rp 48.500', { size: 28, weight: 800, anchor: 'middle' }) +
      text(W / 2, 340, 'Paid to Sample Coffee Bar', { size: 13, fill: C.muted, anchor: 'middle' }) +
      `<line x1="48" y1="368" x2="312" y2="368" stroke="${C.line}" stroke-dasharray="4 4"/>` +
      [['Date', '12 Mar 2026, 08:14'], ['From', 'Everyday Savings •••• 4821'], ['Method', 'Customer-presented QR'], ['Reference', 'DEMO-0000-0042']]
        .map(([k, v], i) => text(48, 400 + i * 40, k, { size: 13, fill: C.muted }) + text(312, 400 + i * 40, v, { size: 13, weight: 600, anchor: 'end' }))
        .join('') +
      button(616, 'Done') +
      text(W / 2, 700, 'Share receipt', { size: 14, weight: 700, fill: C.accent, anchor: 'middle' }),
  ),
};

function card(y, status = 'Active') {
  return (
    `<defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1F3A2A"/><stop offset="1" stop-color="#0E1A13"/></linearGradient></defs>` +
    rect(24, y, 312, 186, { r: 20, fill: 'url(#cg)' }) +
    text(48, y + 40, 'Sample Debit', { size: 15, weight: 700, fill: '#fff' }) +
    `<rect x="48" y="${y + 66}" width="40" height="30" rx="6" fill="#C9B77B"/>` +
    text(48, y + 140, '••••  ••••  ••••  7305', { size: 18, weight: 700, fill: '#fff' }) +
    text(48, y + 166, 'VALID THRU 08/29', { size: 11, fill: '#A7B5AC' }) +
    rect(244, y + 22, 72, 26, { r: 13, fill: status === 'Active' ? '#22C55E33' : '#F9731633' }) +
    text(280, y + 40, status, { size: 12, weight: 700, fill: '#BBF7D0', anchor: 'middle' })
  );
}

const actions = (y) =>
  [['Block', 0], ['Activate', 1], ['Change PIN', 2]]
    .map(([label, i]) => {
      const x = 24 + i * 108;
      return rect(x, y, 96, 84) + `<circle cx="${x + 48}" cy="${y + 30}" r="14" fill="${C.accentSoft}"/>` + text(x + 48, y + 68, label, { size: 12.5, weight: 700, anchor: 'middle' });
    })
    .join('');

const detailRows = (y, rows) =>
  rect(24, y, 312, 40 + rows.length * 36) +
  text(44, y + 30, 'Limit details', { size: 14, weight: 700 }) +
  rows.map(([k, v], i) => text(44, y + 64 + i * 36, k, { size: 13, fill: C.muted }) + text(316, y + 64 + i * 36, v, { size: 13, weight: 600, anchor: 'end' })).join('');

const limits = [['Daily withdrawal', 'Rp 10.000.000'], ['Daily transfer', 'Rp 25.000.000'], ['Daily purchase', 'Rp 15.000.000']];

Object.assign(screens, {
  'cards-available': screen('My card', card(104) + actions(310) + detailRows(414, limits)),
  'cards-partial': screen(
    'My card',
    card(104) +
      actions(310) +
      rect(24, 414, 312, 172, { fill: C.warnSoft }) +
      `<circle cx="56" cy="452" r="14" fill="none" stroke="${C.warn}" stroke-width="2.4"/>` +
      text(56, 457, '!', { size: 15, weight: 800, fill: C.warn, anchor: 'middle' }) +
      text(82, 448, 'Limit details unavailable', { size: 14, weight: 700, fill: C.warn }) +
      text(82, 468, 'Your card and its actions still work.', { size: 12.5, fill: C.warn }) +
      rect(82, 500, 110, 44, { r: 22, fill: C.surface, stroke: C.warn }) +
      text(137, 527, 'Retry', { size: 14, weight: 700, fill: C.warn, anchor: 'middle' }),
  ),
  'cards-recovered': screen(
    'My card',
    card(104) + actions(310) + detailRows(414, limits) + rect(112, 598, 136, 34, { r: 17, fill: C.accentSoft }) + text(W / 2, 620, 'Updated just now', { size: 12.5, weight: 700, fill: C.accent, anchor: 'middle' }),
  ),
});

// ---------- Diagrams (theme-neutral: drawn on their own light panel) ----------
const box = (x, y, w, h, label, sub, { fill = C.surface, stroke = C.line, color = C.ink } = {}) =>
  rect(x, y, w, h, { r: 14, fill, stroke }) +
  text(x + w / 2, y + (sub ? h / 2 - 2 : h / 2 + 5), label, { size: 15, weight: 700, fill: color, anchor: 'middle' }) +
  (sub ? text(x + w / 2, y + h / 2 + 18, sub, { size: 12, fill: C.muted, anchor: 'middle' }) : '');
const arrow = (x1, y1, x2, y2, label) =>
  `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${C.muted}" stroke-width="2" fill="none" marker-end="url(#ah)"/>` +
  (label ? text((x1 + x2) / 2, (y1 + y2) / 2 - 8, label, { size: 12, fill: C.muted, anchor: 'middle' }) : '');
const defs = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${C.muted}"/></marker></defs>`;

const qrDiagram = `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="400" viewBox="0 0 880 400" font-family="${FONT}" role="img">
${defs}<rect width="880" height="400" rx="20" fill="${C.bg}"/>
${box(30, 160, 160, 80, 'Payment result', 'decided off-device', { fill: C.ink, stroke: C.ink, color: '#fff' })}
${[['App in foreground', 'open screen updates', 50], ['App in background', 'push notification', 160], ['App not running', 'push notification', 270]]
  .map(([a, b, y]) => box(290, y, 220, 80, a, b) + arrow(190, 200, 286, y + 40))
  .join('')}
${box(640, 160, 200, 80, 'One receipt', 'same summary every path', { fill: C.accentSoft, stroke: C.accent, color: C.accent })}
${arrow(510, 90, 636, 190)}${arrow(510, 200, 636, 200, 'tap')}${arrow(510, 310, 636, 212, 'tap · cold start')}
${text(440, 384, 'Original explanatory diagram — not a production architecture.', { size: 12, fill: C.muted, anchor: 'middle' })}
</svg>`;

const cardDiagram = `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="400" viewBox="0 0 880 400" font-family="${FONT}" role="img">
${defs}<rect width="880" height="400" rx="20" fill="${C.bg}"/>
${text(40, 50, 'One section of the screen', { size: 14, weight: 700, fill: C.muted })}
${box(60, 150, 170, 80, 'Loading', 'section placeholder')}
${box(370, 70, 190, 80, 'Loaded', 'content + actions', { fill: C.accentSoft, stroke: C.accent, color: C.accent })}
${box(370, 230, 190, 80, 'Failed', 'message in place', { fill: C.warnSoft, stroke: C.warn, color: C.warn })}
${arrow(230, 180, 366, 110, 'success')}${arrow(230, 200, 366, 270, 'error')}
<path d="M370 300 C 260 360, 150 330, 145 234" stroke="${C.muted}" stroke-width="2" fill="none" marker-end="url(#ah)"/>
${text(250, 356, 'Retry (this section only)', { size: 12, fill: C.muted, anchor: 'middle' })}
${rect(640, 90, 200, 210, { r: 14, fill: C.surface, stroke: C.line })}
${text(740, 122, 'Other sections', { size: 14, weight: 700, anchor: 'middle' })}
${['Card summary', 'Card actions', 'Account info'].map((s, i) => rect(664, 140 + i * 50, 152, 36, { r: 10, fill: C.accentSoft }) + text(740, 163 + i * 50, s + ' ✓', { size: 12.5, weight: 600, fill: C.accent, anchor: 'middle' })).join('')}
${text(740, 330, 'stay usable meanwhile', { size: 12, fill: C.muted, anchor: 'middle' })}
${text(440, 384, 'Original explanatory diagram — not a production architecture.', { size: 12, fill: C.muted, anchor: 'middle' })}
</svg>`;

mkdirSync('public/showcase', { recursive: true });
mkdirSync('public/diagrams', { recursive: true });
for (const [name, svg] of Object.entries(screens)) writeFileSync(`public/showcase/${name}.svg`, svg);
writeFileSync('public/diagrams/qr-feedback.svg', qrDiagram);
writeFileSync('public/diagrams/card-states.svg', cardDiagram);
console.log('Wrote', Object.keys(screens).length, 'screens and 2 diagrams');
