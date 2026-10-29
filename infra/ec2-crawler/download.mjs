export async function downloadCities(context, page, timeoutMs = 90_000) {
  return downloadCsv(context, () => page.locator('#DownloadCSVCities').click({ timeout: 15_000 }), timeoutMs, 'https://media26.bechirot.gov.il/files/expc.csv');
}

// Trigger the official control, preserving its URL, popup name and user gesture.
export async function downloadPollingStations(context, page, timeoutMs = 90_000) {
  return downloadCsv(context, () => page.locator('#DownloadCSVBallots').click({ timeout: 15_000 }), timeoutMs, 'https://media26.bechirot.gov.il/files/expb.csv');
}

async function downloadCsv(context, start, timeoutMs, expectedUrl) {
  const watched = new Set();
  let timer;
  let resolveDownload;
  const onDownload = download => {
    // Reused popups can emit stale city downloads when requesting stations (and vice versa).
    if (download.url().split('?')[0] === expectedUrl) resolveDownload(download);
  };
  const onPage = opened => {
    if (watched.has(opened)) return;
    watched.add(opened);
    opened.on('download', onDownload);
  };
  const pending = new Promise((resolve, reject) => {
    resolveDownload = resolve;
    context.on('page', onPage);
    // window.open uses a fixed name and can reuse a popup from an earlier cycle.
    for (const opened of context.pages()) onPage(opened);
    timer = setTimeout(() => reject(new Error('No download within timeout')), timeoutMs);
  });
  try {
    const [download] = await Promise.all([pending, start()]);
    return download;
  } finally {
    clearTimeout(timer);
    context.off('page', onPage);
    for (const opened of watched) opened.off('download', onDownload);
  }
}
