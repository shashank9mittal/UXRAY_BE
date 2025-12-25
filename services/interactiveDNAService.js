/**
 * Service to extract Interactive DNA - all interactive elements from a webpage
 * Uses Playwright to find standard and non-standard interactive elements
 */

/**
 * Extract all interactive elements from a page
 * @param {Page} page - Playwright page object
 * @returns {Promise<Array>} Array of interactive element objects
 */
const extractInteractiveDNA = async (page) => {
  try {
    console.log("[INTERACTIVE_DNA] Starting extraction...");

    // Execute JavaScript in the browser context to find all interactive elements
    const interactiveElements = await page.evaluate(() => {
      const elements = [];

      /**
       * Check if element is visible
       */
      function isVisible(element) {
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0' &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.top < window.innerHeight &&
          rect.bottom > 0 &&
          rect.left < window.innerWidth &&
          rect.right > 0
        );
      }

      /**
       * Get element label with priority order
       */
      function getLabel(element) {
        // Priority 1: innerText (if not empty and meaningful)
        const innerText = element.innerText?.trim();
        if (innerText && innerText.length > 0 && innerText.length < 200) {
          return innerText;
        }

        // Priority 2: aria-label
        if (element.getAttribute('aria-label')) {
          return element.getAttribute('aria-label').trim();
        }

        // Priority 3: placeholder
        if (element.placeholder) {
          return element.placeholder.trim();
        }

        // Priority 4: alt text
        if (element.alt) {
          return element.alt.trim();
        }

        // Priority 5: title attribute
        if (element.title) {
          return element.title.trim();
        }

        // Priority 6: aria-labelledby
        if (element.getAttribute('aria-labelledby')) {
          const labelId = element.getAttribute('aria-labelledby');
          const labelElement = document.getElementById(labelId);
          if (labelElement) {
            return labelElement.innerText?.trim() || labelElement.textContent?.trim() || '';
          }
        }

        return '';
      }

      /**
       * Get element type
       */
      function getType(element) {
        const tagName = element.tagName.toLowerCase();
        
        // Standard interactive elements
        if (['a', 'button', 'input', 'select', 'textarea'].includes(tagName)) {
          if (tagName === 'input') {
            return element.type || 'input';
          }
          return tagName;
        }

        // Check for role attribute
        const role = element.getAttribute('role');
        if (role) {
          return role;
        }

        // Check for onclick or similar event handlers
        if (element.onclick || element.getAttribute('onclick')) {
          return 'clickable';
        }

        // Check for cursor pointer style
        const style = window.getComputedStyle(element);
        if (style.cursor === 'pointer' || style.cursor === 'hand') {
          return 'clickable';
        }

        // Check for tabindex (interactive)
        if (element.hasAttribute('tabindex') && element.tabIndex >= 0) {
          return 'interactive';
        }

        return tagName;
      }

      /**
       * Get coordinates relative to document
       */
      function getCoordinates(element) {
        const rect = element.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        return {
          x: Math.round(rect.left + scrollX),
          y: Math.round(rect.top + scrollY),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }

      /**
       * Recursively find elements in Shadow DOM
       */
      function findInShadowDOM(host, selector) {
        const results = [];
        
        if (host.shadowRoot) {
          const shadowElements = host.shadowRoot.querySelectorAll(selector);
          shadowElements.forEach(el => results.push(el));
          
          // Recursively check nested shadow roots
          shadowElements.forEach(el => {
            if (el.shadowRoot) {
              results.push(...findInShadowDOM(el, selector));
            }
          });
        }
        
        return results;
      }

      /**
       * Get all interactive elements including those in Shadow DOM
       */
      function getAllInteractiveElements() {
        const allElements = [];

        // Standard interactive element selectors
        const standardSelectors = [
          'a[href]',
          'button',
          'input',
          'select',
          'textarea',
          '[role="button"]',
          '[role="link"]',
          '[role="menuitem"]',
          '[role="option"]',
          '[role="tab"]',
          '[role="checkbox"]',
          '[role="radio"]',
          '[role="switch"]',
          '[onclick]',
          '[tabindex]:not([tabindex="-1"])',
        ];

        // Find all standard interactive elements
        standardSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            if (isVisible(el)) {
              allElements.push(el);
            }
          });
        });

        // Find elements with cursor: pointer style
        const allElementsWithPointer = document.querySelectorAll('*');
        allElementsWithPointer.forEach(el => {
          if (isVisible(el)) {
            const style = window.getComputedStyle(el);
            if ((style.cursor === 'pointer' || style.cursor === 'hand') && 
                !allElements.includes(el)) {
              allElements.push(el);
            }
          }
        });

        // Find elements in Shadow DOM
        const shadowHosts = document.querySelectorAll('*');
        shadowHosts.forEach(host => {
          if (host.shadowRoot) {
            standardSelectors.forEach(selector => {
              const shadowElements = findInShadowDOM(host, selector);
              shadowElements.forEach(el => {
                if (isVisible(el) && !allElements.includes(el)) {
                  allElements.push(el);
                }
              });
            });
          }
        });

        return allElements;
      }

      // Get all interactive elements
      const interactiveElements = getAllInteractiveElements();

      // Extract metadata for each element
      const result = [];
      const seenIds = new Set();

      interactiveElements.forEach((element, index) => {
        try {
          const coordinates = getCoordinates(element);
          const label = getLabel(element);
          const type = getType(element);

          // Create unique identifier
          const elementId = `${type}-${coordinates.x}-${coordinates.y}-${index}`;
          
          if (seenIds.has(elementId)) {
            return; // Skip duplicates
          }
          seenIds.add(elementId);

          const elementData = {
            id: elementId,
            label: label,
            type: type,
            tagName: element.tagName.toLowerCase(),
            coordinates: coordinates,
            attributes: {
              href: element.href || element.getAttribute('href') || null,
              role: element.getAttribute('role') || null,
              ariaLabel: element.getAttribute('aria-label') || null,
              placeholder: element.placeholder || null,
              type: element.type || null,
              value: element.value || null,
              disabled: element.disabled || element.getAttribute('disabled') !== null,
              tabindex: element.tabIndex || null,
            },
            visible: isVisible(element),
          };

          result.push(elementData);
        } catch (error) {
          console.error('Error processing element:', error);
        }
      });

      return result;
    });

    console.log(`[INTERACTIVE_DNA] Found ${interactiveElements.length} interactive elements`);
    return interactiveElements;
  } catch (error) {
    console.error(`[INTERACTIVE_DNA] Error extracting interactive DNA: ${error.message}`);
    throw new Error(`Failed to extract interactive DNA: ${error.message}`);
  }
};

module.exports = {
  extractInteractiveDNA,
};

