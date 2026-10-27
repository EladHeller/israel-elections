const { chromium } = require('playwright');

const chromiumLaunchOptions = {
  headless: true,
  timeout: 30_000,
  args: [
    '--single-process',
    '--no-zygote',
    '--in-process-gpu',
    '--disable-site-isolation-trials',
    '--font-render-hinting=none',
  ],
  env: {
    ...process.env,
    HOME: '/tmp',
    XDG_CACHE_HOME: '/tmp/.cache',
  },
};

const csvUrl = 'https://media26.bechirot.gov.il/files/expc.csv';

export async function handler() {
  const browser = await chromium.launch(chromiumLaunchOptions);

  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    let navigationError: string | undefined;
    try {
      await page.goto(csvUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
    } catch (error) {
      navigationError = error instanceof Error ? error.message : String(error);
    }

    // If the CSV request is challenged, Chromium gets a chance to execute the
    // WAF challenge on the protected URL and persist its cookies in the context.
    await page.waitForTimeout(5_000);

    // browserContext.request shares the browser context's cookie storage, so this
    // second request reuses any token/cookies established by the browser challenge.
    const response = await context.request.get(csvUrl, { timeout: 30_000 });
    const body = await response.text();
    const headers = response.headers();

    const csv = {
      status: response.status(),
      wafAction: headers['x-amzn-waf-action'] ?? null,
      lastModified: headers['last-modified'] ?? null,
      contentType: headers['content-type'] ?? null,
      contentLength: body.length,
      preview: body.slice(0, 200),
    };

    return {
      statusCode: csv.status === 200 && csv.contentLength > 0 ? 200 : 502,
      body: JSON.stringify({
        navigationError,
        finalUrl: page.url(),
        chromiumVersion: browser.version(),
        cookies: (await context.cookies()).map(({ name, domain, expires }) => ({ name, domain, expires })),
        csv,
      }),
    };
  } finally {
    await browser.close();
  }
}
