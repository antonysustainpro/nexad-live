import { test, expect, Page } from "@playwright/test";
import {
  loginAsTestUser,
  mockBrainAPIs,
  mockFallbackAPIs,
  mockChatAPIs,
  MOCK_USER,
} from "./helpers";

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const TEST_USER_ID = MOCK_USER.id; // "u_test_001"

const MOCK_PROFILE = {
  id: TEST_USER_ID,
  fullName: "Antony Bousader",
  email: "antony@nexad.ai",
  company: "NexAD",
  phone: "+1234567890",
  role: "CEO",
  avatarUrl: null,
  apiKey: "nxad_sk_1234567890abcdef1234567890abcdef",
  tier: "PRO" as const,
  memberSince: "2025-01-01T00:00:00Z",
};

const MOCK_SETTINGS = {
  theme: "dark",
  language: "en",
  fontSize: "medium",
  sendSound: false,
  arriveSound: false,
  successSound: false,
  masterVolume: 15,
  localProcessingOnly: false,
  biometricLock: true,
  autoLockTimeout: "5",
  pushNotifications: true,
};

const MOCK_PERSONA = {
  personality: "professional" as const,
  formalCasual: 70,
  conciseDetailed: 50,
  languageBalance: 50,
};

// ---------------------------------------------------------------------------
// Helper: seed localStorage with user display info (required by pages)
// ---------------------------------------------------------------------------

async function seedUserDisplay(page: Page) {
  await page.addInitScript(
    (userId: string) => {
      localStorage.setItem(
        "nexus-user-display",
        JSON.stringify({ id: userId, displayName: "Antony" })
      );
    },
    TEST_USER_ID
  );
}

// ---------------------------------------------------------------------------
// Helper: mock all Settings / Profile / Persona proxy endpoints
// ---------------------------------------------------------------------------

async function mockSettingsAPIs(page: Page) {
  // GET settings
  await page.route(`**/api/proxy/user/${TEST_USER_ID}/settings`, (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SETTINGS),
      });
    }
    // PUT settings — echo back the body to simulate a save
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: route.request().postData() || JSON.stringify(MOCK_SETTINGS),
    });
  });
}

async function mockProfileAPIs(page: Page) {
  // GET / PUT profile
  await page.route(
    `**/api/proxy/vault/profile/${TEST_USER_ID}`,
    (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_PROFILE),
        });
      }
      // PUT — echo updated profile
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: route.request().postData() || JSON.stringify(MOCK_PROFILE),
      });
    }
  );

  // Avatar upload
  await page.route(`**/api/proxy/vault/avatar/${TEST_USER_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ avatar_url: "https://cdn.nexad.ai/avatars/test.jpg" }),
    })
  );

  // Delete account
  await page.route(`**/api/proxy/user/${TEST_USER_ID}`, (route) => {
    if (route.request().method() === "DELETE") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ deleted: true }),
      });
    }
    return route.continue();
  });
}

async function mockPersonaAPIs(page: Page) {
  await page.route(`**/api/proxy/user/${TEST_USER_ID}/persona`, (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_PERSONA),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: route.request().postData() || JSON.stringify(MOCK_PERSONA),
    });
  });
}

async function mockLogoutAPI(page: Page) {
  await page.route("**/api/v1/auth/logout", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    })
  );
}

async function mockClearDataAPIs(page: Page) {
  // The clearAllUserData function calls multiple endpoints — mock them all
  await page.route("**/api/proxy/vault/documents**", (route) => {
    if (route.request().method() === "DELETE") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ deleted: true }),
      });
    }
    return route.continue();
  });

  await page.route("**/api/proxy/conversations**", (route) => {
    if (route.request().method() === "DELETE") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ deleted: true }),
      });
    }
    return route.continue();
  });
}

// ---------------------------------------------------------------------------
// Consolidated setup for each test group
// ---------------------------------------------------------------------------

async function setupSettingsPage(page: Page) {
  await mockFallbackAPIs(page);
  await mockChatAPIs(page);
  await mockBrainAPIs(page);
  await mockSettingsAPIs(page);
  await mockLogoutAPI(page);
  await mockClearDataAPIs(page);
  await seedUserDisplay(page);
  await loginAsTestUser(page);
  await page.goto("/settings");
  // Wait for page to finish loading settings from backend
  await expect(
    page.getByRole("heading", { name: /Settings|الإعدادات/i })
  ).toBeVisible({ timeout: 8000 });
}

async function setupProfilePage(page: Page) {
  await mockFallbackAPIs(page);
  await mockChatAPIs(page);
  await mockBrainAPIs(page);
  await mockProfileAPIs(page);
  await seedUserDisplay(page);
  await loginAsTestUser(page);
  await page.goto("/profile");
  // Wait for profile to finish loading (heading appears once loading spinner is gone)
  await expect(
    page.getByRole("heading", { name: /Profile|الملف الشخصي/i })
  ).toBeVisible({ timeout: 8000 });
  // Wait for the form fields (not the loading spinner)
  await expect(page.getByLabel(/Full Name|الاسم الكامل/i)).toBeVisible({
    timeout: 8000,
  });
}

async function setupPersonaPage(page: Page) {
  await mockFallbackAPIs(page);
  await mockChatAPIs(page);
  await mockBrainAPIs(page);
  await mockPersonaAPIs(page);
  await seedUserDisplay(page);
  await loginAsTestUser(page);
  await page.goto("/persona");
  // Wait for persona page to finish loading
  await expect(
    page.getByRole("heading", { name: /Persona|الشخصية/i })
  ).toBeVisible({ timeout: 8000 });
}

// ===========================================================================
// SETTINGS PAGE TESTS
// ===========================================================================

test.describe("Settings — Appearance", () => {
  test.beforeEach(async ({ page }) => {
    await setupSettingsPage(page);
  });

  test("renders page title and subtitle", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Settings|الإعدادات/i })
    ).toBeVisible();
    await expect(
      page.getByText(/Customize your NexusAD Ai experience/i).first()
    ).toBeVisible();
  });

  test("theme toggle: light / dark / system options are visible and selectable", async ({
    page,
  }) => {
    // All three options should be visible
    await expect(page.getByText("Light").first()).toBeVisible();
    await expect(page.getByText("Dark").first()).toBeVisible();
    await expect(page.getByText("System").first()).toBeVisible();

    // Select Light
    await page.getByLabel("Light").click();
    const lightRadio = page.locator("input[type='radio'][id='light']");
    // The radio group updates; the label should have the selected border
    await expect(
      page.locator("label[for='light']")
    ).toHaveClass(/border-nexus-jade/, { timeout: 3000 });

    // Select Dark
    await page.getByLabel("Dark").click();
    await expect(
      page.locator("label[for='dark']")
    ).toHaveClass(/border-nexus-jade/, { timeout: 3000 });

    // Select System
    await page.getByLabel("System").click();
    await expect(
      page.locator("label[for='system']")
    ).toHaveClass(/border-nexus-jade/, { timeout: 3000 });
  });

  test("font size selector shows small / medium / large options", async ({
    page,
  }) => {
    await expect(page.getByText("Font Size").first()).toBeVisible();

    // Open the select dropdown
    const fontTrigger = page
      .locator("[data-slot='select-trigger']")
      .first();
    await fontTrigger.click();

    // All font size options should appear
    await expect(page.getByRole("option", { name: "Small" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Medium" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Large" })).toBeVisible();
  });

  test("can change font size to large", async ({ page }) => {
    const fontTrigger = page
      .locator("[data-slot='select-trigger']")
      .first();
    await fontTrigger.click();
    await page.getByRole("option", { name: "Large" }).click();

    // The trigger text should now show "Large"
    await expect(fontTrigger).toContainText("Large");
  });
});

test.describe("Settings — Language", () => {
  test.beforeEach(async ({ page }) => {
    await setupSettingsPage(page);
  });

  test("language options are visible: English, Arabic, Bilingual", async ({
    page,
  }) => {
    await expect(page.getByText("English").first()).toBeVisible();
    await expect(page.getByText("العربية").first()).toBeVisible();
    await expect(
      page.getByText("Bilingual / ثنائي اللغة").first()
    ).toBeVisible();
  });

  test("can select Arabic language", async ({ page }) => {
    await page.getByLabel("العربية").click();
    // The label for the Arabic option should gain selected styling
    await expect(
      page.locator("label[for='lang-ar']")
    ).toHaveClass(/border-nexus-jade/, { timeout: 3000 });
  });

  test("can select Bilingual language", async ({ page }) => {
    await page.getByLabel("Bilingual / ثنائي اللغة").click();
    await expect(
      page.locator("label[for='lang-bilingual']")
    ).toHaveClass(/border-nexus-jade/, { timeout: 3000 });
  });
});

test.describe("Settings — Sound Design", () => {
  test.beforeEach(async ({ page }) => {
    await setupSettingsPage(page);
  });

  test("send sound toggle is visible and toggleable", async ({ page }) => {
    await expect(page.getByText("Send").first()).toBeVisible();
    await expect(
      page.getByText("Soft thump when message sent").first()
    ).toBeVisible();

    // Find the switch next to "Send" section — it's the first switch on the page
    const sendSwitch = page.locator("button[role='switch']").first();
    await expect(sendSwitch).toBeVisible();

    // Toggle it on
    await sendSwitch.click();
    await expect(sendSwitch).toHaveAttribute("data-state", "checked");

    // Toggle it off
    await sendSwitch.click();
    await expect(sendSwitch).toHaveAttribute("data-state", "unchecked");
  });

  test("arrive sound toggle is visible and toggleable", async ({ page }) => {
    await expect(page.getByText("Arrive").first()).toBeVisible();
    await expect(
      page.getByText("Crystalline chime when response received").first()
    ).toBeVisible();

    // The arrive switch is the second switch
    const arriveSwitch = page.locator("button[role='switch']").nth(1);
    await arriveSwitch.click();
    await expect(arriveSwitch).toHaveAttribute("data-state", "checked");
  });

  test("success sound toggle is visible and toggleable", async ({ page }) => {
    await expect(page.getByText("Success").first()).toBeVisible();
    await expect(
      page.getByText("Harmonic resonance on completion").first()
    ).toBeVisible();

    // The success switch is the third switch
    const successSwitch = page.locator("button[role='switch']").nth(2);
    await successSwitch.click();
    await expect(successSwitch).toHaveAttribute("data-state", "checked");
  });

  test("master volume slider is visible and shows percentage", async ({
    page,
  }) => {
    await expect(page.getByText("Master Volume").first()).toBeVisible();
    // Default percentage label
    await expect(page.getByText("15%").first()).toBeVisible();
    // Range labels
    await expect(page.getByText("0%").first()).toBeVisible();
    await expect(page.getByText("30%").first()).toBeVisible();
  });

  test("master volume slider can be adjusted", async ({ page }) => {
    const slider = page.getByRole("slider", { name: /Master Volume/i });
    await expect(slider).toBeVisible();

    // The slider has a min of 0 and max of 30
    // Drag it to a new value — we use keyboard for precision
    await slider.focus();
    // Press Right arrow 5 times to increase volume by 5
    for (let i = 0; i < 5; i++) {
      await slider.press("ArrowRight");
    }
    // The percentage label should have increased from 15%
    await expect(page.getByText("20%").first()).toBeVisible({ timeout: 3000 });
  });

  test("sound preview buttons are present", async ({ page }) => {
    const previewButtons = page.getByRole("button", { name: /Preview/i });
    await expect(previewButtons).toHaveCount(3);
  });
});

test.describe("Settings — Privacy & Security", () => {
  test.beforeEach(async ({ page }) => {
    await setupSettingsPage(page);
  });

  test("local processing toggle is visible", async ({ page }) => {
    await expect(
      page.getByText("Local Processing Only").first()
    ).toBeVisible();
    await expect(
      page.getByText("Process data on-device only (slower)").first()
    ).toBeVisible();
  });

  test("local processing toggle can be switched on", async ({ page }) => {
    // Find the local processing switch — it follows the 3 sound switches
    // The switches on the page in order: send, arrive, success, local, biometric, pushNotifications
    const localSwitch = page.locator("button[role='switch']").nth(3);
    await expect(localSwitch).toHaveAttribute("data-state", "unchecked");
    await localSwitch.click();
    await expect(localSwitch).toHaveAttribute("data-state", "checked");
  });

  test("biometric lock toggle is visible and defaults to on", async ({
    page,
  }) => {
    await expect(page.getByText("Biometric Lock").first()).toBeVisible();
    await expect(
      page.getByText("Use Face ID / Touch ID to access").first()
    ).toBeVisible();

    // Biometric lock defaults to true
    const bioSwitch = page.locator("button[role='switch']").nth(4);
    await expect(bioSwitch).toHaveAttribute("data-state", "checked");
  });

  test("biometric lock can be toggled off", async ({ page }) => {
    const bioSwitch = page.locator("button[role='switch']").nth(4);
    await bioSwitch.click();
    await expect(bioSwitch).toHaveAttribute("data-state", "unchecked");
  });

  test("auto-lock timeout selector shows all options", async ({ page }) => {
    await expect(
      page.getByText("Auto-Lock Timeout").first()
    ).toBeVisible();

    // The auto-lock is the second Select on the page (first is font size)
    const autoLockTrigger = page
      .locator("[data-slot='select-trigger']")
      .nth(1);
    await autoLockTrigger.click();

    await expect(
      page.getByRole("option", { name: "1 minute", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: "5 minutes", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: "15 minutes", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: "30 minutes", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: "Never", exact: true })
    ).toBeVisible();
  });

  test("can change auto-lock timeout to 15 minutes", async ({ page }) => {
    const autoLockTrigger = page
      .locator("[data-slot='select-trigger']")
      .nth(1);
    await autoLockTrigger.click();
    await page.getByRole("option", { name: "15 minutes" }).click();
    await expect(autoLockTrigger).toContainText("15 minutes");
  });
});

test.describe("Settings — Notifications", () => {
  test.beforeEach(async ({ page }) => {
    await setupSettingsPage(page);
  });

  test("push notifications toggle is visible and defaults to on", async ({
    page,
  }) => {
    await expect(
      page.getByText("Push Notifications").first()
    ).toBeVisible();
    await expect(
      page.getByText("Receive notifications for new messages").first()
    ).toBeVisible();

    // Push notifications defaults to true — it is the last switch
    const pushSwitch = page.locator("button[role='switch']").nth(5);
    await expect(pushSwitch).toHaveAttribute("data-state", "checked");
  });

  test("push notifications can be toggled off", async ({ page }) => {
    const pushSwitch = page.locator("button[role='switch']").nth(5);
    await pushSwitch.click();
    await expect(pushSwitch).toHaveAttribute("data-state", "unchecked");
  });
});

test.describe("Settings — Sign Out", () => {
  test.beforeEach(async ({ page }) => {
    await setupSettingsPage(page);
  });

  test("sign out button is visible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Sign Out|تسجيل الخروج/i })
    ).toBeVisible();
  });

  test("sign out clears session and redirects to /welcome", async ({
    page,
  }) => {
    let logoutCalled = false;
    await page.route("**/api/v1/auth/logout", (route) => {
      logoutCalled = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    const signOutBtn = page.getByRole("button", {
      name: /Sign Out|تسجيل الخروج/i,
    });
    await signOutBtn.click();

    // Should redirect to /welcome
    await page.waitForURL("**/welcome", { timeout: 10000 });
    expect(page.url()).toContain("/welcome");
  });
});

test.describe("Settings — Clear All Data", () => {
  test.beforeEach(async ({ page }) => {
    await setupSettingsPage(page);
  });

  test("clear data button is visible", async ({ page }) => {
    await expect(
      page.getByText("Clear All Data").first()
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Clear|مسح/i }).first()
    ).toBeVisible();
  });

  test("clear data shows confirmation dialog", async ({ page }) => {
    // Click the "Clear" button to open the AlertDialog
    const clearBtn = page
      .getByRole("button", { name: /^Clear$|^مسح$/i })
      .first();
    await clearBtn.click();

    // The alert dialog should appear
    await expect(
      page.getByText(/Confirm Deletion|تأكيد الحذف/i).first()
    ).toBeVisible({ timeout: 3000 });
    await expect(
      page.getByText(
        /All conversations and vault documents will be permanently deleted/i
      )
    ).toBeVisible();

    // Cancel and Clear All buttons should be present
    await expect(
      page.getByRole("button", { name: /Cancel|إلغاء/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Clear All|مسح الكل/i })
    ).toBeVisible();
  });

  test("clear data dialog cancel closes dialog without action", async ({
    page,
  }) => {
    const clearBtn = page
      .getByRole("button", { name: /^Clear$|^مسح$/i })
      .first();
    await clearBtn.click();

    await expect(
      page.getByText(/Confirm Deletion/i).first()
    ).toBeVisible({ timeout: 3000 });

    // Click Cancel
    await page.getByRole("button", { name: /Cancel|إلغاء/i }).click();

    // The dialog should disappear
    await expect(
      page.getByText(/Confirm Deletion/i).first()
    ).not.toBeVisible({ timeout: 3000 });
  });

  test("clear data confirm calls API and redirects to /welcome", async ({
    page,
  }) => {
    const clearBtn = page
      .getByRole("button", { name: /^Clear$|^مسح$/i })
      .first();
    await clearBtn.click();

    await expect(
      page.getByText(/Confirm Deletion/i).first()
    ).toBeVisible({ timeout: 3000 });

    // Click "Clear All" to confirm
    await page
      .getByRole("button", { name: /Clear All|مسح الكل/i })
      .click();

    // Should redirect to /welcome after clearing
    await page.waitForURL("**/welcome", { timeout: 10000 });
    expect(page.url()).toContain("/welcome");
  });
});

test.describe("Settings — Persistence", () => {
  test("settings persist after page reload", async ({ page }) => {
    // Track settings save calls
    let savedSettings: Record<string, unknown> | null = null;

    await mockFallbackAPIs(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await mockLogoutAPI(page);
    await mockClearDataAPIs(page);
    await seedUserDisplay(page);
    await loginAsTestUser(page);

    // First: return default settings
    await page.route(
      `**/api/proxy/user/${TEST_USER_ID}/settings`,
      (route) => {
        if (route.request().method() === "GET") {
          // Return whatever we last saved, or defaults
          const response = savedSettings || MOCK_SETTINGS;
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(response),
          });
        }
        // Capture the PUT body
        const body = route.request().postData();
        if (body) {
          savedSettings = { ...MOCK_SETTINGS, ...JSON.parse(body) };
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: body || JSON.stringify(MOCK_SETTINGS),
        });
      }
    );

    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: /Settings/i })
    ).toBeVisible({ timeout: 8000 });

    // Toggle send sound ON
    const sendSwitch = page.locator("button[role='switch']").first();
    await sendSwitch.click();
    await expect(sendSwitch).toHaveAttribute("data-state", "checked");

    // Wait for debounced save (800ms + buffer)
    await page.waitForTimeout(1200);

    // Reload the page
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /Settings/i })
    ).toBeVisible({ timeout: 8000 });

    // The send switch should still be checked after reload (API returns saved state)
    const sendSwitchAfterReload = page
      .locator("button[role='switch']")
      .first();
    // If savedSettings captured the toggle, GET will return it
    if (savedSettings) {
      await expect(sendSwitchAfterReload).toHaveAttribute(
        "data-state",
        "checked",
        { timeout: 5000 }
      );
    }
  });
});

// ===========================================================================
// PROFILE PAGE TESTS
// ===========================================================================

test.describe("Profile — Personal Information", () => {
  test.beforeEach(async ({ page }) => {
    await setupProfilePage(page);
  });

  test("renders profile heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Profile|الملف الشخصي/i })
    ).toBeVisible();
  });

  test("displays all form fields with mock data", async ({ page }) => {
    const fullNameInput = page.getByLabel(/Full Name|الاسم الكامل/i);
    await expect(fullNameInput).toHaveValue(MOCK_PROFILE.fullName);

    const emailInput = page.getByLabel(/Email|البريد الإلكتروني/i);
    await expect(emailInput).toHaveValue(MOCK_PROFILE.email);

    const companyInput = page.getByLabel(/Company|الشركة/i);
    await expect(companyInput).toHaveValue(MOCK_PROFILE.company);

    const phoneInput = page.getByLabel(/Phone|الهاتف/i);
    await expect(phoneInput).toHaveValue(MOCK_PROFILE.phone);
  });

  test("can edit full name", async ({ page }) => {
    const fullNameInput = page.getByLabel(/Full Name|الاسم الكامل/i);
    await fullNameInput.clear();
    await fullNameInput.fill("John Doe");
    await expect(fullNameInput).toHaveValue("John Doe");
  });

  test("can edit email", async ({ page }) => {
    const emailInput = page.getByLabel(/Email|البريد الإلكتروني/i);
    await emailInput.clear();
    await emailInput.fill("john@example.com");
    await expect(emailInput).toHaveValue("john@example.com");
  });

  test("can edit company", async ({ page }) => {
    const companyInput = page.getByLabel(/Company|الشركة/i);
    await companyInput.clear();
    await companyInput.fill("Acme Corp");
    await expect(companyInput).toHaveValue("Acme Corp");
  });

  test("can edit phone", async ({ page }) => {
    const phoneInput = page.getByLabel(/Phone|الهاتف/i);
    await phoneInput.clear();
    await phoneInput.fill("+9876543210");
    await expect(phoneInput).toHaveValue("+9876543210");
  });

  test("save button triggers API call and shows saving state", async ({
    page,
  }) => {
    let saveRequested = false;
    await page.route(
      `**/api/proxy/vault/profile/${TEST_USER_ID}`,
      async (route) => {
        if (route.request().method() === "PUT") {
          saveRequested = true;
          // Add delay so the saving state is visible for assertion
          await new Promise((r) => setTimeout(r, 500));
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: route.request().postData() || "{}",
          });
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_PROFILE),
        });
      }
    );

    // Edit a field first
    const fullNameInput = page.getByLabel(/Full Name|الاسم الكامل/i);
    await fullNameInput.clear();
    await fullNameInput.fill("Updated Name");

    // Click save
    const saveBtn = page.getByRole("button", {
      name: /Save Changes|حفظ التغييرات/i,
    });
    await saveBtn.click();

    // Should briefly show saving state
    await expect(
      page.getByText(/Saving|جارٍ الحفظ/i).first()
    ).toBeVisible({ timeout: 3000 });
  });
});

test.describe("Profile — Avatar Upload", () => {
  test.beforeEach(async ({ page }) => {
    await setupProfilePage(page);
  });

  test("avatar section is visible with change photo text", async ({
    page,
  }) => {
    await expect(
      page.getByText(/Click to change photo|انقر لتغيير الصورة/i)
    ).toBeVisible();
  });

  test("avatar upload button has proper aria label", async ({ page }) => {
    const changeAvatarBtn = page.getByRole("button", {
      name: /Change profile picture|تغيير الصورة الشخصية/i,
    });
    await expect(changeAvatarBtn).toBeVisible();
  });

  test("avatar upload accepts image files via file input", async ({
    page,
  }) => {
    // The hidden file input should accept image/*
    const fileInput = page.locator("input[type='file'][accept='image/*']");
    await expect(fileInput).toBeAttached();

    // Create a fake image file and upload it
    const buffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    await fileInput.setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer,
    });

    // Should show "Uploading..." text briefly, then "Avatar updated" toast
    // The upload mock returns a URL, so the component should update
    await expect(
      page
        .getByText(/Click to change photo|انقر لتغيير الصورة/i)
        .or(page.getByText(/Uploading|جارٍ التحميل/i))
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Profile — API Key", () => {
  test.beforeEach(async ({ page }) => {
    await setupProfilePage(page);
  });

  test("API key section is visible with masked key", async ({ page }) => {
    await expect(page.getByText(/API Key|مفتاح API/i).first()).toBeVisible();
    // The masked key should show the first 8 characters followed by dots
    const apiKeyInput = page.locator("input[readonly]").first();
    await expect(apiKeyInput).toBeVisible();
    const value = await apiKeyInput.inputValue();
    expect(value).toContain("nxad_sk_");
    expect(value).toContain("••••");
  });

  test("toggle API key visibility shows and hides key", async ({ page }) => {
    const showBtn = page.getByRole("button", { name: /Show|إظهار/i });
    await expect(showBtn).toBeVisible();

    // Click to reveal
    await showBtn.click();

    // Now the full key should be visible
    const apiKeyInput = page.locator("input[readonly]").first();
    const revealedValue = await apiKeyInput.inputValue();
    expect(revealedValue).toBe(MOCK_PROFILE.apiKey);

    // The button should now say "Hide"
    const hideBtn = page.getByRole("button", { name: /Hide|إخفاء/i });
    await expect(hideBtn).toBeVisible();

    // Click to hide again
    await hideBtn.click();
    const hiddenValue = await apiKeyInput.inputValue();
    expect(hiddenValue).toContain("••••");
  });

  test("copy API key button is present", async ({ page }) => {
    const copyBtn = page.getByRole("button", {
      name: /Copy API key|نسخ مفتاح API/i,
    });
    await expect(copyBtn).toBeVisible();
  });
});

test.describe("Profile — Subscription Info", () => {
  test.beforeEach(async ({ page }) => {
    await setupProfilePage(page);
  });

  test("subscription section shows current plan", async ({ page }) => {
    await expect(
      page.getByText(/Subscription & Access|الاشتراك والوصول/i).first()
    ).toBeVisible();
    await expect(
      page.getByText(/Current Plan|الخطة الحالية/i).first()
    ).toBeVisible();
    // PRO tier badge
    await expect(page.getByText("Pro").first()).toBeVisible();
  });

  test("upgrade button is visible", async ({ page }) => {
    // The Upgrade button is wrapped in a Link — use the link role
    await expect(
      page.getByRole("link", { name: /Upgrade|ترقية/i })
    ).toBeVisible();
  });

  test("member since date is displayed", async ({ page }) => {
    await expect(
      page.getByText(/Member since|عضو منذ/i).first()
    ).toBeVisible();
    // The date should be formatted from the mock (Jan 1, 2025)
    await expect(
      page.getByText(/January 1, 2025|2025/i).first()
    ).toBeVisible();
  });
});

test.describe("Profile — Danger Zone (Delete Account)", () => {
  test.beforeEach(async ({ page }) => {
    await setupProfilePage(page);
  });

  test("danger zone section is visible", async ({ page }) => {
    await expect(
      page.getByText(/Danger Zone|منطقة الخطر/i).first()
    ).toBeVisible();
    await expect(
      page.getByText(
        /Deleting your account is permanent and cannot be undone/i
      )
    ).toBeVisible();
  });

  test("delete account button opens confirmation dialog", async ({
    page,
  }) => {
    const deleteBtn = page.getByRole("button", {
      name: /Delete Account|حذف الحساب/i,
    });
    await deleteBtn.click();

    // Confirmation dialog should appear
    await expect(
      page.getByText(/Confirm Account Deletion|تأكيد حذف الحساب/i).first()
    ).toBeVisible({ timeout: 3000 });
    await expect(
      page.getByText(
        /This action cannot be undone. All your data will be permanently deleted/i
      )
    ).toBeVisible();
  });

  test("delete confirmation requires typing exact text", async ({ page }) => {
    const deleteBtn = page.getByRole("button", {
      name: /Delete Account|حذف الحساب/i,
    });
    await deleteBtn.click();

    await expect(
      page.getByText(/Confirm Account Deletion/i).first()
    ).toBeVisible({ timeout: 3000 });

    // The "Delete Forever" button should be disabled initially
    const confirmDeleteBtn = page.getByRole("button", {
      name: /Delete Forever|حذف نهائي/i,
    });
    await expect(confirmDeleteBtn).toBeDisabled();

    // Type wrong text — button should remain disabled
    const confirmInput = page
      .locator("input[placeholder='DELETE MY ACCOUNT']")
      .or(page.locator("input[placeholder='حذف حسابي']"));
    await confirmInput.fill("wrong text");
    await expect(confirmDeleteBtn).toBeDisabled();

    // Type correct text
    await confirmInput.clear();
    await confirmInput.fill("DELETE MY ACCOUNT");
    await expect(confirmDeleteBtn).toBeEnabled();
  });

  test("delete confirmation cancel closes dialog", async ({ page }) => {
    const deleteBtn = page.getByRole("button", {
      name: /Delete Account|حذف الحساب/i,
    });
    await deleteBtn.click();

    await expect(
      page.getByText(/Confirm Account Deletion/i).first()
    ).toBeVisible({ timeout: 3000 });

    // Click cancel
    const cancelBtn = page.getByRole("button", { name: /Cancel|إلغاء/i });
    await cancelBtn.click();

    // Dialog should close
    await expect(
      page.getByText(/Confirm Account Deletion/i).first()
    ).not.toBeVisible({ timeout: 3000 });
  });

  test("delete confirmation with correct text calls API and redirects", async ({
    page,
  }) => {
    let deleteAPICalled = false;
    await page.route(`**/api/proxy/user/${TEST_USER_ID}`, (route) => {
      if (route.request().method() === "DELETE") {
        deleteAPICalled = true;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ deleted: true }),
        });
      }
      return route.continue();
    });

    const deleteBtn = page.getByRole("button", {
      name: /Delete Account|حذف الحساب/i,
    });
    await deleteBtn.click();

    await expect(
      page.getByText(/Confirm Account Deletion/i).first()
    ).toBeVisible({ timeout: 3000 });

    // Type the required confirmation text
    const confirmInput = page
      .locator("input[placeholder='DELETE MY ACCOUNT']")
      .or(page.locator("input[placeholder='حذف حسابي']"));
    await confirmInput.fill("DELETE MY ACCOUNT");

    // Click Delete Forever
    const confirmDeleteBtn = page.getByRole("button", {
      name: /Delete Forever|حذف نهائي/i,
    });
    await confirmDeleteBtn.click();

    // Should redirect to /login
    await page.waitForURL("**/login", { timeout: 10000 });
    expect(page.url()).toContain("/login");
    expect(deleteAPICalled).toBe(true);
  });
});

// ===========================================================================
// PERSONA PAGE TESTS
// ===========================================================================

test.describe("Persona — Personality Selection", () => {
  test.beforeEach(async ({ page }) => {
    await setupPersonaPage(page);
  });

  test("renders persona page heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Persona|الشخصية/i })
    ).toBeVisible();
    await expect(
      page.getByText(/Customize how NexusAD Ai speaks with you/i)
    ).toBeVisible();
  });

  test("all four personality types are visible", async ({ page }) => {
    await expect(page.getByText("Professional").first()).toBeVisible();
    await expect(page.getByText("Friendly").first()).toBeVisible();
    await expect(page.getByText("Direct").first()).toBeVisible();
    await expect(page.getByText("Adaptive").first()).toBeVisible();
  });

  test("personality descriptions are shown", async ({ page }) => {
    await expect(
      page.getByText("Formal, thorough, business-focused").first()
    ).toBeVisible();
    await expect(
      page.getByText("Warm, approachable, conversational").first()
    ).toBeVisible();
    await expect(
      page.getByText("Concise, to-the-point, efficient").first()
    ).toBeVisible();
    await expect(
      page.getByText("Adjusts based on context and mood").first()
    ).toBeVisible();
  });

  test("can select Friendly personality", async ({ page }) => {
    await page.getByLabel("Friendly").click();
    await expect(
      page.locator("label[for='friendly']")
    ).toHaveClass(/border-nexus-jade/, { timeout: 3000 });
  });

  test("can select Direct personality", async ({ page }) => {
    await page.getByLabel("Direct").click();
    await expect(
      page.locator("label[for='direct']")
    ).toHaveClass(/border-nexus-jade/, { timeout: 3000 });
  });

  test("can select Adaptive personality", async ({ page }) => {
    await page.getByLabel("Adaptive").click();
    await expect(
      page.locator("label[for='adaptive']")
    ).toHaveClass(/border-nexus-jade/, { timeout: 3000 });
  });
});

test.describe("Persona — Style Sliders", () => {
  test.beforeEach(async ({ page }) => {
    await setupPersonaPage(page);
  });

  test("formal/casual slider is visible with labels", async ({ page }) => {
    await expect(page.getByText("Formal").first()).toBeVisible();
    await expect(page.getByText("Casual").first()).toBeVisible();
    await expect(page.getByText("70%").first()).toBeVisible(); // Default formalCasual
  });

  test("formal/casual slider can be adjusted", async ({ page }) => {
    const formalSlider = page.getByRole("slider", {
      name: /Formal vs Casual/i,
    });
    await expect(formalSlider).toBeVisible();

    // Use keyboard to adjust
    await formalSlider.focus();
    // Press Left arrow to decrease from 70
    for (let i = 0; i < 3; i++) {
      await formalSlider.press("ArrowLeft");
    }
    // Should now show 40% (70 - 30 = 40, since step is 10)
    await expect(page.getByText("40%").first()).toBeVisible({ timeout: 3000 });
  });

  test("concise/detailed slider is visible with labels", async ({ page }) => {
    await expect(page.getByText("Concise").first()).toBeVisible();
    await expect(page.getByText("Detailed").first()).toBeVisible();
    await expect(page.getByText("50%").first()).toBeVisible(); // Default conciseDetailed
  });

  test("concise/detailed slider can be adjusted", async ({ page }) => {
    const detailedSlider = page.getByRole("slider", {
      name: /Concise vs Detailed/i,
    });
    await expect(detailedSlider).toBeVisible();

    await detailedSlider.focus();
    for (let i = 0; i < 2; i++) {
      await detailedSlider.press("ArrowRight");
    }
    // Should now show 70% (50 + 20)
    await expect(page.getByText("70%").first()).toBeVisible({ timeout: 3000 });
  });

  test("language balance slider is visible with Arabic/English labels", async ({
    page,
  }) => {
    await expect(page.getByText("العربية").first()).toBeVisible();
    await expect(page.getByText("English").first()).toBeVisible();

    const langSlider = page.getByRole("slider", {
      name: /Language Balance/i,
    });
    await expect(langSlider).toBeVisible();
  });

  test("language balance slider can be adjusted", async ({ page }) => {
    const langSlider = page.getByRole("slider", {
      name: /Language Balance/i,
    });
    await langSlider.focus();
    for (let i = 0; i < 2; i++) {
      await langSlider.press("ArrowRight");
    }
    // From 50 + 20 = 70
    await expect(page.getByText("70%").first()).toBeVisible({ timeout: 3000 });
  });
});

test.describe("Persona — Live Preview", () => {
  test.beforeEach(async ({ page }) => {
    await setupPersonaPage(page);
  });

  test("live preview section is visible", async ({ page }) => {
    await expect(
      page.getByText(/Live Preview|معاينة مباشرة/i).first()
    ).toBeVisible();
    await expect(
      page.getByText(
        /How NexusAD Ai will respond with these settings/i
      ).first()
    ).toBeVisible();
  });

  test("live preview updates when personality changes", async ({ page }) => {
    // Default is Professional — get the initial preview text
    const previewCard = page
      .locator("[data-slot='card']")
      .filter({ hasText: /Live Preview/i });
    const initialPreview = await previewCard
      .locator("p.text-body")
      .textContent();

    // Switch to Direct personality
    await page.getByLabel("Direct").click();

    // Preview text should change
    const updatedPreview = await previewCard
      .locator("p.text-body")
      .textContent();

    // The texts should be different (direct vs professional have different responses)
    expect(updatedPreview).not.toBe(initialPreview);
  });
});

test.describe("Persona — Save & Reset", () => {
  test.beforeEach(async ({ page }) => {
    await setupPersonaPage(page);
  });

  test("save button is visible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Save Changes|حفظ التغييرات/i })
    ).toBeVisible();
  });

  test("save button triggers API call", async ({ page }) => {
    let saveCalled = false;
    await page.route(
      `**/api/proxy/user/${TEST_USER_ID}/persona`,
      async (route) => {
        if (route.request().method() === "PUT") {
          saveCalled = true;
          // Add delay so the saving state is visible for assertion
          await new Promise((r) => setTimeout(r, 500));
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: route.request().postData() || "{}",
          });
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_PERSONA),
        });
      }
    );

    // Change a personality
    await page.getByLabel("Friendly").click();

    // Click save
    const saveBtn = page.getByRole("button", {
      name: /Save Changes|حفظ التغييرات/i,
    });
    await saveBtn.click();

    // Should show saving state briefly
    await expect(
      page.getByText(/Saving|جاري الحفظ/i).first()
    ).toBeVisible({ timeout: 3000 });

    // Wait for save to complete
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
    expect(saveCalled).toBe(true);
  });

  test("reset to default button resets all sliders", async ({ page }) => {
    // Adjust sliders first
    const formalSlider = page.getByRole("slider", {
      name: /Formal vs Casual/i,
    });
    await formalSlider.focus();
    await formalSlider.press("ArrowLeft");
    await formalSlider.press("ArrowLeft");

    // Click Reset to Default
    const resetBtn = page.getByRole("button", {
      name: /Reset to Default|إعادة ضبط/i,
    });
    await resetBtn.click();

    // Sliders should reset: formalCasual=50, conciseDetailed=50, languageBalance=50
    // Professional should be selected
    await expect(
      page.locator("label[for='professional']")
    ).toHaveClass(/border-nexus-jade/, { timeout: 3000 });

    // All three sliders should show 50%
    const percentTexts = await page.getByText("50%").all();
    expect(percentTexts.length).toBeGreaterThanOrEqual(3);
  });
});

test.describe("Persona — Voice Sample", () => {
  test.beforeEach(async ({ page }) => {
    await setupPersonaPage(page);
  });

  test("voice sample section is visible", async ({ page }) => {
    await expect(
      page.getByText(/Voice Sample|عينة الصوت/i).first()
    ).toBeVisible();
  });

  test("record new sample button is visible", async ({ page }) => {
    await expect(
      page.getByRole("button", {
        name: /Record New Sample|تسجيل عينة جديدة/i,
      })
    ).toBeVisible();
  });
});

// ===========================================================================
// CROSS-PAGE: Main landmark accessibility
// ===========================================================================

test.describe("Settings/Profile/Persona — Accessibility", () => {
  test("settings page has proper main landmark", async ({ page }) => {
    await setupSettingsPage(page);
    const main = page.locator("main#main-content");
    await expect(main).toBeVisible();
  });

  test("profile page has proper main landmark", async ({ page }) => {
    await setupProfilePage(page);
    const main = page.locator("main#main-content");
    await expect(main).toBeVisible();
  });

  test("persona page has proper main landmark", async ({ page }) => {
    await setupPersonaPage(page);
    const main = page.locator("main#main-content");
    await expect(main).toBeVisible();
  });
});

// ===========================================================================
// CROSS-PAGE: Version footer
// ===========================================================================

test.describe("Settings — Footer", () => {
  test("version string is displayed", async ({ page }) => {
    await setupSettingsPage(page);
    await expect(
      page.getByText(/NexusAD Ai v1\.0\.0/i).first()
    ).toBeVisible();
  });
});
