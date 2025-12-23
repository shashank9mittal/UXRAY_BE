const actionExecutionService = require('./actionExecutionService');

/**
 * Automatically executes actions for all elements with suggestions
 * @param {Page} page - Playwright page instance
 * @param {Array} elements - Array of elements with action suggestions
 * @param {Object} options - Execution options
 * @param {Function} progressCallback - Optional progress callback
 * @returns {Promise<Object>} Execution results
 */
async function executeAllActions(page, elements, options = {}, progressCallback = null) {
  const {
    maxActions = 20,
    delayBetweenActions = 500,
    skipNavigation = false, // Skip actions that might navigate away
    continueOnError = true, // Continue even if action fails
    actionTimeout = 5000, // Timeout per action
  } = options;

  const executionResults = [];
  const executedElements = [];

  // Filter elements that have actionable suggestions
  const elementsToExecute = elements
    .filter(el => {
      if (!el.actionSuggestion) return false;
      if (skipNavigation && el.actionSuggestion.action === 'click' && el.category === 'link') {
        return false; // Skip links that might navigate
      }
      return true;
    })
    .slice(0, maxActions);

  console.log(`[AUTO_EXEC] Executing ${elementsToExecute.length} actions out of ${elements.length} total elements...`);

  for (let i = 0; i < elementsToExecute.length; i++) {
    const element = elementsToExecute[i];
    
    if (progressCallback) {
      const progress = Math.floor((i / elementsToExecute.length) * 100);
      progressCallback(
        progress,
        `Executing ${element.actionSuggestion.action} on element ${i + 1}/${elementsToExecute.length}...`,
        {
          current: i + 1,
          total: elementsToExecute.length,
          element: element.text || element.tagName || element.ariaLabel || 'element',
          action: element.actionSuggestion.action,
        }
      );
    }

    try {
      console.log(`[AUTO_EXEC] Step ${i + 1}/${elementsToExecute.length}: Executing ${element.actionSuggestion.action} on ${element.text || element.tagName || 'element'}`);
      
      const executionResult = await actionExecutionService.executeAction(
        page,
        element,
        element.actionSuggestion,
        { stepNumber: i + 1 } // Pass step number for screenshot naming
      );

      // Send screenshot via progress callback if available
      if (progressCallback && executionResult.screenshot) {
        progressCallback(
          progress,
          `Screenshot captured for step ${i + 1}`,
          {
            current: i + 1,
            total: elementsToExecute.length,
            element: element.text || element.tagName || element.ariaLabel || 'element',
            action: element.actionSuggestion.action,
            screenshot: {
              filename: executionResult.screenshot.filename,
              url: executionResult.screenshot.url,
              base64: executionResult.screenshot.base64, // Include base64 for SSE
            },
            execution: {
              success: executionResult.success,
              action: executionResult.action,
            },
          }
        );
      }

      executionResults.push({
        element: {
          tagName: element.tagName,
          text: element.text || element.ariaLabel || '',
          category: element.category,
        },
        actionSuggestion: element.actionSuggestion,
        execution: executionResult,
        timestamp: new Date().toISOString(),
      });

      executedElements.push({
        ...element,
        execution: executionResult,
      });

      // Delay between actions
      if (i < elementsToExecute.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenActions));
      }

      // If click action, wait for potential navigation
      if (executionResult.success && executionResult.action === 'click') {
        await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {
          console.log('[AUTO_EXEC] No network activity after click, continuing...');
        });
      }

      // If action failed and continueOnError is false, stop execution
      if (!executionResult.success && !continueOnError) {
        console.log('[AUTO_EXEC] Action failed and continueOnError is false, stopping execution');
        break;
      }
    } catch (error) {
      console.error(`[AUTO_EXEC] Error executing action on element ${i + 1}: ${error.message}`);
      
      // Try to capture screenshot on error
      let screenshot = null;
      try {
        screenshot = await actionExecutionService.captureActionScreenshot(
          page,
          i + 1,
          element.actionSuggestion?.action || 'error',
          element.text || element.ariaLabel || element.tagName || 'element'
        );
      } catch (screenshotError) {
        console.warn(`[AUTO_EXEC] Failed to capture error screenshot: ${screenshotError.message}`);
      }
      
      // Send screenshot via progress callback if available
      if (progressCallback && screenshot) {
        const progress = Math.floor((i / elementsToExecute.length) * 100);
        progressCallback(
          progress,
          `Error screenshot captured for step ${i + 1}`,
          {
            current: i + 1,
            total: elementsToExecute.length,
            element: element.text || element.tagName || element.ariaLabel || 'element',
            action: element.actionSuggestion?.action || 'error',
            screenshot: {
              filename: screenshot.filename,
              url: screenshot.url,
              base64: screenshot.base64, // Include base64 for SSE
            },
            execution: {
              success: false,
              action: element.actionSuggestion?.action || 'error',
              error: error.message,
            },
          }
        );
      }
      
      executionResults.push({
        element: {
          tagName: element.tagName,
          text: element.text || element.ariaLabel || '',
          category: element.category,
        },
        actionSuggestion: element.actionSuggestion,
        execution: {
          success: false,
          action: element.actionSuggestion?.action || 'unknown',
          error: error.message,
          screenshot: screenshot,
        },
        timestamp: new Date().toISOString(),
      });

      // If continueOnError is false, stop execution
      if (!continueOnError) {
        console.log('[AUTO_EXEC] Error occurred and continueOnError is false, stopping execution');
        break;
      }
    }
  }

  const summary = {
    total: elements.length,
    attempted: elementsToExecute.length,
    successful: executionResults.filter(r => r.execution.success).length,
    failed: executionResults.filter(r => !r.execution.success).length,
  };

  console.log(`[AUTO_EXEC] Execution complete: ${summary.successful}/${summary.attempted} successful`);

  return {
    executionResults,
    executedElements,
    summary,
  };
}

module.exports = {
  executeAllActions,
};

