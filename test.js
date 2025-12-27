/**
 * Verification script for SessionManager service
 * Tests session creation, retrieval, and captureState functionality
 */
const SessionManager = require('./services/sessionManagerService');

// Test session creation, retrieval, and captureState
async function testSessionManager() {
  console.log('Testing SessionManager...\n');

  try {
    // Create a session for user1 with a URL that has buttons
    console.log('Creating session for user1 with URL...');
    const testUrl = 'https://www.amazon.com'; // You can change this to any URL with buttons
    const createdSession = await SessionManager.createSession('user1', testUrl);
    console.log('Created session:', {
      status: createdSession.status,
      createdAt: createdSession.createdAt,
      hasBrowser: !!createdSession.browser,
      hasPage: !!createdSession.page,
    });

    // Retrieve the session for user1
    const retrievedSession = SessionManager.getSession('user1');
    console.log('\nRetrieved session:', {
      status: retrievedSession.status,
      createdAt: retrievedSession.createdAt,
      hasBrowser: !!retrievedSession.browser,
      hasPage: !!retrievedSession.page,
    });

    // Verify data persistence
    if (retrievedSession && retrievedSession.status === 'active' && retrievedSession.browser && retrievedSession.page) {
      console.log('\n✅ SUCCESS: Session data persisted correctly!');
      console.log('Session status:', retrievedSession.status);
      console.log('Session created at:', retrievedSession.createdAt);
      console.log('Browser instance:', retrievedSession.browser ? 'Present' : 'Missing');
      console.log('Page instance:', retrievedSession.page ? 'Present' : 'Missing');
      
      // Wait a bit for page to fully load before capturing state
      console.log('\n⏳ Waiting 3 seconds for page to fully load...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test captureState
      console.log('\n📸 Testing captureState...');
      try {
        const state = await SessionManager.captureState('user1');
        
        console.log('\n✅ Capture State Results:');
        console.log('- Screenshot length:', state.screenshot ? state.screenshot.length : 0, 'characters (base64)');
        console.log('- Interactive elements (buttons) found:', state.interactiveElements.length);
        
        if (state.interactiveElements.length > 0) {
          console.log('\n📋 Interactive elements details:');
          state.interactiveElements.slice(0, 5).forEach((element, index) => {
            const textPreview = element.text ? element.text.substring(0, 50).replace(/\n/g, ' ') : '(no text)';
            console.log(`  ${index + 1}. ID: ${element.id || 'N/A'}`);
            console.log(`     Text: "${textPreview}${element.text && element.text.length > 50 ? '...' : ''}"`);
            console.log(`     Coordinates: x=${element.coordinates.x}, y=${element.coordinates.y}, width=${element.coordinates.width}, height=${element.coordinates.height}`);
            console.log('');
          });
          
          if (state.interactiveElements.length > 5) {
            console.log(`  ... and ${state.interactiveElements.length - 5} more elements\n`);
          }
        } else {
          console.log('⚠️  No buttons found on the page');
          console.log('   (This is normal for some pages like example.com)');
        }

        console.log('\n✅ SUCCESS: captureState works correctly!');
      } catch (captureError) {
        console.error('\n❌ ERROR capturing state:', captureError.message);
        throw captureError;
      }

      console.log('\n⏳ Keeping browser open for 10 seconds for visual verification...');
      console.log('   You should see the browser window with the loaded page.');
      
      // Keep process running for 10 seconds
      setTimeout(async () => {
        console.log('\nClosing session and cleaning up...');
        await SessionManager.closeSession('user1');
        console.log('✅ Test completed successfully!');
        process.exit(0);
      }, 10000);
    } else {
      console.log('\n❌ FAILED: Session data was not persisted correctly.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testSessionManager();

