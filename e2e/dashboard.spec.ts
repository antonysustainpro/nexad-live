import { test, expect } from "@playwright/test";
import { loginAsTestUser, mockBrainAPIs, mockFallbackAPIs, mockChatAPIs } from "./helpers";

test.describe("Dashboard (Home Page)", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await loginAsTestUser(page);
    await page.goto("/");
  });

  test("shows greeting", async ({ page }) => {
    // Greeting should be visible (time-based or special occasion)
    await expect(page.getByText(/Good (morning|afternoon|evening)|Ramadan|Eid|Jumu'ah|مرحباً|صباح|مساء|Welcome/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("shows sovereignty score component", async ({ page }) => {
    // Sovereignty score section should be present (has aria-label) - use .first() if multiple matches
    const sovereigntySection = page.locator('[aria-label*="Sovereignty Score"], [aria-label*="نقاط السيادة"]').first();
    await expect(sovereigntySection).toBeVisible({ timeout: 5000 });
  });

  test("shows daily briefing card", async ({ page }) => {
    // Briefing items should be visible - look for briefing card content
    await expect(page.getByText(/Welcome to NexusAD|مرحباً بك|Three things|ثلاثة|attention|انتباهك/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("quick action buttons are present", async ({ page }) => {
    // Quick action buttons
    await expect(page.getByRole("link", { name: /New Conversation|محادثة جديدة/i })).toBeVisible({ timeout: 5000 });
  });

  test("new conversation button links to chat", async ({ page }) => {
    const chatLink = page.getByRole("link", { name: /New Conversation|محادثة جديدة/i });
    await expect(chatLink).toHaveAttribute("href", "/chat");
  });

  test("voice mode button links to voice", async ({ page }) => {
    const voiceLink = page.getByRole("link", { name: /Voice Mode|الوضع الصوتي/i });
    await expect(voiceLink).toHaveAttribute("href", "/voice");
  });

  test("domain overview section is present", async ({ page }) => {
    await expect(page.getByText(/Domain Overview|نظرة عامة على المجالات/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("vault summary section is present", async ({ page }) => {
    await expect(page.getByText(/Vault Summary|ملخص الخزنة/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("page has proper main landmark", async ({ page }) => {
    const main = page.locator("main#main-content");
    await expect(main).toBeVisible();
  });

  test("footer shows AI services info", async ({ page }) => {
    await expect(page.getByText(/Powered by|مدعوم بـ/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Dashboard Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await loginAsTestUser(page);
  });

  test("clicking New Conversation navigates to chat", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /New Conversation|محادثة جديدة/i }).click();
    await expect(page).toHaveURL(/\/chat/);
  });

  test("clicking View All Domains navigates to domains", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /View All Domains|عرض الكل/i }).first().click();
    await expect(page).toHaveURL(/\/(domains|briefing)/);
  });
});
