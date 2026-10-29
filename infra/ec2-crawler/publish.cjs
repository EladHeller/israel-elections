const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { readFile, unlink } = require('node:fs/promises');
const { runWithHeartbeat, statusWriter } = require('./app/infra/ec2-crawler/heartbeat.cjs');
const { publishResultsCsv, publishPollingStationsCsv } = require('./app/dist/csv-monitor.js');

async function publishDownload(kind, publish) {
  const { stdout } = await promisify(execFile)(process.execPath, ['/opt/election-crawler/crawl.mjs', kind], {
    timeout: 150_000, maxBuffer: 1024 * 1024,
  });
  const downloaded = JSON.parse(stdout.trim());
  if (!downloaded.ok || !new RegExp(`^/home/crawler/downloads/${kind}-[0-9]+\\.csv$`).test(downloaded.path)) {
    throw new Error('Unexpected crawler output');
  }
  try {
    const bytes = await readFile(downloaded.path);
    let csv;
    try { csv = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { csv = new TextDecoder('windows-1255').decode(bytes); }
    await publish(csv, new Date().toISOString());
    return { sha256: downloaded.sha256, rows: downloaded.rows };
  } finally {
    await unlink(downloaded.path);
  }
}
async function main() {
  // Publish nationwide/city updates first, even if the station download subsequently fails.
  const cities = await publishDownload('cities', publishResultsCsv);
  const pollingStations = await publishDownload('polling-stations', publishPollingStationsCsv);
  return { ...cities, pollingStations };
}
runWithHeartbeat(main, statusWriter()).then(result => {
  console.log(JSON.stringify({ ok: true, ...result }));
}).catch(error => { console.error(error); process.exitCode = 1; });
