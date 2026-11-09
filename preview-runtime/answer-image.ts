import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const font = { loadSystemFonts: false, fontFiles: [join(__dirname, 'PreviewSans.ttf')] };
const escapeXml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

export function textWidth(text: string, size: number): number {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="160"><text x="0" y="100" font-family="DejaVu Sans" font-size="${size}">${escapeXml(text)}</text></svg>`;
  return new Resvg(svg, { font }).innerBBox()?.width ?? 0;
}

export function wrapText(text: string, size: number, width: number, maximumLines: number): string[] {
  if (!text.trim()) return [];
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && textWidth(candidate, size) > width) {
      lines.push(line); line = word;
      if (lines.length === maximumLines) break;
    }
    else line = candidate;
  }
  lines.push(line);
  return lines.slice(0, maximumLines).map((value, index) => {
    if (textWidth(value, size) <= width && (index < maximumLines - 1 || lines.length <= maximumLines)) return value;
    const characters = Array.from(value);
    let low = 0; let high = characters.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (textWidth(`${characters.slice(0, middle).join('')}…`, size) <= width) low = middle;
      else high = middle - 1;
    }
    return `${characters.slice(0, low).join('').trimEnd()}…`;
  });
}

export function answerImageSvg(election: string, question: string, sentences: string[]): string {
  const answered = sentences.length > 0;
  const questionSize = answered ? 48 : 60;
  const questions = wrapText(question, questionSize, 1056, answered ? 2 : 3);
  const answers = wrapText(sentences.join(' '), 60, 1056, 4);
  const text = (value: string, y: number, size: number, fill: string) => `<text x="1128" y="${y}" direction="rtl" text-anchor="end" font-size="${size}" fill="${fill}">${escapeXml(`\u202b${value}\u202c`)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" lang="he">
    <title>${escapeXml(question)}</title><desc>${escapeXml(sentences.join(' '))}</desc>
    <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#213e64"/><stop offset="1" stop-color="#0b132b"/></linearGradient></defs>
    <rect width="1200" height="630" fill="url(#bg)"/><path d="M0 0H1200" stroke="#f6aa1c" stroke-width="12"/>
    <g font-family="DejaVu Sans">
      ${text(`הכנסת ה־${election}`, 68, 34, '#b2c5db')}
      ${questions.map((value, i) => text(value, (answered ? 146 : 240) + i * (answered ? 64 : 80), questionSize, '#fff')).join('')}
      ${answers.map((value, i) => text(value, 320 + i * 78, 60, '#f6aa1c')).join('')}
      <text x="72" y="610" font-size="22" fill="#b2c5db">elections.eladheller.com</text>
    </g>
  </svg>`;
}

export function answerImagePng(election: string, question: string, sentences: string[]): Buffer {
  return new Resvg(answerImageSvg(election, question, sentences), { font }).render().asPng();
}
