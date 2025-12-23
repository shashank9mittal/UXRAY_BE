/**
 * Helper functions for Server-Sent Events (SSE)
 */

/**
 * Sets up SSE headers and sends initial connection event
 * @param {Response} res - Express response object
 */
function setupSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // Send initial connection event
  res.write('data: {"type":"connected","message":"Connection established"}\n\n');
}

/**
 * Sends an SSE event
 * @param {Response} res - Express response object
 * @param {string} type - Event type
 * @param {Object} data - Event data
 */
function sendSSEEvent(res, type, data) {
  const event = {
    type,
    timestamp: new Date().toISOString(),
    ...data,
  };
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Sends a progress update
 * @param {Response} res - Express response object
 * @param {string} stage - Current stage name
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} message - Progress message
 * @param {Object} metadata - Additional metadata
 */
function sendProgress(res, stage, progress, message, metadata = {}) {
  sendSSEEvent(res, 'progress', {
    stage,
    progress,
    message,
    ...metadata,
  });
}

/**
 * Sends an error event and closes the connection
 * @param {Response} res - Express response object
 * @param {Error|Object} error - Error object
 */
function sendError(res, error) {
  sendSSEEvent(res, 'error', {
    error: error.message || error.error || 'Unknown error',
    message: error.message || error.error || 'An error occurred',
    details: error.details || null,
  });
  res.end();
}

/**
 * Sends completion event and closes the connection
 * @param {Response} res - Express response object
 * @param {Object} data - Final data to send
 */
function sendComplete(res, data) {
  sendSSEEvent(res, 'complete', data);
  res.end();
}

/**
 * Sends a screenshot event
 * @param {Response} res - Express response object
 * @param {Object} screenshotData - Screenshot data with base64, filename, url, etc.
 * @param {Object} executionData - Execution data (step, element, action, etc.)
 */
function sendScreenshot(res, screenshotData, executionData = {}) {
  sendSSEEvent(res, 'screenshot', {
    step: executionData.step || executionData.current || 0,
    total: executionData.total || 0,
    element: executionData.element || '',
    action: executionData.action || '',
    screenshot: {
      filename: screenshotData.filename,
      url: screenshotData.url,
      base64: screenshotData.base64, // Base64 encoded image data
    },
    execution: executionData.execution || {},
  });
}

module.exports = {
  setupSSE,
  sendSSEEvent,
  sendProgress,
  sendError,
  sendComplete,
  sendScreenshot,
};

