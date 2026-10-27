import config from './config';
import { csvMonitor } from './csv-monitor';

const DEFAULT_POLL_INTERVAL_MS = 60_000;
const MIN_POLL_INTERVAL_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 5 * 60_000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getPollInterval() {
  const value = Number(process.env.LOCAL_POLL_INTERVAL_MS ?? DEFAULT_POLL_INTERVAL_MS);
  if (!Number.isInteger(value) || value < MIN_POLL_INTERVAL_MS) {
    throw new Error(`LOCAL_POLL_INTERVAL_MS must be an integer >= ${MIN_POLL_INTERVAL_MS}`);
  }
  return value;
}

async function main() {
  const once = process.argv.includes('--once');
  const pollInterval = getPollInterval();
  let stopping = false;
  let lastError: string | undefined;
  let lastHeartbeat = 0;

  const stop = () => {
    stopping = true;
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  console.log('[local-monitor] starting', {
    elections: config.currElections,
    bucket: config.bucket,
    region: config.region,
    intervalMs: pollInterval,
    once,
  });

  while (!stopping) {
    const startedAt = Date.now();
    try {
      await csvMonitor();
      const now = Date.now();
      if (lastError || now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS || once) {
        console.log('[local-monitor] poll succeeded', { at: new Date(now).toISOString() });
        lastHeartbeat = now;
      }
      lastError = undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message !== lastError) {
        console.error('[local-monitor] poll failed', { message });
        lastError = message;
      }
      if (once) throw error;
    }

    if (once) return;
    await sleep(Math.max(0, pollInterval - (Date.now() - startedAt)));
  }

  console.log('[local-monitor] stopped');
}

main().catch((error) => {
  console.error('[local-monitor] fatal error', error);
  process.exitCode = 1;
});
