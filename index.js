// Load environment variables from .env file
require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const { WebSocketServer } = require("ws");
const SessionManager = require("./services/sessionManagerService");
const url = require("url");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json());

// Routes
const indexRoutes = require("./routes/index");
const analyzeRoutes = require("./routes/analyze");
const sessionRoutes = require("./routes/session");

app.use("/", indexRoutes);
app.use("/analyze", analyzeRoutes);
app.use("/session", sessionRoutes);

// Debug route for testing captureState
app.get("/debug/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: "userId is required",
        message: "Please provide a userId in the URL path (e.g., /debug/user1)",
      });
    }

    console.log(`[DEBUG] Capturing state for user: ${userId}`);

    // Call captureState
    const result = await SessionManager.captureState(userId);

    // Set Content-Type and return JSON response
    res.setHeader("Content-Type", "application/json");
    res.json(result);
  } catch (error) {
    console.error(`[DEBUG] Error capturing state:`, error.message);

    // Handle "Session not found" or "Page not found" errors with 404
    if (error.message.includes("not found")) {
      return res.status(404).json({
        error: "Session not found",
        message: error.message,
      });
    }

    // Other errors return 500
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Create HTTP server
const server = http.createServer(app);

// Attach WebSocket server to HTTP server
const wss = new WebSocketServer({ server });

// WebSocket connection handling
wss.on("connection", async (ws, request) => {
  try {
    // Parse URL to extract userId query parameter
    const parsedUrl = url.parse(request.url, true);
    const userId = parsedUrl.query?.userId;

    // Handle missing userId
    if (!userId) {
      console.log("[WEBSOCKET] Connection rejected: missing userId");
      ws.close(1008, "Missing userId parameter");
      return;
    }

    console.log(`[WEBSOCKET] New connection: ${userId}`);

    // Store WebSocket connection in session (now async - creates browser if needed)
    await SessionManager.setSocket(userId, ws);

    // Temporary: Send test message for frontend testing
    ws.send(JSON.stringify({ type: 'HELLO', payload: 'World' }));

    // Handle socket disconnection
    ws.on("close", () => {
      console.log(`[WEBSOCKET] Connection closed: ${userId}`);
    });

    // Handle socket errors
    ws.on("error", (error) => {
      console.error(`[WEBSOCKET] Error for user ${userId}:`, error.message);
    });
  } catch (error) {
    console.error("[WEBSOCKET] Error handling connection:", error.message);
    ws.close(1011, "Internal server error");
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server is ready for connections`);
});

module.exports = app;
