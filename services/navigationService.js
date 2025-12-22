/**
 * Extracts navigation elements (links and buttons) with their bounding boxes
 * @param {Page} page - Playwright page instance
 * @returns {Promise<Array>} Array of navigation elements with text, bounding box, and URL
 */
async function getNavigationElements(page) {
  console.log("[NAVIGATION] Extracting navigation elements...");

  const navigationElements = await page.$$eval("a, button", (elements) => {
    return elements.map((element) => {
      const rect = element.getBoundingClientRect();
      const tagName = element.tagName.toLowerCase();

      // Get text content
      let text = "";
      if (tagName === "a") {
        text = element.textContent?.trim() || element.getAttribute("aria-label") || "";
      } else if (tagName === "button") {
        text =
          element.textContent?.trim() ||
          element.getAttribute("aria-label") ||
          element.getAttribute("value") ||
          "";
      }

      // Get URL for links
      let url = null;
      if (tagName === "a") {
        url = element.href || element.getAttribute("href") || null;
      }

      return {
        type: tagName,
        text: text,
        url: url,
        boundingBox: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };
    });
  });

  console.log(`[NAVIGATION] Found ${navigationElements.length} navigation elements`);
  return navigationElements;
}

module.exports = {
  getNavigationElements,
};



