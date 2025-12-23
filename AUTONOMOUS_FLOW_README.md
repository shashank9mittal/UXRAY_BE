# Autonomous Flow Implementation (Step 4)

This document describes the autonomous web interaction implementation based on the 4-step approach from `steps.txt`.

## Overview

The autonomous flow service implements **Step 4: Execute Action and Loop**, completing the full autonomous navigation system:

1. ✅ **Step 1**: Capture Actionable Elements (already implemented)
2. ✅ **Step 2**: Formulate LLM Prompt (already implemented)
3. ✅ **Step 3**: API Call and Decision Parsing (already implemented)
4. ✅ **Step 4**: Execute Action and Loop (**NEW - just implemented**)

## New Services Created

### 1. `actionExecutionService.js`
Executes actions on web elements using Playwright.

**Functions:**
- `executeAction(page, element, actionSuggestion)` - Executes click, fill, or select actions

**Features:**
- Multiple element finding strategies (ID, name, text, bounding box)
- Handles click, fill, and select actions
- Waits for network activity after clicks
- Error handling and fallback methods

### 2. `goalDecisionService.js`
Gets LLM decision for the next action based on a specific goal.

**Functions:**
- `getNextActionForGoal(page, goal, elements)` - Selects ONE element for a goal
- `isGoalAchieved(page, goal)` - Checks if goal has been achieved

**Features:**
- Goal-based element selection (different from general suggestions)
- Structured JSON output with rationale
- Goal achievement checking

### 3. `autonomousFlowService.js`
Main service that orchestrates the autonomous navigation loop.

**Functions:**
- `autonomousFlow(url, goal, options, progressCallback)` - Main autonomous flow

**Features:**
- Loops through steps until goal achieved or max steps reached
- Integrates all services (detection, suggestions, decisions, execution)
- Progress tracking for SSE
- Step recording with screenshots (optional)

## New API Endpoint

### POST `/analyze/autonomous`

**Request Body:**
```json
{
  "url": "https://example.com",
  "goal": "navigate to product details page",
  "maxSteps": 10,
  "waitBetweenSteps": 1000,
  "takeScreenshots": false
}
```

**Response (JSON):**
```json
{
  "message": "Goal achieved!",
  "goal": "navigate to product details page",
  "goalAchieved": true,
  "startingUrl": "https://example.com",
  "finalUrl": "https://example.com/products/item-123",
  "finalTitle": "Product Details - Example",
  "stepsCompleted": 3,
  "totalSteps": 3,
  "steps": [
    {
      "step": 1,
      "url": "https://example.com",
      "decision": {
        "selected_element": {
          "text": "Products",
          "category": "link"
        },
        "action": "click",
        "input_data": null,
        "rationale": "Clicking Products link to navigate to products page"
      },
      "execution": {
        "success": true,
        "action": "click"
      },
      "timestamp": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

**Response (SSE - with `?stream=true` or `Accept: text/event-stream`):**
- Real-time progress updates
- Step completion events
- Final completion event

## Usage Examples

### Basic Usage (JSON)

```javascript
const response = await fetch('http://localhost:3000/analyze/autonomous', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://example.com',
    goal: 'find and click the sign up button',
    maxSteps: 5,
  }),
});

const result = await response.json();
console.log('Goal achieved:', result.goalAchieved);
console.log('Steps:', result.steps);
```

### With SSE Streaming

```javascript
const response = await fetch('http://localhost:3000/analyze/autonomous?stream=true', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
  },
  body: JSON.stringify({
    url: 'https://example.com',
    goal: 'navigate to login page',
    maxSteps: 10,
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      
      if (data.type === 'progress') {
        console.log(`${data.progress}% - ${data.message}`);
      } else if (data.type === 'step_completed') {
        console.log(`Step ${data.step} completed:`, data.decision);
      } else if (data.type === 'complete') {
        console.log('Flow complete!', data);
      }
    }
  }
}
```

## How It Works

1. **Start**: Launches browser and navigates to starting URL
2. **Loop** (up to `maxSteps` times):
   - **Step 1**: Detect all actionable elements
   - **Step 2**: Enrich elements with context and get AI suggestions
   - **Step 3**: Get LLM decision for the goal (selects ONE element)
   - **Step 4**: Execute the action (click/fill/select)
   - **Check**: Verify if goal is achieved
   - **Continue**: If goal not achieved, loop back to Step 1
3. **End**: Return results with all steps recorded

## Goal Examples

- `"navigate to product details page"`
- `"sign in to the account"`
- `"search for laptops"`
- `"add item to cart"`
- `"navigate to checkout page"`

## Options

- `maxSteps` (default: 10) - Maximum number of steps before stopping
- `waitBetweenSteps` (default: 1000ms) - Wait time between steps
- `takeScreenshots` (default: false) - Take screenshots at each step

## Error Handling

- Invalid URL: Returns 400 error
- Missing goal: Returns 400 error
- LLM errors: Falls back to mock decisions if API key missing
- Element not found: Logs warning and continues
- Network errors: Handled gracefully

## Integration with Existing Services

The autonomous flow integrates seamlessly with existing services:
- Uses `navigationService` for element detection
- Uses `actionSuggestionService` for AI suggestions
- Uses `browserService` for browser management
- Uses `goalDecisionService` for goal-based decisions
- Uses `actionExecutionService` for action execution

## Testing

Test the autonomous flow:

```bash
curl -X POST http://localhost:3000/analyze/autonomous \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "goal": "navigate to about page",
    "maxSteps": 5
  }'
```

## Next Steps

- Enhance goal achievement detection (more sophisticated checks)
- Add support for more action types (scroll, hover, etc.)
- Improve element finding strategies
- Add retry logic for failed actions
- Add screenshot comparison for goal verification

