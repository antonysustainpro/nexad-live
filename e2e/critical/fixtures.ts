/**
 * CRITICAL E2E FIXTURES
 *
 * Shared helpers for the 5 critical user journeys.
 *
 * Philosophy: These tests run against the REAL backend via /api/proxy.
 * Auth is mocked at the session/cookie level (we cannot do real Google OAuth in CI),
 * but all other API calls — chat, vault, search, sovereignty — hit RunPod for real.
 *
 * The real backend URL is: https://4ljj3bdk1x0vhv-9000.proxy.runpod.net
 * The Next.js /api/proxy route forwards calls there.
 */

import { Page, BrowserContext } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BACKEND_URL = "https://4ljj3bdk1x0vhv-9000.proxy.runpod.net";
export const BACKEND_API = `${BACKEND_URL}/api/v1`;

/** Timeouts tuned for real network round-trips to RunPod */
export const TIMEOUTS = {
  /** Page navigation + server-side render */
  page: 30000,
  /** Real backend API call (chat can be slow) */
  api: 45000,
  /** SSE streaming response — first token */
  stream: 30000,
  /** Vault upload (depends on file size) */
  upload: 60000,
  /** Sovereignty score calculation */
  sovereignty: 20000,
  /** Short UI interaction (click, fill) */
  ui: 10000,
};

// ---------------------------------------------------------------------------
// Auth session injection
//
// We cannot perform a real Google OAuth flow in automated tests, so we inject
// a synthetic session that passes the Next.js middleware cookie checks.
//
// The middleware reads:
//   nexus-session          — existence check (any non-empty value passes)
//   nexus-session-created  — unix timestamp (must be recent enough)
//   nexus-last-activity    — unix timestamp (must be recent enough)
//
// The auth context also calls GET /api/proxy/auth/me — we mock that endpoint
// to return a well-known test user so the UI renders the authenticated state.
// ---------------------------------------------------------------------------

export async function injectAuthSession(page: Page): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  // Cookies must match the domain the browser actually navigates to (localhost in dev)
  const domain = new URL(page.url() || "http://localhost:3001").hostname || "localhost";

  await page.context().addCookies([
    { name: "nexus-session",         value: "e2e-test-session-token", domain, path: "/" },
    { name: "nexus-session-created", value: String(now),             domain, path: "/" },
    { name: "nexus-last-activity",   value: String(now),             domain, path: "/" },
    { name: "nexusad-api-key",       value: "e2e-test-api-key",      domain, path: "/" },
  ]);

  // Persist display info in localStorage so the client renders correctly
  await page.addInitScript(() => {
    localStorage.setItem(
      "nexus-user-display",
      JSON.stringify({ id: "e2e-user-001", displayName: "E2E Tester" })
    );
  });
}

/**
 * Mock ONLY the auth/me endpoint (everything else is real backend).
 * Call this BEFORE navigating to any protected page.
 */
export async function mockAuthMe(page: Page): Promise<void> {
  await page.route("**/api/proxy/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "e2e-user-001",
        email: "e2e@nexusad.ai",
        name: "E2E Tester",
        fullName: "E2E Tester",
        organization_id: "org_e2e",
        is_super_admin: false,
        roles: ["user"],
        tier: "pro",
      }),
    })
  );

  // Also mock the v1 path in case the app uses both prefixes
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          id: "e2e-user-001",
          email: "e2e@nexusad.ai",
          name: "E2E Tester",
          fullName: "E2E Tester",
          organization_id: "org_e2e",
          is_super_admin: false,
          roles: ["user"],
        },
      }),
    })
  );
}

/**
 * Inject auth session AND mock /auth/me so protected pages load correctly.
 * This is the standard setup for any test that needs to be logged in.
 */
export async function setupAuthenticatedSession(page: Page): Promise<void> {
  // Mock auth/me first (route registration before navigation)
  await mockAuthMe(page);
  // Then inject cookies (for middleware) and localStorage (for client)
  await injectAuthSession(page);
}

// ---------------------------------------------------------------------------
// Backend health check
// ---------------------------------------------------------------------------

/**
 * Verify the real backend is reachable before running tests that depend on it.
 * Returns true if healthy, false otherwise.
 * Tests should skip (not fail) when the backend is unreachable.
 */
export async function isBackendHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Viewport helpers
// ---------------------------------------------------------------------------

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet:  { width: 768,  height: 1024 },
  mobile:  { width: 375,  height: 812 },
};

/**
 * Check whether the current page viewport is considered "mobile" (<= 640px).
 */
export async function isMobileViewport(page: Page): Promise<boolean> {
  const vp = page.viewportSize();
  return vp !== null && vp.width <= 640;
}

// ---------------------------------------------------------------------------
// Utility: wait for no pending network requests to settle
// ---------------------------------------------------------------------------

export async function waitForNetworkIdle(page: Page, timeoutMs = 5000): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => {
    // Ignore timeout — network may never become truly idle with SSE connections
  });
}
