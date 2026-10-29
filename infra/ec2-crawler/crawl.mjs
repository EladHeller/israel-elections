import { downloadCities, downloadPollingStations } from './download.mjs';
import { chromium } from 'playwright';
import { parse } from 'csv-parse/sync';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const pollingStations = process.argv[2] === 'polling-stations';

// Attach to the same ordinary Chrome visible in the remote desktop.
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().startsWith('https://votes26.bechirot.gov.il/'));
try {
  if (!page) throw new Error('Open the official results homepage in the desktop first');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.locator('#DownloadCSVCities').waitFor({ state: 'visible', timeout: 30_000 });
  await mkdir('/home/crawler/downloads', { recursive: true });
  await page.screenshot({ path: '/home/crawler/downloads/before.png' });
  const link = page.locator('#DownloadCSVCities');
  if (!await link.isVisible()) throw new Error(`Download link unavailable: ${await page.title()} | ${(await page.locator('body').innerText()).slice(0, 500)}`);
  const download = await (pollingStations ? downloadPollingStations : downloadCities)(context, page);
  const path = `/home/crawler/downloads/${pollingStations ? 'polling-stations' : 'cities'}-${Date.now()}.csv`;
  await download.saveAs(path);
  if ((await stat(path)).size > 30 * 1024 * 1024) throw new Error('CSV exceeds size limit');
  const bytes = await readFile(path);
  let csv;
  try { csv = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { csv = new TextDecoder('windows-1255').decode(bytes); }
  const rows = parse(csv, { bom: true, skip_empty_lines: true });
  if (rows.length < 2 || !rows[0].some(c => c.trim() === 'שם ישוב') || !rows[0].includes('כשרים') || (pollingStations && !rows[0].some(c => c.trim() === 'מספר קלפי'))) {
    throw new Error('Downloaded content is not a valid results CSV');
  }
  console.log(JSON.stringify({ ok: true, path, source: download.url(), rows: rows.length - 1,
    sha256: createHash('sha256').update(bytes).digest('hex') }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: String(error) }));
  process.exitCode = 1;
} finally {
  await browser.close(); // Disconnect CDP; the independently started Chrome stays open.
}
