import { test, expect } from "@playwright/test";
import { loginAsTestUser, mockBrainAPIs, mockFallbackAPIs, mockChatAPIs } from "./helpers";

test.describe("Profile Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await loginAsTestUser(page);
    await page.goto("/profile");
  });

  test("renders profile page with title", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Profile|الملف الشخصي/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("avatar section is visible", async ({ page }) => {
    // The avatar upload component is inside a Card (data-slot="card")
    const avatarCard = page.locator("[data-slot='card']").first();
    await avatarCard.scrollIntoViewIfNeeded();
    await expect(avatarCard).toBeVisible({ timeout: 5000 });
  });

  test("personal information section is visible", async ({ page }) => {
    await expect(
      page.getByText(/Personal Information|المعلومات الشخصية/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("form fields are present", async ({ page }) => {
    // Full Name input
    const fullNameInput = page.getByLabel(/Full Name|الاسم الكامل/i);
    await expect(fullNameInput).toBeVisible({ timeout: 5000 });

    // Email input
    const emailInput = page.getByLabel(/Email|البريد الإلكتروني/i);
    await expect(emailInput).toBeVisible({ timeout: 5000 });

    // Company input
    const companyInput = page.getByLabel(/Company|الشركة/i);
    await expect(companyInput).toBeVisible({ timeout: 5000 });

    // Phone input
    const phoneInput = page.getByLabel(/Phone|الهاتف/i);
    await expect(phoneInput).toBeVisible({ timeout: 5000 });
  });

  test("save button is visible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Save Changes|حفظ التغييرات/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("save button triggers save action", async ({ page }) => {
    const saveButton = page.getByRole("button", { name: /Save Changes|حفظ التغييرات/i });
    await saveButton.click();

    // Button should show saving state
    await expect(
      page.getByText(/Saving|جارٍ الحفظ/i).first()
    ).toBeVisible({ timeout: 3000 });
  });

  test("subscription section is visible", async ({ page }) => {
    await expect(
      page.getByText(/Subscription & Access|الاشتراك والوصول/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("current plan badge is visible", async ({ page }) => {
    await expect(
      page.getByText(/Current Plan|الخطة الحالية/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("upgrade button is visible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Upgrade|ترقية/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("API key section is visible", async ({ page }) => {
    await expect(
      page.getByText(/API Key|مفتاح API/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("member since date is visible", async ({ page }) => {
    await expect(
      page.getByText(/Member since|عضو منذ/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("can edit full name field", async ({ page }) => {
    const fullNameInput = page.getByLabel(/Full Name|الاسم الكامل/i);
    await fullNameInput.clear();
    await fullNameInput.fill("Test User");
    await expect(fullNameInput).toHaveValue("Test User");
  });
});
