import { test, expect } from "@playwright/test";
import { loginAsTestUser, mockBrainAPIs, mockFallbackAPIs, mockChatAPIs } from "./helpers";

test.describe("Billing Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await loginAsTestUser(page);
    await page.goto("/billing");
  });

  test("renders billing page with title", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Billing & Subscription|الفواتير والاشتراك/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows page description", async ({ page }) => {
    await expect(
      page.getByText(/Manage your plan and usage|إدارة خطتك واستخدامك/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("current plan section is visible", async ({ page }) => {
    // Wait for the billing page heading to confirm page has loaded
    await expect(
      page.getByRole("heading", { name: /Billing & Subscription|الفواتير والاشتراك/i })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/Current Plan|خطتك الحالية/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("tier badge is visible", async ({ page }) => {
    // Default tier is FREE
    await expect(page.getByText("FREE").first()).toBeVisible({ timeout: 5000 });
  });

  test("upgrade button is visible", async ({ page }) => {
    // Wait for the billing page to fully render (heading confirms initial load)
    await expect(
      page.getByRole("heading", { name: /Billing & Subscription|الفواتير والاشتراك/i })
    ).toBeVisible({ timeout: 10000 });
    // The upgrade button is rendered inside a Card that animates in;
    // wait for the "Current Plan" section to confirm the card has mounted
    await expect(
      page.getByText(/Current Plan|خطتك الحالية/i).first()
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("link", { name: /Upgrade Plan|ترقية الخطة/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("view all plans link is visible", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: /View All Plans|عرض جميع الخطط/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("usage section is visible", async ({ page }) => {
    await expect(
      page.getByText(/Current Usage|الاستخدام الحالي/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("usage meters show requests, domains, storage", async ({ page }) => {
    const requests = page.getByText(/Requests|الطلبات/i).first();
    await requests.scrollIntoViewIfNeeded();
    await expect(requests).toBeVisible({ timeout: 5000 });
    const domains = page.getByText(/Domains|النطاقات/i).first();
    await domains.scrollIntoViewIfNeeded();
    await expect(domains).toBeVisible({ timeout: 5000 });
    const storage = page.getByText(/Storage|التخزين/i).first();
    await storage.scrollIntoViewIfNeeded();
    await expect(storage).toBeVisible({ timeout: 5000 });
  });

  test("invoice history link is visible", async ({ page }) => {
    await expect(
      page.getByText(/Invoice History|سجل الفواتير/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("upgrade button links to pricing page", async ({ page }) => {
    const upgradeLink = page.getByRole("link", { name: /Upgrade Plan|ترقية الخطة/i });
    await expect(upgradeLink).toHaveAttribute("href", "/billing/pricing");
  });
});
