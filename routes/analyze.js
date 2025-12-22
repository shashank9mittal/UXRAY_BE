const express = require("express");
const router = express.Router();

// Services
const browserService = require("../services/browserService");
const navigationService = require("../services/navigationService");
const actionSuggestionService = require("../services/actionSuggestionService");

// Utils
const { validateUrl } = require("../utils/urlValidator");
const { handleError } = require("../utils/errorHandler");
const { setupSSE, sendProgress, sendError, sendComplete, sendSSEEvent } = require("../utils/sseHelper");

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

// Analyze route (POST) - Simplified to only detect actionable elements with SSE support
router.post("/", async (req, res) => {
  let browser = null;
  // Check if client wants SSE streaming
  const useSSE = req.headers.accept?.includes('text/event-stream') || req.query.stream === 'true';
  
  try {
    const { url } = req.body;

    console.log(`[ANALYZE] Received request for URL: ${url} (SSE: ${useSSE})`);

    // Validate URL
    const validation = validateUrl(url);
    if (!validation.isValid) {
      console.log(`[ANALYZE] Validation failed: ${validation.error.message}`);
      if (useSSE) {
        sendError(res, validation.error);
        return;
      }
      return res.status(validation.error.status).json({
        error: validation.error.message,
        message: validation.error.details,
      });
    }

    // Set up SSE if requested
    if (useSSE) {
      setupSSE(res);
      sendProgress(res, 'initializing', 0, 'Starting analysis...', { url });
    }

    // Launch browser and navigate
    if (useSSE) {
      sendProgress(res, 'browser', 10, 'Launching browser...');
    }
    browser = await browserService.launchBrowser();
    
    if (useSSE) {
      sendProgress(res, 'navigation', 20, 'Navigating to page...');
    }
    const { page } = await browserService.navigateToUrl(browser, url);

    // Get actionable elements with all filtering applied
    if (useSSE) {
      sendProgress(res, 'detection', 30, 'Detecting actionable elements...');
    }
    const actionableElements = await navigationService.getAllActionableElements(page);
    
    if (useSSE) {
      sendProgress(res, 'detection', 50, `Found ${actionableElements.length} actionable elements`, {
        count: actionableElements.length,
      });
    }
    
    // Get action suggestions from AI (enriches elements with context and suggestions)
    if (useSSE) {
      sendProgress(res, 'context', 55, 'Enriching elements with context...');
    }
    
    // Stream AI suggestions as they're processed
    const actionableElementsWithSuggestions = await actionSuggestionService.getActionSuggestions(
      page,
      actionableElements,
      useSSE ? (progress, message, metadata) => {
        sendProgress(res, 'ai_suggestions', progress, message, metadata);
      } : null
    );
    
    if (useSSE) {
      sendProgress(res, 'export', 90, 'Preparing export data...');
    }
    
    const sheetsData = await navigationService.exportActionableElementsToSheets(
      actionableElementsWithSuggestions
    );

    // Close browser
    if (useSSE) {
      sendProgress(res, 'cleanup', 95, 'Cleaning up...');
    }
    await browserService.closeBrowser(browser);
    browser = null;

    // Return response
    const analysisResult = {
      message: "Actionable elements extracted successfully",
      url: url,
      status: "success",
      count: actionableElementsWithSuggestions.length,
      elements: actionableElementsWithSuggestions, // Now includes actionSuggestion and context
      sheetsExport: sheetsData,
    };

    console.log(`[ANALYZE] Found ${actionableElementsWithSuggestions.length} actionable elements with AI suggestions for: ${url}`);
    
    if (useSSE) {
      // Stream elements in chunks for better UX
      sendProgress(res, 'streaming', 98, 'Streaming results...', {
        totalElements: actionableElementsWithSuggestions.length,
      });
      
      // Send elements in chunks of 20
      const chunkSize = 20;
      for (let i = 0; i < actionableElementsWithSuggestions.length; i += chunkSize) {
        const chunk = actionableElementsWithSuggestions.slice(i, i + chunkSize);
        sendSSEEvent(res, 'elements_chunk', {
          chunk,
          index: i,
          total: actionableElementsWithSuggestions.length,
        });
      }
      
      // Send final completion
      sendComplete(res, {
        message: "Analysis completed successfully",
        url: url,
        status: "success",
        count: actionableElementsWithSuggestions.length,
        sheetsExport: sheetsData,
      });
    } else {
      res.json(analysisResult);
    }
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
    
    if (useSSE) {
      sendError(res, errorResponse);
    } else {
      res.status(errorResponse.status).json({
        error: errorResponse.error,
        message: errorResponse.message,
        ...(errorResponse.details && { details: errorResponse.details }),
      });
    }
  }
});

module.exports = router;
