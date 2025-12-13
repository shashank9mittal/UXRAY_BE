const express = require("express");
const { chromium } = require("playwright");
const router = express.Router();

// Analyze route
router.post("/", async (req, res) => {
  let browser = null;
  try {
    const { url } = req.body;

    console.log(`[ANALYZE] Received request for URL: ${url}`);

    // Validate URL is provided
    if (!url) {
      console.log("[ANALYZE] Error: URL is missing");
      return res.status(400).json({
        error: "URL is required",
        message: "Please provide a URL in the request body",
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      console.log(`[ANALYZE] Error: Invalid URL format - ${url}`);
      return res.status(400).json({
        error: "Invalid URL format",
        message: "Please provide a valid URL",
      });
    }

    console.log("[ANALYZE] Launching headless browser...");
    // Launch headless browser
    browser = await chromium.launch({
      headless: true,
    });
    console.log("[ANALYZE] Browser launched successfully");

    // Create a new page
    const page = await browser.newPage();
    console.log("[ANALYZE] New page created");

    // Navigate to the URL and wait for network to be idle
    console.log(`[ANALYZE] Navigating to: ${url}`);
    const startTime = Date.now();
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000, // 30 second timeout
    });
    const loadTime = Date.now() - startTime;
    console.log(`[ANALYZE] Page loaded in ${loadTime}ms`);

    // Get page title for verification
    const pageTitle = await page.title();
    console.log(`[ANALYZE] Page title: ${pageTitle}`);

    // Capture screenshot
    console.log("[ANALYZE] Capturing screenshot...");
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    const screenshotBase64 = screenshotBuffer.toString("base64");
    console.log("[ANALYZE] Screenshot captured");

    // Get performance metrics
    console.log("[ANALYZE] Collecting performance metrics...");
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const paint = performance.getEntriesByType("paint");
      return {
        domContentLoaded: navigation
          ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart
          : null,
        loadComplete: navigation
          ? navigation.loadEventEnd - navigation.loadEventStart
          : null,
        firstPaint: paint.find((p) => p.name === "first-paint")?.startTime || null,
        firstContentfulPaint: paint.find((p) => p.name === "first-contentful-paint")
          ?.startTime || null,
      };
    });
    console.log("[ANALYZE] Performance metrics collected");

    // Get page dimensions
    const viewportSize = page.viewportSize();
    const pageDimensions = await page.evaluate(() => {
      return {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });

    // Basic accessibility checks
    console.log("[ANALYZE] Running accessibility checks...");
    const accessibilityData = await page.evaluate(() => {
      const images = document.querySelectorAll("img");
      const links = document.querySelectorAll("a");
      const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
      const buttons = document.querySelectorAll("button");
      const inputs = document.querySelectorAll("input, textarea, select");

      let imagesWithoutAlt = 0;
      let linksWithoutText = 0;
      let buttonsWithoutText = 0;

      images.forEach((img) => {
        if (!img.alt && !img.getAttribute("aria-label")) {
          imagesWithoutAlt++;
        }
      });

      links.forEach((link) => {
        const text = link.textContent?.trim();
        const ariaLabel = link.getAttribute("aria-label");
        if (!text && !ariaLabel && !link.querySelector("img")) {
          linksWithoutText++;
        }
      });

      buttons.forEach((button) => {
        const text = button.textContent?.trim();
        const ariaLabel = button.getAttribute("aria-label");
        const ariaLabelledBy = button.getAttribute("aria-labelledby");
        if (!text && !ariaLabel && !ariaLabelledBy) {
          buttonsWithoutText++;
        }
      });

      return {
        totalImages: images.length,
        imagesWithoutAlt,
        totalLinks: links.length,
        linksWithoutText,
        totalHeadings: headings.length,
        totalButtons: buttons.length,
        buttonsWithoutText,
        totalInputs: inputs.length,
        hasH1: document.querySelector("h1") !== null,
      };
    });
    console.log("[ANALYZE] Accessibility checks completed");

    // Get meta information
    const metaInfo = await page.evaluate(() => {
      const getMeta = (name) => {
        const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        return meta ? meta.getAttribute("content") : null;
      };

      return {
        description: getMeta("description") || getMeta("og:description"),
        keywords: getMeta("keywords"),
        author: getMeta("author"),
        viewport: getMeta("viewport"),
      };
    });

    // Close the browser
    console.log("[ANALYZE] Closing browser...");
    await browser.close();
    console.log("[ANALYZE] Browser closed successfully");

    const analysisResult = {
      message: "Analysis completed successfully",
      url: url,
      status: "success",
      pageInfo: {
        title: pageTitle,
        loadTime: loadTime,
        viewport: {
          width: viewportSize?.width || null,
          height: viewportSize?.height || null,
        },
        dimensions: pageDimensions,
      },
      performance: performanceMetrics,
      accessibility: accessibilityData,
      meta: metaInfo,
      screenshot: `data:image/png;base64,${screenshotBase64}`,
    };

    console.log(`[ANALYZE] Analysis completed for: ${url}`);
    res.json(analysisResult);
  } catch (error) {
    console.error(`[ANALYZE] Error occurred: ${error.message}`);
    // Ensure browser is closed even if there's an error
    if (browser) {
      await browser.close().catch(() => {
        console.log("[ANALYZE] Browser closed after error");
      });
    }

    // Handle specific Playwright errors
    if (error.message.includes("net::ERR")) {
      return res.status(400).json({
        error: "Failed to load URL",
        message: "Unable to reach the provided URL. Please check if the URL is accessible.",
        details: error.message,
      });
    }

    if (error.message.includes("timeout")) {
      return res.status(408).json({
        error: "Request timeout",
        message: "The page took too long to load. Please try again or check the URL.",
        details: error.message,
      });
    }

    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

module.exports = router;

