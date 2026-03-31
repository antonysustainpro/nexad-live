import { test, expect } from "@playwright/test";
import { loginAsTestUser, mockChatAPIs, mockBrainAPIs, mockFallbackAPIs } from "./helpers";

test.describe("Responsive - Mobile (375x812)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test("login page renders properly on mobile", async ({ page }) => {
    await page.goto("/login");
    // Login form should be visible (use .first() because Radix Tabs renders both tab panels)
    await expect(page.locator("#api-key").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign In|تسجيل الدخول/i })).toBeVisible();
  });

  test("chat page renders on mobile", async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await loginAsTestUser(page);
    await page.goto("/chat");
    // Chat input should be visible
    const textarea = page.getByRole("textbox").first();
    await expect(textarea).toBeVisible({ timeout: 5000 });
  });

  test("mobile tab bar is visible", async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await loginAsTestUser(page);
    await page.goto("/chat");
    // Mobile navigation should be present at bottom
    const nav = page.locator("nav[aria-label='Main navigation'], nav[aria-label='التنقل الرئيسي']");
    await expect(nav).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Responsive - Tablet (768x1024)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await mockFallbackAPIs(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await loginAsTestUser(page);
  });

  test("home page renders on tablet", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Good|Welcome|مرحباً|Sovereignty/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Responsive - Desktop (1440x900)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockFallbackAPIs(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await loginAsTestUser(page);
  });

  test("sidebar is visible on desktop", async ({ page }) => {
    await page.goto("/");
    const sidebar = page.locator("aside[role='navigation']");
    await expect(sidebar).toBeVisible({ timeout: 5000 });
  });

  test("chat page shows full layout on desktop", async ({ page }) => {
    await page.goto("/chat");
    // Chat input and mode selector should be visible
    const textarea = page.getByRole("textbox").first();
    await expect(textarea).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Responsive - Chat Mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockFallbackAPIs(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await loginAsTestUser(page);
  });

  test("chat page renders on mobile with input area", async ({ page }) => {
    await page.goto("/chat");
    const textarea = page.getByRole("textbox").first();
    await expect(textarea).toBeVisible({ timeout: 5000 });
  });

  test("mode selector works on mobile", async ({ page }) => {
    await page.goto("/chat");
    // Mode selector button
    const modeButton = page.getByRole("button", { name: /Select intelligence mode|Standard|وضع/i }).first();
    await expect(modeButton).toBeVisible({ timeout: 5000 });
    await modeButton.click();
    // Should see mode options in dropdown (use .first() since regex may match other elements)
    await expect(page.getByText(/McKinsey-grade|parallel shard|lightning|ماكنزي|شرائح متوازية/i).first()).toBeVisible({ timeout: 3000 });
  });
});
