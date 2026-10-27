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

export async function handler() {
  const browser = await chromium.launch(chromiumLaunchOptions);

  try {
    const page = await browser.newPage();
    const response = await page.goto('https://example.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: response?.status(),
        title: await page.title(),
        chromiumVersion: browser.version(),
      }),
    };
  } finally {
    await browser.close();
  }
}
