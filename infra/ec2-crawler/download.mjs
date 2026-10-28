export async function downloadCities(context, page, timeoutMs = 90_000) {
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
    const [download] = await Promise.all([pending, page.locator('#DownloadCSVCities').click({ timeout: 15_000 })]);
    return download;
  } finally {
    clearTimeout(timer);
    context.off('page', onPage);
    for (const opened of watched) opened.off('download', resolveDownload);
  }
}
