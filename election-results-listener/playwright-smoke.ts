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

const originUrl = 'https://media26.bechirot.gov.il/';
const csvUrl = 'https://media26.bechirot.gov.il/files/expc.csv';

export async function handler() {
  const browser = await chromium.launch(chromiumLaunchOptions);

  try {
    const page = await browser.newPage();
    const initialResponse = await page.goto(originUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    // Give an AWS WAF browser challenge time to execute and establish its session token.
    await page.waitForTimeout(5_000);

    const csv = await page.evaluate(async (url: string) => {
      const response = await fetch(url, { cache: 'no-store' });
      const body = await response.text();

      return {
        status: response.status,
        wafAction: response.headers.get('x-amzn-waf-action'),
        lastModified: response.headers.get('last-modified'),
        contentType: response.headers.get('content-type'),
        contentLength: body.length,
        preview: body.slice(0, 200),
      };
    }, csvUrl);

    return {
      statusCode: csv.status === 200 && csv.contentLength > 0 ? 200 : 502,
      body: JSON.stringify({
        initialStatus: initialResponse?.status(),
        finalUrl: page.url(),
        chromiumVersion: browser.version(),
        csv,
      }),
    };
  } finally {
    await browser.close();
  }
}
