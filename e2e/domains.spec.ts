import { test, expect } from "@playwright/test";
import { loginAsTestUser, mockBrainAPIs, mockFallbackAPIs, mockChatAPIs } from "./helpers";

test.describe("Domains Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await loginAsTestUser(page);
    await page.goto("/domains");
  });

  test("renders domains page with title", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Domains|المجالات/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows page description", async ({ page }) => {
    await expect(
      page.getByText(/Explore the knowledge domains|استكشف مجالات المعرفة/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("domain cards are visible", async ({ page }) => {
    // Should show domain names from the hardcoded list
    await expect(page.getByText("Financial").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/^Legal$/).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Health").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Technical").first()).toBeVisible({ timeout: 5000 });
  });

  test("top mastered domains section is visible", async ({ page }) => {
    await expect(
      page.getByText(/Top Mastered Domains|أعلى المجالات إتقاناً/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("domain cards have mastery percentages", async ({ page }) => {
    // Each domain card shows a mastery percentage
    await expect(page.getByText(/Mastery|الإتقان/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("domain links navigate to domain detail", async ({ page }) => {
    // Each domain is a link to /domains/{id}
    const financialLink = page.locator('a[href="/domains/financial"]').first();
    await expect(financialLink).toBeVisible({ timeout: 5000 });

    await financialLink.click();
    await expect(page).toHaveURL(/\/domains\/financial/);
  });

  test("all nine domains are rendered", async ({ page }) => {
    // Verify all domain names appear
    const domainNames = [
      "Financial",
      "Legal",
      "UAE Government",
      "Health",
      "Technical",
      "Real Estate",
      "Education",
      "Shopping",
      "Travel",
    ];

    for (const name of domainNames) {
      await expect(page.getByText(name).first()).toBeVisible({ timeout: 5000 });
    }
  });
});
