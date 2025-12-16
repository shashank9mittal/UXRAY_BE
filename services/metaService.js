/**
 * Extracts meta information from the page
 * @param {Page} page - Playwright page instance
 * @returns {Promise<Object>} Meta information
 */
async function getMetaInfo(page) {
  const metaInfo = await page.evaluate(() => {
    const getMeta = (name) => {
      const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
      return meta ? meta.getAttribute("content") : null;
    };

    return {
      description: getMeta("description") || getMeta("og:description"),
      keywords: getMeta("keywords"),
      author: getMeta("author"),
      viewport: getMeta("viewport"),
    };
  });
  return metaInfo;
}

module.exports = {
  getMetaInfo,
};


