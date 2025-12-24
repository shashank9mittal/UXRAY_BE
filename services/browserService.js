const { chromium } = require("playwright");

/**
 * Launch a browser instance
 * @returns {Promise<Browser>} Browser instance
 */
const launchBrowser = async () => {
  try {
    console.log("[BROWSER] Launching browser...");
    const browser = await chromium.launch({
      headless: false, // Run in visible mode
      slowMo: 100, // Slow down operations by 100ms to make it easier to see
    });
    console.log("[BROWSER] Browser launched successfully");
    return browser;
  } catch (error) {
    console.error("[BROWSER] Error launching browser:", error.message);
    throw new Error(`Failed to launch browser: ${error.message}`);
  }
};

/**
 * Navigate to a URL and return the page
 * @param {Browser} browser - Browser instance
 * @param {string} url - URL to navigate to
 * @returns {Promise<{page: Page, loadTime: number, statusCode: number}>}
 */
const navigateToUrl = async (browser, url) => {
  let page = null;
  try {
    console.log(`[BROWSER] Creating new page...`);
    page = await browser.newPage();

    const startTime = Date.now();
    console.log(`[BROWSER] Navigating to URL: ${url}`);

    const response = await page.goto(url, {
      waitUntil: "networkidle", // Wait until network is idle
      timeout: 30000, // 30 second timeout
    });

    const loadTime = Date.now() - startTime;
    const statusCode = response?.status() || 200;

    console.log(`[BROWSER] Navigation completed. Status: ${statusCode}, Load time: ${loadTime}ms`);

    return {
      page,
      loadTime,
      statusCode,
    };
  } catch (error) {
    console.error(`[BROWSER] Error navigating to URL: ${error.message}`);
    // Clean up page if it was created
    if (page) {
      await page.close().catch(() => {});
    }
    throw new Error(`Failed to navigate to URL: ${error.message}`);
  }
};

/**
 * Close the browser instance
 * @param {Browser} browser - Browser instance to close
 */
const closeBrowser = async (browser) => {
  try {
    if (browser) {
      console.log("[BROWSER] Closing browser...");
      await browser.close();
      console.log("[BROWSER] Browser closed successfully");
    }
  } catch (error) {
    console.error("[BROWSER] Error closing browser:", error.message);
    // Don't throw error when closing, just log it
  }
};

module.exports = {
  launchBrowser,
  navigateToUrl,
  closeBrowser,
};

