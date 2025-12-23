const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

/**
 * Service to execute actions on web elements using Playwright
 * Handles click, fill, and other interactive actions
 */

/**
 * Ensures the screenshots directory exists
 */
async function ensureScreenshotsDir() {
  const screenshotsDir = path.join(__dirname, "../screenshots");
  try {
    await fs.access(screenshotsDir);
  } catch {
    await fs.mkdir(screenshotsDir, { recursive: true });
  }
}

/**
 * Captures a screenshot after action execution
 * @param {Page} page - Playwright page instance
 * @param {number} stepNumber - Step number for naming
 * @param {string} action - Action type (click, fill, select)
 * @param {string} elementText - Element text for filename
 * @returns {Promise<Object>} Screenshot info
 */
async function captureActionScreenshot(page, stepNumber, action, elementText) {
  try {
    await ensureScreenshotsDir();
    
    // Generate filename
    const sanitizedText = (elementText || 'element').replace(/[^a-z0-9]/gi, '_').substring(0, 30);
    const timestamp = Date.now();
    const filename = `action_${stepNumber}_${action}_${sanitizedText}_${timestamp}.png`;
    const filepath = path.join(__dirname, "../screenshots", filename);

    // Capture screenshot (viewport only, not full page for faster capture)
    const screenshotBuffer = await page.screenshot({ 
      path: filepath,
      fullPage: false, // Viewport only for faster capture
    });

    // Convert to base64 for SSE streaming
    const screenshotBase64 = screenshotBuffer.toString('base64');

    console.log(`[ACTION_EXEC] Screenshot captured: ${filename}`);

    return {
      filename,
      url: `/screenshots/${filename}`,
      path: filepath,
      base64: screenshotBase64, // Include base64 for SSE streaming
    };
  } catch (error) {
    console.warn(`[ACTION_EXEC] Failed to capture screenshot: ${error.message}`);
    return null;
  }
}

/**
 * Executes an action on a page element based on the action suggestion
 * @param {Page} page - Playwright page instance
 * @param {Object} element - Element object with selector and metadata
 * @param {Object} actionSuggestion - Action suggestion from LLM
 * @param {Object} options - Optional parameters (stepNumber for screenshot naming)
 * @returns {Promise<Object>} Execution result
 */
async function executeAction(page, element, actionSuggestion, options = {}) {
  try {
    console.log(`[ACTION_EXEC] Executing ${actionSuggestion.action} on element: ${element.text || element.tagName}`);

    // Strategy 1: For click actions, try mouse click with coordinates first (bypasses interception)
    if (actionSuggestion.action === 'click' && element.boundingBox) {
      const { x, y, width, height } = element.boundingBox;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      
      try {
        // Mouse click at coordinates bypasses element interception issues
        await page.mouse.click(centerX, centerY);
        await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {
          console.log('[ACTION_EXEC] No network activity after mouse click');
        });
        
        // Capture screenshot after action
        const screenshot = await captureActionScreenshot(
          page,
          options.stepNumber || 0,
          'click',
          element.text || element.ariaLabel || element.tagName
        );
        
        return {
          success: true,
          action: 'click',
          method: 'mouse_click_coordinates',
          element: {
            tagName: element.tagName,
            text: element.text || element.ariaLabel || '',
          },
          screenshot: screenshot,
        };
      } catch (error) {
        console.warn(`[ACTION_EXEC] Mouse click failed: ${error.message}, trying locator click...`);
      }
    }

    // Strategy 2: Find element by locator and use force click to bypass interception
    let locator = null;

    // Try multiple strategies to find the element
    if (element.context?.id) {
      locator = page.locator(`#${element.context.id}`).first();
    } else if (element.context?.name) {
      locator = page.locator(`[name="${element.context.name}"]`).first();
    } else if (element.href) {
      // For links, try to find by href
      locator = page.locator(`a[href="${element.href}"]`).first();
    } else if (element.text) {
      // Try to find by text content
      locator = page.locator(`${element.tagName}:has-text("${element.text}")`).first();
    } else {
      // Last resort: use tag name
      locator = page.locator(element.tagName).first();
    }

    if (!locator) {
      throw new Error('Could not find element locator');
    }

    // Execute the action
    if (actionSuggestion.action === 'click') {
      // Try normal click first (faster, more reliable when it works)
      try {
        await locator.click({ timeout: 3000 });
      } catch (error) {
        // If normal click fails (likely due to interception), use force click
        console.log('[ACTION_EXEC] Normal click failed, using force click to bypass interception...');
        await locator.click({ force: true, timeout: 3000 });
      }
      
      // Wait for navigation or network activity
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {
        console.log('[ACTION_EXEC] No network activity after click');
      });
      
      // Capture screenshot after action
      const screenshot = await captureActionScreenshot(
        page,
        options.stepNumber || 0,
        'click',
        element.text || element.ariaLabel || element.tagName
      );
      
      return {
        success: true,
        action: 'click',
        method: 'locator_click',
        element: {
          tagName: element.tagName,
          text: element.text || element.ariaLabel || '',
        },
        screenshot: screenshot,
      };
    } else if (actionSuggestion.action === 'fill') {
      const value = actionSuggestion.suggested_value || actionSuggestion.input_data || '';
      
      // For fill actions, try to focus first, then fill
      try {
        await locator.focus({ timeout: 3000 }).catch(() => {});
        await locator.fill(value, { timeout: 3000 });
      } catch (error) {
        // If fill fails, try clearing first, then filling
        console.log('[ACTION_EXEC] Normal fill failed, trying clear then fill...');
        await locator.clear({ timeout: 3000 }).catch(() => {});
        await locator.fill(value, { timeout: 3000 });
      }
      
      // Capture screenshot after action
      const screenshot = await captureActionScreenshot(
        page,
        options.stepNumber || 0,
        'fill',
        element.text || element.ariaLabel || element.placeholder || element.tagName
      );
      
      return {
        success: true,
        action: 'fill',
        value: value,
        element: {
          tagName: element.tagName,
          text: element.text || element.ariaLabel || '',
        },
        screenshot: screenshot,
      };
    } else if (actionSuggestion.action === 'select') {
      const value = actionSuggestion.suggested_value || actionSuggestion.input_data || '';
      await locator.selectOption(value);
      
      // Capture screenshot after action
      const screenshot = await captureActionScreenshot(
        page,
        options.stepNumber || 0,
        'select',
        element.text || element.ariaLabel || element.tagName
      );
      
      return {
        success: true,
        action: 'select',
        value: value,
        element: {
          tagName: element.tagName,
          text: element.text || element.ariaLabel || '',
        },
        screenshot: screenshot,
      };
    } else {
      throw new Error(`Unknown action: ${actionSuggestion.action}`);
    }
  } catch (error) {
    console.error(`[ACTION_EXEC] Error executing action: ${error.message}`);
    
    // Try to capture screenshot even on error
    let screenshot = null;
    try {
      screenshot = await captureActionScreenshot(
        page,
        options.stepNumber || 0,
        actionSuggestion.action || 'error',
        element.text || element.ariaLabel || element.tagName || 'element'
      );
    } catch (screenshotError) {
      console.warn(`[ACTION_EXEC] Failed to capture error screenshot: ${screenshotError.message}`);
    }
    
    return {
      success: false,
      action: actionSuggestion.action,
      error: error.message,
      screenshot: screenshot,
    };
  }
}

module.exports = {
  executeAction,
  captureActionScreenshot,
};

