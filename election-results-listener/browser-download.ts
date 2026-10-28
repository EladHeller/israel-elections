import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import config from './config';
import { getCsvResults } from './csv-data';

const landingUrl = 'https://votes26.bechirot.gov.il/';
const downloadTimeout = 90_000;
const maxBytes = 30 * 1024 * 1024;

export function summarizeDownloadedCsv(bytes: Buffer) {
  if (!bytes.length || bytes.length > maxBytes) throw new Error('Unexpected CSV file size');
  let csv: string;
  try {
    csv = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    csv = new TextDecoder('windows-1255').decode(bytes);
  }
  const rows: string[][] = parse(csv, { bom: true, skip_empty_lines: true });
  if (rows.length < 2) throw new Error('Downloaded file has no result rows');
  const { voteData, countedVotes } = getCsvResults(csv, config.notPartiesKeys);
  return {
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    rows: rows.length - 1,
    parties: Object.keys(voteData).length,
    validVotes: Object.values(voteData).reduce((sum, { votes }) => sum + votes, 0),
    countedVotes,
  };
}

// Listen before clicking: the site's link uses window.open, and a download may
// be emitted by either the opener or the new page. No follow-up HTTP fetch.
export async function clickCityDownload(context: any, page: any, timeoutMs = downloadTimeout) {
  const watched = new Set<any>();
  let timer: ReturnType<typeof setTimeout>;
  let onPage: (opened: any) => void;
  let onDownload: (download: any) => void;
  const pending = new Promise<any>((resolve, reject) => {
    onDownload = resolve;
    onPage = (opened) => {
      if (watched.has(opened)) return;
      watched.add(opened);
      opened.on('download', onDownload);
    };
    context.on('page', onPage);
    onPage(page);
    timer = setTimeout(() => reject(new Error('No CSV download after clicking DownloadCSVCities')), timeoutMs);
  });
  try {
    const [download] = await Promise.all([
      pending,
      page.locator('#DownloadCSVCities').click({ timeout: 15_000 }),
    ]);
    return download;
  } finally {
    clearTimeout(timer!);
    context.off('page', onPage!);
    for (const opened of watched) opened.off('download', onDownload!);
  }
}

export async function runBrowserDownload(chromium: any) {
  const directory = await mkdtemp(join(tmpdir(), 'election-download-'));
  let browser: any;
  let context: any;
  const responses: Record<string, unknown>[] = [];
  try {
    browser = await chromium.launch({
      headless: true,
      timeout: 30_000,
      args: ['--single-process', '--no-zygote', '--in-process-gpu', '--disable-site-isolation-trials'],
      env: { ...process.env, HOME: tmpdir(), XDG_CACHE_HOME: join(tmpdir(), '.cache') },
    });
    context = await browser.newContext({ acceptDownloads: true });
    context.on('response', (response: any) => {
      if (responses.length < 20 && response.request().isNavigationRequest()) {
        responses.push({ url: response.url(), status: response.status(),
          contentType: response.headers()['content-type'], wafAction: response.headers()['x-amzn-waf-action'] });
      }
    });
    const page = await context.newPage();
    await page.goto(landingUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator('#DownloadCSVCities').waitFor({ state: 'visible', timeout: 45_000 });
    const download = await clickCityDownload(context, page);
    const path = join(directory, 'cities.csv');
    await download.saveAs(path);
    if ((await stat(path)).size > maxBytes) throw new Error('Downloaded CSV exceeds size limit');
    const csv = summarizeDownloadedCsv(await readFile(path));
    return { statusCode: 200, body: JSON.stringify({ ok: true, source: download.url(),
      filename: download.suggestedFilename(), chromiumVersion: browser.version(), csv, responses }) };
  } catch (error) {
    const pages = await Promise.all((context?.pages() ?? []).map(async (page: any) => ({
      url: page.url(),
      title: await page.title().catch(() => ''),
      text: await page.locator('body').innerText({ timeout: 1_000 }).then((text: string) => text.slice(0, 500)).catch(() => ''),
    })));
    return { statusCode: 502, body: JSON.stringify({ ok: false,
      error: error instanceof Error ? error.message : String(error), responses, pages }) };
  } finally {
    try {
      await browser?.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}

export async function handler() {
  const { chromium } = require('playwright');
  const result = await runBrowserDownload(chromium);
  console.log(result.body);
  return result;
}
