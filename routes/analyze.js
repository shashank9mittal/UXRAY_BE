const express = require("express");
const router = express.Router();

// Services
const browserService = require("../services/browserService");

// Helper function to send SSE data
const sendSSE = (res, event, data) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

// Analyze route with Server-Sent Events
router.post("/", async (req, res) => {
  let browser = null;

  // Handle client disconnect
  req.on("close", () => {
    console.log(`[ANALYZE] Client disconnected for URL: ${req.body?.url || "unknown"}`);
    // Clean up browser if client disconnects
    if (browser) {
      browserService.closeBrowser(browser).catch(() => {});
    }
    if (!res.destroyed) {
      res.end();
    }
  });

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: "URL is required",
        message: "Please provide a URL in the request body",
      });
    }

    console.log(`[ANALYZE] Received request for URL: ${url}`);

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Send initial connection event
    sendSSE(res, "connected", {
      message: "Connection established",
      timestamp: new Date().toISOString(),
    });

    // Launch browser and navigate to URL
    sendSSE(res, "status", {
      message: "Launching browser...",
      timestamp: new Date().toISOString(),
    });

    browser = await browserService.launchBrowser();
    
    sendSSE(res, "status", {
      message: "Navigating to URL...",
      timestamp: new Date().toISOString(),
    });

    const { page, loadTime, statusCode } = await browserService.navigateToUrl(browser, url);

    // Keep browser open for 5 seconds so user can see it
    sendSSE(res, "status", {
      message: "Browser opened - keeping open for 5 seconds...",
      timestamp: new Date().toISOString(),
    });
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Close the page
    await page.close();
    
    // Close the browser
    await browserService.closeBrowser(browser);
    browser = null;

    // Send the analysis result
    const response = {
      message: "Analysis completed successfully",
      url: url,
      status: "success",
      loadTime: loadTime,
      statusCode: statusCode,
      timestamp: new Date().toISOString(),
    };

    console.log(`[ANALYZE] Analysis completed for: ${url}`);
    sendSSE(res, "analysis", response);

    // Send completion event
    sendSSE(res, "complete", {
      message: "Analysis stream completed",
      timestamp: new Date().toISOString(),
    });

    // Send end event to signal stream is ending
    sendSSE(res, "end", {
      message: "Stream ended",
      timestamp: new Date().toISOString(),
    });

    // Close the connection
    console.log(`[ANALYZE] Stream ended for: ${url}`);
    res.end();
  } catch (error) {
    console.error(`[ANALYZE] Error occurred: ${error.message}`);

    // Clean up browser if it was opened
    if (browser) {
      await browserService.closeBrowser(browser).catch(() => {
        console.log("[ANALYZE] Browser closed after error");
      });
      browser = null;
    }

    // If headers haven't been sent, send regular error response
    if (!res.headersSent) {
      return res.status(500).json({
        error: "Internal server error",
        message: error.message,
      });
    }

    // Otherwise, send error as SSE event
    sendSSE(res, "error", {
      error: "Internal server error",
      message: error.message,
      timestamp: new Date().toISOString(),
    });

    // Send end event even on error
    sendSSE(res, "end", {
      message: "Stream ended due to error",
      timestamp: new Date().toISOString(),
    });

    res.end();
  }
});

module.exports = router;
