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
 * @returns {Promise<{page: Page, loadTime: number, statusCode: number}>} Page instance, load time, and status code
 */
async function navigateToUrl(browser, url) {
  const page = await browser.newPage();
  console.log("[BROWSER] New page created");

  console.log(`[BROWSER] Navigating to: ${url}`);
  const startTime = Date.now();
  
  let statusCode = 200;
  let response = null;

  try {
    response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000, // 30 second timeout
    });

    // Get status code from response
    if (response) {
      statusCode = response.status();
      
      // Throw error for 4xx and 5xx status codes
      if (statusCode >= 400) {
        const statusText = response.statusText() || "Unknown error";
        throw new Error(`HTTP ${statusCode}: ${statusText}`);
      }
    }
  } catch (error) {
    // If we have a response with error status, use it
    if (response && response.status() >= 400) {
      statusCode = response.status();
      throw new Error(`HTTP ${statusCode}: ${response.statusText() || "Page returned an error status"}`);
    }
    // Re-throw navigation errors (network errors, timeouts, etc.)
    throw error;
  }

  const loadTime = Date.now() - startTime;
  console.log(`[BROWSER] Page loaded in ${loadTime}ms with status ${statusCode}`);

  return { page, loadTime, statusCode };
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

