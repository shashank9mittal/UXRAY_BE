const { chromium } = require("playwright");

/**
 * Launches a headless browser instance
 * @returns {Promise<Browser>} Browser instance
 */
async function launchBrowser() {
  console.log("[BROWSER] Launching headless browser...");
  const browser = await chromium.launch({
    headless: true,
  });
  console.log("[BROWSER] Browser launched successfully");
  return browser;
}

/**
 * Creates a new page and navigates to the URL
 * @param {Browser} browser - Browser instance
 * @param {string} url - URL to navigate to
 * @returns {Promise<{page: Page, loadTime: number}>} Page instance and load time
 */
async function navigateToUrl(browser, url) {
  const page = await browser.newPage();
  console.log("[BROWSER] New page created");

  console.log(`[BROWSER] Navigating to: ${url}`);
  const startTime = Date.now();
  await page.goto(url, {
    waitUntil: "networkidle",
    timeout: 30000, // 30 second timeout
  });
  const loadTime = Date.now() - startTime;
  console.log(`[BROWSER] Page loaded in ${loadTime}ms`);

  return { page, loadTime };
}

/**
 * Closes the browser instance
 * @param {Browser} browser - Browser instance
 */
async function closeBrowser(browser) {
  if (browser) {
    console.log("[BROWSER] Closing browser...");
    await browser.close();
    console.log("[BROWSER] Browser closed successfully");
  }
}

module.exports = {
  launchBrowser,
  navigateToUrl,
  closeBrowser,
};

