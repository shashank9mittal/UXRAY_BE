/**
 * Collects performance metrics from the page
 * @param {Page} page - Playwright page instance
 * @returns {Promise<Object>} Performance metrics
 */
async function getPerformanceMetrics(page) {
  console.log("[PERFORMANCE] Collecting performance metrics...");
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
      firstContentfulPaint:
        paint.find((p) => p.name === "first-contentful-paint")?.startTime || null,
    };
  });
  console.log("[PERFORMANCE] Performance metrics collected");
  return performanceMetrics;
}

module.exports = {
  getPerformanceMetrics,
};

