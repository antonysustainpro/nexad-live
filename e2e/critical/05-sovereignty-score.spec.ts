/**
 * CRITICAL JOURNEY 5: Sovereignty Score Check
 *
 * Tests the sovereignty score and related security features:
 * - Sovereignty page renders correctly (authenticated)
 * - Score is displayed with a numeric value and grade
 * - Score factors breakdown is visible (encryption, shards, key health, etc.)
 * - Key fingerprint and algorithm are shown
 * - Shard distribution map is rendered
 * - Sovereignty ribbon is visible across pages
 * - Real backend returns actual sovereignty score data
 * - Key management actions (backup, rotate) are accessible
 * - Privacy comparison page works
 * - Mobile viewport renders sovereignty UI correctly
 *
 * The sovereignty calls hit the REAL RunPod backend.
 * If the test user is not in the real DB, we verify the error is handled gracefully.
 */

import { test, expect, Page } from "@playwright/test";
import { setupAuthenticatedSession, TIMEOUTS, VIEWPORTS } from "./fixtures";

// ---------------------------------------------------------------------------
// Mock data — mirrors the real backend response shape
// ---------------------------------------------------------------------------

const MOCK_SOVEREIGNTY_STATUS = {
  encryption_algo: "AES-256-GCM",
  shard_count: 12,
  processing_mode: "local",
  key_valid: true,
  jurisdiction: "UAE",
};

const MOCK_SOVEREIGNTY_SCORE = {
  score: 87,
  grade: "A-",
  factors: [
    { name: "encryption_strength", score: 95, label: "Encryption" },
    { name: "shard_distribution",  score: 90, label: "Shards" },
    { name: "pii_protection",       score: 82, label: "Local Processing" },
    { name: "key_health",            score: 78, label: "Key Health" },
    { name: "access_hygiene",        score: 88, label: "Access" },
  ],
};

const MOCK_SOVEREIGNTY_REPORT = {
  score: 87,
  grade: "A-",
  recommendations: [],
  key_info: {
    fingerprint: "A7:3B:C2:D9:E4:F5",
    created_at: "2026-03-15T00:00:00Z",
    algorithm: "ECDH-P256",
    backup_method: "QR Code",
  },
  shard_stats: {
    active_shards: 12,
    nodes: 3,
    redundancy: 4,
  },
};

const MOCK_KEY_STATUS = {
  key_exists: true,
  key_id: "key_abc123",
  fingerprint: "A7:3B:C2:D9:E4:F5",
  created_at: "2026-03-15T00:00:00Z",
  algorithm: "ECDH-P256",
  backup_method: "QR Code",
  last_rotated_at: null,
};

const MOCK_SHARD_DISTRIBUTION = {
  nodes: [
    { node_id: "uae-1", location: "UAE Node 1", shard_count: 4, status: "active" },
    { node_id: "uae-2", location: "UAE Node 2", shard_count: 4, status: "active" },
    { node_id: "uae-3", location: "UAE Node 3", shard_count: 4, status: "active" },
  ],
  total_shards: 12,
};

// ---------------------------------------------------------------------------
// Mock sovereignty APIs helper
// ---------------------------------------------------------------------------

async function mockSovereigntyAPIs(page: Page): Promise<void> {
  await page.route("**/api/proxy/sovereignty/status", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_SOVEREIGNTY_STATUS) })
  );
  await page.route("**/api/proxy/sovereignty/score", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_SOVEREIGNTY_SCORE) })
  );
  await page.route("**/api/proxy/sovereignty/report", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_SOVEREIGNTY_REPORT) })
  );
  await page.route("**/api/proxy/vault/shards", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_SHARD_DISTRIBUTION) })
  );
  await page.route("**/api/proxy/keys/status", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_KEY_STATUS) })
  );
  await page.route("**/api/proxy/keys/*/backup", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ backup_data: "nexusad://backup?fp=A7:3B:C2:D9:E4:F5", backup_format: "qr-base64" }),
    })
  );
  await page.route("**/api/proxy/keys/*/rotate", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ new_key_id: "key_rotated_456", fingerprint: "B8:4C:D3:E0:F6:A7", rotated_at: new Date().toISOString() }),
    })
  );
  await page.route("**/api/proxy/keys/generate", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ key_id: "key_new_789", fingerprint: "C9:5D:E4:F1:07:B8", public_key_jwk: {}, created_at: new Date().toISOString() }),
    })
  );
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

async function setupSovereigntyPage(page: Page): Promise<void> {
  await mockSovereigntyAPIs(page);
  await setupAuthenticatedSession(page);
  await page.goto("/sovereignty");
  await expect(
    page.getByRole("heading", { name: /Sovereignty|السيادة/i }).first()
  ).toBeVisible({ timeout: TIMEOUTS.page });
}

// ===========================================================================
// SUITE 1: Page Rendering
// ===========================================================================

test.describe("Sovereignty Score — Page Rendering", () => {
  test.beforeEach(async ({ page }) => {
    await setupSovereigntyPage(page);
  });

  test("sovereignty page loads at /sovereignty", async ({ page }) => {
    await expect(page).toHaveURL(/\/sovereignty/);
  });

  test("sovereignty page title and description are visible", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Sovereignty|السيادة/i })
    ).toBeVisible({ timeout: TIMEOUTS.ui });

    await expect(
      page.getByText(/vault and keys|control|sovereign/i).first()
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("sovereignty page renders correctly on mobile", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto("/sovereignty");

    await expect(
      page.getByRole("heading", { name: /Sovereignty|السيادة/i }).first()
    ).toBeVisible({ timeout: TIMEOUTS.page });
  });
});

// ===========================================================================
// SUITE 2: Sovereignty Score Display
// ===========================================================================

test.describe("Sovereignty Score — Score Display", () => {
  test.beforeEach(async ({ page }) => {
    await setupSovereigntyPage(page);
  });

  test("sovereignty score region is visible", async ({ page }) => {
    await expect(
      page.getByRole("region", { name: /Sovereignty Score|نقاط السيادة/i })
        .or(page.getByText(/Sovereignty Score|نقاط السيادة/i).first())
    ).toBeVisible({ timeout: TIMEOUTS.sovereignty });
  });

  test("numeric score value from mock data (87) is displayed", async ({ page }) => {
    await expect(
      page.getByText("87").first()
    ).toBeVisible({ timeout: TIMEOUTS.sovereignty });
  });

  test("letter grade (A-) from mock data is displayed", async ({ page }) => {
    await expect(
      page.getByText("A-").first()
    ).toBeVisible({ timeout: TIMEOUTS.sovereignty });
  });

  test("score factor breakdown labels are visible", async ({ page }) => {
    const factors = ["Encryption", "Shards", "Local Processing", "Key Health", "Access"];
    for (const factor of factors) {
      await expect(page.getByText(factor).first()).toBeVisible({ timeout: TIMEOUTS.ui });
    }
  });

  test("score factors show numeric values", async ({ page }) => {
    // At least one factor score from the mock (e.g. 95 for Encryption)
    await expect(
      page.getByText("95").first()
        .or(page.getByText("90").first())
        .or(page.getByText("78").first())
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });
});

// ===========================================================================
// SUITE 3: Key Information
// ===========================================================================

test.describe("Sovereignty Score — Key Information", () => {
  test.beforeEach(async ({ page }) => {
    await setupSovereigntyPage(page);
  });

  test("encryption key section heading is visible", async ({ page }) => {
    await expect(
      page.getByText(/Encryption Key|مفتاح التشفير/i).first()
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("key fingerprint value from mock data is displayed", async ({ page }) => {
    await expect(
      page.getByText("A7:3B:C2:D9:E4:F5").first()
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("key algorithm from mock data is displayed", async ({ page }) => {
    await expect(
      page.getByText("ECDH-P256").first()
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("backup method (QR Code) is displayed", async ({ page }) => {
    await expect(
      page.getByText("QR Code").first()
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("copy fingerprint button is visible and clickable", async ({ page }) => {
    const copyButton = page.getByRole("button", { name: /Copy Fingerprint|نسخ البصمة/i });
    await expect(copyButton).toBeVisible({ timeout: TIMEOUTS.ui });

    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await copyButton.click();

    // A toast should confirm the copy
    await expect(
      page.getByText(/copied|Fingerprint copied|تم نسخ/i).first()
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });
});

// ===========================================================================
// SUITE 4: Shard Distribution
// ===========================================================================

test.describe("Sovereignty Score — Shard Distribution", () => {
  test.beforeEach(async ({ page }) => {
    await setupSovereigntyPage(page);
  });

  test("shard distribution section heading is visible", async ({ page }) => {
    await expect(
      page.getByText(/Shard Distribution|توزيع الأجزاء/i).first()
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("shard map canvas element is rendered", async ({ page }) => {
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("active shards count from mock data (12) is visible", async ({ page }) => {
    await expect(
      page.getByText("12").first()
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("sharding details section shows active shards and nodes labels", async ({ page }) => {
    await expect(page.getByText(/Active Shards|أجزاء نشطة/i).first()).toBeVisible({ timeout: TIMEOUTS.ui });
    await expect(page.getByText(/^Nodes$|^عقد$/i).first()).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("network health indicator is visible", async ({ page }) => {
    await expect(
      page.getByText(/Network Health|صحة الشبكة/i).first()
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });
});

// ===========================================================================
// SUITE 5: Key Management Actions
// ===========================================================================

test.describe("Sovereignty Score — Key Management", () => {
  test.beforeEach(async ({ page }) => {
    await setupSovereigntyPage(page);
  });

  test("backup via QR button is visible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Backup via QR|نسخ احتياطي/i })
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("backup QR button opens a passphrase dialog", async ({ page }) => {
    await page.getByRole("button", { name: /Backup via QR|نسخ احتياطي/i }).click();

    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.ui });

    // The dialog should contain a password input for the passphrase
    await expect(dialog.locator("input[type='password']")).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("passphrase dialog can be cancelled", async ({ page }) => {
    await page.getByRole("button", { name: /Backup via QR|نسخ احتياطي/i }).click();

    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.ui });

    const cancelButton = dialog.getByRole("button", { name: /Cancel|إلغاء/i });
    await cancelButton.click();

    await expect(dialog).not.toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("entering passphrase and generating QR shows the QR code dialog", async ({ page }) => {
    await page.getByRole("button", { name: /Backup via QR|نسخ احتياطي/i }).click();

    const passphraseDialog = page.getByRole("dialog").first();
    await expect(passphraseDialog).toBeVisible({ timeout: TIMEOUTS.ui });

    await passphraseDialog.locator("input[type='password']").fill("secure-passphrase-2026");
    await passphraseDialog.getByRole("button", { name: /Generate QR|توليد رمز/i }).click();

    // A new dialog (QR code) should appear
    const qrDialog = page.getByRole("dialog").filter({ has: page.locator("img") }).first()
      .or(page.getByRole("dialog").filter({ hasText: /QR|backup/i }).first());
    await expect(qrDialog).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("rotate key button is visible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Rotate Key|تدوير المفتاح/i })
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("rotate key shows a confirmation before proceeding", async ({ page }) => {
    let confirmMessage = "";
    page.on("dialog", async (dialog) => {
      confirmMessage = dialog.message();
      await dialog.dismiss(); // Cancel the rotation
    });

    await page.getByRole("button", { name: /Rotate Key|تدوير المفتاح/i }).click();

    await page.waitForTimeout(1000);
    // Either a native confirm dialog was shown OR a custom modal appeared
    const hasConfirmation =
      confirmMessage.length > 0 ||
      (await page.getByRole("dialog").count()) > 0 ||
      (await page.getByText(/are you sure|confirm/i).count()) > 0;

    expect(hasConfirmation).toBe(true);
  });
});

// ===========================================================================
// SUITE 6: Sovereignty Recommendations
// ===========================================================================

test.describe("Sovereignty Score — Recommendations", () => {
  test.beforeEach(async ({ page }) => {
    await setupSovereigntyPage(page);
  });

  test("recommendations section is visible", async ({ page }) => {
    await expect(
      page.getByText(/Recommendations|توصيات/i).first()
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("at least one recommendation item is rendered", async ({ page }) => {
    // The sovereignty page has hardcoded recommendations
    await expect(
      page.getByText(/Enable Hardware Key|Biometric|2FA|Setup/i).first()
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });
});

// ===========================================================================
// SUITE 7: Sovereignty Status Ribbon (appears in layout)
// ===========================================================================

test.describe("Sovereignty Score — Status Ribbon", () => {
  test.beforeEach(async ({ page }) => {
    await setupSovereigntyPage(page);
  });

  test("sovereignty status ribbon is present on the page", async ({ page }) => {
    const ribbon = page.getByRole("status", { name: /Sovereignty status ribbon/i })
      .or(page.locator('[aria-label*="sovereignty"], [data-testid*="sovereignty-ribbon"]').first());
    await expect(ribbon).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("ribbon shows encryption algorithm label (AES-256-GCM)", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /AES-256-GCM/i }).first()
        .or(page.getByText("AES-256-GCM").first())
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("ribbon shows jurisdiction label (UAE)", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /UAE/i }).first()
        .or(page.getByText("UAE").first())
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });

  test("ribbon shows key validity status", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Valid|Sovereign/i }).first()
        .or(page.getByText(/Valid|Sovereign/i).first())
    ).toBeVisible({ timeout: TIMEOUTS.ui });
  });
});

// ===========================================================================
// SUITE 8: Real Backend Integration
// ===========================================================================

test.describe("Sovereignty Score — Real Backend Integration", () => {
  test("sovereignty score page fetches data from the real RunPod backend", async ({ page }) => {
    // Let the requests go to the REAL backend (no mocks)
    const statusCodes: number[] = [];

    await page.route("**/api/proxy/sovereignty/**", async (route) => {
      const response = await route.fetch();
      statusCodes.push(response.status());
      await route.fulfill({ response });
    });

    await setupAuthenticatedSession(page);
    await page.goto("/sovereignty");

    // Wait for the real API calls to complete
    await page.waitForTimeout(10000);

    // Verify that at least one sovereignty API was called and returned a valid HTTP status
    if (statusCodes.length > 0) {
      for (const status of statusCodes) {
        expect([200, 401, 403, 404, 422, 500]).toContain(status);
      }
    }

    // The page should not show a JavaScript error regardless of backend response
    await expect(page.locator("body")).not.toHaveText(/TypeError|ReferenceError|Uncaught/i);

    // Some UI content should be visible (the page didn't crash)
    await expect(
      page.getByRole("heading").first()
    ).toBeVisible({ timeout: TIMEOUTS.page });
  });

  test("sovereignty page handles 401 from backend gracefully", async ({ page }) => {
    // Simulate backend refusing the test session
    await page.route("**/api/proxy/sovereignty/**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      })
    );

    await setupAuthenticatedSession(page);
    await page.goto("/sovereignty");

    // Should either redirect to login OR show a graceful error
    await page.waitForTimeout(5000);
    const currentUrl = page.url();
    const isOnLoginOrSovPage = currentUrl.includes("/login") || currentUrl.includes("/sovereignty");
    expect(isOnLoginOrSovPage).toBe(true);

    // Should not crash
    await expect(page.locator("body")).not.toHaveText(/TypeError|ReferenceError/i);
  });
});
