const express = require("express");
const router = express.Router();

// Services
const browserService = require("../services/browserService");
const navigationService = require("../services/navigationService");
const actionSuggestionService = require("../services/actionSuggestionService");
const autonomousFlowService = require("../services/autonomousFlowService");
const autoExecutionService = require("../services/autoExecutionService");

// Utils
const { validateUrl } = require("../utils/urlValidator");
const { handleError } = require("../utils/errorHandler");
const { setupSSE, sendProgress, sendError, sendComplete, sendSSEEvent, sendScreenshot } = require("../utils/sseHelper");

// Actionable elements route (GET) - Must be before POST route to avoid 404
router.get("/actionable-elements", async (req, res) => {
  let browser = null;
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        error: "Missing URL parameter",
        message: "Please provide a URL query parameter",
      });
    }

    console.log(`[ACTIONABLE] Received request for URL: ${url}`);

    // Validate URL
    const validation = validateUrl(url);
    if (!validation.isValid) {
      return res.status(validation.error.status).json({
        error: validation.error.message,
        message: validation.error.details,
      });
    }

    // Launch browser and navigate
    browser = await browserService.launchBrowser();
    const { page } = await browserService.navigateToUrl(browser, url);

    // Get actionable elements
    const actionableElements = await navigationService.getAllActionableElements(page);
    const sheetsData = await navigationService.exportActionableElementsToSheets(actionableElements);

    // Close browser
    await browserService.closeBrowser(browser);
    browser = null;

    res.json({
      message: "Actionable elements extracted successfully",
      url: url,
      status: "success",
      count: actionableElements.length,
      elements: actionableElements,
      sheetsExport: sheetsData, // Ready for export to Google Sheets, CSV, etc.
    });
  } catch (error) {
    console.error(`[ACTIONABLE] Error occurred: ${error.message}`);

    if (browser) {
      await browserService.closeBrowser(browser).catch(() => {});
    }

    const errorResponse = handleError(error);
    res.status(errorResponse.status).json({
      error: errorResponse.error,
      message: errorResponse.message,
    });
  }
});

// Analyze route (POST) - Simplified to only detect actionable elements with SSE support
router.post("/", async (req, res) => {
  let browser = null;
  // Check if client wants SSE streaming
  const useSSE = req.headers.accept?.includes('text/event-stream') || req.query.stream === 'true';
  
  try {
    const { url } = req.body;

    console.log(`[ANALYZE] Received request for URL: ${url} (SSE: ${useSSE})`);

    // Validate URL
    const validation = validateUrl(url);
    if (!validation.isValid) {
      console.log(`[ANALYZE] Validation failed: ${validation.error.message}`);
      if (useSSE) {
        sendError(res, validation.error);
        return;
      }
      return res.status(validation.error.status).json({
        error: validation.error.message,
        message: validation.error.details,
      });
    }

    // Set up SSE if requested
    if (useSSE) {
      setupSSE(res);
      sendProgress(res, 'initializing', 0, 'Starting analysis...', { url });
    }

    // Launch browser and navigate
    if (useSSE) {
      sendProgress(res, 'browser', 10, 'Launching browser...');
    }
    browser = await browserService.launchBrowser();
    
    if (useSSE) {
      sendProgress(res, 'navigation', 20, 'Navigating to page...');
    }
    const { page } = await browserService.navigateToUrl(browser, url);

    // Get actionable elements with all filtering applied
    if (useSSE) {
      sendProgress(res, 'detection', 30, 'Detecting actionable elements...');
    }
    const actionableElements = await navigationService.getAllActionableElements(page);
    
    if (useSSE) {
      sendProgress(res, 'detection', 50, `Found ${actionableElements.length} actionable elements`, {
        count: actionableElements.length,
      });
    }
    
    // Get action suggestions from AI (enriches elements with context and suggestions)
    if (useSSE) {
      sendProgress(res, 'context', 55, 'Enriching elements with context...');
    }
    
    // Stream AI suggestions as they're processed
    const actionableElementsWithSuggestions = await actionSuggestionService.getActionSuggestions(
      page,
      actionableElements,
      useSSE ? (progress, message, metadata) => {
        sendProgress(res, 'ai_suggestions', progress, message, metadata);
      } : null
    );
    
    // Automatically execute actions for each element
    if (useSSE) {
      sendProgress(res, 'execution', 70, 'Executing actions on elements...', {
        total: actionableElementsWithSuggestions.length,
      });
    }

    const executionData = await autoExecutionService.executeAllActions(
      page,
      actionableElementsWithSuggestions,
      {
        maxActions: 200,
        delayBetweenActions: 500,
        skipNavigation: false,
      },
      useSSE ? (progress, message, metadata) => {
        // Map progress from 0-100 to 10-85% range (user changed it to 10)
        const executionProgress = 10 + Math.floor(progress * 0.75);
        
        // If metadata contains screenshot, send it as a separate screenshot event
        if (metadata.screenshot) {
          sendScreenshot(res, metadata.screenshot, {
            step: metadata.current,
            total: metadata.total,
            element: metadata.element,
            action: metadata.action,
            execution: metadata.execution,
          });
        }
        
        // Send progress update
        sendProgress(res, 'execution', executionProgress, message, {
          current: metadata.current,
          total: metadata.total,
          element: metadata.element,
          action: metadata.action,
          // Don't include base64 in progress events to reduce size
          hasScreenshot: !!metadata.screenshot,
        });
      } : null
    );
    
    if (useSSE) {
      sendProgress(res, 'export', 90, 'Preparing export data...');
    }
    
    const sheetsData = await navigationService.exportActionableElementsToSheets(
      actionableElementsWithSuggestions
    );

    // Close browser
    if (useSSE) {
      sendProgress(res, 'cleanup', 95, 'Cleaning up...');
    }
    await browserService.closeBrowser(browser);
    browser = null;

    // Get base URL for full screenshot URLs
    const protocol = req.protocol;
    const host = req.get("host");
    const baseUrl = `${protocol}://${host}`;

    // Convert relative screenshot URLs to full URLs
    const executionResultsWithFullUrls = executionData.executionResults.map(result => ({
      ...result,
      execution: {
        ...result.execution,
        screenshot: result.execution.screenshot ? {
          ...result.execution.screenshot,
          fullUrl: result.execution.screenshot.url ? `${baseUrl}${result.execution.screenshot.url}` : null,
        } : null,
      },
    }));

    const executedElementsWithFullUrls = executionData.executedElements.map(element => ({
      ...element,
      execution: element.execution ? {
        ...element.execution,
        screenshot: element.execution.screenshot ? {
          ...element.execution.screenshot,
          fullUrl: element.execution.screenshot.url ? `${baseUrl}${element.execution.screenshot.url}` : null,
        } : null,
      } : null,
    }));

    // Return response with execution results
    const analysisResult = {
      message: "Actionable elements extracted and actions executed successfully",
      url: url,
      status: "success",
      count: actionableElementsWithSuggestions.length,
      elements: actionableElementsWithSuggestions, // All elements with suggestions
      executedElements: executedElementsWithFullUrls, // Elements that were executed with full screenshot URLs
      executionResults: executionResultsWithFullUrls, // Detailed execution results with full screenshot URLs
      executionSummary: executionData.summary, // Execution summary
      sheetsExport: sheetsData,
    };

    console.log(`[ANALYZE] Found ${actionableElementsWithSuggestions.length} actionable elements with AI suggestions for: ${url}`);
    console.log(`[ANALYZE] Executed ${executionData.summary.attempted} actions: ${executionData.summary.successful} successful, ${executionData.summary.failed} failed`);
    
    if (useSSE) {
      // Stream execution results
      sendProgress(res, 'streaming', 98, 'Streaming results...', {
        totalElements: actionableElementsWithSuggestions.length,
        executed: executionData.summary.attempted,
        successful: executionData.summary.successful,
      });
      
      // Send execution results in chunks
      const chunkSize = 10;
      for (let i = 0; i < executionData.executionResults.length; i += chunkSize) {
        const chunk = executionData.executionResults.slice(i, i + chunkSize);
        sendSSEEvent(res, 'execution_chunk', {
          chunk,
          index: i,
          total: executionData.executionResults.length,
        });
      }
      
      // Send elements in chunks of 20
      const elementChunkSize = 20;
      for (let i = 0; i < actionableElementsWithSuggestions.length; i += elementChunkSize) {
        const chunk = actionableElementsWithSuggestions.slice(i, i + elementChunkSize);
        sendSSEEvent(res, 'elements_chunk', {
          chunk,
          index: i,
          total: actionableElementsWithSuggestions.length,
        });
      }
      
      // Get base URL for full screenshot URLs
      const protocol = req.protocol;
      const host = req.get("host");
      const baseUrl = `${protocol}://${host}`;

      // Convert relative screenshot URLs to full URLs for completion event
      const executionResultsWithFullUrls = executionData.executionResults.map(result => ({
        ...result,
        execution: {
          ...result.execution,
          screenshot: result.execution.screenshot ? {
            ...result.execution.screenshot,
            fullUrl: result.execution.screenshot.url ? `${baseUrl}${result.execution.screenshot.url}` : null,
          } : null,
        },
      }));

      // Send final completion
      sendComplete(res, {
        message: "Analysis and execution completed successfully",
        url: url,
        status: "success",
        count: actionableElementsWithSuggestions.length,
        executionSummary: executionData.summary,
        executionResults: executionResultsWithFullUrls,
        sheetsExport: sheetsData,
      });
    } else {
      res.json(analysisResult);
    }
  } catch (error) {
    console.error(`[ANALYZE] Error occurred: ${error.message}`);

    // Ensure browser is closed even if there's an error
    if (browser) {
      await browserService.closeBrowser(browser).catch(() => {
        console.log("[ANALYZE] Browser closed after error");
      });
    }

    // Handle error
    const errorResponse = handleError(error);
    
    if (useSSE) {
      sendError(res, errorResponse);
    } else {
      res.status(errorResponse.status).json({
        error: errorResponse.error,
        message: errorResponse.message,
        ...(errorResponse.details && { details: errorResponse.details }),
      });
    }
  }
});

// Autonomous flow route (POST) - Implements Step 4: Execute and Loop
router.post("/autonomous", async (req, res) => {
  // Check if client wants SSE streaming
  const useSSE = req.headers.accept?.includes('text/event-stream') || req.query.stream === 'true';
  
  try {
    const { url, goal, maxSteps = 10, waitBetweenSteps = 1000, takeScreenshots = false } = req.body;

    if (!url) {
      const error = { error: "Missing URL", message: "Please provide a URL in the request body" };
      if (useSSE) {
        sendError(res, error);
        return;
      }
      return res.status(400).json(error);
    }

    if (!goal) {
      const error = { error: "Missing goal", message: "Please provide a goal/objective in the request body" };
      if (useSSE) {
        sendError(res, error);
        return;
      }
      return res.status(400).json(error);
    }

    console.log(`[AUTONOMOUS] Starting autonomous flow for URL: ${url}, Goal: ${goal}`);

    // Validate URL
    const validation = validateUrl(url);
    if (!validation.isValid) {
      const error = validation.error;
      if (useSSE) {
        sendError(res, error);
        return;
      }
      return res.status(validation.error.status).json({
        error: validation.error.message,
        message: validation.error.details,
      });
    }

    // Set up SSE if requested
    if (useSSE) {
      setupSSE(res);
      sendProgress(res, 'initializing', 0, 'Starting autonomous flow...', { url, goal });
    }

    // Run autonomous flow
    const result = await autonomousFlowService.autonomousFlow(
      url,
      goal,
      {
        maxSteps: parseInt(maxSteps),
        waitBetweenSteps: parseInt(waitBetweenSteps),
        takeScreenshots: takeScreenshots === true,
      },
      useSSE ? (progress, message, metadata) => {
        sendProgress(res, 'autonomous', progress, message, metadata);
      } : null
    );

    console.log(`[AUTONOMOUS] Flow completed: ${result.stepsCompleted} steps, Goal achieved: ${result.goalAchieved}`);

    if (useSSE) {
      // Stream steps as they complete
      result.steps.forEach((step, index) => {
        sendSSEEvent(res, 'step_completed', {
          step: step.step,
          total: result.steps.length,
          decision: step.decision,
          execution: step.execution,
        });
      });

      // Send final completion
      sendComplete(res, {
        message: result.goalAchieved ? "Goal achieved!" : "Flow completed",
        goal,
        goalAchieved: result.goalAchieved,
        startingUrl: result.startingUrl,
        finalUrl: result.finalUrl,
        finalTitle: result.finalTitle,
        stepsCompleted: result.stepsCompleted,
        totalSteps: result.totalSteps,
        steps: result.steps.map(s => ({
          step: s.step,
          url: s.url,
          decision: s.decision,
          execution: s.execution,
          timestamp: s.timestamp,
        })),
      });
    } else {
      res.json({
        message: result.goalAchieved ? "Goal achieved!" : "Flow completed",
        goal,
        goalAchieved: result.goalAchieved,
        startingUrl: result.startingUrl,
        finalUrl: result.finalUrl,
        finalTitle: result.finalTitle,
        stepsCompleted: result.stepsCompleted,
        totalSteps: result.totalSteps,
        steps: result.steps.map(s => ({
          step: s.step,
          url: s.url,
          decision: s.decision,
          execution: s.execution,
          timestamp: s.timestamp,
        })),
      });
    }
  } catch (error) {
    console.error(`[AUTONOMOUS] Error occurred: ${error.message}`);

    const errorResponse = handleError(error);
    
    if (useSSE) {
      sendError(res, errorResponse);
    } else {
      res.status(errorResponse.status || 500).json({
        error: errorResponse.error,
        message: errorResponse.message,
        ...(errorResponse.details && { details: errorResponse.details }),
      });
    }
  }
});

module.exports = router;
