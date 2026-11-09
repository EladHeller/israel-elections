import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

export function previewRoot() {
  return pathToFileURL((existsSync(resolve('src/data/party-names.json')) ? resolve('.') : resolve('elections-client')) + '/');
}
const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

export function electionPreviewSvg(election, lists, mode = 'results') {
  const all = [...lists].sort((a, b) => b.seats - a.seats);
  if (!/^[1-9][0-9]*$/.test(election) || mode === 'results' && (!all.length || all.some(row => !Number.isSafeInteger(row.seats) || row.seats <= 0)
    || all.reduce((total, row) => total + row.seats, 0) !== 120)) {
    throw new Error('Social preview requires a valid election and 120 real seats');
  }
  const rows = mode === 'question' ? [] : all.filter((row, index) => index < 3 || row.seats === all[2]?.seats);
  const step = Math.min(115, 330 / rows.length);
  const chart = rows.map(({ name, seats }, index) => {
    const y = 255 + index * step;
    const bar = 1038 * seats / all[0].seats;
    const size = name.length > 35 ? 32 : name.length > 25 ? 39 : 51;
    return `<g data-list="${escapeXml(name)}" data-seats="${seats}">
      <text x="1118" y="${y}" direction="rtl" text-anchor="end" font-size="${size}">${escapeXml(name)}</text>
      <text x="80" y="${y}" font-size="68" fill="#f6aa1c">${seats}</text>
      <rect x="${1118 - bar}" y="${y + 21}" width="${bar}" height="13" rx="6.5" fill="#91c7e8"/>
    </g>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" lang="he">
    <title>הכנסת ה־${election}</title>
    <desc>${mode === 'question' ? 'שאלות על הבחירות לכנסת ה־' + election : rows.map(row => `${escapeXml(row.name)}: ${row.seats}`).join(', ')}</desc>
    <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#213e64"/><stop offset="1" stop-color="#0b132b"/></linearGradient></defs>
    <rect width="1200" height="630" fill="url(#bg)"/><path d="M0 0H1200" stroke="#f6aa1c" stroke-width="12"/>
    <g font-family="DejaVu Sans" fill="#fff">
      <text x="${mode === 'question' ? 600 : 1118}" y="${mode === 'question' ? 330 : 113}" direction="rtl" text-anchor="${mode === 'question' ? 'middle' : 'end'}" font-size="${mode === 'question' ? 110 : 78}">הכנסת ה־${election}</text>
      ${chart}
      <text x="80" y="594" font-size="25" fill="#b2c5db">elections.eladheller.com</text>
    </g>
  </svg>`;
}

export function renderPreview(svg) {
  return new Resvg(svg, { font: {
    fontFiles: [fileURLToPath(new URL('scripts/fonts/PreviewSans.ttf', previewRoot()))],
    loadSystemFonts: false,
  } }).render().asPng();
}

export function electionPreviewAssets(root = previewRoot()) {
  const names = JSON.parse(readFileSync(new URL('src/data/party-names.json', root), 'utf8'));
  return Object.keys(names).flatMap(election => {
    const path = new URL(`public/data/${election}/allResults.json`, root);
    if (!existsSync(path)) return [];
    const data = JSON.parse(readFileSync(path, 'utf8'));
    const lists = Object.entries(data.realResults)
      .filter(([, value]) => value.mandats > 0)
      .map(([key, value]) => ({ name: names[election][key] || key, seats: value.mandats }));
    return ['results', 'question'].map(mode => {
      const svg = electionPreviewSvg(election, lists, mode);
      return { election, mode, svg, fileName: `social/${mode === 'question' ? 'question' : 'elections'}-${election}-v2.png`, png: renderPreview(svg) };
    });
  });
}
