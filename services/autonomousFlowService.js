const browserService = require('./browserService');
const navigationService = require('./navigationService');
const actionSuggestionService = require('./actionSuggestionService');
const goalDecisionService = require('./goalDecisionService');
const actionExecutionService = require('./actionExecutionService');

/**
 * Autonomous flow service that implements the full autonomous navigation loop
 * @param {string} url - Starting URL
 * @param {string} goal - Goal/objective (e.g., "navigate to product details", "sign in")
 * @param {Object} options - Options for the flow
 * @param {Function} progressCallback - Optional progress callback for SSE
 * @returns {Promise<Object>} Flow result with steps and final state
 */
async function autonomousFlow(url, goal, options = {}, progressCallback = null) {
  const {
    maxSteps = 10,
    waitBetweenSteps = 1000,
    takeScreenshots = false,
  } = options;

  let browser = null;
  const steps = [];
  let currentStep = 0;

  try {
    if (progressCallback) {
      progressCallback(0, 'Starting autonomous flow...', { url, goal });
    }

    // Launch browser and navigate
    if (progressCallback) {
      progressCallback(10, 'Launching browser...');
    }
    browser = await browserService.launchBrowser();
    
    if (progressCallback) {
      progressCallback(20, 'Navigating to starting URL...');
    }
    const { page } = await browserService.navigateToUrl(browser, url);

    // Main autonomous loop
    while (currentStep < maxSteps) {
      if (progressCallback) {
        progressCallback(
          20 + (currentStep / maxSteps) * 70,
          `Step ${currentStep + 1}/${maxSteps}: Analyzing page...`,
          { step: currentStep + 1, maxSteps }
        );
      }

      console.log(`[AUTONOMOUS] Step ${currentStep + 1}/${maxSteps}`);

      // Step 1: Get actionable elements
      const actionableElements = await navigationService.getAllActionableElements(page);
      console.log(`[AUTONOMOUS] Found ${actionableElements.length} actionable elements`);

      if (actionableElements.length === 0) {
        console.log('[AUTONOMOUS] No actionable elements found, stopping');
        break;
      }

      // Step 2: Enrich with context and get AI suggestions
      const elementsWithSuggestions = await actionSuggestionService.getActionSuggestions(
        page,
        actionableElements
      );

      // Add IDs to elements for LLM reference
      const elementsWithIds = elementsWithSuggestions.map((el, index) => ({
        ...el,
        id: `elem_${index}`,
      }));

      // Step 3: Get LLM decision for goal
      if (progressCallback) {
        progressCallback(
          30 + (currentStep / maxSteps) * 60,
          `Step ${currentStep + 1}: Getting AI decision for goal...`,
          { goal }
        );
      }

      const decision = await goalDecisionService.getNextActionForGoal(
        page,
        goal,
        elementsWithIds
      );

      // Step 4: Execute the action
      if (progressCallback) {
        progressCallback(
          40 + (currentStep / maxSteps) * 50,
          `Step ${currentStep + 1}: Executing ${decision.action}...`,
          { action: decision.action, element: decision.element.text || decision.element.tagName }
        );
      }

      const executionResult = await actionExecutionService.executeAction(
        page,
        decision.element,
        {
          action: decision.action,
          suggested_value: decision.input_data,
          input_data: decision.input_data, // Support both formats
        }
      );

      // Record step
      const stepRecord = {
        step: currentStep + 1,
        url: page.url(),
        decision: {
          selected_element: {
            text: decision.element.text || decision.element.tagName,
            category: decision.element.category,
          },
          action: decision.action,
          input_data: decision.input_data,
          rationale: decision.rationale,
        },
        execution: executionResult,
        timestamp: new Date().toISOString(),
      };

      if (takeScreenshots) {
        try {
          const screenshot = await page.screenshot({ fullPage: false });
          stepRecord.screenshot = screenshot.toString('base64');
        } catch (error) {
          console.warn('[AUTONOMOUS] Could not take screenshot:', error.message);
        }
      }

      steps.push(stepRecord);

      console.log(`[AUTONOMOUS] Step ${currentStep + 1} completed: ${decision.action} on ${decision.element.text || decision.element.tagName}`);
      console.log(`[AUTONOMOUS] Rationale: ${decision.rationale}`);

      // Check if goal is achieved
      if (progressCallback) {
        progressCallback(
          50 + (currentStep / maxSteps) * 40,
          `Step ${currentStep + 1}: Checking if goal achieved...`,
        );
      }

      const goalAchieved = await goalDecisionService.isGoalAchieved(page, goal);
      
      if (goalAchieved) {
        console.log('[AUTONOMOUS] Goal achieved!');
        if (progressCallback) {
          progressCallback(100, 'Goal achieved!', { goal });
        }
        break;
      }

      // Wait before next step
      await new Promise(resolve => setTimeout(resolve, waitBetweenSteps));
      currentStep++;
    }

    // Get final state before closing browser
    const finalUrl = page.url();
    const finalTitle = await page.title();
    const goalAchieved = await goalDecisionService.isGoalAchieved(page, goal);

    // Close browser
    await browserService.closeBrowser(browser);
    browser = null;

    return {
      success: true,
      goal,
      startingUrl: url,
      finalUrl,
      finalTitle,
      stepsCompleted: currentStep + 1,
      totalSteps: steps.length,
      steps,
      goalAchieved,
    };
  } catch (error) {
    console.error(`[AUTONOMOUS] Error in autonomous flow: ${error.message}`);

    if (browser) {
      await browserService.closeBrowser(browser).catch(() => {});
    }

    throw error;
  }
}

module.exports = {
  autonomousFlow,
};

