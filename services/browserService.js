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
    // First, wait for page to load (faster, more reliable than networkidle)
    response = await page.goto(url, {
      waitUntil: "load", // Changed from "networkidle" to "load" for better reliability
      timeout: 60000, // Increased to 60 second timeout
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

    // Optionally wait for network to be idle (with shorter timeout)
    // This helps capture dynamic content but won't wait forever
    try {
      await Promise.race([
        page.waitForLoadState("networkidle"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000))
      ]);
      console.log("[BROWSER] Network idle state reached");
    } catch (idleError) {
      console.log("[BROWSER] Network idle timeout - continuing with loaded page");
      // Continue anyway - page is loaded
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

  // Wait a bit more for any animations or dynamic content to render
  await page.waitForTimeout(2000); // Increased to 2 seconds
  
  // Wait for page to be fully ready
  await page.evaluate(() => {
    return new Promise((resolve) => {
      if (document.readyState === "complete") {
        resolve();
      } else {
        window.addEventListener("load", resolve);
      }
    });
  });

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

