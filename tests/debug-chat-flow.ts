/**
 * DIAGNOSTIC SCRIPT: Test the full chat flow on nexusad.ai
 *
 * This script acts as a real user and captures:
 * - All network requests/responses
 * - All console errors
 * - Screenshots at each step
 * - Cookie state
 * - CSRF token flow
 *
 * Run: npx playwright test tests/debug-chat-flow.ts --project=desktop --headed
 * Or headless: npx playwright test tests/debug-chat-flow.ts --project=desktop
 */

import { test, expect } from "@playwright/test";

const SITE_URL = "https://nexusad.ai";
const SCREENSHOTS_DIR = "/Users/antonybousader/nexad-live/tests/debug-screenshots";

// Collect all network requests and responses
const networkLog: Array<{
  timestamp: string;
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  error?: string;
}> = [];

// Collect all console errors
const consoleErrors: Array<{
  timestamp: string;
  type: string;
  text: string;
  location?: string;
}> = [];

test.describe("NexusAD Chat Flow Debug", () => {
  test("Full user journey: load -> login -> chat -> send message", async ({ page }) => {
    // ========================================================================
    // STEP 0: Set up listeners for ALL network requests and console messages
    // ========================================================================

    // Listen for ALL console messages
    page.on("console", (msg) => {
      consoleErrors.push({
        timestamp: new Date().toISOString(),
        type: msg.type(),
        text: msg.text(),
        location: msg.location()?.url,
      });
    });

    // Listen for page errors (uncaught exceptions)
    page.on("pageerror", (error) => {
      consoleErrors.push({
        timestamp: new Date().toISOString(),
        type: "PAGE_ERROR",
        text: `${error.name}: ${error.message}`,
      });
    });

    // Listen for ALL network requests
    page.on("request", (request) => {
      const entry: typeof networkLog[0] = {
        timestamp: new Date().toISOString(),
        method: request.method(),
        url: request.url(),
        requestHeaders: Object.fromEntries(
          Object.entries(request.headers()).filter(([k]) =>
            ["content-type", "x-csrf-token", "x-user-id", "cookie", "authorization"].includes(k.toLowerCase())
          )
        ),
      };
      // Capture POST body for API calls
      if (request.method() === "POST" && request.url().includes("/api/")) {
        try {
          entry.requestBody = request.postData()?.substring(0, 2000) || "(no body)";
        } catch {
          entry.requestBody = "(could not read body)";
        }
      }
      networkLog.push(entry);
    });

    // Listen for ALL network responses
    page.on("response", async (response) => {
      const url = response.url();
      const matchingEntry = [...networkLog].reverse().find(
        (e) => e.url === url && !e.status
      );
      if (matchingEntry) {
        matchingEntry.status = response.status();
        matchingEntry.statusText = response.statusText();
        matchingEntry.responseHeaders = Object.fromEntries(
          Object.entries(response.headers()).filter(([k]) =>
            ["content-type", "set-cookie", "x-request-id", "location"].includes(k.toLowerCase())
          )
        );
        // Capture response body for API calls (limited)
        if (url.includes("/api/") && response.status() !== 200) {
          try {
            matchingEntry.responseBody = (await response.text()).substring(0, 1000);
          } catch {
            matchingEntry.responseBody = "(could not read response)";
          }
        }
      }
    });

    // Listen for failed requests
    page.on("requestfailed", (request) => {
      networkLog.push({
        timestamp: new Date().toISOString(),
        method: request.method(),
        url: request.url(),
        error: request.failure()?.errorText || "Unknown failure",
      });
    });

    // ========================================================================
    // STEP 1: Navigate to the site
    // ========================================================================
    console.log("\n=== STEP 1: Navigate to", SITE_URL, "===");

    const startTime = Date.now();
    const response = await page.goto(SITE_URL, {
      waitUntil: "networkidle",
      timeout: 30000
    });
    const loadTime = Date.now() - startTime;

    console.log(`Page loaded in ${loadTime}ms, status: ${response?.status()}`);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-landing-page.png`, fullPage: true });

    // Check current URL (did we get redirected?)
    const currentUrl = page.url();
    console.log(`Current URL after load: ${currentUrl}`);

    // ========================================================================
    // STEP 2: Check cookies BEFORE login
    // ========================================================================
    console.log("\n=== STEP 2: Check cookies before any action ===");
    const cookiesBefore = await page.context().cookies();
    const relevantCookiesBefore = cookiesBefore.filter(c =>
      c.name.includes("csrf") || c.name.includes("nexus") || c.name.includes("session")
    );
    console.log("Cookies before login:", JSON.stringify(relevantCookiesBefore.map(c => ({
      name: c.name,
      value: c.value.substring(0, 20) + "...",
      domain: c.domain,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
    })), null, 2));

    // ========================================================================
    // STEP 3: Check if we're on login page or already authenticated
    // ========================================================================
    console.log("\n=== STEP 3: Determine auth state ===");
    const isOnLoginPage = currentUrl.includes("/login");
    const isOnMainApp = !isOnLoginPage;
    console.log(`On login page: ${isOnLoginPage}`);
    console.log(`On main app: ${isOnMainApp}`);

    if (isOnLoginPage) {
      console.log("\n=== User is on login page - checking what login options are available ===");
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-login-page.png`, fullPage: true });

      // Check for Google sign-in button
      const googleButton = page.locator('a[href="/api/v1/auth/google"]');
      const googleButtonVisible = await googleButton.isVisible().catch(() => false);
      console.log(`Google sign-in button visible: ${googleButtonVisible}`);

      // Check for API key form
      const apiKeyToggle = page.locator('text=Sign in with API Key');
      const apiKeyVisible = await apiKeyToggle.isVisible().catch(() => false);
      console.log(`API key toggle visible: ${apiKeyVisible}`);
    }

    // ========================================================================
    // STEP 4: Try to access chat directly (simulating authenticated user)
    // ========================================================================
    console.log("\n=== STEP 4: Try navigating to /chat directly ===");
    await page.goto(`${SITE_URL}/chat`, {
      waitUntil: "networkidle",
      timeout: 30000
    });

    const chatUrl = page.url();
    console.log(`URL after navigating to /chat: ${chatUrl}`);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-chat-page-attempt.png`, fullPage: true });

    // If redirected to login, we need to simulate auth
    if (chatUrl.includes("/login")) {
      console.log("\n=== REDIRECTED TO LOGIN - Need to authenticate first ===");
      console.log("Attempting to set auth cookies manually to bypass OAuth...");

      // Simulate an authenticated session by setting cookies directly
      // This tests the chat flow independently of the OAuth flow
      await page.context().addCookies([
        {
          name: "nexus-session",
          value: "test-session-token-for-debugging",
          domain: "nexusad.ai",
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
        },
        {
          name: "nexus-session-created",
          value: String(Math.floor(Date.now() / 1000)),
          domain: "nexusad.ai",
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
        },
        {
          name: "nexus-last-activity",
          value: String(Math.floor(Date.now() / 1000)),
          domain: "nexusad.ai",
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
        },
        {
          name: "csrf-token",
          value: "debug-csrf-token-12345",
          domain: "nexusad.ai",
          path: "/",
          httpOnly: false,
          secure: true,
          sameSite: "Strict",
        },
      ]);

      // Try again
      await page.goto(`${SITE_URL}/chat`, {
        waitUntil: "networkidle",
        timeout: 30000
      });

      const chatUrlAfterAuth = page.url();
      console.log(`URL after setting cookies and retrying /chat: ${chatUrlAfterAuth}`);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-chat-with-fake-session.png`, fullPage: true });

      if (chatUrlAfterAuth.includes("/login")) {
        console.log("STILL REDIRECTED TO LOGIN - Auth check is server-side, need real token");
      }
    }

    // ========================================================================
    // STEP 5: Check cookies AFTER navigation attempts
    // ========================================================================
    console.log("\n=== STEP 5: Check cookies after navigation ===");
    const cookiesAfter = await page.context().cookies();
    const relevantCookiesAfter = cookiesAfter.filter(c =>
      c.name.includes("csrf") || c.name.includes("nexus") || c.name.includes("session")
    );
    console.log("Cookies after navigation:", JSON.stringify(relevantCookiesAfter.map(c => ({
      name: c.name,
      value: c.value.substring(0, 30) + "...",
      domain: c.domain,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
    })), null, 2));

    // ========================================================================
    // STEP 6: If we're on the chat page, try to send a message
    // ========================================================================
    const finalUrl = page.url();
    if (finalUrl.includes("/chat") || finalUrl === `${SITE_URL}/`) {
      console.log("\n=== STEP 6: Attempting to interact with chat UI ===");

      // Look for chat input
      const chatInput = page.locator('textarea, input[type="text"]').first();
      const chatInputVisible = await chatInput.isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`Chat input visible: ${chatInputVisible}`);

      if (chatInputVisible) {
        // Type a message
        await chatInput.fill("Hello, this is a test message");
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-message-typed.png`, fullPage: true });

        // Try to find and click send button
        const sendButton = page.locator('button[type="submit"], button:has(svg)').last();
        const sendVisible = await sendButton.isVisible().catch(() => false);
        console.log(`Send button visible: ${sendVisible}`);

        if (sendVisible) {
          // Clear network log to capture only the chat request
          const chatNetworkStartIndex = networkLog.length;

          console.log("\n=== Clicking send... ===");
          await sendButton.click();

          // Wait for network activity
          await page.waitForTimeout(5000);
          await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-after-send.png`, fullPage: true });

          // Analyze chat-related network requests
          const chatRequests = networkLog.slice(chatNetworkStartIndex).filter(
            (e) => e.url.includes("/api/") || e.url.includes("/proxy/")
          );

          console.log("\n=== CHAT API REQUESTS ===");
          for (const req of chatRequests) {
            console.log(`\n${req.method} ${req.url}`);
            console.log(`  Status: ${req.status || "PENDING"} ${req.statusText || ""}`);
            if (req.error) console.log(`  ERROR: ${req.error}`);
            if (req.requestHeaders) console.log(`  Request Headers: ${JSON.stringify(req.requestHeaders)}`);
            if (req.requestBody) console.log(`  Request Body: ${req.requestBody.substring(0, 500)}`);
            if (req.responseHeaders) console.log(`  Response Headers: ${JSON.stringify(req.responseHeaders)}`);
            if (req.responseBody) console.log(`  Response Body: ${req.responseBody.substring(0, 500)}`);
          }
        }
      } else {
        console.log("Chat input NOT found on page. Looking for any interactive elements...");
        const allButtons = await page.locator("button").allTextContents();
        console.log("Buttons on page:", allButtons);
        const allInputs = await page.locator("input, textarea").count();
        console.log("Input/textarea count:", allInputs);
      }
    }

    // ========================================================================
    // STEP 7: Direct API test - bypass the UI entirely
    // ========================================================================
    console.log("\n=== STEP 7: Direct API test - calling /api/proxy/chat from browser context ===");

    // First, check what CSRF token we have
    const csrfFromCookie = await page.evaluate(() => {
      const cookies = document.cookie.split(";");
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split("=");
        if (name === "csrf-token") return decodeURIComponent(value);
      }
      return null;
    });
    console.log(`CSRF token from cookie: ${csrfFromCookie}`);

    // Try making a direct API call from the page context
    const apiResult = await page.evaluate(async () => {
      try {
        const csrfToken = (() => {
          const cookies = document.cookie.split(";");
          for (const cookie of cookies) {
            const [name, value] = cookie.trim().split("=");
            if (name?.trim() === "csrf-token") return decodeURIComponent(value);
          }
          return null;
        })();

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (csrfToken) {
          headers["X-CSRF-Token"] = csrfToken;
        }

        const body = JSON.stringify({
          messages: [{ role: "user", content: "Hello test" }],
          stream: true,
          use_rag: true,
          mode: "standard",
          language: "en",
          provider: null,
          model: null,
          max_tokens: 4096,
        });

        const response = await fetch("/api/proxy/chat", {
          method: "POST",
          headers,
          body,
          credentials: "include",
        });

        const responseText = await response.text().catch(() => "(could not read)");

        return {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseText.substring(0, 2000),
          csrfTokenUsed: csrfToken,
          allCookies: document.cookie,
        };
      } catch (err: unknown) {
        const error = err as Error;
        return {
          error: error.message,
          name: error.name,
          stack: error.stack?.substring(0, 500),
        };
      }
    });

    console.log("\n=== DIRECT API CALL RESULT ===");
    console.log(JSON.stringify(apiResult, null, 2));

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-after-api-test.png`, fullPage: true });

    // ========================================================================
    // STEP 8: Test backend directly (no proxy)
    // ========================================================================
    console.log("\n=== STEP 8: Test backend health directly ===");
    const backendResult = await page.evaluate(async () => {
      try {
        const response = await fetch(
          "https://4ljj3bdk1x0vhv-9000.proxy.runpod.net/health",
          { method: "GET" }
        );
        return {
          status: response.status,
          body: await response.text().catch(() => "(error reading)"),
        };
      } catch (err: unknown) {
        const error = err as Error;
        return { error: error.message };
      }
    });
    console.log("Backend health check from browser:", JSON.stringify(backendResult, null, 2));

    // Also test CORS by hitting /api/v1/chat directly from browser
    console.log("\n=== STEP 8b: Test backend /api/v1/chat directly from browser (CORS test) ===");
    const corsResult = await page.evaluate(async () => {
      try {
        const response = await fetch(
          "https://4ljj3bdk1x0vhv-9000.proxy.runpod.net/api/v1/chat",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [{ role: "user", content: "Hello" }],
              stream: false,
              mode: "standard",
            }),
          }
        );
        return {
          status: response.status,
          statusText: response.statusText,
          body: (await response.text().catch(() => "")).substring(0, 1000),
        };
      } catch (err: unknown) {
        const error = err as Error;
        return { error: error.message, type: error.name };
      }
    });
    console.log("Direct backend chat call:", JSON.stringify(corsResult, null, 2));

    // ========================================================================
    // FINAL REPORT
    // ========================================================================
    console.log("\n" + "=".repeat(80));
    console.log("FINAL DIAGNOSTIC REPORT");
    console.log("=".repeat(80));

    // Console errors
    const realErrors = consoleErrors.filter(e =>
      e.type === "error" || e.type === "PAGE_ERROR"
    );
    console.log(`\nConsole Errors (${realErrors.length}):`);
    for (const err of realErrors) {
      console.log(`  [${err.type}] ${err.text.substring(0, 200)}`);
      if (err.location) console.log(`    at: ${err.location}`);
    }

    // Failed network requests
    const failedRequests = networkLog.filter(
      (e) => e.error || (e.status && e.status >= 400)
    );
    console.log(`\nFailed/Error Network Requests (${failedRequests.length}):`);
    for (const req of failedRequests) {
      console.log(`  ${req.method} ${req.url}`);
      console.log(`    Status: ${req.status || "N/A"}, Error: ${req.error || "N/A"}`);
      if (req.responseBody) console.log(`    Body: ${req.responseBody.substring(0, 200)}`);
    }

    // All API requests
    const apiRequests = networkLog.filter(
      (e) => e.url.includes("/api/")
    );
    console.log(`\nAll API Requests (${apiRequests.length}):`);
    for (const req of apiRequests) {
      console.log(`  ${req.method} ${req.url} -> ${req.status || "PENDING"}`);
    }

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-final-state.png`, fullPage: true });

    // Always pass - this is a diagnostic test
    expect(true).toBe(true);
  });
});
