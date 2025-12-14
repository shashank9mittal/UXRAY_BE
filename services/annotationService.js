const { createCanvas, loadImage } = require("canvas");
const fs = require("fs").promises;
const path = require("path");

/**
 * Annotates a screenshot with AI coordinates and navigation elements
 * Phase 3: Implements bounding box drawing and issue ID badges
 * @param {Buffer} screenshotBuffer - Original screenshot buffer
 * @param {Array} aiCoordinates - AI detected coordinates with labels
 * @param {Array} navigationElements - Navigation elements (links, buttons)
 * @param {Array} report - Mock report with coordinates and issue IDs
 * @param {string} originalFilename - Original screenshot filename
 * @returns {Promise<{filename: string, url: string, base64: string}>} Annotated screenshot info
 */
async function annotateScreenshot(
  screenshotBuffer,
  aiCoordinates,
  navigationElements,
  report,
  originalFilename
) {
  console.log("[ANNOTATION] Starting screenshot annotation (Phase 3)...");

  // B3.1: Load the screenshot buffer into Canvas object
  console.log("[ANNOTATION] B3.1: Loading screenshot buffer into Canvas...");
  const img = await loadImage(screenshotBuffer);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");

  // Draw the original image
  ctx.drawImage(img, 0, 0);
  console.log(`[ANNOTATION] Canvas created: ${img.width}x${img.height}px`);

  // B3.2: Draw bounding boxes from mock report coordinates
  if (report && report.length > 0) {
    console.log(`[ANNOTATION] B3.2: Drawing ${report.length} bounding boxes from report...`);
    report.forEach((issue) => {
      if (issue.coordinates) {
        const { x, y, width, height } = issue.coordinates;

        // Draw red strokeRect around each area
        ctx.strokeStyle = "red";
        ctx.lineWidth = 3;
        ctx.setLineDash([]); // Solid line for report issues
        ctx.strokeRect(x, y, width, height);

        // B3.3: Draw issue ID badge (filled circle with number)
        if (issue.id) {
          const badgeRadius = 15;
          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;
          
          // Smart badge positioning: try right side first, then left, then top
          let badgeX, badgeY;
          if (x + width + badgeRadius + 10 < canvasWidth) {
            // Position to the right of the box
            badgeX = x + width + badgeRadius + 5;
            badgeY = y + badgeRadius;
          } else if (x - badgeRadius - 10 > 0) {
            // Position to the left of the box
            badgeX = x - badgeRadius - 5;
            badgeY = y + badgeRadius;
          } else {
            // Position above the box
            badgeX = x + badgeRadius;
            badgeY = Math.max(badgeRadius + 5, y - badgeRadius - 5);
          }

          // Draw filled circle (badge)
          ctx.fillStyle = "red";
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, badgeRadius, 0, 2 * Math.PI);
          ctx.fill();

          // Draw white border for better visibility
          ctx.strokeStyle = "white";
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw issue ID number in white text
          ctx.fillStyle = "white";
          ctx.font = "bold 14px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(issue.id.toString(), badgeX, badgeY);
        }
      }
    });
  }

  // Draw AI coordinate boxes
  if (aiCoordinates && aiCoordinates.length > 0) {
    console.log(`[ANNOTATION] Drawing ${aiCoordinates.length} AI coordinate boxes`);
    aiCoordinates.forEach((coord, index) => {
      const { x, y, width, height, label, confidence } = coord;

      // Draw semi-transparent rectangle
      ctx.strokeStyle = `rgba(255, 0, 0, 0.8)`;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, width, height);

      // Draw label background
      const labelText = label || `Region ${index + 1}`;
      const confidenceText = confidence ? ` (${(confidence * 100).toFixed(0)}%)` : "";
      const fullLabel = `${labelText}${confidenceText}`;

      ctx.font = "bold 14px Arial";
      const textMetrics = ctx.measureText(fullLabel);
      const textWidth = textMetrics.width;
      const textHeight = 20;
      const padding = 5;

      // Label background
      ctx.fillStyle = "rgba(255, 0, 0, 0.9)";
      ctx.fillRect(x, y - textHeight - padding * 2, textWidth + padding * 2, textHeight + padding);

      // Label text
      ctx.fillStyle = "white";
      ctx.textBaseline = "top";
      ctx.fillText(fullLabel, x + padding, y - textHeight - padding);
    });
  }

  // Draw navigation element boxes (links and buttons)
  if (navigationElements && navigationElements.length > 0) {
    console.log(`[ANNOTATION] Drawing ${navigationElements.length} navigation elements`);
    
    // Group by type for different colors
    const links = navigationElements.filter((el) => el.type === "a");
    const buttons = navigationElements.filter((el) => el.type === "button");

    // Draw links in blue
    links.forEach((link) => {
      const { boundingBox } = link;
      ctx.strokeStyle = "rgba(0, 0, 255, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(
        boundingBox.x,
        boundingBox.y,
        boundingBox.width,
        boundingBox.height
      );
    });

    // Draw buttons in green
    buttons.forEach((button) => {
      const { boundingBox } = button;
      ctx.strokeStyle = "rgba(0, 255, 0, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(
        boundingBox.x,
        boundingBox.y,
        boundingBox.width,
        boundingBox.height
      );
    });
  }

  // Generate annotated filename
  const baseFilename = originalFilename.replace(".png", "");
  const annotatedFilename = `${baseFilename}_annotated.png`;
  const filepath = path.join(__dirname, "../screenshots", annotatedFilename);

  // B3.1: Save the loaded screenshot back to verify (and save annotated version)
  const buffer = canvas.toBuffer("image/png");
  await fs.writeFile(filepath, buffer);
  console.log(`[ANNOTATION] B3.1: Annotated screenshot saved: ${annotatedFilename} (${(buffer.length / 1024).toFixed(2)} KB)`);

  // Convert to base64 for API response
  const base64 = buffer.toString("base64");

  return {
    filename: annotatedFilename,
    url: `/screenshots/${annotatedFilename}`,
    base64: base64, // Return base64 for verification
  };
}

module.exports = {
  annotateScreenshot,
};

