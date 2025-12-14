/**
 * Captures a full-page screenshot of the current page
 * @param {Page} page - Playwright page instance
 * @returns {Promise<string>} Base64 encoded screenshot
 */
async function captureScreenshot(page) {
  console.log("[SCREENSHOT] Capturing screenshot...");
  const screenshotBuffer = await page.screenshot({ fullPage: true });
  const screenshotBase64 = screenshotBuffer.toString("base64");
  console.log("[SCREENSHOT] Screenshot captured");
  return `data:image/png;base64,${screenshotBase64}`;
}

module.exports = {
  captureScreenshot,
};

