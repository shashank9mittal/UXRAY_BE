const express = require("express");
const router = express.Router();

// Services
const browserService = require("../services/browserService");
const screenshotService = require("../services/screenshotService");
const interactiveDNAService = require("../services/interactiveDNAService");

// Simple GET endpoint to analyze URL and return screenshot
router.get("/", async (req, res) => {
  let browser = null;

  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        error: "URL is required",
        message: "Please provide a URL as a query parameter (e.g., /analyze?url=https://example.com)",
      });
    }

    console.log(`[ANALYZE] Received request for URL: ${url}`);

    // Launch browser
    browser = await browserService.launchBrowser();

    // Navigate to URL
    const { page, loadTime, statusCode } = await browserService.navigateToUrl(browser, url);

    // Extract Interactive DNA (all interactive elements)
    const interactiveDNA = await interactiveDNAService.extractInteractiveDNA(page);

    // Capture screenshot
    const screenshot = await screenshotService.captureScreenshot(page, url);

    // Close the page
    await page.close();

    // Close the browser
    await browserService.closeBrowser(browser);
    browser = null;

    // Send response with screenshot and interactive DNA
    const response = {
      message: "Analysis completed successfully",
      url: url,
      status: "success",
      loadTime: loadTime,
      statusCode: statusCode,
      screenshot: {
        filename: screenshot.filename,
        base64: screenshot.base64,
        width: screenshot.width,
        height: screenshot.height,
      },
      interactiveDNA: interactiveDNA,
      elementCount: interactiveDNA.length,
      timestamp: new Date().toISOString(),
    };

    console.log(`[ANALYZE] Analysis completed for: ${url}`);
    res.json(response);
  } catch (error) {
    console.error(`[ANALYZE] Error occurred: ${error.message}`);
    console.error(error.stack);

    // Clean up browser if it was opened
    if (browser) {
      await browserService.closeBrowser(browser).catch(() => {
        console.log("[ANALYZE] Browser closed after error");
      });
      browser = null;
    }

    // Send error response
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

module.exports = router;
