const express = require("express");
const router = express.Router();
const SessionManager = require("../services/sessionManagerService");
const { validateUrl } = require("../utils/urlValidator");

/**
 * POST /session/start
 * Creates a new session for a user and launches a browser instance
 * Optionally navigates to a URL if provided
 */
router.post("/start", async (req, res) => {
  try {
    const { userId, url } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: "userId is required",
        message: "Please provide a userId in the request body",
      });
    }

    // Validate URL if provided
    if (url) {
      const urlValidation = validateUrl(url);
      if (!urlValidation.isValid) {
        return res.status(urlValidation.error.status).json({
          error: urlValidation.error.message,
          message: urlValidation.error.details,
        });
      }
    }

    console.log(`[SESSION] Starting session for user: ${userId}${url ? ` with URL: ${url}` : ""}`);

    // Check if session already exists
    const existingSession = SessionManager.getSession(userId);
    if (existingSession) {
      console.log(`[SESSION] Session already exists for user: ${userId}`);
      
      // If URL is provided and session exists, navigate to it
      if (url) {
        const navSuccess = await SessionManager.navigateToUrl(userId, url);
        if (!navSuccess) {
          return res.status(500).json({
            error: "Navigation error",
            message: `Failed to navigate to URL: ${url}`,
          });
        }
      }

      return res.json({
        status: "success",
        message: "Session already exists" + (url ? " and navigated to URL" : ""),
        userId: userId,
        url: url || null,
        session: {
          status: existingSession.status,
          createdAt: existingSession.createdAt,
        },
      });
    }

    // Create new session (this will launch a browser and navigate to URL if provided)
    const session = await SessionManager.createSession(userId, url);

    console.log(`[SESSION] Session created successfully for user: ${userId}${url ? ` and navigated to ${url}` : ""}`);

    // Return success response
    res.json({
      status: "success",
      message: "Session started successfully" + (url ? " and navigated to URL" : ""),
      userId: userId,
      url: url || null,
      session: {
        status: session.status,
        createdAt: session.createdAt,
      },
    });
  } catch (error) {
    console.error(`[SESSION] Error starting session:`, error.message);
    console.error(error.stack);

    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

module.exports = router;
