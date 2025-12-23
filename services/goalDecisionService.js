const OpenAI = require("openai");

// Lazy initialization of OpenAI client
let openai = null;

function getOpenAIClient() {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "your_api_key_here") {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    openai = new OpenAI({
      apiKey: apiKey,
    });
  }
  return openai;
}

/**
 * Gets LLM decision for the next action to take based on a goal
 * This is different from action suggestions - it selects ONE element for a specific goal
 * @param {Page} page - Playwright page instance
 * @param {string} goal - The goal/objective (e.g., "navigate to product details page", "sign in")
 * @param {Array} elements - Array of actionable elements with suggestions
 * @returns {Promise<Object>} Decision object with selected element and action
 */
async function getNextActionForGoal(page, goal, elements) {
  const useLiveAI = !!process.env.OPENAI_API_KEY;

  if (!useLiveAI) {
    console.log("[GOAL_DECISION] No OPENAI_API_KEY, returning mock decision...");
    // Return first clickable element as mock decision
    const clickableElement = elements.find(el => 
      el.actionSuggestion?.action === 'click' || el.category === 'button' || el.category === 'link'
    );
    
    if (clickableElement) {
      return {
        selected_element_id: clickableElement.id || 'elem_0',
        action: 'click',
        input_data: null,
        rationale: 'Mock decision: selected first clickable element',
        element: clickableElement,
      };
    }
    
    throw new Error('No suitable element found for goal');
  }

  try {
    const client = getOpenAIClient();

    // Create simplified element list with IDs for LLM
    const elementsForLLM = elements.map((el, index) => ({
      id: `elem_${index}`,
      tag: el.tagName,
      text: el.text || el.ariaLabel || '',
      category: el.category,
      action_suggestion: el.actionSuggestion?.action || 'click',
      purpose: el.actionSuggestion?.purpose || 'user_interaction',
      href: el.href || null,
      placeholder: el.placeholder || el.context?.placeholder || null,
      label: el.context?.label || null,
    }));

    const prompt = `You are an Autonomous UI Agent. Your current goal is: "${goal}"

Below is a list of all actionable HTML elements visible on the current page.

INSTRUCTIONS:
1. Select the SINGLE best element to interact with next to move towards the goal
2. Determine the necessary action (click, fill, select)
3. If the action is "fill", suggest a realistic, generic value based on the element's text/placeholder
4. Provide a clear rationale explaining why this action was chosen

UI ELEMENTS:
${JSON.stringify(elementsForLLM, null, 2)}

RESPOND ONLY WITH A JSON OBJECT that strictly follows this schema:
{
  "selected_element_id": "string",  // Must match an ID from the list above (elem_0, elem_1, etc.)
  "action": "click|fill|select",     // The action to take
  "input_data": "string|null",      // Required if action is "fill", otherwise null
  "rationale": "string"              // Explain why this action was chosen to achieve the goal
}

Return ONLY valid JSON, no markdown, no code blocks, no explanations.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert autonomous UI agent that selects the best actions to achieve user goals. Always return valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    let decision;

    try {
      decision = JSON.parse(content);
    } catch (parseError) {
      console.error("[GOAL_DECISION] JSON parse error:", parseError);
      throw new Error("Failed to parse LLM decision as JSON");
    }

    // Validate decision structure
    if (!decision.selected_element_id || !decision.action) {
      throw new Error("Invalid decision structure from LLM");
    }

    // Find the selected element
    const elementId = decision.selected_element_id;
    const elementIndex = parseInt(elementId.replace('elem_', ''));
    const selectedElement = elements[elementIndex];

    if (!selectedElement) {
      throw new Error(`LLM selected unknown element ID: ${elementId}`);
    }

    console.log(`[GOAL_DECISION] Selected element: ${selectedElement.text || selectedElement.tagName}`);
    console.log(`[GOAL_DECISION] Action: ${decision.action}`);
    console.log(`[GOAL_DECISION] Rationale: ${decision.rationale}`);

    return {
      selected_element_id: decision.selected_element_id,
      action: decision.action,
      input_data: decision.input_data || null,
      rationale: decision.rationale,
      element: selectedElement,
    };
  } catch (error) {
    console.error(`[GOAL_DECISION] Error getting decision: ${error.message}`);
    throw error;
  }
}

/**
 * Checks if a goal has been achieved
 * @param {Page} page - Playwright page instance
 * @param {string} goal - The goal to check
 * @returns {Promise<boolean>} True if goal is achieved
 */
async function isGoalAchieved(page, goal) {
  try {
    // Simple goal checking - can be enhanced
    const currentUrl = page.url();
    const pageTitle = await page.title();
    const pageText = await page.textContent('body');

    // Check if URL contains goal keywords
    const goalKeywords = goal.toLowerCase().split(' ');
    const urlMatches = goalKeywords.some(keyword => currentUrl.toLowerCase().includes(keyword));
    const titleMatches = goalKeywords.some(keyword => pageTitle.toLowerCase().includes(keyword));
    const textMatches = goalKeywords.some(keyword => pageText.toLowerCase().includes(keyword));

    return urlMatches || titleMatches || textMatches;
  } catch (error) {
    console.warn(`[GOAL_DECISION] Error checking goal: ${error.message}`);
    return false;
  }
}

module.exports = {
  getNextActionForGoal,
  isGoalAchieved,
};

