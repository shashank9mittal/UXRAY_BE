const actionableElementsService = require('./actionableElementsService');

/**
 * Extracts navigation elements (links and buttons) with their bounding boxes
 * Enhanced version that uses comprehensive actionable elements detection
 * @param {Page} page - Playwright page instance
 * @returns {Promise<Array>} Array of navigation elements with text, bounding box, and URL
 */
async function getNavigationElements(page) {
  console.log("[NAVIGATION] Extracting navigation elements...");

  // Use the comprehensive actionable elements service
  const actionableElements = await actionableElementsService.getActionableElements(page, {
    filterByVisibility: true,
    filterBySemanticValue: true,
    filterByLocation: true,
    viewportPriority: true,
  });

  // Transform to the expected format for backward compatibility
  const navigationElements = actionableElements
    .filter(el => el.category === 'link' || el.category === 'button')
    .map(element => ({
      type: element.tagName,
      text: element.text || element.ariaLabel || '',
      url: element.href || null,
      boundingBox: element.boundingBox || {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
      // Additional metadata
      category: element.category,
      ariaLabel: element.ariaLabel,
      locationScore: element.locationScore,
    }));

  console.log(`[NAVIGATION] Found ${navigationElements.length} navigation elements`);
  return navigationElements;
}

/**
 * Get all actionable elements (comprehensive)
 * @param {Page} page - Playwright page instance
 * @returns {Promise<Array>} All actionable elements with full metadata
 */
async function getAllActionableElements(page) {
  return await actionableElementsService.getActionableElements(page);
}

/**
 * Export actionable elements to sheets format
 * @param {Array} elements - Array of actionable elements
 * @returns {Array} Structured data ready for export
 */
function exportActionableElementsToSheets(elements) {
  return actionableElementsService.exportToSheets(elements);
}

module.exports = {
  getNavigationElements,
  getAllActionableElements,
  exportActionableElementsToSheets,
};



