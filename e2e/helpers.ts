import { Page } from "@playwright/test";

/**
 * Mock user data for authenticated tests.
 */
export const MOCK_USER = {
  id: "u_test_001",
  email: "antony@nexad.ai",
  name: "Antony Bousader",
  organization_id: "org_001",
  is_super_admin: true,
  roles: ["admin"],
  created_at: "2025-01-01T00:00:00Z",
};

/**
 * Inject a fake auth token and mock the /me endpoint so the app
 * thinks we are logged in. Call this BEFORE navigating to any
 * protected page.
 *
 * IMPORTANT: Call this AFTER mockFallbackAPIs so the specific /auth/me
 * route takes priority over the catch-all (Playwright matches LIFO).
 */
export async function loginAsTestUser(page: Page) {
  // Set auth token in localStorage before the app boots
  await page.addInitScript(() => {
    localStorage.setItem("auth_token", "test-token-e2e");
    localStorage.setItem("nexusad-api-key", "test-api-key-e2e");
  });

  // Set auth cookies for middleware (SSR route protection)
  // The middleware checks nexus-session for protected routes (/team, /billing)
  // and falls back to cookie-based timeout checks (nexus-last-activity, nexus-session-created)
  const now = Math.floor(Date.now() / 1000);
  await page.context().addCookies([
    {
      name: "nexusad-api-key",
      value: "test-api-key-e2e",
      domain: "localhost",
      path: "/",
    },
    {
      name: "nexus-session",
      value: "test-session-e2e",
      domain: "localhost",
      path: "/",
    },
    {
      name: "nexus-session-created",
      value: String(now),
      domain: "localhost",
      path: "/",
    },
    {
      name: "nexus-last-activity",
      value: String(now),
      domain: "localhost",
      path: "/",
    },
  ]);

  // Intercept the /me API call and return mock user
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          id: "u_test_001",
          email: "antony@nexad.ai",
          name: "Antony Bousader",
          organization_id: "org_001",
          is_super_admin: true,
          roles: ["admin"],
          created_at: "2025-01-01T00:00:00Z",
        },
      }),
    })
  );

  // Mock workspaces endpoint
  await page.route("**/api/v1/workspaces**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [{ id: "ws_001", name: "nexAD Workspace", status: "ACTIVE" }],
      }),
    })
  );
}

/**
 * Mock all dashboard-related API calls with realistic fallback data.
 * Endpoints match the actual client calls:
 *   /dashboard/stats, /my/inbox-summary, /my/tasks, /alerts
 */
export async function mockDashboardAPIs(page: Page) {
  await page.route("**/api/v1/dashboard/stats", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          total_users: 42,
          total_devices: 128,
          total_workspaces: 3,
          total_tasks: 15,
          active_alerts: 3,
          system_health: 96,
        },
      }),
    })
  );

  await page.route("**/api/v1/my/inbox-summary**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { pending_tasks: 5, pending_approvals: 2, unread_notifications: 8 },
      }),
    })
  );

  await page.route("**/api/v1/my/tasks**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [
          { id: "t1", title: "Review compliance report", priority: "high", status: "in_progress", due_date: "2026-03-25T00:00:00Z" },
          { id: "t2", title: "Update fleet firmware", priority: "medium", status: "open", due_date: "2026-03-28T00:00:00Z" },
        ],
      }),
    })
  );

  await page.route("**/api/v1/alerts**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [
          { id: "a1", title: "Temperature sensor anomaly", severity: "high", status: "open", created_at: "2026-03-20T10:00:00Z" },
          { id: "a2", title: "Network latency spike", severity: "medium", status: "in_progress", created_at: "2026-03-20T09:00:00Z" },
        ],
      }),
    })
  );
}

/**
 * Mock admin APIs.
 * Endpoints match the actual client calls:
 *   /users, /organizations, /feature-flags, /admin/system-health
 */
export async function mockAdminAPIs(page: Page) {
  await page.route("**/api/v1/users**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [
          { id: "u1", first_name: "Antony", last_name: "Bousader", full_name: "Antony Bousader", email: "antony@nexad.ai", is_super_admin: true, is_active: true, last_login: "2026-03-20T08:00:00Z" },
          { id: "u2", first_name: "Sarah", last_name: "Chen", full_name: "Sarah Chen", email: "sarah@nexad.ai", is_super_admin: false, is_active: true, last_login: "2026-03-19T14:00:00Z" },
        ],
      }),
    })
  );

  await page.route("**/api/v1/organizations**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [{ id: "org1", name: "nexAD Corp", code: "NEXAD", status: "Active" }],
      }),
    })
  );

  await page.route("**/api/v1/feature-flags**", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            { id: "ff1", key: "dark_mode", name: "Dark Mode", description: "Enable dark mode", is_enabled: true },
            { id: "ff2", key: "ai_sandbox", name: "AI Sandbox", description: "Enable sandbox mode", is_enabled: false },
          ],
        }),
      });
    }
    // PUT toggle
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: {} }) });
  });

  await page.route("**/api/v1/admin/system-health**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          status: "healthy",
          uptime: 86400,
          services: {
            auth_service: { status: "healthy", latency_ms: 12 },
            brain_service: { status: "healthy", latency_ms: 45 },
            core_service: { status: "healthy", latency_ms: 8 },
          },
        },
      }),
    })
  );
}

/**
 * Mock brain APIs — uses the actual /brain/twin/* endpoints the app calls.
 */
export async function mockBrainAPIs(page: Page) {
  // Vault stats — called by brain page via getBrainState
  await page.route("**/api/v1/brain/twin/vault/stats**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          total_memories: 156,
          total_conversations: 42,
          total_life_entries: 12,
          total_habits: 8,
          vault_status: "active",
          created_at: "2025-01-01T00:00:00Z",
        },
      }),
    })
  );

  // Vault transparency — called by brain page via getBrainState AND getBrainActivity
  await page.route("**/api/v1/brain/twin/vault/transparency**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          life_domains: {
            Identity: 24,
            Expertise: 18,
            Memory: 156,
            Knowledge: 42,
            Workflow: 8,
            Predictions: 5,
            Emotion: 12,
          },
          memories: [
            { id: "mem1", content: "User prefers dark mode", category: "Identity", created_at: "2026-03-20T10:00:00Z" },
            { id: "mem2", content: "Work schedule preference", category: "Workflow", created_at: "2026-03-20T09:00:00Z" },
          ],
        },
      }),
    })
  );

  // Personality — called by brain page and settings page
  await page.route("**/api/v1/brain/twin/personality**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          personality_vector: { wit: 0.7, humor: 0.6, warmth: 0.8, empathy: 0.9, directness: 0.7, curiosity: 0.8, formality: 0.3, confidence: 0.75 },
          relationship_stage: "Trusted",
          interaction_count: 142,
          maturity_level: 3,
          mood_state: { label: "Engaged", arousal: 0.6, valence: 0.7, dominance: 0.5 },
        },
      }),
    })
  );

  // Brain activity — called by brain page
  await page.route("**/api/v1/brain/activity**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [
          { id: "act1", action: "Learned", detail: "User prefers dark mode", layer: "Identity", timestamp: "2026-03-20T10:00:00Z" },
          { id: "act2", action: "Updated", detail: "Work schedule preference", layer: "Workflow", timestamp: "2026-03-20T09:00:00Z" },
        ],
      }),
    })
  );
}

/**
 * Mock chat APIs — uses the actual /brain/twin/* endpoints the app calls.
 */
export async function mockChatAPIs(page: Page) {
  // Twin conversations — what the chat sidebar loads
  await page.route("**/api/v1/brain/twin/conversations**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [
          { id: "th1", title: "Project update discussion", created_at: "2026-03-20T08:00:00Z", updated_at: "2026-03-20T10:00:00Z", message_count: 5 },
          { id: "th2", title: "Brain health check", created_at: "2026-03-19T14:00:00Z", updated_at: "2026-03-19T15:00:00Z", message_count: 3 },
        ],
      }),
    })
  );

  // Thread messages — loaded when clicking a conversation
  await page.route("**/api/v1/chat/threads/*/messages**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [
          { id: "m1", thread_id: "th1", sender_id: "u_test_001", sender_type: "user", content: "What is the project status?", created_at: "2026-03-20T08:00:00Z" },
          { id: "m2", thread_id: "th1", sender_id: null, sender_type: "ai", content: "The project is progressing well. All 15 features are graduated with a 96.3/100 average score.", created_at: "2026-03-20T08:01:00Z", metadata: { mode: "think" } },
        ],
      }),
    })
  );

  // Twin chat — sends a message and gets AI response
  await page.route("**/api/v1/brain/twin/chat**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          reply: "I have processed your request. The current system status shows all services healthy.",
          conversation_id: "th_new_001",
          mode: "think",
          memories_used: 3,
        },
      }),
    })
  );

  // Twin briefing — called by chat welcome screen
  await page.route("**/api/v1/brain/twin/briefing**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          briefing: "Good morning! All systems are healthy.",
          highlights: ["3 new alerts", "5 pending tasks"],
        },
      }),
    })
  );
}

/**
 * Generic catch-all for unmocked API routes — returns empty success.
 * IMPORTANT: Call this BEFORE specific mocks so they take priority
 * (Playwright matches routes in LIFO order — last registered wins).
 */
export async function mockFallbackAPIs(page: Page) {
  await page.route("**/api/v1/**", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [] }),
    });
  });
}
