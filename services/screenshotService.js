const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

/**
 * Captures a full-page screenshot and saves it to disk
 * @param {Page} page - Playwright page instance
 * @param {string} url - URL of the page (for generating filename)
 * @returns {Promise<{base64: string, filename: string, url: string}>} Screenshot data
 */
async function captureScreenshot(page, url) {
  console.log("[SCREENSHOT] Capturing screenshot...");
  const screenshotBuffer = await page.screenshot({ fullPage: true });
  const screenshotBase64 = screenshotBuffer.toString("base64");

  // Generate unique filename
  const urlHash = crypto.createHash("md5").update(url).digest("hex").substring(0, 8);
  const timestamp = Date.now();
  const filename = `screenshot_${urlHash}_${timestamp}.png`;
  const filepath = path.join(__dirname, "../screenshots", filename);

  // Save to disk
  await fs.writeFile(filepath, screenshotBuffer);
  console.log(`[SCREENSHOT] Screenshot saved to: ${filename}`);

  // Return relative URL - frontend should prepend backend URL
  return {
    base64: screenshotBase64,
    filename: filename,
    url: `/screenshots/${filename}`, // Relative path - use with backend base URL
  };
}

module.exports = {
  captureScreenshot,
};

