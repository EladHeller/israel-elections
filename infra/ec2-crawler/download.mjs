export async function downloadCities(context, page, timeoutMs = 90_000) {
  const watched = new Set();
  let timer;
  let resolveDownload;
  let rejectDownload;
  const onResponse = response => {
    const source = new URL(response.url());
    if (source.hostname !== 'media26.bechirot.gov.il' || source.pathname !== '/files/expc.csv') return;
    const status = response.status();
    if (status >= 400) {
      rejectDownload(new Error(`City CSV source returned HTTP ${status}`));
      return;
    }
    const location = response.headers().location;
    if (status < 300 || status >= 400 || !location) return;
    try {
      if (new URL(location, source).hostname === 'maintenance.gov.il') {
        rejectDownload(new Error('City CSV source redirected to the government maintenance page; keeping last published results'));
      }
    } catch {
      rejectDownload(new Error('City CSV source returned an invalid redirect'));
    }
  };
  const onPage = opened => {
    if (watched.has(opened)) return;
    watched.add(opened);
    opened.on('download', resolveDownload);
  };
  const pending = new Promise((resolve, reject) => {
    resolveDownload = resolve;
    rejectDownload = reject;
    context.on('response', onResponse);
    context.on('page', onPage);
    // window.open uses a fixed name and can reuse a popup from an earlier cycle.
    for (const opened of context.pages()) onPage(opened);
    timer = setTimeout(() => reject(new Error('No download within timeout')), timeoutMs);
  });
  try {
    const [download] = await Promise.all([pending, page.locator('#DownloadCSVCities').click({ timeout: 15_000 })]);
    return download;
  } finally {
    clearTimeout(timer);
    context.off('page', onPage);
    context.off('response', onResponse);
    for (const opened of watched) opened.off('download', resolveDownload);
  }
}
