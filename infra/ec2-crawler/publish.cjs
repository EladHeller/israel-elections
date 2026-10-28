const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { readFile, unlink } = require('node:fs/promises');
const { runWithHeartbeat, statusWriter } = require('./app/infra/ec2-crawler/heartbeat.cjs');
const { publishResultsCsv } = require('./app/dist/csv-monitor.js');

async function main() {
  const { stdout } = await promisify(execFile)(process.execPath, ['/opt/election-crawler/crawl.mjs'], {
    timeout: 150_000, maxBuffer: 1024 * 1024,
  });
  const downloaded = JSON.parse(stdout.trim());
  if (!downloaded.ok || !/^\/home\/crawler\/downloads\/cities-\d+\.csv$/.test(downloaded.path)) {
    throw new Error('Unexpected crawler output');
  }
  try {
    const bytes = await readFile(downloaded.path);
    let csv;
    try { csv = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { csv = new TextDecoder('windows-1255').decode(bytes); }
    await publishResultsCsv(csv, new Date().toISOString());
    return { sha256: downloaded.sha256, rows: downloaded.rows };
  } finally {
    await unlink(downloaded.path);
  }
}
runWithHeartbeat(main, statusWriter()).then(result => {
  console.log(JSON.stringify({ ok: true, ...result }));
}).catch(error => { console.error(error); process.exitCode = 1; });
