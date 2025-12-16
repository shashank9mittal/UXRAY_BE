/**
 * Handles and formats errors for API responses
 * @param {Error} error - Error object
 * @returns {Object} Formatted error response
 */
function handleError(error) {
  console.error(`[ERROR] ${error.message}`);

  // Network errors - unreachable URL
  if (
    error.message.includes("net::ERR") ||
    error.message.includes("ERR_NAME_NOT_RESOLVED") ||
    error.message.includes("ERR_CONNECTION_REFUSED") ||
    error.message.includes("ERR_CONNECTION_TIMED_OUT")
  ) {
    return {
      status: 400,
      error: "Failed to load URL",
      message: "Unable to reach the provided URL. Please check if the URL is accessible and try again.",
      details: error.message,
    };
  }

  // 404 Not Found
  if (
    error.message.includes("404") ||
    error.message.includes("net::ERR_ABORTED") ||
    error.message.includes("Navigation failed")
  ) {
    return {
      status: 404,
      error: "Page not found",
      message: "The requested URL returned a 404 error. The page may not exist or has been moved.",
      details: error.message,
    };
  }

  // Timeout errors
  if (
    error.message.includes("timeout") ||
    error.message.includes("Navigation timeout") ||
    error.message.includes("Timeout")
  ) {
    return {
      status: 408,
      error: "Request timeout",
      message: "The page took too long to load. Please try again or check if the URL is accessible.",
      details: error.message,
    };
  }

  // SSL/Certificate errors
  if (
    error.message.includes("SSL") ||
    error.message.includes("certificate") ||
    error.message.includes("CERT")
  ) {
    return {
      status: 400,
      error: "SSL Certificate error",
      message: "There was an issue with the website's SSL certificate. The URL may be using an invalid or expired certificate.",
      details: error.message,
    };
  }

  // Generic server error
  return {
    status: 500,
    error: "Internal server error",
    message: "An unexpected error occurred while processing your request.",
    details: error.message,
  };
}

module.exports = {
  handleError,
};

