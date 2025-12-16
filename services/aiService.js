const visionAIService = require("./visionAIService");

/**
 * B4.2: AI service that uses live Vision AI or falls back to mock
 * @param {string} url - URL that was analyzed
 * @param {string} screenshotBase64 - Base64 encoded screenshot
 * @param {Array} navigationElements - Array of navigation elements
 * @param {number} imageWidth - Screenshot width
 * @param {number} imageHeight - Screenshot height
 * @returns {Promise<Object>} AI analysis results
 */
async function analyzeWithAI(url, screenshotBase64, navigationElements, imageWidth, imageHeight) {
  // B4.2: Use live Vision AI if API key is available, otherwise fall back to mock
  const useLiveAI = !!process.env.OPENAI_API_KEY;

  if (useLiveAI) {
    console.log("[AI] B4.2: Using live Vision AI analysis...");
    try {
      const visionResult = await visionAIService.analyzeWithVisionAI(
        screenshotBase64,
        imageWidth,
        imageHeight
      );

      // Transform vision AI response to match expected format
      return {
        coordinates: visionResult.report.map((issue) => ({
          x: issue.coordinates.x,
          y: issue.coordinates.y,
          width: issue.coordinates.width,
          height: issue.coordinates.height,
          label: issue.message,
          confidence: issue.severity === "critical" ? 0.95 : issue.severity === "warning" ? 0.8 : 0.6,
        })),
        report: visionResult.report,
        timestamp: visionResult.timestamp,
        model: visionResult.model,
      };
    } catch (error) {
      console.error("[AI] Vision AI failed, falling back to mock:", error.message);
      // Fall through to mock data
    }
  }

  // Fallback to mock data
  console.log("[AI] Using mock AI analysis (no OPENAI_API_KEY or Vision AI failed)...");
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Mock coordinates (representing detected UI elements or regions of interest)
  const mockCoordinates = [
    {
      x: 100,
      y: 150,
      width: 200,
      height: 50,
      label: "Header Section",
      confidence: 0.95,
    },
    {
      x: 50,
      y: 300,
      width: 300,
      height: 100,
      label: "Main Content Area",
      confidence: 0.88,
    },
    {
      x: 400,
      y: 100,
      width: 150,
      height: 400,
      label: "Sidebar",
      confidence: 0.82,
    },
  ];

  // Mock report array (representing AI-generated insights with coordinates and IDs)
  const mockReport = [
    {
      id: 1,
      type: "accessibility",
      severity: "warning",
      message: "Some images are missing alt text",
      element: "img",
      recommendation: "Add descriptive alt attributes to all images",
      coordinates: {
        x: 100,
        y: 150,
        width: 200,
        height: 50,
      },
    },
    {
      id: 2,
      type: "performance",
      severity: "info",
      message: "Page load time is acceptable",
      metric: "loadTime",
      value: "2.3s",
      coordinates: {
        x: 50,
        y: 300,
        width: 300,
        height: 100,
      },
    },
    {
      id: 3,
      type: "ux",
      severity: "suggestion",
      message: "Consider adding more visual hierarchy",
      area: "main-content",
      recommendation: "Use larger headings and better spacing",
      coordinates: {
        x: 400,
        y: 100,
        width: 150,
        height: 400,
      },
    },
    {
      id: 4,
      type: "seo",
      severity: "warning",
      message: "Meta description could be improved",
      element: "meta",
      recommendation: "Add a more descriptive meta description",
      coordinates: {
        x: 200,
        y: 50,
        width: 400,
        height: 30,
      },
    },
  ];

  console.log("[AI] Mock AI analysis completed");

  return {
    coordinates: mockCoordinates,
    report: mockReport,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  analyzeWithAI,
};

