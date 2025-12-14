const OpenAI = require("openai");

/**
 * Phase 4: Vision AI Service
 * Implements Vision AI prompting with Nielsen's Heuristics
 */

// Lazy initialization of OpenAI client (only when needed)
let openai = null;

function getOpenAIClient() {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "your_api_key_here") {
      throw new Error("OPENAI_API_KEY environment variable is not set or is still the placeholder value");
    }
    openai = new OpenAI({
      apiKey: apiKey,
    });
  }
  return openai;
}

/**
 * B4.1: Vision AI Prompting function based on Nielsen's Heuristics
 * @param {string} screenshotBase64 - Base64 encoded screenshot
 * @param {number} imageWidth - Width of the screenshot
 * @param {number} imageHeight - Height of the screenshot
 * @returns {Promise<Object>} AI analysis results with coordinates
 */
async function analyzeWithVisionAI(screenshotBase64, imageWidth, imageHeight) {
  console.log("[VISION_AI] B4.1: Starting Vision AI analysis with Nielsen's Heuristics...");

  // Get OpenAI client (will throw if API key is not set)
  const client = getOpenAIClient();

  // Nielsen's 10 Usability Heuristics
  const nielsensHeuristics = `
1. Visibility of system status - The system should always keep users informed about what is going on
2. Match between system and real world - The system should speak the users' language
3. User control and freedom - Users need clearly marked "emergency exits" to leave unwanted states
4. Consistency and standards - Users should not have to wonder whether different words, situations, or actions mean the same thing
5. Error prevention - Even better than good error messages is a careful design which prevents a problem from occurring
6. Recognition rather than recall - Minimize the user's memory load by making objects, actions, and options visible
7. Flexibility and efficiency of use - Accelerators may often speed up the interaction for expert users
8. Aesthetic and minimalist design - Dialogues should not contain information which is irrelevant or rarely needed
9. Help users recognize, diagnose, and recover from errors - Error messages should be expressed in plain language
10. Help and documentation - Even though it is better if the system can be used without documentation
`;

  const prompt = `You are a UX expert analyzing a website screenshot based on Nielsen's 10 Usability Heuristics.

${nielsensHeuristics}

Analyze the provided screenshot and identify UX issues, violations, or areas for improvement based on these heuristics.

CRITICAL REQUIREMENTS:
1. You MUST return a valid JSON object with the exact structure specified below
2. For each issue found, provide precise pixel coordinates (x, y, width, height) of the bounding box
3. Coordinates must be relative to the image dimensions: ${imageWidth}x${imageHeight} pixels
4. Each issue must have a unique ID starting from 1
5. Classify each issue by the relevant Nielsen heuristic (1-10)
6. Provide severity level: "critical", "warning", "suggestion", or "info"
7. Include specific, actionable recommendations

REQUIRED JSON STRUCTURE:
{
  "report": [
    {
      "id": 1,
      "heuristic": 1,
      "heuristicName": "Visibility of system status",
      "type": "accessibility|performance|ux|seo|error",
      "severity": "critical|warning|suggestion|info",
      "message": "Brief description of the issue",
      "recommendation": "Specific actionable recommendation",
      "coordinates": {
        "x": 100,
        "y": 150,
        "width": 200,
        "height": 50
      }
    }
  ]
}

IMPORTANT:
- Return ONLY valid JSON, no markdown, no code blocks, no explanations
- Ensure all coordinates are within image bounds (0 to ${imageWidth} for x/width, 0 to ${imageHeight} for y/height)
- Be thorough but focus on the most impactful issues
- If no issues are found, return: {"report": []}
`;

  try {
    console.log("[VISION_AI] Sending request to OpenAI Vision API...");
    
    const response = await client.chat.completions.create({
      model: "gpt-4o", // or "gpt-4-vision-preview" if available
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${screenshotBase64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" }, // Force JSON output
      max_tokens: 2000,
      temperature: 0.3, // Lower temperature for more consistent, structured output
    });

    const content = response.choices[0].message.content;
    console.log("[VISION_AI] Received response from OpenAI");

    // Parse and validate JSON
    let aiResponse;
    try {
      aiResponse = JSON.parse(content);
    } catch (parseError) {
      console.error("[VISION_AI] JSON parse error:", parseError);
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
      }
    }

    // B4.1: Validate JSON schema
    const validationResult = validateAIResponse(aiResponse, imageWidth, imageHeight);
    if (!validationResult.valid) {
      console.warn("[VISION_AI] Validation warnings:", validationResult.errors);
      // Continue with partial data if structure is mostly correct
    }

    console.log(`[VISION_AI] B4.1: Successfully parsed and validated AI response. Found ${aiResponse.report?.length || 0} issues.`);

    return {
      report: aiResponse.report || [],
      timestamp: new Date().toISOString(),
      model: response.model,
    };
  } catch (error) {
    console.error("[VISION_AI] Error calling OpenAI API:", error.message);
    throw new Error(`Vision AI analysis failed: ${error.message}`);
  }
}

/**
 * Validates the AI response structure and coordinates
 * @param {Object} response - Parsed AI response
 * @param {number} imageWidth - Image width for coordinate validation
 * @param {number} imageHeight - Image height for coordinate validation
 * @returns {Object} Validation result
 */
function validateAIResponse(response, imageWidth, imageHeight) {
  const errors = [];
  
  if (!response || typeof response !== "object") {
    return { valid: false, errors: ["Response is not an object"] };
  }

  if (!Array.isArray(response.report)) {
    return { valid: false, errors: ["Report is not an array"] };
  }

  response.report.forEach((issue, index) => {
    // Validate required fields
    if (typeof issue.id !== "number") {
      errors.push(`Issue ${index}: Missing or invalid 'id'`);
    }
    if (!issue.coordinates) {
      errors.push(`Issue ${index}: Missing 'coordinates'`);
    } else {
      const { x, y, width, height } = issue.coordinates;
      if (typeof x !== "number" || x < 0 || x > imageWidth) {
        errors.push(`Issue ${index}: Invalid x coordinate (${x})`);
      }
      if (typeof y !== "number" || y < 0 || y > imageHeight) {
        errors.push(`Issue ${index}: Invalid y coordinate (${y})`);
      }
      if (typeof width !== "number" || width <= 0 || x + width > imageWidth) {
        errors.push(`Issue ${index}: Invalid width (${width})`);
      }
      if (typeof height !== "number" || height <= 0 || y + height > imageHeight) {
        errors.push(`Issue ${index}: Invalid height (${height})`);
      }
    }
    if (!issue.message) {
      errors.push(`Issue ${index}: Missing 'message'`);
    }
    if (!issue.severity) {
      errors.push(`Issue ${index}: Missing 'severity'`);
    }
  });

  return {
    valid: errors.length === 0,
    errors: errors,
  };
}

module.exports = {
  analyzeWithVisionAI,
  validateAIResponse,
};

