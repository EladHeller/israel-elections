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

async function summarizeResponse(response: any) {
  const body = await response.text();
  const headers = response.headers();

  return {
    status: response.status(),
    wafAction: headers['x-amzn-waf-action'] ?? null,
    lastModified: headers['last-modified'] ?? null,
    contentType: headers['content-type'] ?? null,
    contentLength: body.length,
    preview: body.slice(0, 200),
  };
}

export async function handler() {
  const browser = await chromium.launch(chromiumLaunchOptions);

  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    let navigation: Record<string, unknown>;
    try {
      const response = await page.goto(csvUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      navigation = response
        ? {
            status: response.status(),
            wafAction: response.headers()['x-amzn-waf-action'] ?? null,
            contentType: response.headers()['content-type'] ?? null,
            url: response.url(),
          }
        : { response: null };
    } catch (error) {
      navigation = {
        error: error instanceof Error ? error.message : String(error),
      };
    }

    const [defaultResponse, nodeLikeResponse] = await Promise.all([
      context.request.get(csvUrl, { timeout: 30_000 }),
      context.request.get(csvUrl, {
        timeout: 30_000,
        headers: {
          accept: '*/*',
          'user-agent': 'node',
        },
      }),
    ]);

    const [defaultRequest, nodeLikeRequest] = await Promise.all([
      summarizeResponse(defaultResponse),
      summarizeResponse(nodeLikeResponse),
    ]);

    return {
      statusCode: [defaultRequest, nodeLikeRequest].some(
        ({ status, contentLength }) => status === 200 && contentLength > 0,
      )
        ? 200
        : 502,
      body: JSON.stringify({
        finalUrl: page.url(),
        chromiumVersion: browser.version(),
        cookies: (await context.cookies()).map(({ name, domain, expires }) => ({ name, domain, expires })),
        navigation,
        requests: {
          default: defaultRequest,
          nodeLike: nodeLikeRequest,
        },
      }),
    };
  } finally {
    await browser.close();
  }
}
