/**
 * Runs accessibility checks on the page
 * @param {Page} page - Playwright page instance
 * @returns {Promise<Object>} Accessibility data
 */
async function checkAccessibility(page) {
  console.log("[ACCESSIBILITY] Running accessibility checks...");
  const accessibilityData = await page.evaluate(() => {
    const images = document.querySelectorAll("img");
    const links = document.querySelectorAll("a");
    const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const buttons = document.querySelectorAll("button");
    const inputs = document.querySelectorAll("input, textarea, select");

    let imagesWithoutAlt = 0;
    let linksWithoutText = 0;
    let buttonsWithoutText = 0;

    images.forEach((img) => {
      if (!img.alt && !img.getAttribute("aria-label")) {
        imagesWithoutAlt++;
      }
    });

    links.forEach((link) => {
      const text = link.textContent?.trim();
      const ariaLabel = link.getAttribute("aria-label");
      if (!text && !ariaLabel && !link.querySelector("img")) {
        linksWithoutText++;
      }
    });

    buttons.forEach((button) => {
      const text = button.textContent?.trim();
      const ariaLabel = button.getAttribute("aria-label");
      const ariaLabelledBy = button.getAttribute("aria-labelledby");
      if (!text && !ariaLabel && !ariaLabelledBy) {
        buttonsWithoutText++;
      }
    });

    return {
      totalImages: images.length,
      imagesWithoutAlt,
      totalLinks: links.length,
      linksWithoutText,
      totalHeadings: headings.length,
      totalButtons: buttons.length,
      buttonsWithoutText,
      totalInputs: inputs.length,
      hasH1: document.querySelector("h1") !== null,
    };
  });
  console.log("[ACCESSIBILITY] Accessibility checks completed");
  return accessibilityData;
}

module.exports = {
  checkAccessibility,
};



