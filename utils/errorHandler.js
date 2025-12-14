/**
 * Handles and formats errors for API responses
 * @param {Error} error - Error object
 * @returns {Object} Formatted error response
 */
function handleError(error) {
  console.error(`[ERROR] ${error.message}`);

  if (error.message.includes("net::ERR")) {
    return {
      status: 400,
      error: "Failed to load URL",
      message: "Unable to reach the provided URL. Please check if the URL is accessible.",
      details: error.message,
    };
  }

  if (error.message.includes("timeout")) {
    return {
      status: 408,
      error: "Request timeout",
      message: "The page took too long to load. Please try again or check the URL.",
      details: error.message,
    };
  }

  return {
    status: 500,
    error: "Internal server error",
    message: error.message,
  };
}

module.exports = {
  handleError,
};

