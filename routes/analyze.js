const express = require("express");
const router = express.Router();

// Analyze route
router.post("/", (req, res) => {
  try {
    const { url } = req.body;

    // Validate URL is provided
    if (!url) {
      return res.status(400).json({
        error: "URL is required",
        message: "Please provide a URL in the request body",
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        error: "Invalid URL format",
        message: "Please provide a valid URL",
      });
    }

    // TODO: Add analysis logic here
    res.json({
      message: "Analysis request received",
      url: url,
    });
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

module.exports = router;

