/**
 * Mock AI service that returns mock analysis data
 * This will be replaced with actual AI integration later
 * @param {string} url - URL that was analyzed
 * @param {string} screenshotBase64 - Base64 encoded screenshot
 * @param {Array} navigationElements - Array of navigation elements
 * @returns {Promise<Object>} Mock AI analysis results
 */
async function analyzeWithAI(url, screenshotBase64, navigationElements) {
  console.log("[AI] Running mock AI analysis...");

  // Simulate AI processing delay
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

