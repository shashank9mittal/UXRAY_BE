const express = require("express");
const router = express.Router();

// Helper function to send SSE data
const sendSSE = (res, event, data) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

// Analyze route with Server-Sent Events
router.post("/", (req, res) => {
  // Handle client disconnect
  req.on("close", () => {
    console.log(`[ANALYZE] Client disconnected for URL: ${req.body?.url || "unknown"}`);
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

    // Send the analysis result
    const response = {
      message: "Analysis completed successfully",
      url: url,
      status: "success",
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
