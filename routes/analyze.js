const express = require("express");
const router = express.Router();

// Services
const browserService = require("../services/browserService");
const navigationService = require("../services/navigationService");
const actionSuggestionService = require("../services/actionSuggestionService");

// Utils
const { validateUrl } = require("../utils/urlValidator");
const { handleError } = require("../utils/errorHandler");

// Actionable elements route (GET) - Must be before POST route to avoid 404
router.get("/actionable-elements", async (req, res) => {
  let browser = null;
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        error: "Missing URL parameter",
        message: "Please provide a URL query parameter",
      });
    }

    console.log(`[ACTIONABLE] Received request for URL: ${url}`);

    // Validate URL
    const validation = validateUrl(url);
    if (!validation.isValid) {
      return res.status(validation.error.status).json({
        error: validation.error.message,
        message: validation.error.details,
      });
    }

    // Launch browser and navigate
    browser = await browserService.launchBrowser();
    const { page } = await browserService.navigateToUrl(browser, url);

    // Get actionable elements
    const actionableElements = await navigationService.getAllActionableElements(page);
    const sheetsData = await navigationService.exportActionableElementsToSheets(actionableElements);

    // Close browser
    await browserService.closeBrowser(browser);
    browser = null;

    res.json({
      message: "Actionable elements extracted successfully",
      url: url,
      status: "success",
      count: actionableElements.length,
      elements: actionableElements,
      sheetsExport: sheetsData, // Ready for export to Google Sheets, CSV, etc.
    });
  } catch (error) {
    console.error(`[ACTIONABLE] Error occurred: ${error.message}`);

    if (browser) {
      await browserService.closeBrowser(browser).catch(() => {});
    }

    const errorResponse = handleError(error);
    res.status(errorResponse.status).json({
      error: errorResponse.error,
      message: errorResponse.message,
    });
  }
});

// Analyze route (POST) - Simplified to only detect actionable elements
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
    const { page } = await browserService.navigateToUrl(browser, url);

    // Get actionable elements with all filtering applied
    const actionableElements = await navigationService.getAllActionableElements(page);
    
    // Get action suggestions from AI (enriches elements with context and suggestions)
    const actionableElementsWithSuggestions = await actionSuggestionService.getActionSuggestions(
      page,
      actionableElements
    );
    
    const sheetsData = await navigationService.exportActionableElementsToSheets(
      actionableElementsWithSuggestions
    );

    // Close browser
    await browserService.closeBrowser(browser);
    browser = null;

    // Return simple response with actionable elements (now includes action suggestions)
    const analysisResult = {
      message: "Actionable elements extracted successfully",
      url: url,
      status: "success",
      count: actionableElementsWithSuggestions.length,
      elements: actionableElementsWithSuggestions, // Now includes actionSuggestion and context
      sheetsExport: sheetsData,
    };

    console.log(`[ANALYZE] Found ${actionableElementsWithSuggestions.length} actionable elements with AI suggestions for: ${url}`);
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
