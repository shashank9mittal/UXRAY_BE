/**
 * Verification script for SessionManager service
 * Tests session creation and retrieval to prove data persistence
 */
const SessionManager = require('./services/sessionManagerService');

// Test session creation and retrieval
async function testSessionManager() {
  console.log('Testing SessionManager...\n');

  try {
    // Create a session for user1 (now async)
    console.log('Creating session for user1...');
    const createdSession = await SessionManager.createSession('user1');
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
      console.log('\n⏳ Keeping browser open for 10 seconds for visual verification...');
      
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
    process.exit(1);
  }
}

// Run the test
testSessionManager();

