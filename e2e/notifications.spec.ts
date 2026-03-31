import { test, expect, Page } from "@playwright/test";
import { loginAsTestUser, mockBrainAPIs, mockFallbackAPIs, mockChatAPIs } from "./helpers";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const NOW = new Date();

function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: "n1",
    title: "Alert: CPU usage high",
    titleAr: "تنبيه: استخدام المعالج مرتفع",
    body: "Server alpha-3 is running at 95% CPU utilisation.",
    bodyAr: "الخادم ألفا-3 يعمل بنسبة 95% من المعالج.",
    category: "alerts",
    icon: "alert-triangle",
    timestamp: NOW.toISOString(),
    read: false,
    actionUrl: "/alerts",
    actionLabel: "View Alerts",
    actionLabelAr: "عرض التنبيهات",
    ...overrides,
  };
}

const MOCK_NOTIFICATIONS = [
  // Today — unread
  makeNotification({ id: "n1", category: "alerts", read: false, timestamp: NOW.toISOString() }),
  makeNotification({
    id: "n2",
    title: "Butler reminder",
    titleAr: "تذكير الخادم",
    body: "Your meeting starts in 15 minutes.",
    bodyAr: "اجتماعك يبدأ بعد 15 دقيقة.",
    category: "butler",
    read: false,
    timestamp: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString(), // 1 h ago
  }),
  // Today — read
  makeNotification({
    id: "n3",
    title: "Payment received",
    titleAr: "تم استلام الدفعة",
    body: "Your subscription payment was processed.",
    bodyAr: "تمت معالجة دفعة اشتراكك.",
    category: "billing",
    read: true,
    timestamp: new Date(NOW.getTime() - 3 * 60 * 60 * 1000).toISOString(), // 3 h ago
  }),
  // This week
  makeNotification({
    id: "n4",
    title: "New login detected",
    titleAr: "تم اكتشاف تسجيل دخول جديد",
    body: "A new login was detected from Dubai, UAE.",
    bodyAr: "تم اكتشاف تسجيل دخول جديد من دبي، الإمارات.",
    category: "security",
    read: true,
    timestamp: new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
  }),
  // Earlier
  makeNotification({
    id: "n5",
    title: "System maintenance complete",
    titleAr: "اكتملت صيانة النظام",
    body: "Scheduled maintenance finished.",
    bodyAr: "اكتملت الصيانة المجدولة.",
    category: "alerts",
    read: true,
    timestamp: new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
  }),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set up localStorage with mock user so the notifications page can read the
 * user ID, and mock the notifications API endpoint with the given data.
 */
async function mockNotificationsAPI(page: Page, notifications = MOCK_NOTIFICATIONS) {
  // The notifications page reads user id from "nexus-user-display" in localStorage
  await page.addInitScript(() => {
    localStorage.setItem(
      "nexus-user-display",
      JSON.stringify({ id: "u_test_001", name: "Antony Bousader" })
    );
  });

  // Mock the GET notifications endpoint
  await page.route("**/api/proxy/butler/notifications/**", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(notifications),
      });
    }
    return route.fallback();
  });
}

/** Mock mark-single-notification-read (PUT …/{id}/read) */
async function mockMarkReadAPI(page: Page, succeed = true) {
  await page.route("**/api/proxy/butler/notifications/*/read", (route) => {
    if (route.request().method() === "PUT") {
      return route.fulfill({
        status: succeed ? 200 : 500,
        contentType: "application/json",
        body: JSON.stringify(succeed ? { success: true } : { error: "Server Error" }),
      });
    }
    return route.fallback();
  });
}

/** Mock mark-all-read (PUT …/{userId}/read-all) */
async function mockMarkAllReadAPI(page: Page, succeed = true) {
  await page.route("**/api/proxy/butler/notifications/*/read-all", (route) => {
    if (route.request().method() === "PUT") {
      return route.fulfill({
        status: succeed ? 200 : 500,
        contentType: "application/json",
        body: JSON.stringify(succeed ? { success: true } : { error: "Server Error" }),
      });
    }
    return route.fallback();
  });
}

/** Mock dismiss (DELETE …/{id}) */
async function mockDismissAPI(page: Page, succeed = true) {
  await page.route("**/api/proxy/butler/notifications/*", (route) => {
    if (route.request().method() === "DELETE") {
      return route.fulfill({
        status: succeed ? 200 : 500,
        contentType: "application/json",
        body: JSON.stringify(succeed ? { success: true } : { error: "Server Error" }),
      });
    }
    return route.fallback();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Notifications Page", () => {
  // -----------------------------------------------------------------------
  // Happy path — notifications load
  // -----------------------------------------------------------------------
  test.describe("with notifications", () => {
    test.beforeEach(async ({ page }) => {
      await mockFallbackAPIs(page);
      await mockChatAPIs(page);
      await mockBrainAPIs(page);
      // Order matters: specific mocks AFTER fallback (LIFO)
      await mockNotificationsAPI(page);
      await mockMarkReadAPI(page);
      await mockMarkAllReadAPI(page);
      await mockDismissAPI(page);
      await loginAsTestUser(page);
      await page.goto("/notifications");
    });

    test("renders page heading with bell icon", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
    });

    test("shows unread count badge", async ({ page }) => {
      // n1 and n2 are unread => badge should show "2"
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      const badge = page.locator("span").filter({ hasText: "2" }).first();
      await expect(badge).toBeVisible({ timeout: 5000 });
    });

    test("displays notification items", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      // Check first notification title is visible
      await expect(page.getByText("Alert: CPU usage high").first()).toBeVisible({ timeout: 5000 });
      // Check butler notification
      await expect(page.getByText("Butler reminder").first()).toBeVisible({ timeout: 5000 });
    });

    test("unread notifications have distinct styling (unread indicator dot)", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      // Unread notifications have a span with aria-label "Unread"
      const unreadDots = page.locator("[aria-label='Unread']");
      // n1 and n2 are unread
      await expect(unreadDots).toHaveCount(2, { timeout: 5000 });
    });

    test("read notifications do not have unread indicator", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      // n3, n4, n5 are read — they should NOT have the unread dot.
      // Total unread dots should be exactly 2 (for n1, n2).
      const unreadDots = page.locator("[aria-label='Unread']");
      await expect(unreadDots).toHaveCount(2, { timeout: 5000 });
    });

    test("notifications are grouped by time period", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      // Group headers
      await expect(page.getByText("Today").first()).toBeVisible({ timeout: 5000 });
      // "This Week" or "Earlier" depending on date math — at least one should exist
      const thisWeek = page.getByText("This Week").first();
      const earlier = page.getByText("Earlier").first();
      // At least one time-group besides "Today" should appear
      const hasThisWeek = await thisWeek.isVisible().catch(() => false);
      const hasEarlier = await earlier.isVisible().catch(() => false);
      expect(hasThisWeek || hasEarlier).toBeTruthy();
    });

    // -------------------------------------------------------------------
    // Filter tabs
    // -------------------------------------------------------------------
    test("filter tabs are visible (All, Alerts, Butler, Billing, Security)", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      for (const label of ["All", "Alerts", "Butler", "Billing", "Security"]) {
        await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible({ timeout: 5000 });
      }
    });

    test("clicking Alerts filter shows only alert notifications", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      await page.getByRole("button", { name: "Alerts" }).click();
      // n1 (alerts, unread) and n5 (alerts, read) should be visible
      await expect(page.getByText("Alert: CPU usage high").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("System maintenance complete").first()).toBeVisible({ timeout: 5000 });
      // Butler notification should NOT be visible
      await expect(page.getByText("Butler reminder")).toHaveCount(0, { timeout: 3000 });
    });

    test("clicking Butler filter shows only butler notifications", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      await page.getByRole("button", { name: "Butler" }).click();
      await expect(page.getByText("Butler reminder").first()).toBeVisible({ timeout: 5000 });
      // Alert should not be visible
      await expect(page.getByText("Alert: CPU usage high")).toHaveCount(0, { timeout: 3000 });
    });

    test("clicking Billing filter shows only billing notifications", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      await page.getByRole("button", { name: "Billing" }).click();
      await expect(page.getByText("Payment received").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Alert: CPU usage high")).toHaveCount(0, { timeout: 3000 });
    });

    test("clicking Security filter shows only security notifications", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      await page.getByRole("button", { name: "Security" }).click();
      await expect(page.getByText("New login detected").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Alert: CPU usage high")).toHaveCount(0, { timeout: 3000 });
    });

    test("clicking All filter after another filter shows everything again", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      // Switch to Alerts
      await page.getByRole("button", { name: "Alerts" }).click();
      await expect(page.getByText("Butler reminder")).toHaveCount(0, { timeout: 3000 });
      // Switch back to All
      await page.getByRole("button", { name: "All", exact: true }).click();
      await expect(page.getByText("Butler reminder").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Alert: CPU usage high").first()).toBeVisible({ timeout: 5000 });
    });

    test("active filter tab has distinct styling", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      // Default active tab is "All" — it should have the active class
      const allBtn = page.getByRole("button", { name: "All", exact: true });
      await expect(allBtn).toHaveClass(/bg-nexus-jade/, { timeout: 5000 });
      // Click Alerts
      await page.getByRole("button", { name: "Alerts" }).click();
      const alertsBtn = page.getByRole("button", { name: "Alerts" });
      await expect(alertsBtn).toHaveClass(/bg-nexus-jade/, { timeout: 5000 });
      // All should no longer be active
      await expect(allBtn).not.toHaveClass(/bg-nexus-jade/);
    });

    // -------------------------------------------------------------------
    // Click to mark as read
    // -------------------------------------------------------------------
    test("clicking an unread notification marks it as read (optimistic update)", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });

      // Initially 2 unread dots
      await expect(page.locator("[aria-label='Unread']")).toHaveCount(2, { timeout: 5000 });

      // Click the first notification (n1 — unread)
      await page.getByText("Alert: CPU usage high").first().click();

      // Now only 1 unread dot should remain
      await expect(page.locator("[aria-label='Unread']")).toHaveCount(1, { timeout: 5000 });
    });

    test("clicking a read notification does not change anything", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });

      // 2 unread dots initially
      await expect(page.locator("[aria-label='Unread']")).toHaveCount(2, { timeout: 5000 });

      // Click a read notification (n3 — billing, read)
      await page.getByText("Payment received").first().click();

      // Still 2 unread dots
      await expect(page.locator("[aria-label='Unread']")).toHaveCount(2, { timeout: 3000 });
    });

    // -------------------------------------------------------------------
    // Dismiss notification
    // -------------------------------------------------------------------
    test("dismiss button removes notification from list", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });

      // Verify "Alert: CPU usage high" exists
      await expect(page.getByText("Alert: CPU usage high").first()).toBeVisible({ timeout: 5000 });

      // The dismiss button is hidden until hover. Force-click it.
      const firstItem = page.getByText("Alert: CPU usage high").first().locator("../..");
      const dismissBtn = firstItem.getByRole("button", { name: /Dismiss notification|إزالة الإشعار/i });
      await dismissBtn.click({ force: true });

      // The notification should disappear
      await expect(page.getByText("Alert: CPU usage high")).toHaveCount(0, { timeout: 5000 });
    });

    test("dismiss updates unread count when dismissing unread notification", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });

      // Initially 2 unread
      await expect(page.locator("[aria-label='Unread']")).toHaveCount(2, { timeout: 5000 });

      // Dismiss n1 (unread alert)
      const firstItem = page.getByText("Alert: CPU usage high").first().locator("../..");
      const dismissBtn = firstItem.getByRole("button", { name: /Dismiss notification|إزالة الإشعار/i });
      await dismissBtn.click({ force: true });

      // Now only 1 unread dot
      await expect(page.locator("[aria-label='Unread']")).toHaveCount(1, { timeout: 5000 });
    });

    // -------------------------------------------------------------------
    // Mark all as read
    // -------------------------------------------------------------------
    test("mark all read button is visible when there are unread notifications", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      await expect(
        page.getByRole("button", { name: /Mark all read|تحديد الكل كمقروء/i })
      ).toBeVisible({ timeout: 5000 });
    });

    test("mark all read removes all unread indicators", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });

      // 2 unread dots initially
      await expect(page.locator("[aria-label='Unread']")).toHaveCount(2, { timeout: 5000 });

      // Click "Mark all read"
      await page.getByRole("button", { name: /Mark all read|تحديد الكل كمقروء/i }).click();

      // All unread indicators should be gone
      await expect(page.locator("[aria-label='Unread']")).toHaveCount(0, { timeout: 5000 });
    });

    test("mark all read button disappears after all are read", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });

      // Click "Mark all read"
      await page.getByRole("button", { name: /Mark all read|تحديد الكل كمقروء/i }).click();

      // Button should no longer be visible (unreadCount becomes 0)
      await expect(
        page.getByRole("button", { name: /Mark all read|تحديد الكل كمقروء/i })
      ).toHaveCount(0, { timeout: 5000 });
    });

    test("mark all read shows success toast", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      await page.getByRole("button", { name: /Mark all read|تحديد الكل كمقروء/i }).click();
      // Sonner toast with success message
      await expect(
        page.getByText(/All marked as read|تم تحديد الكل كمقروء/i).first()
      ).toBeVisible({ timeout: 5000 });
    });

    test("unread count badge updates when marking one as read", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });

      // Badge should show "2" initially
      const badge = page.locator("span").filter({ hasText: /^2$/ }).first();
      await expect(badge).toBeVisible({ timeout: 5000 });

      // Mark n1 as read by clicking
      await page.getByText("Alert: CPU usage high").first().click();

      // Badge should now show "1"
      const updatedBadge = page.locator("span").filter({ hasText: /^1$/ }).first();
      await expect(updatedBadge).toBeVisible({ timeout: 5000 });
    });

    // -------------------------------------------------------------------
    // Notification content details
    // -------------------------------------------------------------------
    test("notification body text is visible", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      await expect(
        page.getByText("Server alpha-3 is running at 95% CPU utilisation.").first()
      ).toBeVisible({ timeout: 5000 });
    });

    test("notification action link is rendered when present", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      const actionLink = page.getByRole("link", { name: /View Alerts|عرض التنبيهات/i }).first();
      await expect(actionLink).toBeVisible({ timeout: 5000 });
      await expect(actionLink).toHaveAttribute("href", "/alerts");
    });

    test("notification timestamp is displayed", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      // The timestamp is formatted as "Mar 27, 12:00 PM" or similar locale string
      // Match any month abbreviation or Arabic month, followed by a day number
      const firstNotification = page.getByText("Alert: CPU usage high").first().locator("../..");
      await expect(firstNotification.getByText(/[A-Z][a-z]{2}\s+\d|[\u0600-\u06FF]/i).first()).toBeVisible({ timeout: 5000 });
    });
  });

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------
  test.describe("empty state", () => {
    test.beforeEach(async ({ page }) => {
      await mockFallbackAPIs(page);
      await mockChatAPIs(page);
      await mockBrainAPIs(page);
      await mockNotificationsAPI(page, []); // empty array
      await loginAsTestUser(page);
      await page.goto("/notifications");
    });

    test("shows empty state when no notifications exist", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      await expect(
        page.getByText(/No notifications|لا توجد إشعارات/i).first()
      ).toBeVisible({ timeout: 5000 });
    });

    test("shows helpful message in empty state", async ({ page }) => {
      await expect(
        page.getByText(/Your notifications will appear here|ستظهر إشعاراتك هنا/i).first()
      ).toBeVisible({ timeout: 8000 });
    });

    test("empty state shows inbox icon", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      // The Inbox icon is rendered inside a div with bg-muted
      const iconContainer = page.locator(".bg-muted").filter({ has: page.locator("svg") });
      await expect(iconContainer.first()).toBeVisible({ timeout: 5000 });
    });

    test("mark all read button is hidden when no unread notifications", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      await expect(
        page.getByRole("button", { name: /Mark all read|تحديد الكل كمقروء/i })
      ).toHaveCount(0, { timeout: 3000 });
    });

    test("unread count badge is hidden when all are read", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      // The badge with a number should not exist
      const badge = page.locator(".bg-nexus-jade\\/20");
      await expect(badge).toHaveCount(0, { timeout: 3000 });
    });

    test("filter tabs still show empty state per category", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      // Click Alerts — still empty
      await page.getByRole("button", { name: "Alerts" }).click();
      await expect(
        page.getByText(/No notifications|لا توجد إشعارات/i).first()
      ).toBeVisible({ timeout: 5000 });
    });
  });

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------
  test.describe("error state", () => {
    test.beforeEach(async ({ page }) => {
      await mockFallbackAPIs(page);
      await mockChatAPIs(page);
      await mockBrainAPIs(page);

      // Set up user display so the page attempts the API call
      await page.addInitScript(() => {
        localStorage.setItem(
          "nexus-user-display",
          JSON.stringify({ id: "u_test_001", name: "Antony Bousader" })
        );
      });

      // Mock notifications endpoint to return error
      await page.route("**/api/proxy/butler/notifications/**", (route) => {
        if (route.request().method() === "GET") {
          return route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "Internal Server Error" }),
          });
        }
        return route.fallback();
      });

      await loginAsTestUser(page);
      await page.goto("/notifications");
    });

    test("shows error message when API fails", async ({ page }) => {
      await expect(
        page.getByText(/Error Loading Notifications|خطأ في تحميل الإشعارات/i).first()
      ).toBeVisible({ timeout: 8000 });
    });

    test("shows retry button on error", async ({ page }) => {
      await expect(
        page.getByRole("button", { name: /Retry|إعادة المحاولة/i })
      ).toBeVisible({ timeout: 8000 });
    });

    test("retry button reloads notifications", async ({ page }) => {
      await expect(
        page.getByRole("button", { name: /Retry|إعادة المحاولة/i })
      ).toBeVisible({ timeout: 8000 });

      // Now change the mock to succeed on retry
      await page.route("**/api/proxy/butler/notifications/**", (route) => {
        if (route.request().method() === "GET") {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(MOCK_NOTIFICATIONS),
          });
        }
        return route.fallback();
      });

      // Click retry
      await page.getByRole("button", { name: /Retry|إعادة المحاولة/i }).click();

      // Should now see notifications
      await expect(
        page.getByText("Alert: CPU usage high").first()
      ).toBeVisible({ timeout: 8000 });
    });

    test("error state shows bell icon", async ({ page }) => {
      await expect(
        page.getByText(/Error Loading Notifications|خطأ في تحميل الإشعارات/i).first()
      ).toBeVisible({ timeout: 8000 });
      // Bell icon is rendered as SVG — just confirm the error container has an SVG
      const errorSection = page.locator("text=Error Loading Notifications").locator("../..");
      const svgs = errorSection.locator("svg");
      await expect(svgs.first()).toBeVisible({ timeout: 3000 });
    });
  });

  // -----------------------------------------------------------------------
  // Mark all read failure (rollback)
  // -----------------------------------------------------------------------
  test.describe("mark all read API failure", () => {
    test.beforeEach(async ({ page }) => {
      await mockFallbackAPIs(page);
      await mockChatAPIs(page);
      await mockBrainAPIs(page);
      await mockNotificationsAPI(page);
      await mockMarkReadAPI(page);
      await mockMarkAllReadAPI(page, false); // fail
      await mockDismissAPI(page);
      await loginAsTestUser(page);
      await page.goto("/notifications");
    });

    test("rolls back optimistic update when mark-all-read fails", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });

      // 2 unread initially
      await expect(page.locator("[aria-label='Unread']")).toHaveCount(2, { timeout: 5000 });

      // Click mark all read — API will fail
      await page.getByRole("button", { name: /Mark all read|تحديد الكل كمقروء/i }).click();

      // Unread dots should return after rollback
      await expect(page.locator("[aria-label='Unread']")).toHaveCount(2, { timeout: 5000 });
    });

    test("shows error toast when mark-all-read fails", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      await page.getByRole("button", { name: /Mark all read|تحديد الكل كمقروء/i }).click();
      await expect(
        page.getByText(/Failed to update notifications|فشل في تحديث الإشعارات/i).first()
      ).toBeVisible({ timeout: 5000 });
    });
  });

  // -----------------------------------------------------------------------
  // Dismiss API failure (rollback)
  // -----------------------------------------------------------------------
  test.describe("dismiss API failure", () => {
    test.beforeEach(async ({ page }) => {
      await mockFallbackAPIs(page);
      await mockChatAPIs(page);
      await mockBrainAPIs(page);
      await mockNotificationsAPI(page);
      await mockMarkReadAPI(page);
      await mockMarkAllReadAPI(page);
      await mockDismissAPI(page, false); // fail
      await loginAsTestUser(page);
      await page.goto("/notifications");
    });

    test("rolls back optimistic dismiss when API fails", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });

      // Dismiss n1
      const firstItem = page.getByText("Alert: CPU usage high").first().locator("../..");
      const dismissBtn = firstItem.getByRole("button", { name: /Dismiss notification|إزالة الإشعار/i });
      await dismissBtn.click({ force: true });

      // Should reappear after rollback
      await expect(page.getByText("Alert: CPU usage high").first()).toBeVisible({ timeout: 5000 });
    });

    test("shows error toast when dismiss fails", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });

      const firstItem = page.getByText("Alert: CPU usage high").first().locator("../..");
      const dismissBtn = firstItem.getByRole("button", { name: /Dismiss notification|إزالة الإشعار/i });
      await dismissBtn.click({ force: true });

      await expect(
        page.getByText(/Failed to dismiss notification|فشل في حذف الإشعار/i).first()
      ).toBeVisible({ timeout: 5000 });
    });
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
  test.describe("loading state", () => {
    test("shows spinner while notifications are loading", async ({ page }) => {
      await mockFallbackAPIs(page);
      await mockChatAPIs(page);
      await mockBrainAPIs(page);

      await page.addInitScript(() => {
        localStorage.setItem(
          "nexus-user-display",
          JSON.stringify({ id: "u_test_001", name: "Antony Bousader" })
        );
      });

      // Delay the notifications response so we can see the spinner
      await page.route("**/api/proxy/butler/notifications/**", async (route) => {
        if (route.request().method() === "GET") {
          await new Promise((r) => setTimeout(r, 2000));
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(MOCK_NOTIFICATIONS),
          });
        }
        return route.continue();
      });

      await loginAsTestUser(page);
      await page.goto("/notifications");

      // The Loader2 spinner should be visible during load
      const spinner = page.locator(".animate-spin");
      await expect(spinner).toBeVisible({ timeout: 3000 });

      // After loading completes, spinner should disappear and content appears
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // -----------------------------------------------------------------------
  // All read — no mark-all button
  // -----------------------------------------------------------------------
  test.describe("all notifications already read", () => {
    test.beforeEach(async ({ page }) => {
      const allRead = MOCK_NOTIFICATIONS.map((n) => ({ ...n, read: true }));
      await mockFallbackAPIs(page);
      await mockChatAPIs(page);
      await mockBrainAPIs(page);
      await mockNotificationsAPI(page, allRead);
      await loginAsTestUser(page);
      await page.goto("/notifications");
    });

    test("mark all read button is not shown when all are already read", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      await expect(
        page.getByRole("button", { name: /Mark all read|تحديد الكل كمقروء/i })
      ).toHaveCount(0, { timeout: 3000 });
    });

    test("no unread count badge is displayed", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      const badge = page.locator(".bg-nexus-jade\\/20");
      await expect(badge).toHaveCount(0, { timeout: 3000 });
    });

    test("no unread indicator dots are shown", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      await expect(page.locator("[aria-label='Unread']")).toHaveCount(0, { timeout: 3000 });
    });
  });

  // -----------------------------------------------------------------------
  // No user — graceful fallback
  // -----------------------------------------------------------------------
  test.describe("no user in localStorage", () => {
    test.beforeEach(async ({ page }) => {
      await mockFallbackAPIs(page);
      await mockChatAPIs(page);
      await mockBrainAPIs(page);
      // Do NOT set nexus-user-display — the page should handle missing user gracefully
      await loginAsTestUser(page);
      await page.goto("/notifications");
    });

    test("shows empty state when no user is found", async ({ page }) => {
      // Page should show empty state (setNotifications([]) when no userId)
      await expect(
        page.getByText(/No notifications|لا توجد إشعارات/i).first()
      ).toBeVisible({ timeout: 8000 });
    });
  });

  // -----------------------------------------------------------------------
  // Accessibility
  // -----------------------------------------------------------------------
  test.describe("accessibility", () => {
    test.beforeEach(async ({ page }) => {
      await mockFallbackAPIs(page);
      await mockChatAPIs(page);
      await mockBrainAPIs(page);
      await mockNotificationsAPI(page);
      await mockMarkReadAPI(page);
      await mockMarkAllReadAPI(page);
      await mockDismissAPI(page);
      await loginAsTestUser(page);
      await page.goto("/notifications");
    });

    test("dismiss buttons have accessible labels", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      const dismissButtons = page.getByRole("button", { name: /Dismiss notification|إزالة الإشعار/i });
      const count = await dismissButtons.count();
      expect(count).toBe(5); // one per notification
    });

    test("unread indicators have aria-label", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      const unreadSpans = page.locator("[aria-label='Unread']");
      const count = await unreadSpans.count();
      expect(count).toBe(2);
    });

    test("decorative icons are hidden from screen readers", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^Notifications$|^الإشعارات$/i })
      ).toBeVisible({ timeout: 8000 });
      // Check the Bell icon in header has aria-hidden
      const ariaHiddenIcons = page.locator("[aria-hidden='true']");
      const count = await ariaHiddenIcons.count();
      expect(count).toBeGreaterThan(0);
    });
  });
});
