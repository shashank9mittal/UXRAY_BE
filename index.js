// Load environment variables from .env file
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json({ limit: "50mb" })); // Increase JSON payload limit
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static screenshots with proper headers
app.use(
  "/screenshots",
  express.static(path.join(__dirname, "screenshots"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".png")) {
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "public, max-age=3600");
      }
    },
  })
);

// Routes
const indexRoutes = require("./routes/index");
const analyzeRoutes = require("./routes/analyze");

app.use("/", indexRoutes);
app.use("/analyze", analyzeRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
