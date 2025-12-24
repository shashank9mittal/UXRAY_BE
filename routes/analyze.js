const express = require("express");
const router = express.Router();

// Analyze route
router.post("/", (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: "URL is required",
        message: "Please provide a URL in the request body",
      });
    }

    console.log(`[ANALYZE] Received request for URL: ${url}`);

    // Return the URL
    const response = {
      message: "Analysis completed successfully",
      url: url,
      status: "success",
    };

    console.log(`[ANALYZE] Analysis completed for: ${url}`);
    res.json(response);
  } catch (error) {
    console.error(`[ANALYZE] Error occurred: ${error.message}`);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

module.exports = router;
