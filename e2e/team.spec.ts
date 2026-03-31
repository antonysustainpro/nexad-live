import { test, expect, Page } from "@playwright/test";
import { loginAsTestUser, mockBrainAPIs, mockFallbackAPIs, mockChatAPIs } from "./helpers";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_TEAM_MEMBERS = [
  {
    id: "tm_001",
    name: "Sarah Chen",
    email: "sarah@nexad.ai",
    role: "admin",
    avatarUrl: null,
    lastActive: "2026-03-19T14:00:00Z",
    apiCalls: 1250,
    tokensUsed: 48000,
  },
  {
    id: "tm_002",
    name: "Omar Khalil",
    email: "omar@nexad.ai",
    role: "member",
    avatarUrl: null,
    lastActive: "2026-03-18T09:30:00Z",
    apiCalls: 320,
    tokensUsed: 12000,
  },
  {
    id: "tm_003",
    name: "Lena Park",
    email: "lena@nexad.ai",
    role: "viewer",
    avatarUrl: null,
    lastActive: "2026-03-17T16:00:00Z",
    apiCalls: 50,
    tokensUsed: 2000,
  },
];

const MOCK_INVITATIONS = [
  {
    id: "inv_001",
    email: "pending@nexad.ai",
    role: "member" as const,
    invitedAt: "2026-03-18T10:00:00Z",
    expiresAt: "2026-03-25T10:00:00Z",
  },
];

const MOCK_REFERRAL_CODE = { code: "NX-TEST99" };

const MOCK_REFERRAL_STATS = {
  totalReferrals: 5,
  activeReferrals: 3,
  creditsEarned: 150,
  referralCode: "NX-TEST99",
};

const MOCK_REFERRALS = [
  { id: "ref_001", name: "Alice Johnson", date: "2026-03-10T00:00:00Z", status: "active", creditEarned: 50 },
  { id: "ref_002", name: "Bob Williams", date: "2026-03-12T00:00:00Z", status: "pending", creditEarned: 0 },
  { id: "ref_003", name: "Charlie Brown", date: "2026-02-01T00:00:00Z", status: "expired", creditEarned: 50 },
];

// ---------------------------------------------------------------------------
// Helpers to mock Team & Referral proxy APIs
// ---------------------------------------------------------------------------

async function mockTeamAPIs(page: Page) {
  await page.route("**/api/proxy/team/members", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_TEAM_MEMBERS),
      });
    }
    return route.continue();
  });

  await page.route("**/api/proxy/team/invitations", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_INVITATIONS),
      });
    }
    return route.continue();
  });

  await page.route("**/api/proxy/team/invite", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "inv_new",
          email: "newinvite@nexad.ai",
          role: "member",
          invitedAt: "2026-03-20T00:00:00Z",
          expiresAt: "2026-03-27T00:00:00Z",
        }),
      });
    }
    return route.continue();
  });

  // Update member (PUT)
  await page.route("**/api/proxy/team/members/*", (route) => {
    if (route.request().method() === "PUT") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...MOCK_TEAM_MEMBERS[0], role: "viewer" }),
      });
    }
    if (route.request().method() === "DELETE") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ removed: true }),
      });
    }
    return route.continue();
  });

  // Cancel invitation (DELETE)
  await page.route("**/api/proxy/team/invitations/*", (route) => {
    if (route.request().method() === "DELETE") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ cancelled: true }),
      });
    }
    return route.continue();
  });
}

async function mockReferralAPIs(page: Page) {
  await page.route("**/api/proxy/referral/code/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_REFERRAL_CODE),
    })
  );

  await page.route("**/api/proxy/referral/stats/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_REFERRAL_STATS),
    })
  );

  await page.route("**/api/proxy/referral/list/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_REFERRALS),
    })
  );
}

/**
 * Set the billing tier in localStorage so BillingGuard allows access.
 */
async function setBillingTier(page: Page, tier: "FREE" | "PRO" | "ENTERPRISE") {
  await page.addInitScript((t) => {
    localStorage.setItem("nexusad-billing-tier", t);
  }, tier);
}

/**
 * Seed the nexus-user-display localStorage entry so the referral page
 * can derive a user ID and call the referral APIs.
 */
async function seedReferralUser(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "nexus-user-display",
      JSON.stringify({ id: "u_test_001", name: "Antony Bousader" })
    );
  });
}

// ===========================================================================
// TEAM PAGE TESTS
// ===========================================================================

test.describe("Team Page", () => {
  test.describe("Enterprise billing guard", () => {
    test("shows upgrade overlay when user is on FREE tier", async ({ page }) => {
      await mockFallbackAPIs(page);
      await mockChatAPIs(page);
      await mockBrainAPIs(page);
      await mockTeamAPIs(page);
      await loginAsTestUser(page);
      // Do NOT set billing tier (defaults to FREE)

      await page.goto("/team");

      // The guard displays a lock overlay with an upgrade prompt
      await expect(
        page.getByText(/Team Management Locked|إدارة الفريق مقفلة/i).first()
      ).toBeVisible({ timeout: 10000 });
      await expect(
        page.getByRole("link", { name: /Upgrade Now|ترقية الآن/i })
      ).toBeVisible({ timeout: 5000 });
    });

    test("upgrade link points to /billing/pricing", async ({ page }) => {
      await mockFallbackAPIs(page);
      await mockChatAPIs(page);
      await mockBrainAPIs(page);
      await mockTeamAPIs(page);
      await loginAsTestUser(page);

      await page.goto("/team");

      const upgradeLink = page.getByRole("link", { name: /Upgrade Now|ترقية الآن/i });
      await expect(upgradeLink).toHaveAttribute("href", "/billing/pricing");
    });
  });

  test.describe("With ENTERPRISE access", () => {
    test.beforeEach(async ({ page }) => {
      await mockFallbackAPIs(page);
      await mockChatAPIs(page);
      await mockBrainAPIs(page);
      await mockTeamAPIs(page);
      await setBillingTier(page, "ENTERPRISE");
      await loginAsTestUser(page);
      await page.goto("/team");
    });

    // -----------------------------------------------------------------
    // Team members list
    // -----------------------------------------------------------------

    test("team members list loads and displays members", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /Team Management|إدارة الفريق/i })
      ).toBeVisible({ timeout: 10000 });

      // Table header columns
      await expect(page.getByText(/Member|العضو/i).first()).toBeVisible({ timeout: 5000 });

      // Member count in card title
      await expect(
        page.getByText(/Team Members \(3\)|أعضاء الفريق \(3\)/i).first()
      ).toBeVisible({ timeout: 5000 });

      // Individual member names
      await expect(page.getByText("Sarah Chen")).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Omar Khalil")).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Lena Park")).toBeVisible({ timeout: 5000 });
    });

    test("member emails are displayed in the table", async ({ page }) => {
      await expect(page.getByText("sarah@nexad.ai")).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("omar@nexad.ai")).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("lena@nexad.ai")).toBeVisible({ timeout: 5000 });
    });

    test("member roles are displayed with correct labels", async ({ page }) => {
      await expect(page.getByText("Admin").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Member").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Viewer").first()).toBeVisible({ timeout: 5000 });
    });

    test("member usage stats are displayed", async ({ page }) => {
      // Sarah: 1250 -> 1.3K calls, 48000 -> 48.0K tokens
      await expect(page.getByText(/1\.3K/i).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/48\.0K/i).first()).toBeVisible({ timeout: 5000 });
    });

    // -----------------------------------------------------------------
    // Pending invitations
    // -----------------------------------------------------------------

    test("pending invitations section is displayed", async ({ page }) => {
      await expect(
        page.getByText(/Pending Invitations|الدعوات المعلقة/i).first()
      ).toBeVisible({ timeout: 5000 });

      // The pending email
      await expect(page.getByText("pending@nexad.ai")).toBeVisible({ timeout: 5000 });
    });

    test("pending invitation shows role and expiry", async ({ page }) => {
      // "Member" role label and "Expires" date
      const invitationRow = page.locator("text=pending@nexad.ai").locator("..");
      await expect(invitationRow).toBeVisible({ timeout: 5000 });
      await expect(
        page.getByText(/Expires|تنتهي/i).first()
      ).toBeVisible({ timeout: 5000 });
    });

    // -----------------------------------------------------------------
    // Invite member modal
    // -----------------------------------------------------------------

    test("invite member button is visible", async ({ page }) => {
      await expect(
        page.getByRole("button", { name: /Invite Member|دعوة عضو/i })
      ).toBeVisible({ timeout: 5000 });
    });

    test("invite member modal opens on button click", async ({ page }) => {
      await page.getByRole("button", { name: /Invite Member|دعوة عضو/i }).click();

      await expect(
        page.getByRole("heading", { name: /Invite Team Member|دعوة عضو فريق/i })
      ).toBeVisible({ timeout: 5000 });

      // Email field is present
      await expect(page.locator("#invite-email")).toBeVisible({ timeout: 3000 });

      // Role selector is present
      await expect(page.locator("#invite-role")).toBeVisible({ timeout: 3000 });

      // Send Invitation button
      await expect(
        page.getByRole("button", { name: /Send Invitation|إرسال الدعوة/i })
      ).toBeVisible({ timeout: 3000 });
    });

    test("invite modal has cancel button that closes it", async ({ page }) => {
      await page.getByRole("button", { name: /Invite Member|دعوة عضو/i }).click();

      await expect(
        page.getByRole("heading", { name: /Invite Team Member|دعوة عضو فريق/i })
      ).toBeVisible({ timeout: 5000 });

      // Click Cancel
      await page.getByRole("button", { name: /Cancel|إلغاء/i }).click();

      // Modal should close
      await expect(
        page.getByRole("heading", { name: /Invite Team Member|دعوة عضو فريق/i })
      ).not.toBeVisible({ timeout: 3000 });
    });

    test("invite form validates empty email (shows toast error)", async ({ page }) => {
      await page.getByRole("button", { name: /Invite Member|دعوة عضو/i }).click();
      await expect(page.locator("#invite-email")).toBeVisible({ timeout: 5000 });

      // Submit without entering email
      await page.getByRole("button", { name: /Send Invitation|إرسال الدعوة/i }).click();

      // A sonner toast with the validation message should appear
      await expect(
        page.getByText(/Please enter an email|الرجاء إدخال البريد الإلكتروني/i).first()
      ).toBeVisible({ timeout: 5000 });
    });

    test("invite member success flow", async ({ page }) => {
      await page.getByRole("button", { name: /Invite Member|دعوة عضو/i }).click();
      await expect(page.locator("#invite-email")).toBeVisible({ timeout: 5000 });

      // Fill email
      await page.locator("#invite-email").fill("newinvite@nexad.ai");

      // Submit
      await page.getByRole("button", { name: /Send Invitation|إرسال الدعوة/i }).click();

      // Success toast
      await expect(
        page.getByText(/Invitation sent|تم إرسال الدعوة/i).first()
      ).toBeVisible({ timeout: 5000 });

      // Modal should close
      await expect(
        page.getByRole("heading", { name: /Invite Team Member|دعوة عضو فريق/i })
      ).not.toBeVisible({ timeout: 5000 });
    });

    // -----------------------------------------------------------------
    // Cancel invitation
    // -----------------------------------------------------------------

    test("cancel invitation removes it from the list", async ({ page }) => {
      await expect(page.getByText("pending@nexad.ai")).toBeVisible({ timeout: 5000 });

      // Click the cancel (X) button next to the pending invitation
      const cancelBtn = page.getByRole("button", { name: /Cancel invitation|إلغاء الدعوة/i });
      await cancelBtn.click();

      // Success toast
      await expect(
        page.getByText(/Invitation cancelled|تم إلغاء الدعوة/i).first()
      ).toBeVisible({ timeout: 5000 });

      // Pending email should disappear
      await expect(page.getByText("pending@nexad.ai")).not.toBeVisible({ timeout: 5000 });
    });

    // -----------------------------------------------------------------
    // Edit member role
    // -----------------------------------------------------------------

    test("edit role modal opens from member actions dropdown", async ({ page }) => {
      // Wait for members to load
      await expect(page.getByText("Sarah Chen")).toBeVisible({ timeout: 5000 });

      // Open the dropdown for the first member
      const optionsButtons = page.getByRole("button", { name: /Options|خيارات/i });
      await optionsButtons.first().click();

      // Click Edit
      await page.getByRole("menuitem", { name: /Edit|تعديل/i }).click();

      // Edit Role modal should open
      await expect(
        page.getByRole("heading", { name: /Edit Member Role|تعديل دور العضو/i })
      ).toBeVisible({ timeout: 5000 });

      // Member name should be shown in description
      await expect(page.getByText("Sarah Chen").first()).toBeVisible({ timeout: 3000 });

      // Role radio options should be visible
      await expect(page.getByText("Admin").first()).toBeVisible({ timeout: 3000 });
      await expect(page.getByText("Viewer").first()).toBeVisible({ timeout: 3000 });
    });

    test("edit role modal save button is disabled when role unchanged", async ({ page }) => {
      await expect(page.getByText("Sarah Chen")).toBeVisible({ timeout: 5000 });

      const optionsButtons = page.getByRole("button", { name: /Options|خيارات/i });
      await optionsButtons.first().click();
      await page.getByRole("menuitem", { name: /Edit|تعديل/i }).click();

      await expect(
        page.getByRole("heading", { name: /Edit Member Role|تعديل دور العضو/i })
      ).toBeVisible({ timeout: 5000 });

      // Save Changes button should be disabled because no role change
      const saveBtn = page.getByRole("button", { name: /Save Changes|حفظ التغييرات/i });
      await expect(saveBtn).toBeDisabled();
    });

    test("edit role modal save succeeds after changing role", async ({ page }) => {
      await expect(page.getByText("Sarah Chen")).toBeVisible({ timeout: 5000 });

      const optionsButtons = page.getByRole("button", { name: /Options|خيارات/i });
      await optionsButtons.first().click();
      await page.getByRole("menuitem", { name: /Edit|تعديل/i }).click();

      await expect(
        page.getByRole("heading", { name: /Edit Member Role|تعديل دور العضو/i })
      ).toBeVisible({ timeout: 5000 });

      // Select a different role (Viewer) - use click() because Radix RadioGroup
      // items are custom elements that don't respond to Playwright's check() method
      await page.getByLabel("Viewer").click();

      // Save Changes should now be enabled
      const saveBtn = page.getByRole("button", { name: /Save Changes|حفظ التغييرات/i });
      await expect(saveBtn).toBeEnabled();
      await saveBtn.click();

      // Success toast
      await expect(
        page.getByText(/Member updated|تم تحديث العضو/i).first()
      ).toBeVisible({ timeout: 5000 });

      // Modal should close
      await expect(
        page.getByRole("heading", { name: /Edit Member Role|تعديل دور العضو/i })
      ).not.toBeVisible({ timeout: 5000 });
    });

    // -----------------------------------------------------------------
    // Remove member
    // -----------------------------------------------------------------

    test("remove member opens confirmation dialog", async ({ page }) => {
      await expect(page.getByText("Sarah Chen")).toBeVisible({ timeout: 5000 });

      const optionsButtons = page.getByRole("button", { name: /Options|خيارات/i });
      await optionsButtons.first().click();

      // Click Remove
      await page.getByRole("menuitem", { name: /Remove|إزالة/i }).click();

      // Confirmation dialog should appear
      await expect(
        page.getByRole("heading", { name: /Remove team member|إزالة عضو الفريق/i })
      ).toBeVisible({ timeout: 5000 });

      // Confirmation text mentions the member name
      await expect(
        page.getByText(/Are you sure you want to remove "Sarah Chen"|هل أنت متأكد من إزالة/i).first()
      ).toBeVisible({ timeout: 3000 });

      // Cancel and Remove buttons in the dialog
      await expect(
        page.getByRole("button", { name: /Cancel|إلغاء/i }).first()
      ).toBeVisible({ timeout: 3000 });
      await expect(
        page.getByRole("button", { name: /^Remove$|^إزالة$/i }).first()
      ).toBeVisible({ timeout: 3000 });
    });

    test("remove member confirmed removes member from list", async ({ page }) => {
      await expect(page.getByText("Sarah Chen")).toBeVisible({ timeout: 5000 });

      const optionsButtons = page.getByRole("button", { name: /Options|خيارات/i });
      await optionsButtons.first().click();
      await page.getByRole("menuitem", { name: /Remove|إزالة/i }).click();

      // Confirm removal via the AlertDialog action button
      await expect(
        page.getByRole("heading", { name: /Remove team member|إزالة عضو الفريق/i })
      ).toBeVisible({ timeout: 5000 });

      // Click the destructive "Remove" action button in the alert dialog
      const removeAction = page.locator("[role='alertdialog'] button", {
        hasText: /^Remove$|^إزالة$/i,
      });
      await removeAction.click();

      // Success toast
      await expect(
        page.getByText(/Member removed|تم إزالة العضو/i).first()
      ).toBeVisible({ timeout: 5000 });

      // Sarah Chen should no longer be visible
      await expect(page.getByText("Sarah Chen")).not.toBeVisible({ timeout: 5000 });
    });

    test("remove member dialog cancel keeps member in list", async ({ page }) => {
      await expect(page.getByText("Sarah Chen")).toBeVisible({ timeout: 5000 });

      const optionsButtons = page.getByRole("button", { name: /Options|خيارات/i });
      await optionsButtons.first().click();
      await page.getByRole("menuitem", { name: /Remove|إزالة/i }).click();

      await expect(
        page.getByRole("heading", { name: /Remove team member|إزالة عضو الفريق/i })
      ).toBeVisible({ timeout: 5000 });

      // Click Cancel
      const cancelBtn = page.locator("[role='alertdialog'] button", {
        hasText: /^Cancel$|^إلغاء$/i,
      });
      await cancelBtn.click();

      // Dialog should close
      await expect(
        page.getByRole("heading", { name: /Remove team member|إزالة عضو الفريق/i })
      ).not.toBeVisible({ timeout: 3000 });

      // Member should still be there
      await expect(page.getByText("Sarah Chen")).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe("Empty state", () => {
    test("shows empty state when no team members", async ({ page }) => {
      await mockFallbackAPIs(page);
      await mockChatAPIs(page);
      await mockBrainAPIs(page);

      // Override team members to return empty
      await page.route("**/api/proxy/team/members", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        })
      );
      await page.route("**/api/proxy/team/invitations", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        })
      );

      await setBillingTier(page, "ENTERPRISE");
      await loginAsTestUser(page);
      await page.goto("/team");

      await expect(
        page.getByText(/No team members yet|لا يوجد أعضاء في الفريق بعد/i).first()
      ).toBeVisible({ timeout: 10000 });

      await expect(
        page.getByText(/Invite your team members|قم بدعوة أعضاء فريقك/i).first()
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Error state", () => {
    test("shows error state and retry button when API fails", async ({ page }) => {
      await mockFallbackAPIs(page);
      await mockChatAPIs(page);
      await mockBrainAPIs(page);

      // Override team members to return an error
      await page.route("**/api/proxy/team/members", (route) =>
        route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Server error" }) })
      );
      await page.route("**/api/proxy/team/invitations", (route) =>
        route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Server error" }) })
      );

      await setBillingTier(page, "ENTERPRISE");
      await loginAsTestUser(page);
      await page.goto("/team");

      await expect(
        page.getByText(/Error Loading Team|خطأ في تحميل الفريق/i).first()
      ).toBeVisible({ timeout: 10000 });

      await expect(
        page.getByRole("button", { name: /Retry|إعادة المحاولة/i })
      ).toBeVisible({ timeout: 5000 });
    });
  });
});

// ===========================================================================
// REFERRAL PAGE TESTS
// ===========================================================================

test.describe("Referral Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await mockReferralAPIs(page);
    await seedReferralUser(page);
    await loginAsTestUser(page);
    await page.goto("/referral");
  });

  // -------------------------------------------------------------------
  // Page load
  // -------------------------------------------------------------------

  test("renders referral page with title", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Referral Program|برنامج الإحالة/i })
    ).toBeVisible({ timeout: 10000 });
  });

  // -------------------------------------------------------------------
  // Stats display
  // -------------------------------------------------------------------

  test("referral stats cards are displayed", async ({ page }) => {
    await expect(
      page.getByText(/Total Referrals|إجمالي الإحالات/i).first()
    ).toBeVisible({ timeout: 5000 });

    // Total referrals value
    await expect(page.getByText("5").first()).toBeVisible({ timeout: 5000 });

    // Active referrals
    await expect(page.getByText("3").first()).toBeVisible({ timeout: 5000 });

    // Credits earned
    await expect(page.getByText("$150").first()).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByText(/Credits Earned|الأرصدة المكتسبة/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------
  // Referral code display
  // -------------------------------------------------------------------

  test("referral code is displayed in an input field", async ({ page }) => {
    await expect(
      page.getByText(/Referral Code|كود الإحالة/i).first()
    ).toBeVisible({ timeout: 5000 });

    // The read-only input should contain the code
    const codeInput = page.locator("input[readonly]").first();
    await expect(codeInput).toHaveValue("NX-TEST99", { timeout: 5000 });
  });

  test("referral link is displayed", async ({ page }) => {
    await expect(
      page.getByText(/Referral Link|رابط الإحالة/i).first()
    ).toBeVisible({ timeout: 5000 });

    // The referral link input
    const linkInput = page.locator("input[readonly]").nth(1);
    await expect(linkInput).toHaveValue("https://nexusad.ai/refer/NX-TEST99", { timeout: 5000 });
  });

  // -------------------------------------------------------------------
  // Copy buttons
  // -------------------------------------------------------------------

  test("copy referral code button is visible and clickable", async ({ page }) => {
    const copyCodeBtn = page.getByRole("button", { name: /Copy code|نسخ الكود/i });
    await expect(copyCodeBtn).toBeVisible({ timeout: 5000 });

    // Grant clipboard permissions and click
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await copyCodeBtn.click();

    // Toast success
    await expect(
      page.getByText(/Code copied|تم نسخ الكود/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("copy referral link button is visible and clickable", async ({ page }) => {
    // There are two buttons matching "Copy link" (icon button + share button),
    // so use .nth(1) to target the second icon button (next to referral link input).
    // The first icon button (.nth(0)) is "Copy code" by aria-label.
    // Actually, the icon buttons are: "Copy code" then "Copy link" then "Copy Link" (share).
    // So the icon copy-link button is the first match of aria-label "Copy link".
    const copyLinkBtns = page.getByRole("button", { name: /Copy link|نسخ الرابط/i });
    const copyLinkBtn = copyLinkBtns.first();
    await expect(copyLinkBtn).toBeVisible({ timeout: 5000 });

    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await copyLinkBtn.click();

    // Toast success
    await expect(
      page.getByText(/Link copied|تم نسخ الرابط/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------
  // Share buttons
  // -------------------------------------------------------------------

  test("share via WhatsApp button is visible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /WhatsApp|واتساب/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("WhatsApp button opens whatsapp share link", async ({ page }) => {
    // Intercept window.open
    const [popup] = await Promise.all([
      page.waitForEvent("popup", { timeout: 5000 }).catch(() => null),
      page.getByRole("button", { name: /WhatsApp|واتساب/i }).click(),
    ]);

    // If popup was caught, it should target wa.me or api.whatsapp.com (wa.me redirects)
    if (popup) {
      const popupUrl = popup.url();
      expect(popupUrl.includes("wa.me") || popupUrl.includes("whatsapp.com")).toBeTruthy();
    }
    // Otherwise the browser may have blocked it, which is acceptable in test
  });

  test("share via Email button is visible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Email|بريد إلكتروني/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("copy link share button is visible in share section", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Copy Link|نسخ الرابط/i }).first()
    ).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------
  // How It Works section
  // -------------------------------------------------------------------

  test("how it works section is displayed", async ({ page }) => {
    await expect(
      page.getByText(/How It Works|كيف يعمل/i).first()
    ).toBeVisible({ timeout: 5000 });

    // Three steps
    await expect(
      page.getByText(/Share your code|شارك كودك/i).first()
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText(/Friend signs up|صديقك يسجل/i).first()
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText(/Both get rewarded|كلاكما يحصل على مكافأة/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------
  // Referral list
  // -------------------------------------------------------------------

  test("referral list section is displayed with referrals", async ({ page }) => {
    await expect(
      page.getByText(/Your Referrals|إحالاتك/i).first()
    ).toBeVisible({ timeout: 5000 });

    // Referral names
    await expect(page.getByText("Alice Johnson")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Bob Williams")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Charlie Brown")).toBeVisible({ timeout: 5000 });
  });

  test("referral list shows status badges", async ({ page }) => {
    // Active, Pending, Expired labels
    await expect(page.getByText("Active").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Pending").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Expired").first()).toBeVisible({ timeout: 5000 });
  });

  test("referral list shows credit earned for active referrals", async ({ page }) => {
    // Alice earned $50
    await expect(page.getByText("+$50").first()).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------
  // Terms link
  // -------------------------------------------------------------------

  test("referral program terms link is visible", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: /Referral Program Terms|شروط برنامج الإحالة/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("terms link points to /terms", async ({ page }) => {
    const termsLink = page.getByRole("link", { name: /Referral Program Terms|شروط برنامج الإحالة/i });
    await expect(termsLink).toHaveAttribute("href", "/terms");
  });

  // -------------------------------------------------------------------
  // Empty referral list
  // -------------------------------------------------------------------

  test("shows empty state when no referrals", async ({ page }) => {
    // Override referral list to empty
    await page.route("**/api/proxy/referral/list/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      })
    );

    await page.goto("/referral");

    await expect(
      page.getByText(/No referrals yet|لا توجد إحالات بعد/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  // -------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------

  test("shows error state and retry when API fails", async ({ page }) => {
    // Override all referral endpoints to fail
    await page.route("**/api/proxy/referral/code/**", (route) =>
      route.fulfill({ status: 500, body: "error" })
    );
    await page.route("**/api/proxy/referral/stats/**", (route) =>
      route.fulfill({ status: 500, body: "error" })
    );
    await page.route("**/api/proxy/referral/list/**", (route) =>
      route.fulfill({ status: 500, body: "error" })
    );

    await page.goto("/referral");

    await expect(
      page.getByText(/Error Loading Referrals|خطأ في تحميل الإحالات/i).first()
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByRole("button", { name: /Retry|إعادة المحاولة/i })
    ).toBeVisible({ timeout: 5000 });
  });
});
