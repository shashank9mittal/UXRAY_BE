/**
 * Validates if URL is provided and has valid format
 * @param {string} url - URL to validate
 * @returns {Object} Validation result with isValid flag and error message
 */
function validateUrl(url) {
  if (!url) {
    return {
      isValid: false,
      error: {
        status: 400,
        message: "URL is required",
        details: "Please provide a URL in the request body",
      },
    };
  }

  try {
    new URL(url);
    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: {
        status: 400,
        message: "Invalid URL format",
        details: "Please provide a valid URL",
      },
    };
  }
}

module.exports = {
  validateUrl,
};

