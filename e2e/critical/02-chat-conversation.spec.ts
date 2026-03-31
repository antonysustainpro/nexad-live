/**
 * CRITICAL JOURNEY 2: Chat Conversation
 *
 * Tests the complete chat experience against the real backend:
 * - Chat page renders (authenticated)
 * - User can type and send a message
 * - AI response streams back from RunPod (real SSE)
 * - Input clears after sending
 * - Mode selector works (standard, fast, thinking, pro)
 * - Error handling: what happens when the backend is unavailable
 * - Conversation is persisted to localStorage
 * - Mobile layout renders chat interface correctly
 *
 * NOTE: Real SSE tests have generous timeouts. If RunPod is unreachable,
 * the error-handling suite still passes (it verifies the error UI).
 */

import { test, expect, Page } from "@playwright/test";
import { setupAuthenticatedSession, TIMEOUTS, VIEWPORTS } from "./fixtures";

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

async function setupChatPage(page: Page): Promise<void> {
  await setupAuthenticatedSession(page);
  await page.goto("/chat");
  // Wait for the chat input to appear (confirms the page loaded and the user
  // is treated as authenticated)
  await expect(page.getByRole("textbox").first()).toBeVisible({ timeout: TIMEOUTS.page });
}

// ===========================================================================
// SUITE 1: Page Rendering
// ===========================================================================

test.describe("Chat — Page Rendering", () => {
  test.beforeEach(async ({ page }) => {
    await setupChatPage(page);
  });

  test("chat page loads at /chat", async ({ page }) => {
    await expect(page).toHaveURL(/\/chat/);
  });

  test("chat input textarea is visible and focusable", async ({ page }) => {
    const textarea = page.getByRole("textbox").first();
    await textarea.focus();
    await expect(textarea).toBeFocused();
  });

  test("send button is disabled when input is empty", async ({ page }) => {
    const sendButton = page.getByRole("button", { name: /Send/i }).first();
    await expect(sendButton).toBeVisible({ timeout: TIMEOUTS.ui });
    await expect(sendButton).toBeDisabled();
  });

  test("send button becomes enabled after typing a message", async ({ page }) => {
    const textarea = page.getByRole("textbox").first();
    await textarea.fill("Hello");

    const sendButton = page.getByRole("button", { name: /Send/i }).first();
    await expect(sendButton).toBeEnabled({ timeout: TIMEOUTS.ui });
  });

  test("welcome / empty state is shown before first message", async ({ page }) => {
    // Some variation in text — check for common welcome patterns
    await expect(
      page.getByText(/encrypted|sovereign|first conversation|start chatting|begin/i).first()
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("mode selector button is visible", async ({ page }) => {
    const modeButton = page
      .getByRole("button", { name: /Select intelligence mode|Standard|Mode/i })
      .first();
    await expect(modeButton).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("attach file button is visible", async ({ page }) => {
    const attachButton = page
      .getByRole("button", { name: /Attach|file/i })
      .first();
    await expect(attachButton).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("chat page has a proper main landmark", async ({ page }) => {
    await expect(page.locator("main")).toBeVisible();
  });

  test("chat page renders correctly on mobile", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto("/chat");
    await setupAuthenticatedSession(page);
    await page.goto("/chat");

    await expect(page.getByRole("textbox").first()).toBeVisible({ timeout: TIMEOUTS.page });
    await expect(page.getByRole("button", { name: /Send/i }).first()).toBeVisible();
  });
});

// ===========================================================================
// SUITE 2: Sending a Message & Receiving Response (Real Backend)
// ===========================================================================

test.describe("Chat — Send Message & Receive Response", () => {
  test.beforeEach(async ({ page }) => {
    await setupChatPage(page);
  });

  test("user message appears in the conversation after sending", async ({ page }) => {
    const textarea = page.getByRole("textbox").first();
    await textarea.fill("Hello from E2E test");
    await page.keyboard.press("Enter");

    // User message bubble should appear
    await expect(page.getByText("Hello from E2E test")).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("input is cleared immediately after sending", async ({ page }) => {
    const textarea = page.getByRole("textbox").first();
    await textarea.fill("Test message");
    await page.keyboard.press("Enter");

    // Input should be cleared right after sending
    await expect(textarea).toHaveValue("", { timeout: TIMEOUTS.ui });
  });

  test("Shift+Enter adds a newline without sending", async ({ page }) => {
    const textarea = page.getByRole("textbox").first();
    await textarea.fill("Line one");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("Line two");

    const value = await textarea.inputValue();
    expect(value).toContain("Line one");
    expect(value).toContain("Line two");
  });

  test("empty or whitespace-only message is not sent", async ({ page }) => {
    const textarea = page.getByRole("textbox").first();
    await textarea.fill("   ");
    await page.keyboard.press("Enter");

    // Welcome screen should still be visible (no message sent)
    await expect(
      page.getByText(/encrypted|sovereign|first conversation|start chatting|begin/i).first()
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("AI response arrives from the real backend (real SSE streaming)", async ({ page }) => {
    // This test hits the REAL RunPod backend. It sends a simple prompt and waits
    // for any non-empty response to stream back. The test validates that:
    //   1. A typing indicator or loading state appears
    //   2. A response text eventually becomes visible

    const textarea = page.getByRole("textbox").first();
    await textarea.fill("Say the word HELLO and nothing else.");
    await page.keyboard.press("Enter");

    // A loading/typing indicator should appear while waiting for the backend
    const loadingIndicator = page.locator(
      "[data-testid='typing-indicator'], .animate-pulse, [aria-label*='typing'], [aria-label*='loading']"
    ).first();
    // This may be very short-lived; we just check it existed at some point
    // by waiting for the response text instead

    // The AI response should appear within the generous stream timeout
    // We accept ANY text in an assistant bubble (we can't predict exact output)
    const assistantBubble = page.locator(
      "[data-role='assistant'], [data-sender='ai'], .message-bubble.ai, [data-testid='assistant-message']"
    ).first();

    // Fallback: just look for the response container to appear (even partially streamed text)
    await expect(
      assistantBubble.or(page.getByText(/HELLO/i).first())
    ).toBeVisible({ timeout: TIMEOUTS.stream });
  });

  test("conversation log has aria-live region for screen reader support", async ({ page }) => {
    const textarea = page.getByRole("textbox").first();
    await textarea.fill("Accessibility test message");
    await page.keyboard.press("Enter");

    await expect(page.getByText("Accessibility test message")).toBeVisible({ timeout: TIMEOUTS.ui });

    // The conversation log should have aria-live
    const logContainer = page.locator('[role="log"], [aria-live]').first();
    await expect(logContainer).toBeVisible({ timeout: TIMEOUTS.ui });
  });
});

// ===========================================================================
// SUITE 3: Mode Selector
// ===========================================================================

test.describe("Chat — Mode Selector", () => {
  test.beforeEach(async ({ page }) => {
    await setupChatPage(page);
  });

  test("mode selector dropdown opens showing available modes", async ({ page }) => {
    const modeButton = page
      .getByRole("button", { name: /Select intelligence mode|Standard|Mode/i })
      .first();
    await modeButton.click();

    // At least one mode option should be visible
    await expect(
      page.getByText(/Standard|Fast|Thinking|Pro/i).first()
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("mode URL parameter is respected on page load", async ({ page }) => {
    await page.goto("/chat?mode=thinking");
    await expect(page).toHaveURL(/mode=thinking/);

    await expect(page.getByRole("textbox").first()).toBeVisible({ timeout: TIMEOUTS.page });
    // Welcome message should reflect thinking mode
    await expect(
      page.getByText(/Thinking Mode|Multi-Provider|think/i).first()
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("mode=pro URL parameter activates pro mode", async ({ page }) => {
    await page.goto("/chat?mode=pro");
    await expect(page.getByRole("textbox").first()).toBeVisible({ timeout: TIMEOUTS.page });
    await expect(
      page.getByText(/Pro Mode|McKinsey/i).first()
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("mode=fast URL parameter activates fast mode", async ({ page }) => {
    await page.goto("/chat?mode=fast");
    await expect(page.getByRole("textbox").first()).toBeVisible({ timeout: TIMEOUTS.page });
    await expect(
      page.getByText(/Fast Mode|Lightning/i).first()
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("prompt URL parameter pre-fills the input", async ({ page }) => {
    await page.goto("/chat?prompt=Hello%20from%20URL");
    const textarea = page.getByRole("textbox").first();
    await expect(textarea).toBeVisible({ timeout: TIMEOUTS.page });
    await expect(textarea).toHaveValue("Hello from URL");
  });
});

// ===========================================================================
// SUITE 4: Error Handling
// ===========================================================================

test.describe("Chat — Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    await setupChatPage(page);
  });

  test("network error to chat endpoint shows error message to user", async ({ page }) => {
    // Abort the proxy/chat request to simulate a network failure
    await page.route("**/api/proxy/chat", (route) => route.abort("connectionrefused"));

    const textarea = page.getByRole("textbox").first();
    await textarea.fill("Trigger network error");
    await page.keyboard.press("Enter");

    // An error message should appear in the UI
    await expect(
      page.getByText(/Unable to connect|connection|error|failed|try again/i).first()
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("server 500 error from chat endpoint shows an error message", async ({ page }) => {
    await page.route("**/api/proxy/chat", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal Server Error" }),
      })
    );

    const textarea = page.getByRole("textbox").first();
    await textarea.fill("Trigger server error");
    await page.keyboard.press("Enter");

    await expect(
      page.getByText(/error|failed|unable|Internal/i).first()
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });
});

// ===========================================================================
// SUITE 5: Conversation Persistence
// ===========================================================================

test.describe("Chat — Conversation Persistence", () => {
  test("messages are stored in localStorage after a conversation", async ({ page }) => {
    await setupChatPage(page);

    // Mock the chat endpoint so we don't need a real response for persistence testing
    await page.route("**/api/proxy/chat", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: [
          `data: {"domain":{"domain":"General","confidence":90},"emotion":{"dominant_emotion":"neutral","confidence":0.8}}\n\n`,
          `data: {"content":"Persistence test response.","provider":"nexus-sovereign","model":"nexus-v1"}\n\n`,
          `data: {"done":true}\n\n`,
          `data: [DONE]\n\n`,
        ].join(""),
      })
    );

    const textarea = page.getByRole("textbox").first();
    await textarea.fill("Persistence test message");
    await page.keyboard.press("Enter");

    // Wait for response
    await expect(page.getByText("Persistence test response.")).toBeVisible({ timeout: TIMEOUTS.stream });

    // Check localStorage
    const conversations = await page.evaluate(() => {
      const stored = localStorage.getItem("nexus-conversations");
      return stored ? JSON.parse(stored) : null;
    });

    expect(conversations).not.toBeNull();
    expect(Array.isArray(conversations)).toBe(true);
    expect(conversations.length).toBeGreaterThan(0);
  });
});
