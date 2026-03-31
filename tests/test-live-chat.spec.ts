import { test, expect } from '@playwright/test';

test('Test LIVE nexusad.ai chat functionality', async ({ page }) => {
  console.log('🔍 Starting live chat test...');

  // 1. Go to chat page
  console.log('📍 Navigating to https://nexusad.ai/chat');
  await page.goto('https://nexusad.ai/chat', { waitUntil: 'networkidle' });

  // 2. Check if redirected to login
  const currentUrl = page.url();
  console.log(`📍 Current URL: ${currentUrl}`);

  if (currentUrl.includes('/login')) {
    console.log('🔐 Redirected to login - need to authenticate');

    // Look for Google login button
    const googleButton = page.locator('button:has-text("Sign in with Google"), button:has-text("Continue with Google"), a:has-text("Google")').first();
    if (await googleButton.isVisible()) {
      console.log('✅ Found Google login button');
      // Can't actually login with Google in test, but shows auth is required
    } else {
      console.log('❌ No Google login button found');
    }

    throw new Error('Cannot proceed - authentication required. User must be logged in.');
  }

  // 3. We're on chat page - check for elements
  console.log('✅ On chat page - checking UI elements');

  // Check for chat input
  const chatInput = page.locator('textarea[placeholder*="Ask"], input[placeholder*="Ask"], textarea[placeholder*="Type"], input[placeholder*="Type"]').first();
  const inputVisible = await chatInput.isVisible();
  console.log(`💬 Chat input visible: ${inputVisible}`);

  if (!inputVisible) {
    // Try to find any input/textarea
    const anyInput = await page.locator('textarea, input[type="text"]').first();
    if (await anyInput.isVisible()) {
      console.log('📝 Found alternative input element');
    } else {
      console.log('❌ No input element found at all!');
    }
  }

  // 4. Check for error messages
  const errorMessages = await page.locator('text=/something went wrong|error|failed|unavailable/i').all();
  if (errorMessages.length > 0) {
    console.log(`⚠️ Found ${errorMessages.length} error message(s):`);
    for (const error of errorMessages) {
      const text = await error.textContent();
      console.log(`   - "${text}"`);
    }
  }

  // 5. Try to send a message
  if (inputVisible) {
    console.log('📤 Attempting to send test message...');

    // Type message
    await chatInput.fill('Test message from Playwright');

    // Find send button
    const sendButton = page.locator('button[type="submit"], button:has-text("Send"), button[aria-label*="Send"]').first();

    if (await sendButton.isVisible()) {
      console.log('🚀 Clicking send button...');

      // Set up network monitoring
      const responsePromise = page.waitForResponse(
        resp => resp.url().includes('/api/proxy/chat') || resp.url().includes('/api/v1/chat'),
        { timeout: 10000 }
      ).catch(() => null);

      await sendButton.click();

      // Wait for response
      const response = await responsePromise;
      if (response) {
        console.log(`📡 API Response: ${response.status()} ${response.statusText()}`);
        if (response.status() !== 200) {
          const body = await response.text().catch(() => 'Could not read body');
          console.log(`📋 Response body: ${body.substring(0, 200)}`);
        }
      } else {
        console.log('⏱️ No API response received within 10 seconds');
      }

      // Check for any new error messages
      await page.waitForTimeout(2000);
      const newErrors = await page.locator('text=/something went wrong|error|failed|unavailable/i').all();
      if (newErrors.length > errorMessages.length) {
        console.log('❌ New error appeared after sending message!');
      }
    } else {
      console.log('❌ Send button not found!');
    }
  }

  // 6. Take screenshot for debugging
  await page.screenshot({ path: '/tmp/nexusad-chat-test.png', fullPage: true });
  console.log('📸 Screenshot saved to /tmp/nexusad-chat-test.png');

  // 7. Log all console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`🔴 Browser console error: ${msg.text()}`);
    }
  });

  // 8. Check network requests
  const requests = [];
  page.on('request', request => {
    if (request.url().includes('api')) {
      requests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers()
      });
    }
  });

  page.on('requestfailed', request => {
    console.log(`❌ Request failed: ${request.url()} - ${request.failure()?.errorText}`);
  });

  // Wait a bit to catch any errors
  await page.waitForTimeout(3000);

  console.log(`\n📊 Total API requests made: ${requests.length}`);
  requests.forEach((req, i) => {
    console.log(`${i + 1}. ${req.method} ${req.url}`);
  });
});