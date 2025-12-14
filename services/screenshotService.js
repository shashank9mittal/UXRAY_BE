const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

/**
 * Ensures the screenshots directory exists
 */
async function ensureScreenshotsDir() {
  const screenshotsDir = path.join(__dirname, "../screenshots");
  try {
    await fs.access(screenshotsDir);
  } catch {
    await fs.mkdir(screenshotsDir, { recursive: true });
    console.log("[SCREENSHOT] Created screenshots directory");
  }
}

/**
 * Captures a full-page screenshot and saves it to disk
 * @param {Page} page - Playwright page instance
 * @param {string} url - URL of the page (for generating filename)
 * @returns {Promise<{base64: string, filename: string, url: string}>} Screenshot data
 */
async function captureScreenshot(page, url) {
  console.log("[SCREENSHOT] Capturing screenshot...");
  
  // Ensure directory exists
  await ensureScreenshotsDir();
  
  const screenshotBuffer = await page.screenshot({ fullPage: true });
  
  // Verify buffer is not empty
  if (!screenshotBuffer || screenshotBuffer.length === 0) {
    throw new Error("Screenshot buffer is empty");
  }
  
  const screenshotBase64 = screenshotBuffer.toString("base64");

  // Generate unique filename
  const urlHash = crypto.createHash("md5").update(url).digest("hex").substring(0, 8);
  const timestamp = Date.now();
  const filename = `screenshot_${urlHash}_${timestamp}.png`;
  const filepath = path.join(__dirname, "../screenshots", filename);

  // Save to disk
  await fs.writeFile(filepath, screenshotBuffer);
  console.log(`[SCREENSHOT] Screenshot saved: ${filename} (${(screenshotBuffer.length / 1024).toFixed(2)} KB)`);

  // Return relative URL - frontend should prepend backend URL
  return {
    buffer: screenshotBuffer, // Keep buffer for annotation
    base64: screenshotBase64,
    filename: filename,
    url: `/screenshots/${filename}`, // Relative path - use with backend base URL
  };
}

module.exports = {
  captureScreenshot,
};

