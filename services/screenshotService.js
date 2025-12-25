const path = require("path");
const fs = require("fs").promises;

/**
 * Capture a high-resolution screenshot of the page
 * @param {Page} page - Playwright page object
 * @param {string} url - URL of the page (used for filename generation)
 * @returns {Promise<{buffer: Buffer, base64: string, filename: string, filepath: string}>}
 */
const captureScreenshot = async (page, url) => {
  try {
    console.log(`[SCREENSHOT] Capturing screenshot for: ${url}`);

    // Generate a unique filename based on URL and timestamp
    const urlSlug = url
      .replace(/^https?:\/\//, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .substring(0, 50);
    const timestamp = Date.now();
    const filename = `screenshot_${urlSlug}_${timestamp}.png`;
    const screenshotsDir = path.join(__dirname, "..", "screenshots");
    const filepath = path.join(screenshotsDir, filename);

    // Ensure screenshots directory exists
    try {
      await fs.access(screenshotsDir);
    } catch {
      await fs.mkdir(screenshotsDir, { recursive: true });
      console.log(`[SCREENSHOT] Created screenshots directory`);
    }

    // Capture screenshot with high resolution settings
    const buffer = await page.screenshot({
      type: "png",
      fullPage: true, // Capture full page, not just viewport
      path: filepath,
    });

    // Convert buffer to base64
    const base64 = buffer.toString("base64");

    console.log(`[SCREENSHOT] Screenshot captured: ${filename} (${buffer.length} bytes)`);

    return {
      buffer,
      base64,
      filename,
      filepath,
      width: page.viewportSize()?.width || 1920,
      height: page.viewportSize()?.height || 1080,
    };
  } catch (error) {
    console.error(`[SCREENSHOT] Error capturing screenshot: ${error.message}`);
    throw new Error(`Failed to capture screenshot: ${error.message}`);
  }
};

module.exports = {
  captureScreenshot,
};

