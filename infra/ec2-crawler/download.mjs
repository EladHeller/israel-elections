export async function downloadCities(context, page, timeoutMs = 90_000) {
  return downloadCsv(context, () => page.locator('#DownloadCSVCities').click({ timeout: 15_000 }), timeoutMs);
}

// Use the same authenticated Chrome session and popup download flow as the city link.
export async function downloadPollingStations(context, page, timeoutMs = 90_000) {
  return downloadCsv(context, () => page.evaluate(() => {
    window.open('https://media26.bechirot.gov.il/files/expb.csv', 'polling-stations-csv');
  }), timeoutMs);
}

async function downloadCsv(context, start, timeoutMs) {
  const watched = new Set();
  let timer;
  let resolveDownload;
  const onPage = opened => {
    if (watched.has(opened)) return;
    watched.add(opened);
    opened.on('download', resolveDownload);
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
    for (const opened of watched) opened.off('download', resolveDownload);
  }
}
