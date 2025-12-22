/**
 * Gets basic page information including title, dimensions, and viewport
 * @param {Page} page - Playwright page instance
 * @returns {Promise<Object>} Page information
 */
async function getPageInfo(page) {
  const pageTitle = await page.title();
  console.log(`[PAGE_INFO] Page title: ${pageTitle}`);

  const viewportSize = page.viewportSize();
  const pageDimensions = await page.evaluate(() => {
    return {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  return {
    title: pageTitle,
    viewport: {
      width: viewportSize?.width || null,
      height: viewportSize?.height || null,
    },
    dimensions: pageDimensions,
  };
}

module.exports = {
  getPageInfo,
};



