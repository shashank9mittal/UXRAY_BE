/**
 * Service to find and filter actionable DOM elements using Playwright
 * Finds buttons, links, input fields, and interactive areas with filtering
 */

/**
 * Gets all actionable elements from the page with comprehensive filtering
 * @param {Page} page - Playwright page instance
 * @param {Object} options - Filtering options
 * @returns {Promise<Array>} Array of actionable elements with metadata
 */
async function getActionableElements(page, options = {}) {
  const {
    filterByVisibility = true,
    filterBySemanticValue = true,
    filterByLocation = true,
    viewportPriority = true, // Prioritize elements in main viewport
  } = options;

  console.log("[ACTIONABLE] Extracting actionable elements from DOM...");

  // Get viewport dimensions for location filtering
  const viewport = page.viewportSize || { width: 1280, height: 720 };

  // 1. Find all actionable elements using Playwright locators
  const [
    buttons,
    links,
    inputFields,
    interactiveAreas,
  ] = await Promise.all([
    findButtons(page),
    findLinks(page),
    findInputFields(page),
    findInteractiveAreas(page),
  ]);

  // Combine all elements
  let allElements = [
    ...buttons.map(el => ({ ...el, category: 'button' })),
    ...links.map(el => ({ ...el, category: 'link' })),
    ...inputFields.map(el => ({ ...el, category: 'input' })),
    ...interactiveAreas.map(el => ({ ...el, category: 'interactive' })),
  ];

  console.log(`[ACTIONABLE] Found ${allElements.length} total actionable elements`);

  // 2. Apply filters
  if (filterByVisibility) {
    allElements = await filterElementsByVisibility(allElements, page);
    console.log(`[ACTIONABLE] After visibility filter: ${allElements.length} elements`);
  }

  if (filterBySemanticValue) {
    allElements = filterElementsBySemanticValue(allElements);
    console.log(`[ACTIONABLE] After semantic filter: ${allElements.length} elements`);
  }

  if (filterByLocation && viewportPriority) {
    allElements = prioritizeByLocation(allElements, viewport);
    console.log(`[ACTIONABLE] After location prioritization: ${allElements.length} elements`);
  }

  return allElements;
}

/**
 * Find all button elements
 */
async function findButtons(page) {
  const selectors = 'button, input[type="submit"], input[type="button"], input[type="reset"]';
  const locators = await page.locator(selectors).all();
  
  return await Promise.all(
    locators.map(async (locator) => {
      try {
        const element = await locator.elementHandle();
        if (!element) return null;

        const text = await getElementText(locator);
        const ariaLabel = await locator.getAttribute('aria-label');
        const tagName = await locator.evaluate(el => el.tagName.toLowerCase());
        const boundingBox = await locator.boundingBox();

        return {
          tagName,
          text: text || ariaLabel || '',
          ariaLabel: ariaLabel || null,
          boundingBox: boundingBox || null,
          selector: selectors,
          locator,
        };
      } catch (error) {
        console.warn(`[ACTIONABLE] Error processing button: ${error.message}`);
        return null;
      }
    })
  ).then(results => results.filter(Boolean));
}

/**
 * Find all link elements (excluding empty/placeholder hrefs)
 */
async function findLinks(page) {
  // Find links with valid hrefs (not empty, not just #)
  const selectors = 'a[href]:not([href=""]):not([href="#"]):not([href^="javascript:"])';
  const locators = await page.locator(selectors).all();
  
  return await Promise.all(
    locators.map(async (locator) => {
      try {
        const element = await locator.elementHandle();
        if (!element) return null;

        const text = await getElementText(locator);
        const ariaLabel = await locator.getAttribute('aria-label');
        const href = await locator.getAttribute('href');
        const tagName = await locator.evaluate(el => el.tagName.toLowerCase());
        const boundingBox = await locator.boundingBox();

        return {
          tagName,
          text: text || ariaLabel || '',
          ariaLabel: ariaLabel || null,
          href: href || null,
          boundingBox: boundingBox || null,
          selector: selectors,
          locator,
        };
      } catch (error) {
        console.warn(`[ACTIONABLE] Error processing link: ${error.message}`);
        return null;
      }
    })
  ).then(results => results.filter(Boolean));
}

/**
 * Find all input fields (excluding hidden inputs)
 */
async function findInputFields(page) {
  const selectors = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select';
  const locators = await page.locator(selectors).all();
  
  return await Promise.all(
    locators.map(async (locator) => {
      try {
        const element = await locator.elementHandle();
        if (!element) return null;

        const text = await getElementText(locator);
        const ariaLabel = await locator.getAttribute('aria-label');
        const placeholder = await locator.getAttribute('placeholder');
        const type = await locator.getAttribute('type') || 
                    await locator.evaluate(el => el.tagName.toLowerCase());
        const tagName = await locator.evaluate(el => el.tagName.toLowerCase());
        const boundingBox = await locator.boundingBox();

        return {
          tagName,
          type: type || tagName,
          text: text || placeholder || ariaLabel || '',
          ariaLabel: ariaLabel || null,
          placeholder: placeholder || null,
          boundingBox: boundingBox || null,
          selector: selectors,
          locator,
        };
      } catch (error) {
        console.warn(`[ACTIONABLE] Error processing input: ${error.message}`);
        return null;
      }
    })
  ).then(results => results.filter(Boolean));
}

/**
 * Find interactive areas (elements with click handlers, roles, etc.)
 */
async function findInteractiveAreas(page) {
  // Find elements with onclick, role="button", role="link", or tabindex
  const selectors = '*[onclick], *[role="button"], *[role="link"], *[tabindex]:not([tabindex="-1"])';
  const locators = await page.locator(selectors).all();
  
  return await Promise.all(
    locators.map(async (locator) => {
      try {
        const element = await locator.elementHandle();
        if (!element) return null;

        // Skip if it's already captured as button/link/input
        const tagName = await locator.evaluate(el => el.tagName.toLowerCase());
        if (['button', 'a', 'input', 'textarea', 'select'].includes(tagName)) {
          return null;
        }

        const text = await getElementText(locator);
        const ariaLabel = await locator.getAttribute('aria-label');
        const role = await locator.getAttribute('role');
        const tabIndex = await locator.getAttribute('tabindex');
        const boundingBox = await locator.boundingBox();

        return {
          tagName,
          text: text || ariaLabel || '',
          ariaLabel: ariaLabel || null,
          role: role || null,
          tabIndex: tabIndex || null,
          boundingBox: boundingBox || null,
          selector: selectors,
          locator,
        };
      } catch (error) {
        console.warn(`[ACTIONABLE] Error processing interactive area: ${error.message}`);
        return null;
      }
    })
  ).then(results => results.filter(Boolean));
}

/**
 * Get element text content (handles various cases)
 */
async function getElementText(locator) {
  try {
    // Try textContent first
    const text = await locator.textContent();
    if (text && text.trim()) return text.trim();

    // Try innerText
    const innerText = await locator.innerText();
    if (innerText && innerText.trim()) return innerText.trim();

    // Try value attribute for inputs
    const value = await locator.inputValue().catch(() => null);
    if (value && value.trim()) return value.trim();

    return '';
  } catch (error) {
    return '';
  }
}

/**
 * Filter elements by visibility
 */
async function filterElementsByVisibility(elements, page) {
  const visibleElements = [];

  for (const element of elements) {
    try {
      if (!element.locator) continue;

      const isVisible = await element.locator.isVisible().catch(() => false);
      
      if (isVisible) {
        // Additional check: ensure element has dimensions
        const box = element.boundingBox;
        if (box && box.width > 0 && box.height > 0) {
          visibleElements.push(element);
        }
      }
    } catch (error) {
      console.warn(`[ACTIONABLE] Visibility check failed: ${error.message}`);
    }
  }

  return visibleElements;
}

/**
 * Filter elements by semantic value (prioritize meaningful text)
 */
function filterElementsBySemanticValue(elements) {
  // Filter out elements with no meaningful text
  // Keep elements with:
  // - Non-empty text content
  // - aria-label
  // - placeholder (for inputs)
  // - href (for links)
  return elements.filter(element => {
    const hasText = element.text && element.text.trim().length > 0;
    const hasAriaLabel = element.ariaLabel && element.ariaLabel.trim().length > 0;
    const hasPlaceholder = element.placeholder && element.placeholder.trim().length > 0;
    const hasHref = element.href && element.href.trim().length > 0;
    const hasRole = element.role && element.role.trim().length > 0;

    return hasText || hasAriaLabel || hasPlaceholder || hasHref || hasRole;
  });
}

/**
 * Prioritize elements by location (viewport priority)
 */
function prioritizeByLocation(elements, viewport) {
  // Score elements based on their position
  // Higher score = more important (in viewport, above fold, etc.)
  const scoredElements = elements.map(element => {
    if (!element.boundingBox) {
      return { ...element, locationScore: 0 };
    }

    const { x, y, width, height } = element.boundingBox;
    let score = 0;

    // Check if element is in viewport
    const inViewport = 
      x >= 0 && 
      y >= 0 && 
      x + width <= viewport.width && 
      y + height <= viewport.height;

    if (inViewport) {
      score += 100; // Base score for being in viewport
      
      // Bonus for being above the fold (top 50% of viewport)
      if (y < viewport.height * 0.5) {
        score += 50;
      }

      // Bonus for being in center area (main content)
      const centerX = viewport.width / 2;
      const centerY = viewport.height / 2;
      const elementCenterX = x + width / 2;
      const elementCenterY = y + height / 2;
      
      const distanceFromCenter = Math.sqrt(
        Math.pow(elementCenterX - centerX, 2) + 
        Math.pow(elementCenterY - centerY, 2)
      );
      const maxDistance = Math.sqrt(
        Math.pow(viewport.width, 2) + 
        Math.pow(viewport.height, 2)
      );
      
      score += Math.round(50 * (1 - distanceFromCenter / maxDistance));
    } else {
      // Penalty for being off-screen
      score -= 50;
    }

    // Penalty for being in footer area (bottom 20% of page)
    // This is a heuristic - you might want to detect footer more intelligently
    if (y > viewport.height * 0.8) {
      score -= 20;
    }

    return { ...element, locationScore: score };
  });

  // Sort by location score (descending)
  return scoredElements.sort((a, b) => b.locationScore - a.locationScore);
}

/**
 * Export actionable elements to a structured format (for "sheets" export)
 * @param {Array} elements - Array of actionable elements
 * @returns {Array} Structured data ready for export
 */
function exportToSheets(elements) {
  return elements.map(element => ({
    category: element.category,
    tagName: element.tagName,
    type: element.type || null,
    text: element.text || '',
    ariaLabel: element.ariaLabel || null,
    placeholder: element.placeholder || null,
    href: element.href || null,
    role: element.role || null,
    tabIndex: element.tabIndex || null,
    location: {
      x: element.boundingBox?.x || 0,
      y: element.boundingBox?.y || 0,
      width: element.boundingBox?.width || 0,
      height: element.boundingBox?.height || 0,
    },
    locationScore: element.locationScore || 0,
    selector: element.selector || null,
    // Include action suggestion if available
    actionSuggestion: element.actionSuggestion || null,
    // Include context if available
    context: element.context || null,
  }));
}

module.exports = {
  getActionableElements,
  exportToSheets,
};

