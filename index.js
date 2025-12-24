// Load environment variables from .env file
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json());

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
