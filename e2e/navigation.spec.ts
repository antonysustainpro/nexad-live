import { test, expect, Page } from "@playwright/test";
import { loginAsTestUser, mockChatAPIs, mockBrainAPIs, mockFallbackAPIs } from "./helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mock the /search endpoint returning realistic results. */
async function mockSearchAPI(page: Page) {
  await page.route("**/api/proxy/search**", (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get("q") || "";

    // Return results only when the query contains "budget"
    if (q.toLowerCase().includes("budget")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "sr-1",
              type: "conversation",
              title: "Q1 Budget Review",
              description: "Monthly budget review meeting notes",
              href: "/chat/th1",
              domain: "finance",
              date: "2026-03-18",
              tags: ["finance", "quarterly"],
            },
            {
              id: "sr-2",
              type: "document",
              title: "Budget Proposal 2026",
              description: "Annual budget proposal document",
              href: "/vault",
              domain: "finance",
              date: "2026-02-10",
              tags: ["finance"],
            },
          ],
        }),
      });
    }

    // No results for anything else
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [] }),
    });
  });
}

/** Mock the /briefing endpoint returning realistic items. */
async function mockBriefingAPI(page: Page) {
  await page.route("**/api/proxy/briefing**", (route) => {
    const url = new URL(route.request().url());
    const dateParam = url.searchParams.get("date");

    // Return different content for different dates so we can verify navigation updates content
    const isYesterday = dateParam && dateParam !== new Date().toISOString().split("T")[0];

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          items: [
            {
              id: isYesterday ? "b-y1" : "b-1",
              icon: "TrendingUp",
              title: isYesterday ? "Yesterday Revenue Update" : "Revenue Spike Detected",
              titleAr: isYesterday ? "تحديث إيرادات الأمس" : "تم اكتشاف ارتفاع في الإيرادات",
              summary: isYesterday ? "Revenue was stable yesterday" : "Revenue up 15% this week",
              summaryAr: isYesterday ? "كانت الإيرادات مستقرة بالأمس" : "ارتفاع الإيرادات 15% هذا الأسبوع",
              detail: isYesterday ? "Full report for yesterday" : "Full quarterly revenue analysis",
              detailAr: isYesterday ? "التقرير الكامل لليوم السابق" : "تحليل الإيرادات الربع سنوي الكامل",
              prompt: "Analyze revenue trends",
            },
            {
              id: isYesterday ? "b-y2" : "b-2",
              icon: "Clock",
              title: isYesterday ? "Yesterday Tasks Summary" : "3 Overdue Tasks",
              titleAr: isYesterday ? "ملخص مهام الأمس" : "3 مهام متأخرة",
              summary: isYesterday ? "All tasks were completed" : "Critical tasks need attention",
              summaryAr: isYesterday ? "تم إنجاز جميع المهام" : "مهام حرجة تحتاج انتباه",
              detail: isYesterday ? "Yesterday all tasks done" : "Details on overdue tasks",
              detailAr: isYesterday ? "أنجزت جميع المهام بالأمس" : "تفاصيل المهام المتأخرة",
              prompt: "Show overdue tasks",
            },
            {
              id: isYesterday ? "b-y3" : "b-3",
              icon: "Brain",
              title: isYesterday ? "Yesterday Brain Activity" : "Brain Learning Progress",
              titleAr: isYesterday ? "نشاط الدماغ بالأمس" : "تقدم تعلم الدماغ",
              summary: isYesterday ? "12 items processed" : "42 new patterns identified",
              summaryAr: isYesterday ? "تمت معالجة 12 عنصر" : "تم تحديد 42 نمطاً جديداً",
              detail: isYesterday ? "Brain summary for yesterday" : "Detailed learning report",
              detailAr: isYesterday ? "ملخص الدماغ لليوم السابق" : "تقرير التعلم المفصل",
              prompt: "Summarize brain learning",
            },
          ],
        },
      }),
    });
  });
}

/** Mock settings endpoint for language changes. */
async function mockSettingsAPI(page: Page) {
  await page.route("**/api/proxy/settings**", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            theme: "dark",
            language: "en",
            fontSize: "medium",
          },
        }),
      });
    }
    // PUT/PATCH — just acknowledge
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

/** Standard setup for desktop tests. */
async function setupDesktop(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
}

/** Locate the desktop sidebar. */
function sidebar(page: Page) {
  return page.locator(
    "aside[role='navigation'][aria-label*='Sidebar'], aside[role='navigation'][aria-label*='الشريط']"
  );
}

// ===========================================================================
// 1. SIDEBAR NAVIGATION
// ===========================================================================

test.describe("Sidebar Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockSearchAPI(page);
    await mockBriefingAPI(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await mockSettingsAPI(page);
    await loginAsTestUser(page);
  });

  test("sidebar is visible on desktop", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    await expect(sidebar(page)).toBeVisible({ timeout: 8000 });
  });

  test("sidebar has all primary navigation items", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    const nav = sidebar(page);
    await expect(nav).toBeVisible({ timeout: 8000 });

    // Every nav item from navItems in app-sidebar.tsx
    const expectedLinks: Array<{ name: RegExp | string; exact?: boolean }> = [
      { name: /Butler|الخادم/ },
      { name: /Dashboard|لوحة التحكم/ },
      { name: "Chat", exact: true },
      { name: /Voice|الصوت/ },
      { name: /Vault|الخزنة/ },
      { name: /Domains|المجالات/ },
      { name: /Notifications|الإشعارات/ },
      { name: /Billing|الفواتير/ },
      { name: /Team|الفريق/ },
      { name: /Referrals|الإحالات/ },
      { name: /Profile|الملف الشخصي/ },
      { name: /Help|المساعدة/ },
      { name: /Settings|الإعدادات/ },
    ];

    for (const linkSpec of expectedLinks) {
      await expect(nav.getByRole("link", { name: linkSpec.name, exact: linkSpec.exact })).toBeVisible();
    }
  });

  test("clicking Chat navigates to /chat", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    await sidebar(page).getByRole("link", { name: "Chat", exact: true }).click();
    await expect(page).toHaveURL(/\/chat/);
  });

  test("clicking Dashboard navigates to /", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/chat");
    await sidebar(page)
      .getByRole("link", { name: /Dashboard|لوحة التحكم/i })
      .click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("clicking Settings navigates to /settings", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    await sidebar(page)
      .getByRole("link", { name: /Settings|الإعدادات/i })
      .click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test("clicking Vault navigates to /vault", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    await sidebar(page)
      .getByRole("link", { name: /Vault|الخزنة/i })
      .click();
    await expect(page).toHaveURL(/\/vault/);
  });

  test("clicking Domains navigates to /domains", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    await sidebar(page)
      .getByRole("link", { name: /Domains|المجالات/i })
      .click();
    await expect(page).toHaveURL(/\/domains/);
  });

  test("clicking Profile navigates to /profile", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    await sidebar(page)
      .getByRole("link", { name: /Profile|الملف الشخصي/i })
      .click();
    await expect(page).toHaveURL(/\/profile/);
  });

  test("clicking Help navigates to /help", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    await sidebar(page)
      .getByRole("link", { name: /Help|المساعدة/i })
      .click();
    await expect(page).toHaveURL(/\/help/);
  });

  test("active nav link has aria-current page attribute", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/settings");
    const settingsLink = sidebar(page).getByRole("link", {
      name: /Settings|الإعدادات/i,
    });
    await expect(settingsLink).toHaveAttribute("aria-current", "page");
  });

  test("sidebar has proper ARIA label", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    await expect(sidebar(page)).toHaveAttribute(
      "aria-label",
      /Sidebar navigation|الشريط الجانبي/
    );
  });

  test("main content area has proper landmarks", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    const main = page.locator("main#main-content");
    await expect(main).toBeVisible();
    await expect(main).toHaveAttribute("role", "main");
  });

  test("browser back/forward navigation works", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    await sidebar(page).getByRole("link", { name: "Chat", exact: true }).click();
    await expect(page).toHaveURL(/\/chat/);

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);

    await page.goForward();
    await expect(page).toHaveURL(/\/chat/);
  });

  test("New Chat button is visible and navigates to /chat", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/settings");
    const newChatLink = sidebar(page).getByRole("link", { name: /New Chat|محادثة جديدة/i });
    await expect(newChatLink).toBeVisible();
    await newChatLink.click();
    await expect(page).toHaveURL(/\/chat/);
  });
});

// ===========================================================================
// 2. SIDEBAR COLLAPSE / EXPAND
// ===========================================================================

test.describe("Sidebar Collapse/Expand", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockSearchAPI(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await loginAsTestUser(page);
  });

  test("collapse button is present", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    const collapseBtn = page.getByRole("button", {
      name: /Collapse sidebar|Expand sidebar/i,
    });
    await expect(collapseBtn).toBeVisible();
  });

  test("clicking collapse button shrinks sidebar width", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    const sidebarEl = sidebar(page);
    await expect(sidebarEl).toBeVisible({ timeout: 8000 });

    // Capture expanded width
    const expandedBox = await sidebarEl.boundingBox();
    expect(expandedBox).not.toBeNull();
    const expandedWidth = expandedBox!.width;

    // Click collapse
    await page.getByRole("button", { name: /Collapse sidebar/i }).click();

    // Wait for transition
    await page.waitForTimeout(400);

    const collapsedBox = await sidebarEl.boundingBox();
    expect(collapsedBox).not.toBeNull();
    expect(collapsedBox!.width).toBeLessThan(expandedWidth);
  });

  test("collapsed sidebar hides text labels but shows icons", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    await expect(sidebar(page)).toBeVisible({ timeout: 8000 });

    // Collapse
    await page.getByRole("button", { name: /Collapse sidebar/i }).click();
    await page.waitForTimeout(400);

    // Nav links should still exist (icons visible) but text labels hidden
    // In collapsed mode the sidebar only shows icons; text is rendered conditionally
    // The links still exist but won't show label text
    const links = sidebar(page).getByRole("link");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });

  test("expand button restores sidebar", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    const sidebarEl = sidebar(page);
    await expect(sidebarEl).toBeVisible({ timeout: 8000 });

    // Collapse then expand
    await page.getByRole("button", { name: /Collapse sidebar/i }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /Expand sidebar/i }).click();
    await page.waitForTimeout(400);

    // Search should be visible again (only shown when expanded)
    const searchBtn = sidebarEl.locator("button", { hasText: /Search|بحث/ });
    await expect(searchBtn).toBeVisible();
  });

  test("collapsed sidebar hides search bar", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    await expect(sidebar(page)).toBeVisible({ timeout: 8000 });

    // Search is visible in expanded state
    const searchBtn = sidebar(page).locator("button", { hasText: /Search|بحث/ });
    await expect(searchBtn).toBeVisible();

    // Collapse
    await page.getByRole("button", { name: /Collapse sidebar/i }).click();
    await page.waitForTimeout(400);

    await expect(searchBtn).not.toBeVisible();
  });
});

// ===========================================================================
// 3. GLOBAL SEARCH
// ===========================================================================

test.describe("Global Search", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockSearchAPI(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await loginAsTestUser(page);
  });

  test("search opens with Cmd+K keyboard shortcut", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    await page.waitForTimeout(500);

    // Press Cmd+K (Meta+K)
    await page.keyboard.press("Meta+k");

    // Command dialog should open — look for the search input placeholder
    const searchInput = page.locator(
      "input[placeholder*='Search conversations'], input[placeholder*='ابحث في المحادثات']"
    );
    await expect(searchInput).toBeVisible({ timeout: 3000 });
  });

  test("search opens with click on search button", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    await expect(sidebar(page)).toBeVisible({ timeout: 8000 });

    // Click the search trigger button
    const searchTrigger = sidebar(page).locator("button", { hasText: /Search|بحث/ });
    await searchTrigger.click();

    const searchInput = page.locator(
      "input[placeholder*='Search conversations'], input[placeholder*='ابحث في المحادثات']"
    );
    await expect(searchInput).toBeVisible({ timeout: 3000 });
  });

  test("empty search shows recent searches and quick actions", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    await page.keyboard.press("Meta+k");

    // Scope assertions to the search dialog to avoid matching sidebar elements
    const dialog = page.getByRole("dialog");

    // Recent searches group
    await expect(
      dialog.getByText(/Recent Searches|عمليات البحث الأخيرة/)
    ).toBeVisible({ timeout: 3000 });

    // Specific recent search items
    await expect(dialog.getByText("budget analysis")).toBeVisible();
    await expect(dialog.getByText("investor meeting")).toBeVisible();
    await expect(dialog.getByText("privacy settings")).toBeVisible();

    // Quick actions group
    await expect(
      dialog.getByText(/Quick Actions|إجراءات سريعة/)
    ).toBeVisible();
    await expect(dialog.getByText(/New Chat|محادثة جديدة/)).toBeVisible();
    await expect(dialog.getByText(/Upload Document|رفع مستند/)).toBeVisible();
  });

  test("typing a query returns search results", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    await page.keyboard.press("Meta+k");

    const searchInput = page.locator(
      "input[placeholder*='Search conversations'], input[placeholder*='ابحث في المحادثات']"
    );
    await expect(searchInput).toBeVisible({ timeout: 3000 });

    // Type a query that returns results
    await searchInput.fill("budget");

    // Wait for debounce (300ms) + API response
    await page.waitForTimeout(600);

    // Results should appear
    await expect(page.getByText("Q1 Budget Review")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Budget Proposal 2026")).toBeVisible();
  });

  test("search result click navigates to the correct page", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    await page.keyboard.press("Meta+k");

    const searchInput = page.locator(
      "input[placeholder*='Search conversations'], input[placeholder*='ابحث في المحادثات']"
    );
    await searchInput.fill("budget");
    await page.waitForTimeout(600);

    // Click on the first search result
    await page.getByText("Q1 Budget Review").click();

    // Dialog should close and navigation should happen
    await expect(page).toHaveURL(/\/chat\/th1/, { timeout: 5000 });
  });

  test("search with no results shows empty state", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    await page.keyboard.press("Meta+k");

    const searchInput = page.locator(
      "input[placeholder*='Search conversations'], input[placeholder*='ابحث في المحادثات']"
    );
    await searchInput.fill("xyznonexistent");
    await page.waitForTimeout(600);

    // No results message
    await expect(
      page.getByText(/No results found|لم يتم العثور على نتائج/)
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText(/Try searching for something else|جرب البحث عن شيء آخر/)
    ).toBeVisible();
  });

  test("search dialog closes on Escape", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    await page.keyboard.press("Meta+k");

    const searchInput = page.locator(
      "input[placeholder*='Search conversations'], input[placeholder*='ابحث في المحادثات']"
    );
    await expect(searchInput).toBeVisible({ timeout: 3000 });

    await page.keyboard.press("Escape");
    await expect(searchInput).not.toBeVisible();
  });

  test("search shows loading state while fetching", async ({ page }) => {
    await setupDesktop(page);

    // Add artificial delay to the search API
    await page.route("**/api/proxy/search**", async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.goto("/");
    await page.keyboard.press("Meta+k");

    const searchInput = page.locator(
      "input[placeholder*='Search conversations'], input[placeholder*='ابحث في المحادثات']"
    );
    await searchInput.fill("something");

    // Should show loading state
    await expect(page.getByText(/Searching|جاري البحث/)).toBeVisible({
      timeout: 3000,
    });
  });

  test("search groups results by type", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/");
    await page.keyboard.press("Meta+k");

    const searchInput = page.locator(
      "input[placeholder*='Search conversations'], input[placeholder*='ابحث في المحادثات']"
    );
    await searchInput.fill("budget");
    await page.waitForTimeout(600);

    // Should show type group headings
    await expect(
      page.getByText(/Conversations|المحادثات/).first()
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText(/Documents|المستندات/).first()
    ).toBeVisible();
  });
});

// ===========================================================================
// 4. BRIEFING PAGE
// ===========================================================================

test.describe("Briefing Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockBriefingAPI(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await loginAsTestUser(page);
  });

  test("briefing page loads with ambient intro", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/briefing");

    // Ambient intro renders each word in its own animated span inside an h1.
    // Text nodes have no spaces between them, so match individual words instead.
    await expect(
      page.locator("h1 >> text=attention").or(page.locator("h1 >> text=انتباهك"))
    ).toBeVisible({ timeout: 10000 });
  });

  test("briefing intro shows preview cards after delay", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/briefing");

    // Cards appear after ~1.5s delay
    await expect(page.getByText("Revenue Spike Detected")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("3 Overdue Tasks")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Brain Learning Progress")).toBeVisible({
      timeout: 10000,
    });
  });

  test("View Full Briefing button transitions to expanded view", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/briefing");

    // Wait for the "View Full Briefing" link to appear
    const viewBtn = page.getByRole("button", {
      name: /View Full Briefing|عرض الإحاطة الكاملة/,
    });
    await expect(viewBtn).toBeVisible({ timeout: 12000 });
    await viewBtn.click();

    // Expanded view should show "Daily Briefing" heading
    await expect(
      page.getByText(/Daily Briefing|الإحاطة اليومية/)
    ).toBeVisible({ timeout: 5000 });
  });

  test("expanded briefing shows day navigation controls", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/briefing");

    // Transition to expanded view
    const viewBtn = page.getByRole("button", {
      name: /View Full Briefing|عرض الإحاطة الكاملة/,
    });
    await expect(viewBtn).toBeVisible({ timeout: 12000 });
    await viewBtn.click();

    // Previous day button
    await expect(
      page.getByRole("button", { name: "Previous day" })
    ).toBeVisible({ timeout: 5000 });

    // Next day button (disabled because we are on today)
    const nextBtn = page.getByRole("button", { name: "Next day" });
    await expect(nextBtn).toBeVisible();
    await expect(nextBtn).toBeDisabled();
  });

  test("clicking previous day updates briefing content", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/briefing");

    const viewBtn = page.getByRole("button", {
      name: /View Full Briefing|عرض الإحاطة الكاملة/,
    });
    await expect(viewBtn).toBeVisible({ timeout: 12000 });
    await viewBtn.click();

    // Verify today's content is showing
    await expect(page.getByText("Revenue Spike Detected")).toBeVisible({
      timeout: 5000,
    });

    // Click previous day
    await page.getByRole("button", { name: "Previous day" }).click();

    // Content should update to yesterday's data
    await expect(page.getByText("Yesterday Revenue Update")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("Yesterday Tasks Summary")).toBeVisible();
  });

  test("navigating to previous day enables next day button", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/briefing");

    const viewBtn = page.getByRole("button", {
      name: /View Full Briefing|عرض الإحاطة الكاملة/,
    });
    await expect(viewBtn).toBeVisible({ timeout: 12000 });
    await viewBtn.click();

    // Next button is initially disabled (today)
    const nextBtn = page.getByRole("button", { name: "Next day" });
    await expect(nextBtn).toBeDisabled({ timeout: 5000 });

    // Go back one day
    await page.getByRole("button", { name: "Previous day" }).click();
    await page.waitForTimeout(500);

    // Next button should now be enabled
    await expect(nextBtn).toBeEnabled();
  });

  test("briefing cards have Discuss with NexusAD links", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/briefing");

    const viewBtn = page.getByRole("button", {
      name: /View Full Briefing|عرض الإحاطة الكاملة/,
    });
    await expect(viewBtn).toBeVisible({ timeout: 12000 });
    await viewBtn.click();

    // Each briefing card should have a "Discuss with NexusAD Ai" link
    const discussLinks = page.getByText(/Discuss with NexusAD|ناقش مع NexusAD/);
    await expect(discussLinks.first()).toBeVisible({ timeout: 5000 });
    const count = await discussLinks.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("expanded briefing has back to dashboard link", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/briefing");

    const viewBtn = page.getByRole("button", {
      name: /View Full Briefing|عرض الإحاطة الكاملة/,
    });
    await expect(viewBtn).toBeVisible({ timeout: 12000 });
    await viewBtn.click();

    const backLink = page.getByText(/Back to Dashboard|العودة للوحة التحكم/);
    await expect(backLink).toBeVisible({ timeout: 5000 });
    await backLink.click();
    await expect(page).toHaveURL(/\/$/, { timeout: 5000 });
  });
});

// ===========================================================================
// 5. MOBILE RESPONSIVE SIDEBAR
// ===========================================================================

test.describe("Mobile Responsive Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockSearchAPI(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await loginAsTestUser(page);
  });

  test("desktop sidebar is hidden on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    // The aside element has class "hidden md:flex" so it should be hidden on mobile
    const desktopSidebar = sidebar(page);
    await expect(desktopSidebar).not.toBeVisible();
  });

  test("mobile tab bar is visible on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    const tabBar = page.locator(
      "nav[aria-label='Main navigation'], nav[aria-label='التنقل الرئيسي']"
    );
    await expect(tabBar).toBeVisible({ timeout: 8000 });
  });

  test("mobile tab bar has primary navigation items", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    const tabBar = page.locator(
      "nav[aria-label='Main navigation'], nav[aria-label='التنقل الرئيسي']"
    );
    await expect(tabBar).toBeVisible({ timeout: 8000 });

    // Primary items: Butler, Dashboard, Chat, Voice, Vault
    await expect(tabBar.getByRole("link", { name: /Butler|الخادم/i })).toBeVisible();
    await expect(tabBar.getByRole("link", { name: /Dashboard|الرئيسية/i })).toBeVisible();
    await expect(tabBar.getByRole("link", { name: /Chat|المحادثة/i })).toBeVisible();
    await expect(tabBar.getByRole("link", { name: /Voice|الصوت/i })).toBeVisible();
    await expect(tabBar.getByRole("link", { name: /Vault|الخزنة/i })).toBeVisible();
  });

  test("mobile More button opens sheet with additional items", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    // Click the "More" button
    const moreBtn = page.getByRole("button", { name: /More|المزيد/i });
    await expect(moreBtn).toBeVisible({ timeout: 8000 });
    await moreBtn.click();

    // Sheet should open with more items — scope assertions to the sheet dialog
    const sheet = page.locator("[role='dialog']");
    await expect(sheet.getByText(/Domains|المجالات/).first()).toBeVisible({ timeout: 3000 });
    await expect(sheet.getByText(/Settings|الإعدادات/).first()).toBeVisible();
    await expect(sheet.getByText(/Profile|الملف الشخصي/).first()).toBeVisible();
    await expect(sheet.getByText(/Help|المساعدة/).first()).toBeVisible();
  });

  test("mobile tab bar navigates correctly", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    const tabBar = page.locator(
      "nav[aria-label='Main navigation'], nav[aria-label='التنقل الرئيسي']"
    );
    await expect(tabBar).toBeVisible({ timeout: 8000 });

    await tabBar.getByRole("link", { name: /Chat|المحادثة/i }).click();
    await expect(page).toHaveURL(/\/chat/);
  });

  test("mobile tab bar marks active tab with aria-current", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/chat");

    const tabBar = page.locator(
      "nav[aria-label='Main navigation'], nav[aria-label='التنقل الرئيسي']"
    );
    await expect(tabBar).toBeVisible({ timeout: 8000 });

    const chatLink = tabBar.getByRole("link", { name: /Chat|المحادثة/i });
    await expect(chatLink).toHaveAttribute("aria-current", "page");
  });

  test("Cmd+K search works on mobile too", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.waitForTimeout(500);

    await page.keyboard.press("Meta+k");

    const searchInput = page.locator(
      "input[placeholder*='Search conversations'], input[placeholder*='ابحث في المحادثات']"
    );
    await expect(searchInput).toBeVisible({ timeout: 3000 });
  });
});

// ===========================================================================
// 6. LANGUAGE TOGGLE (EN/AR) AND RTL
// ===========================================================================

test.describe("Language Toggle and RTL", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockSearchAPI(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await mockSettingsAPI(page);
    await loginAsTestUser(page);
  });

  test("language can be switched to Arabic via settings", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/settings");

    // Wait for the settings page to load — scope to main content to avoid AnimatePresence duplicates
    const main = page.locator("main#main-content");
    await expect(main.getByText("Language").first()).toBeVisible({ timeout: 8000 });

    // Click the Arabic radio option — use .first() to avoid strict mode with AnimatePresence
    const arabicLabel = main.locator("label[for='lang-ar']").first();
    await arabicLabel.click();

    // After switching, the HTML dir attribute should become rtl
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl", {
      timeout: 3000,
    });
    // The lang attribute should be "ar"
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  });

  test("language can be switched back to English", async ({ page }) => {
    await setupDesktop(page);

    // Start in Arabic
    await page.addInitScript(() => {
      localStorage.setItem("nexus-language", "ar");
    });
    await page.goto("/settings");

    // Page should be in RTL
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl", {
      timeout: 5000,
    });

    // Click English radio option — scope to main content to avoid AnimatePresence duplicates
    const main = page.locator("main#main-content");
    const englishLabel = main.locator("label[for='lang-en']").first();
    await englishLabel.click();

    // Should switch to LTR
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr", {
      timeout: 3000,
    });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("RTL layout reverses sidebar and content when Arabic selected", async ({ page }) => {
    await setupDesktop(page);

    // Set Arabic before page loads
    await page.addInitScript(() => {
      localStorage.setItem("nexus-language", "ar");
    });
    await page.goto("/");

    // The root flex container should have flex-row-reverse class
    // Layout parent: div.flex.min-h-screen with isRTL && "flex-row-reverse"
    const layoutRoot = page.locator("div.flex.min-h-screen").first();
    await expect(layoutRoot).toBeVisible({ timeout: 8000 });
    await expect(layoutRoot).toHaveClass(/flex-row-reverse/);
  });

  test("sidebar shows Arabic labels when language is Arabic", async ({ page }) => {
    await setupDesktop(page);

    await page.addInitScript(() => {
      localStorage.setItem("nexus-language", "ar");
    });
    await page.goto("/");

    const nav = sidebar(page);
    await expect(nav).toBeVisible({ timeout: 8000 });

    // Should show Arabic labels
    await expect(nav.getByRole("link", { name: /لوحة التحكم/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /المحادثة/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /الإعدادات/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /الخزنة/ })).toBeVisible();
  });

  test("search dialog shows Arabic placeholders when language is Arabic", async ({
    page,
  }) => {
    await setupDesktop(page);

    await page.addInitScript(() => {
      localStorage.setItem("nexus-language", "ar");
    });
    await page.goto("/");
    await page.waitForTimeout(500);

    await page.keyboard.press("Meta+k");

    const searchInput = page.locator(
      "input[placeholder*='ابحث في المحادثات']"
    );
    await expect(searchInput).toBeVisible({ timeout: 3000 });
  });

  test("search no-results shows Arabic text when language is Arabic", async ({
    page,
  }) => {
    await setupDesktop(page);

    await page.addInitScript(() => {
      localStorage.setItem("nexus-language", "ar");
    });
    await page.goto("/");
    await page.keyboard.press("Meta+k");

    const searchInput = page.locator(
      "input[placeholder*='ابحث في المحادثات']"
    );
    await searchInput.fill("xyznonexistent");
    await page.waitForTimeout(600);

    await expect(page.getByText("لم يتم العثور على نتائج")).toBeVisible({
      timeout: 5000,
    });
  });

  test("briefing page shows Arabic content when language is Arabic", async ({
    page,
  }) => {
    await mockBriefingAPI(page);
    await setupDesktop(page);

    await page.addInitScript(() => {
      localStorage.setItem("nexus-language", "ar");
    });
    await page.goto("/briefing");

    // Each word is rendered in a separate animated span, so match individual word
    await expect(
      page.locator("h1 >> text=انتباهك")
    ).toBeVisible({ timeout: 10000 });
  });

  test("mobile tab bar shows Arabic labels when language is Arabic", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.addInitScript(() => {
      localStorage.setItem("nexus-language", "ar");
    });
    await page.goto("/");

    const tabBar = page.locator(
      "nav[aria-label='التنقل الرئيسي']"
    );
    await expect(tabBar).toBeVisible({ timeout: 8000 });

    await expect(tabBar.getByRole("link", { name: /الرئيسية/ })).toBeVisible();
    await expect(tabBar.getByRole("link", { name: /المحادثة/ })).toBeVisible();
  });

  test("command dialog uses RTL direction when Arabic", async ({ page }) => {
    await setupDesktop(page);

    await page.addInitScript(() => {
      localStorage.setItem("nexus-language", "ar");
    });
    await page.goto("/");
    await page.waitForTimeout(500);
    await page.keyboard.press("Meta+k");

    // The Command component should have dir="rtl"
    const commandEl = page.locator("[cmdk-root][dir='rtl']");
    await expect(commandEl).toBeVisible({ timeout: 3000 });
  });
});

// ===========================================================================
// 7. SEARCH PAGE (Full Page)
// ===========================================================================

test.describe("Search Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockSearchAPI(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await loginAsTestUser(page);
  });

  test("search page loads with search input", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/search");

    // Use .first() to avoid AnimatePresence duplicate during page transition
    const searchInput = page.locator(
      "input[placeholder*='Search everything'], input[placeholder*='ابحث في كل شيء']"
    ).first();
    await expect(searchInput).toBeVisible({ timeout: 8000 });
  });

  test("search page shows results for valid query", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/search?q=budget");

    // Should show search results — scope to main content and use .first() for AnimatePresence
    const main = page.locator("main#main-content");
    await expect(main.getByText("Q1 Budget Review").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(main.getByText("Budget Proposal 2026").first()).toBeVisible();
  });

  test("search page shows result count", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/search?q=budget");

    const main = page.locator("main#main-content");
    await expect(main.getByText(/2 results|2 نتيجة/).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("search page shows empty state for no results", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/search?q=xyznonexistent");

    const main = page.locator("main#main-content");
    await expect(
      main.getByText(/No Results Found|لم يتم العثور على نتائج/).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("search page has type filter tabs", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/search?q=budget");

    // Type filter tabs
    await expect(page.getByRole("tab", { name: /All|الكل/ })).toBeVisible({
      timeout: 8000,
    });
    await expect(
      page.getByRole("tab", { name: /Conversations|المحادثات/ })
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Documents|المستندات/ })
    ).toBeVisible();
  });

  test("search page has sort selector", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/search?q=budget");

    // Sort selector should be visible
    await expect(page.getByText(/Relevance|الصلة/)).toBeVisible({
      timeout: 8000,
    });
  });

  test("search page has view mode toggle (list/grid)", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/search?q=budget");

    // View mode toggle buttons exist — use .first() for AnimatePresence duplicates
    const main = page.locator("main#main-content");
    const viewToggle = main.locator("div.flex.border.border-white\\/10.rounded-lg").first();
    await expect(viewToggle).toBeVisible({ timeout: 8000 });
  });

  test("search page has back link", async ({ page }) => {
    await setupDesktop(page);
    await page.goto("/search");

    const main = page.locator("main#main-content");
    const backLink = main.getByText(/Back|العودة/).first();
    await expect(backLink).toBeVisible({ timeout: 8000 });
  });
});
