const express = require("express");
const router = express.Router();

// Root route
router.get("/", (req, res) => {
  res.json({ message: "UXRay Backend API is running" });
});

module.exports = router;



