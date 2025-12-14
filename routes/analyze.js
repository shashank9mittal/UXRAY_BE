const express = require("express");
const router = express.Router();

// Services
const browserService = require("../services/browserService");
const screenshotService = require("../services/screenshotService");
const performanceService = require("../services/performanceService");
const accessibilityService = require("../services/accessibilityService");
const metaService = require("../services/metaService");
const pageInfoService = require("../services/pageInfoService");

// Utils
const { validateUrl } = require("../utils/urlValidator");
const { handleError } = require("../utils/errorHandler");

// Analyze route
router.post("/", async (req, res) => {
  let browser = null;
  try {
    const { url } = req.body;

    console.log(`[ANALYZE] Received request for URL: ${url}`);

    // Validate URL
    const validation = validateUrl(url);
    if (!validation.isValid) {
      console.log(`[ANALYZE] Validation failed: ${validation.error.message}`);
      return res.status(validation.error.status).json({
        error: validation.error.message,
        message: validation.error.details,
      });
    }

    // Launch browser and navigate
    browser = await browserService.launchBrowser();
    const { page, loadTime } = await browserService.navigateToUrl(browser, url);

    // Collect all analysis data in parallel where possible
    const [pageInfo, screenshot, performanceMetrics, accessibilityData, metaInfo] =
      await Promise.all([
        pageInfoService.getPageInfo(page),
        screenshotService.captureScreenshot(page),
        performanceService.getPerformanceMetrics(page),
        accessibilityService.checkAccessibility(page),
        metaService.getMetaInfo(page),
      ]);

    // Close browser
    await browserService.closeBrowser(browser);
    browser = null;

    // Build response
    const analysisResult = {
      message: "Analysis completed successfully",
      url: url,
      status: "success",
      pageInfo: {
        ...pageInfo,
        loadTime: loadTime,
      },
      performance: performanceMetrics,
      accessibility: accessibilityData,
      meta: metaInfo,
      screenshot: screenshot,
    };

    console.log(`[ANALYZE] Analysis completed for: ${url}`);
    res.json(analysisResult);
  } catch (error) {
    console.error(`[ANALYZE] Error occurred: ${error.message}`);

    // Ensure browser is closed even if there's an error
    if (browser) {
      await browserService.closeBrowser(browser).catch(() => {
        console.log("[ANALYZE] Browser closed after error");
      });
    }

    // Handle error
    const errorResponse = handleError(error);
    res.status(errorResponse.status).json({
      error: errorResponse.error,
      message: errorResponse.message,
      ...(errorResponse.details && { details: errorResponse.details }),
    });
  }
});

module.exports = router;
