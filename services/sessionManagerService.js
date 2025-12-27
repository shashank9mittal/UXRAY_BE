const { WebSocket } = require("ws");
const { chromium } = require("playwright");

/**
 * SessionManager Service
 * Manages user sessions in-memory using a Map data structure
 */
class SessionManager {
  constructor() {
    this.activeSessions = new Map();
  }

  /**
   * Create a new session for a user with browser instance
   * @param {string} userId - The unique identifier for the user
   * @param {string} [url] - Optional URL to navigate to after creating the page
   * @returns {Promise<Object>} The created session object with browser and page
   */
  async createSession(userId, url = null) {
    try {
      // Launch Chromium browser instance
      const browser = await chromium.launch({ headless: false });
      
      // Create a new browser context
      const context = await browser.newContext();
      
      // Create a new page
      const page = await context.newPage();
      
      // Navigate to URL if provided
      if (url) {
        try {
          console.log(`[SESSION] Navigating to URL: ${url}`);
          const response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
          const statusCode = response?.status() || 200;
          console.log(`[SESSION] Navigation completed. Status: ${statusCode}`);
          
          // Wait a bit for page to fully render
          await page.waitForTimeout(500);
        } catch (navError) {
          console.error(`[SESSION] Error navigating to URL: ${navError.message}`);
          // Continue with session creation even if navigation fails
        }
      }
      
      const session = {
        browser,
        page,
        status: 'active',
        createdAt: new Date(),
      };
      
      this.activeSessions.set(userId, session);
      return session;
    } catch (error) {
      console.error(`[SESSION] Error creating session for ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Retrieve a session for a user
   * @param {string} userId - The unique identifier for the user
   * @returns {Object|undefined} The session object if found, undefined otherwise
   */
  getSession(userId) {
    return this.activeSessions.get(userId);
  }

  /**
   * Navigate an existing session to a URL
   * @param {string} userId - The unique identifier for the user
   * @param {string} url - The URL to navigate to
   * @returns {Promise<boolean>} True if navigation succeeded, false otherwise
   */
  async navigateToUrl(userId, url) {
    const session = this.getSession(userId);
    
    if (!session || !session.page) {
      console.error(`[SESSION] Cannot navigate: session or page not found for ${userId}`);
      return false;
    }

    try {
      console.log(`[SESSION] Navigating session ${userId} to URL: ${url}`);
      const response = await session.page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      const statusCode = response?.status() || 200;
      console.log(`[SESSION] Navigation completed. Status: ${statusCode}`);
      
      // Wait a bit for page to fully render
      await session.page.waitForTimeout(500);
      return true;
    } catch (error) {
      console.error(`[SESSION] Error navigating to URL: ${error.message}`);
      return false;
    }
  }

  /**
   * Store WebSocket connection for a user session
   * @param {string} userId - The unique identifier for the user
   * @param {WebSocket} ws - The WebSocket connection object
   */
  async setSocket(userId, ws) {
    let session = this.getSession(userId);
    if (!session) {
      session = await this.createSession(userId);
    }
    session.socket = ws;
    this.activeSessions.set(userId, session);
  }

  /**
   * Send an update message to a user via their WebSocket connection
   * @param {string} userId - The unique identifier for the user
   * @param {string} type - The message type
   * @param {Object} payload - The message payload
   * @returns {boolean} True if message was sent, false otherwise
   */
  sendUpdate(userId, type, payload) {
    const session = this.getSession(userId);
    
    if (!session || !session.socket) {
      return false;
    }

    const ws = session.socket;
    
    // Check if socket is open (WebSocket.OPEN = 1)
    if (ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type, payload });
      ws.send(message);
      return true;
    }
    
    return false;
  }

  /**
   * Close a session and clean up browser resources
   * @param {string} userId - The unique identifier for the user
   * @returns {Promise<boolean>} True if session was closed, false if session didn't exist
   */
  async closeSession(userId) {
    const session = this.getSession(userId);
    
    if (!session) {
      return false;
    }

    try {
      // Close browser instance if it exists
      if (session.browser) {
        await session.browser.close();
      }
      
      // Remove session from Map
      this.activeSessions.delete(userId);
      return true;
    } catch (error) {
      console.error(`[SESSION] Error closing session for ${userId}:`, error.message);
      // Still remove from Map even if close fails
      this.activeSessions.delete(userId);
      return true;
    }
  }
}

// Export as singleton instance
module.exports = new SessionManager();
