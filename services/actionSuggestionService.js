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
 * Enriches actionable elements with surrounding context
 * @param {Page} page - Playwright page instance
 * @param {Array} elements - Array of actionable elements
 * @returns {Promise<Array>} Elements enriched with context
 */
async function enrichElementsWithContext(page, elements) {
  console.log(`[ACTION_SUGGESTION] Enriching ${elements.length} elements with context...`);
  
  // Use page.evaluate to get context for all elements at once
  const elementsData = elements.map(el => ({
    tagName: el.tagName,
    text: el.text,
    ariaLabel: el.ariaLabel,
    href: el.href,
    placeholder: el.placeholder,
    type: el.type,
    boundingBox: el.boundingBox,
  }));

  const contexts = await page.evaluate((elementsData) => {
    return elementsData.map((elData) => {
      try {
        // Try to find element by various methods
        let element = null;
        
        // Try by ID first (if we can infer it from context)
        // Try by text content and tag
        const allElements = Array.from(document.querySelectorAll(elData.tagName));
        element = allElements.find((el) => {
          const box = el.getBoundingClientRect();
          return (
            Math.abs(box.x - (elData.boundingBox?.x || 0)) < 5 &&
            Math.abs(box.y - (elData.boundingBox?.y || 0)) < 5 &&
            Math.abs(box.width - (elData.boundingBox?.width || 0)) < 5 &&
            Math.abs(box.height - (elData.boundingBox?.height || 0)) < 5
          );
        });

        if (!element) {
          // Fallback: try to find by text content
          if (elData.text) {
            element = allElements.find((el) => 
              el.textContent?.trim() === elData.text.trim()
            );
          }
        }

        if (!element) {
          // Return minimal context if element not found
          return {
            label: null,
            placeholder: elData.placeholder || null,
            type: elData.type || null,
            id: null,
            name: null,
            className: null,
            ariaLabel: elData.ariaLabel || null,
            ariaDescribedBy: null,
            parentText: null,
            siblingText: null,
          };
        }

        const context = {
          label: null,
          placeholder: element.placeholder || null,
          type: element.type || null,
          id: element.id || null,
          name: element.name || null,
          className: element.className || null,
          ariaLabel: element.getAttribute('aria-label'),
          ariaDescribedBy: element.getAttribute('aria-describedby'),
          parentText: null,
          siblingText: null,
        };

        // Find associated label
        if (element.id) {
          const label = document.querySelector(`label[for="${element.id}"]`);
          if (label) {
            context.label = label.textContent?.trim() || null;
          }
        }

        // Get parent element text (if it's a container)
        const parent = element.parentElement;
        if (parent) {
          const parentText = parent.textContent?.trim();
          if (parentText && parentText.length < 200) {
            context.parentText = parentText;
          }
        }

        // Get sibling text (previous and next siblings)
        const prevSibling = element.previousElementSibling;
        const nextSibling = element.nextElementSibling;
        if (prevSibling) {
          const prevText = prevSibling.textContent?.trim();
          if (prevText && prevText.length < 100) {
            context.siblingText = prevText;
          }
        } else if (nextSibling) {
          const nextText = nextSibling.textContent?.trim();
          if (nextText && nextText.length < 100) {
            context.siblingText = nextText;
          }
        }

        return context;
      } catch (error) {
        // Return minimal context on error
        return {
          label: null,
          placeholder: elData.placeholder || null,
          type: elData.type || null,
          id: null,
          name: null,
          className: null,
          ariaLabel: elData.ariaLabel || null,
          ariaDescribedBy: null,
          parentText: null,
          siblingText: null,
        };
      }
    });
  }, elementsData);

  // Merge contexts with elements
  return elements.map((element, index) => ({
    ...element,
    context: contexts[index] || {
      label: null,
      placeholder: element.placeholder || null,
      type: element.type || null,
      id: null,
      name: null,
      className: null,
      ariaLabel: element.ariaLabel || null,
      ariaDescribedBy: null,
      parentText: null,
      siblingText: null,
    },
  }));
}

/**
 * Gets action suggestions from LLM for a batch of elements
 * @param {Array} elements - Array of enriched actionable elements
 * @param {Function} progressCallback - Optional progress callback (progress, message, metadata)
 * @returns {Promise<Array>} Elements with action suggestions
 */
async function getActionSuggestionsFromLLM(elements, progressCallback = null) {
  const useLiveAI = !!process.env.OPENAI_API_KEY;

  if (!useLiveAI) {
    console.log("[ACTION_SUGGESTION] No OPENAI_API_KEY, returning mock suggestions...");
    if (progressCallback) {
      progressCallback(100, 'Using mock suggestions (no API key)', { total: elements.length });
    }
    return elements.map((el) => ({
      ...el,
      actionSuggestion: {
        action: el.category === 'input' ? 'fill' : 'click',
        data_type: el.category === 'input' ? 'text' : null,
        purpose: 'user_interaction',
        confidence: 0.7,
      },
    }));
  }

  try {
    const client = getOpenAIClient();
    
    // Process in batches to avoid token limits
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < elements.length; i += batchSize) {
      batches.push(elements.slice(i, i + batchSize));
    }

    console.log(`[ACTION_SUGGESTION] Processing ${batches.length} batches of elements...`);

    const results = [];
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      if (progressCallback) {
        const batchProgress = 65 + Math.floor((i / batches.length) * 25); // 65-90%
        progressCallback(
          batchProgress,
          `Processing AI suggestions: batch ${i + 1} of ${batches.length}...`,
          { current: i + 1, total: batches.length, batchSize: batch.length }
        );
      }
      
      const batchResults = await processBatch(client, batch);
      results.push(...batchResults);
    }

    if (progressCallback) {
      progressCallback(90, 'AI suggestions completed', { total: results.length });
    }

    return results;
  } catch (error) {
    console.error(`[ACTION_SUGGESTION] Error getting suggestions: ${error.message}`);
    // Return elements without suggestions on error
    return elements.map((el) => ({
      ...el,
      actionSuggestion: {
        action: el.category === 'input' ? 'fill' : 'click',
        data_type: null,
        suggested_value: null,
        purpose: 'user_interaction',
        expected_navigation: null,
        confidence: 0.3,
      },
    }));
  }
}

/**
 * Process a batch of elements through LLM
 */
async function processBatch(client, batch) {
  const prompt = `You are an AI assistant that analyzes HTML elements and suggests what actions should be taken on them.

For each element provided, analyze it and suggest:
1. What action to take (fill, click, select, etc.)
2. What type of data to input (if it's an input field)
3. What the expected outcome is (if it's a button/link)
4. A suggested value (if applicable)

Return a JSON object with a "suggestions" array containing one object per element in the same order.

REQUIRED JSON STRUCTURE:
{
  "suggestions": [
    {
      "action": "fill|click|select|navigate",
      "data_type": "email|password|text|number|phone|url|date|etc" (null if not applicable),
      "suggested_value": "example value" (null if not applicable),
      "purpose": "authentication|navigation|form_submission|search|etc",
      "expected_navigation": "url or route" (null if not applicable),
      "confidence": 0.0-1.0
    }
  ]
}

ELEMENTS TO ANALYZE:
${JSON.stringify(
  batch.map((el) => ({
    tagName: el.tagName,
    category: el.category,
    text: el.text,
    ariaLabel: el.ariaLabel,
    href: el.href,
    placeholder: el.placeholder || el.context?.placeholder,
    type: el.type || el.context?.type,
    id: el.context?.id,
    name: el.context?.name,
    label: el.context?.label,
    parentText: el.context?.parentText,
    siblingText: el.context?.siblingText,
  })),
  null,
  2
)}

Return ONLY valid JSON object, no markdown, no code blocks, no explanations.`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o", // or "gpt-4" if gpt-4o is not available
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing web UI elements and suggesting appropriate user actions. Always return valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    let suggestions;

    try {
      // Parse JSON response
      const parsed = JSON.parse(content);
      // Extract suggestions array
      if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        suggestions = parsed.suggestions;
      } else if (Array.isArray(parsed)) {
        suggestions = parsed;
      } else {
        // Try to find array in the response
        const arrayMatch = content.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          suggestions = JSON.parse(arrayMatch[0]);
        } else {
          throw new Error("Could not find suggestions array in response");
        }
      }
    } catch (parseError) {
      console.error("[ACTION_SUGGESTION] JSON parse error:", parseError);
      // Fallback: create default suggestions
      suggestions = batch.map(() => ({
        action: "click",
        data_type: null,
        suggested_value: null,
        purpose: "user_interaction",
        expected_navigation: null,
        confidence: 0.5,
      }));
    }

    // Ensure we have the right number of suggestions
    while (suggestions.length < batch.length) {
      suggestions.push({
        action: "click",
        data_type: null,
        suggested_value: null,
        purpose: "user_interaction",
        expected_navigation: null,
        confidence: 0.5,
      });
    }

    // Merge suggestions with elements
    return batch.map((element, index) => ({
      ...element,
      actionSuggestion: suggestions[index] || {
        action: element.category === 'input' ? 'fill' : 'click',
        data_type: null,
        suggested_value: null,
        purpose: 'user_interaction',
        expected_navigation: null,
        confidence: 0.5,
      },
    }));
  } catch (error) {
    console.error(`[ACTION_SUGGESTION] Error processing batch: ${error.message}`);
    // Return elements without suggestions on error
    return batch.map((el) => ({
      ...el,
      actionSuggestion: {
        action: el.category === 'input' ? 'fill' : 'click',
        data_type: null,
        suggested_value: null,
        purpose: 'user_interaction',
        expected_navigation: null,
        confidence: 0.3,
      },
    }));
  }
}

/**
 * Main function to get action suggestions for actionable elements
 * @param {Page} page - Playwright page instance
 * @param {Array} elements - Array of actionable elements
 * @param {Function} progressCallback - Optional progress callback (progress, message, metadata)
 * @returns {Promise<Array>} Elements with action suggestions
 */
async function getActionSuggestions(page, elements, progressCallback = null) {
  console.log(`[ACTION_SUGGESTION] Getting action suggestions for ${elements.length} elements...`);

  // Step 1: Enrich elements with context
  if (progressCallback) {
    progressCallback(55, 'Enriching elements with context...', { total: elements.length });
  }
  const enrichedElements = await enrichElementsWithContext(page, elements);

  if (progressCallback) {
    progressCallback(60, 'Context enrichment completed', { total: enrichedElements.length });
  }

  // Step 2: Get suggestions from LLM
  const elementsWithSuggestions = await getActionSuggestionsFromLLM(enrichedElements, progressCallback);

  console.log(`[ACTION_SUGGESTION] Successfully added suggestions to ${elementsWithSuggestions.length} elements`);
  
  return elementsWithSuggestions;
}

module.exports = {
  getActionSuggestions,
  enrichElementsWithContext,
};

