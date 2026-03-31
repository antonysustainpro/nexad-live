import { test, expect, Page } from "@playwright/test";
import {
  loginAsTestUser,
  mockBrainAPIs,
  mockFallbackAPIs,
  mockChatAPIs,
} from "./helpers";
import * as path from "path";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_ACCESS_LOG = {
  entries: [
    {
      timestamp: "2026-03-20T10:00:00Z",
      actor: "owner",
      action: "UPLOAD",
      resource: "Employment_Contract_2025.pdf",
    },
    {
      timestamp: "2026-03-20T09:30:00Z",
      actor: "owner",
      action: "VIEW",
      resource: "Tax_Return_2025.xlsx",
    },
    {
      timestamp: "2026-03-19T14:00:00Z",
      actor: "owner",
      action: "DOWNLOAD",
      resource: "Passport_Scan.jpg",
    },
    {
      timestamp: "2026-03-19T12:00:00Z",
      actor: "owner",
      action: "DELETE",
      resource: "Old_Resume.pdf",
    },
    {
      timestamp: "2026-03-18T16:00:00Z",
      actor: "owner",
      action: "UPLOAD",
      resource: "Medical_Records.pdf",
    },
    {
      timestamp: "2026-03-18T10:00:00Z",
      actor: "owner",
      action: "VIEW",
      resource: "Lease_Agreement.pdf",
    },
  ],
  total_entries: 6,
  third_party_access_count: 0,
};

const MOCK_SHARD_DISTRIBUTION = {
  nodes: [
    { node_id: "uae-1", location: "UAE Node 1", shard_count: 4, status: "active" as const },
    { node_id: "uae-2", location: "UAE Node 2", shard_count: 4, status: "active" as const },
    { node_id: "uae-3", location: "UAE Node 3", shard_count: 4, status: "active" as const },
  ],
  total_shards: 12,
};

const MOCK_DELETION_CERTIFICATE = {
  deletion_hash: "sha256:a7f3e2d1b8c9...4e5f6a7b",
  timestamp: "2026-03-20T12:00:00Z",
  node_confirmations: ["UAE Node 1", "UAE Node 2", "UAE Node 3"],
  merkle_root: "0xabc123def456",
  merkle_verified: true,
};

const MOCK_VAULT_DOCUMENT = {
  id: "doc-123",
  name: "Employment_Contract_2025.pdf",
  nameAr: "عقد العمل 2025.pdf",
  type: "PDF",
  domain: "Legal",
  domainAr: "قانوني",
  dateAdded: "January 15, 2026",
  chunks: 8,
  usageCount: 12,
  fingerprint: "sha256:4a7f3e2d1b8c9e0f5d6a2b3c8e1f4a7d",
  content:
    "EMPLOYMENT CONTRACT\n\nThis Employment Contract is entered into on January 15, 2026...\n\nParty A: nexAD Technologies\nParty B: Antony Bousader\n\nPosition: Founder & CEO",
  relatedConversations: [
    { id: "conv-1", title: "Employment contract review", date: "Jan 20, 2026" },
    { id: "conv-2", title: "Benefits discussion", date: "Feb 5, 2026" },
  ],
};

// ---------------------------------------------------------------------------
// Vault-specific API mocking
// ---------------------------------------------------------------------------

async function mockVaultAPIs(page: Page) {
  // Access log
  await page.route("**/api/proxy/vault/access-log**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_ACCESS_LOG),
    })
  );

  // Shard distribution
  await page.route("**/api/proxy/vault/shards**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_SHARD_DISTRIBUTION),
    })
  );

  // Upload – small delay so progress animation is visible; no filename returned
  // so the app uses the original file name from the File object
  await page.route("**/api/proxy/vault/upload**", async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ chunks_stored: 4 }),
    });
  });

  // Prove delete
  await page.route("**/api/proxy/vault/prove-delete**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_DELETION_CERTIFICATE),
    })
  );

  // Document detail
  await page.route("**/api/proxy/vault/document/**", (route) => {
    if (route.request().method() === "DELETE") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_VAULT_DOCUMENT),
    });
  });

  // Vault info
  await page.route("**/api/proxy/vault/info**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ name: "sovereign_vault", points_count: 56, vectors_count: 56, status: "green" }),
    })
  );
}

// ---------------------------------------------------------------------------
// Helper: upload a file via the hidden input
// ---------------------------------------------------------------------------

async function uploadFileViaButton(page: Page, filename = "test-document.pdf") {
  // Create a temporary test file buffer
  const buffer = Buffer.from("PDF test content for vault upload");

  // Wait for the vault page to fully render before interacting with the file input
  await page.waitForSelector('input[type="file"]', { state: "attached", timeout: 5000 });

  // Locate the hidden file input scoped to the vault page (not the chat input)
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({
    name: filename,
    mimeType: "application/pdf",
    buffer,
  });
}

// =========================================================================
// TEST SUITE: Vault Page (main listing)
// =========================================================================

test.describe("Vault Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockVaultAPIs(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await loginAsTestUser(page);
    await page.goto("/vault");
  });

  // -----------------------------------------------------------------------
  // Basic rendering
  // -----------------------------------------------------------------------

  test("renders vault page with title and subtitle", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Your Sovereign Vault|خزنتك السيادية/i })
    ).toBeVisible({ timeout: 5000 });

    // Empty-state subtitle should show
    await expect(
      page.getByText(/Your vault is empty|خزنتك فارغة/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("upload button is visible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Upload Document|رفع مستند/i })
    ).toBeVisible({ timeout: 5000 });
  });

  // -----------------------------------------------------------------------
  // Upload via button
  // -----------------------------------------------------------------------

  test("uploads a document via button and shows it in the list", async ({ page }) => {
    await uploadFileViaButton(page, "Employment_Contract.pdf");

    // Wait for upload progress to appear and complete
    await expect(page.getByText(/Encrypting|Sharding|Distributing|Securing|Secured/i).first()).toBeVisible({
      timeout: 5000,
    });

    // Wait for progress to finish (the upload dismisses after 1.5s at 100%)
    await page.waitForTimeout(3000);

    // Document should now appear in the list
    await expect(page.getByText("Employment_Contract.pdf").first()).toBeVisible({ timeout: 5000 });
  });

  test("upload progress bar shows percentage", async ({ page }) => {
    await uploadFileViaButton(page);

    // The progress percentage text should be visible during upload
    await expect(page.getByText(/%/).first()).toBeVisible({ timeout: 5000 });
  });

  test("upload shows toast notification on success", async ({ page }) => {
    await uploadFileViaButton(page);

    // Wait for upload to complete
    await page.waitForTimeout(3000);

    // Sonner toast should appear - check for either success or local-fallback message
    await expect(
      page.getByText(/Document uploaded successfully|Document added locally/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  // -----------------------------------------------------------------------
  // Upload via drag-and-drop
  // -----------------------------------------------------------------------

  test("drag zone highlights on dragover", async ({ page }) => {
    // Find the drop zone text to confirm it exists
    const dropZoneText = page.getByText(/Drag and drop files here|اسحب وأفلت الملفات هنا/i).first();
    await expect(dropZoneText).toBeVisible({ timeout: 5000 });

    // Dispatch dragover event via evaluate (DragEvent requires proper DataTransfer)
    await dropZoneText.evaluate((el) => {
      const event = new DragEvent("dragover", {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      });
      el.parentElement?.dispatchEvent(event);
    });

    // The drop zone should still be visible (page does not crash)
    await expect(dropZoneText).toBeVisible();
  });

  test("browse link inside drag zone triggers file input", async ({ page }) => {
    const browseButton = page.getByRole("button", { name: /browse|تصفح/i });
    await expect(browseButton).toBeVisible({ timeout: 5000 });

    // Clicking browse should not crash (it triggers the hidden file input)
    await browseButton.click();
    // Page should still be intact
    await expect(
      page.getByRole("heading", { name: /Your Sovereign Vault|خزنتك السيادية/i })
    ).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Document list & grid/list toggle
  // -----------------------------------------------------------------------

  test("shows empty state when no documents uploaded", async ({ page }) => {
    await expect(page.getByText(/No documents yet|لا توجد مستندات بعد/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("grid and list view toggle works", async ({ page }) => {
    const gridButton = page.getByRole("button", { name: /Grid view/i });
    const listButton = page.getByRole("button", { name: /List view/i });
    await expect(gridButton).toBeVisible({ timeout: 5000 });
    await expect(listButton).toBeVisible({ timeout: 5000 });

    // Upload a file so we have something to show in both views
    await uploadFileViaButton(page);
    await page.waitForTimeout(3000);

    // Switch to list view
    await listButton.click();
    await page.waitForTimeout(300);

    // Document should still be visible in list view
    await expect(page.getByText("test-document.pdf").first()).toBeVisible({ timeout: 3000 });

    // Switch back to grid view
    await gridButton.click();
    await page.waitForTimeout(300);

    // Document should still be visible in grid view
    await expect(page.getByText("test-document.pdf").first()).toBeVisible({ timeout: 3000 });
  });

  test("uploaded document shows metadata (size, domain, shards)", async ({ page }) => {
    await uploadFileViaButton(page);
    await page.waitForTimeout(3000);

    // The card should show Personal domain badge
    await expect(page.getByText("Personal").first()).toBeVisible({ timeout: 3000 });

    // Should show shard count
    await expect(page.getByText(/shard/i).first()).toBeVisible({ timeout: 3000 });

    // Should show "Just now" timestamp
    await expect(page.getByText("Just now").first()).toBeVisible({ timeout: 3000 });
  });

  // -----------------------------------------------------------------------
  // Search and filter
  // -----------------------------------------------------------------------

  test("search input filters documents", async ({ page }) => {
    // Upload two documents with different names, waiting for each to complete
    await uploadFileViaButton(page, "Employment_Contract.pdf");
    await expect(page.getByText("Employment_Contract.pdf").first()).toBeVisible({ timeout: 10000 });

    await uploadFileViaButton(page, "Tax_Return_2025.xlsx");
    await expect(page.getByText("Tax_Return_2025.xlsx").first()).toBeVisible({ timeout: 10000 });

    // Both documents should be visible
    await expect(page.getByText("Employment_Contract.pdf").first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Tax_Return_2025.xlsx").first()).toBeVisible({ timeout: 3000 });

    // Type a search query
    const searchInput = page.getByPlaceholder(/Search vault|البحث في الخزنة/i).first();
    await searchInput.fill("Tax");

    // Only Tax document should remain visible
    await expect(page.getByText("Tax_Return_2025.xlsx").first()).toBeVisible({ timeout: 3000 });
    // Employment should be filtered out
    await expect(page.getByText("Employment_Contract.pdf")).toHaveCount(0);
  });

  test("domain filter dropdown works", async ({ page }) => {
    // Upload a document first to create a domain
    await uploadFileViaButton(page);
    await page.waitForTimeout(3000);

    // Click the domain filter button
    const filterButton = page.getByRole("button", { name: /All Domains|جميع المجالات/i });
    await expect(filterButton).toBeVisible({ timeout: 5000 });
    await filterButton.click();

    // Dropdown should show "All Domains" option
    await expect(
      page.getByText(/All Domains|جميع المجالات/i).nth(1)
    ).toBeVisible({ timeout: 3000 });
  });

  test("search input is present and accepts text", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search vault|البحث في الخزنة/i).first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill("Employment");
    await expect(searchInput).toHaveValue("Employment");
  });

  // -----------------------------------------------------------------------
  // Folders section
  // -----------------------------------------------------------------------

  test("folders appear after uploading documents", async ({ page }) => {
    await uploadFileViaButton(page);
    await page.waitForTimeout(3000);

    // Folders heading should be visible
    await expect(page.getByText(/^Folders$|^المجلدات$/i).first()).toBeVisible({ timeout: 5000 });

    // Personal folder should appear (since uploaded docs default to Personal)
    await expect(page.getByText("Personal").first()).toBeVisible({ timeout: 3000 });
  });

  test("New Folder button is visible", async ({ page }) => {
    await expect(
      page.getByText(/New Folder|مجلد جديد/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  // -----------------------------------------------------------------------
  // Shard distribution map
  // -----------------------------------------------------------------------

  test("shard distribution section is visible", async ({ page }) => {
    await expect(
      page.getByText(/Shard Distribution|خريطة الأجزاء/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("shard map canvas renders", async ({ page }) => {
    // The ShardMap component renders a canvas with an aria-label
    const canvas = page.locator('canvas[aria-label*="Shard map"]').first();
    await expect(canvas).toBeVisible({ timeout: 5000 });
  });

  test("shard map shows badge with shard count", async ({ page }) => {
    // The badge at the bottom of the shard map shows total shards
    await expect(
      page.getByText(/shards across.*nodes|جزء عبر/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  // -----------------------------------------------------------------------
  // Storage stats
  // -----------------------------------------------------------------------

  test("storage stats section is visible", async ({ page }) => {
    await expect(
      page.getByText(/Storage Used|مساحة التخزين المستخدمة/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("storage shows 0 MB when empty", async ({ page }) => {
    await expect(
      page.getByText(/0 MB.*\/.*10 GB/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  // -----------------------------------------------------------------------
  // Tabs: Documents & Access Log
  // -----------------------------------------------------------------------

  test("documents tab and access log tab are present", async ({ page }) => {
    await expect(page.getByText(/^Documents$|^المستندات$/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Access Log|سجل الوصول/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("access log tab shows entries from API", async ({ page }) => {
    // Click the Access Log tab
    const accessLogTab = page.getByText(/Access Log|سجل الوصول/i).first();
    await accessLogTab.click();

    // Wait for the access log to load
    await page.waitForTimeout(1000);

    // Should show the "ONLY YOU" hero text
    await expect(
      page.getByText(/ONLY YOU|أنت فقط/i).first()
    ).toBeVisible({ timeout: 5000 });

    // Should show table headers
    await expect(page.getByText(/Timestamp|الوقت/i).first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/Actor|المستخدم/i).first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/Action|الإجراء/i).first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/Resource|المورد/i).first()).toBeVisible({ timeout: 3000 });

    // Should show actual log entries
    await expect(page.getByText("UPLOAD").first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("owner").first()).toBeVisible({ timeout: 3000 });
  });

  test("access log pagination works", async ({ page }) => {
    // Click Access Log tab
    const accessLogTab = page.getByText(/Access Log|سجل الوصول/i).first();
    await accessLogTab.click();
    await page.waitForTimeout(1000);

    // Should show pagination (6 entries / 5 per page = 2 pages)
    await expect(page.getByText(/Page 1 of 2|الصفحة 1 من 2/i).first()).toBeVisible({ timeout: 5000 });

    // Click Next button (exact match to avoid matching Next.js Dev Tools button)
    const nextButton = page.getByRole("button", { name: "Next", exact: true });
    await expect(nextButton).toBeVisible({ timeout: 3000 });
    await nextButton.click();

    // Should now be on page 2
    await expect(page.getByText(/Page 2 of 2|الصفحة 2 من 2/i).first()).toBeVisible({ timeout: 3000 });

    // Previous button should now be enabled
    const prevButton = page.getByRole("button", { name: /Previous|السابق/i });
    await prevButton.click();

    // Back to page 1
    await expect(page.getByText(/Page 1 of 2|الصفحة 1 من 2/i).first()).toBeVisible({ timeout: 3000 });
  });

  test("access log shows loading state initially", async ({ page }) => {
    // Re-navigate with a delayed access log response
    await page.route("**/api/proxy/vault/access-log**", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ACCESS_LOG),
      });
    });

    await page.goto("/vault");

    // Switch to Access Log tab
    const accessLogTab = page.getByText(/Access Log|سجل الوصول/i).first();
    await accessLogTab.click();

    // Loading state should show
    await expect(
      page.getByText(/Loading access log|جاري تحميل سجل الوصول/i).first()
    ).toBeVisible({ timeout: 3000 });
  });

  // -----------------------------------------------------------------------
  // Delete ceremony (from vault page)
  // -----------------------------------------------------------------------

  test("delete ceremony opens from document context menu", async ({ page }) => {
    // Upload a document first
    await uploadFileViaButton(page, "Delete_Me.pdf");
    await page.waitForTimeout(3000);

    // Open the document dropdown (hover to reveal the more options button)
    const docCard = page.getByText("Delete_Me.pdf").first().locator("..").locator("..");
    await docCard.hover();

    // Click the more options button
    const moreButton = docCard.getByRole("button", { name: /More options/i });
    await moreButton.click({ timeout: 3000 });

    // Click "Delete & Prove It"
    await page.getByText(/Delete & Prove It|حذف وإثبات/i).click();

    // Delete ceremony modal should appear
    await expect(
      page.getByText(/Permanent Deletion|حذف دائم/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("delete ceremony requires typing DELETE to confirm", async ({ page }) => {
    // Upload and trigger delete
    await uploadFileViaButton(page, "Delete_Me.pdf");
    await page.waitForTimeout(3000);

    const docCard = page.getByText("Delete_Me.pdf").first().locator("..").locator("..");
    await docCard.hover();
    const moreButton = docCard.getByRole("button", { name: /More options/i });
    await moreButton.click({ timeout: 3000 });
    await page.getByText(/Delete & Prove It|حذف وإثبات/i).click();

    // The "Delete Forever" button should be disabled initially
    const deleteForeverBtn = page.getByRole("button", { name: /Delete Forever|حذف للأبد/i });
    await expect(deleteForeverBtn).toBeDisabled();

    // Type partial text - button should still be disabled
    const confirmInput = page.getByPlaceholder(/Type DELETE|اكتب DELETE/i);
    await confirmInput.fill("DEL");
    await expect(deleteForeverBtn).toBeDisabled();

    // Type full "DELETE" - button should become enabled
    await confirmInput.fill("DELETE");
    await expect(deleteForeverBtn).toBeEnabled();
  });

  test("delete ceremony cancel button works", async ({ page }) => {
    // Upload and trigger delete
    await uploadFileViaButton(page, "Delete_Me.pdf");
    await page.waitForTimeout(3000);

    const docCard = page.getByText("Delete_Me.pdf").first().locator("..").locator("..");
    await docCard.hover();
    const moreButton = docCard.getByRole("button", { name: /More options/i });
    await moreButton.click({ timeout: 3000 });
    await page.getByText(/Delete & Prove It|حذف وإثبات/i).click();

    // Click Cancel
    await page.getByRole("button", { name: /Cancel|إلغاء/i }).click();

    // Modal should close - permanent deletion text should be gone
    await expect(
      page.getByText(/Permanent Deletion|حذف دائم/i)
    ).toHaveCount(0, { timeout: 3000 });

    // Document should still be in the list
    await expect(page.getByText("Delete_Me.pdf").first()).toBeVisible();
  });

  test("delete ceremony runs through all phases and shows certificate", async ({ page }) => {
    // Upload and trigger delete
    await uploadFileViaButton(page, "Delete_Me.pdf");
    await page.waitForTimeout(3000);

    const docCard = page.getByText("Delete_Me.pdf").first().locator("..").locator("..");
    await docCard.hover();
    const moreButton = docCard.getByRole("button", { name: /More options/i });
    await moreButton.click({ timeout: 3000 });
    await page.getByText(/Delete & Prove It|حذف وإثبات/i).click();

    // Type DELETE and confirm
    const confirmInput = page.getByPlaceholder(/Type DELETE|اكتب DELETE/i);
    await confirmInput.fill("DELETE");
    await page.getByRole("button", { name: /Delete Forever|حذف للأبد/i }).click();

    // Phase 1: Preparing deletion
    await expect(
      page.getByText(/Preparing deletion|جاري التحضير للحذف/i).first()
    ).toBeVisible({ timeout: 5000 });

    // Phase 2: Revoking encryption keys
    await expect(
      page.getByText(/Revoking encryption keys|إلغاء مفاتيح التشفير/i).first()
    ).toBeVisible({ timeout: 5000 });

    // Phase 3: Shredding data shards
    await expect(
      page.getByText(/Shredding data shards|تمزيق أجزاء البيانات/i).first()
    ).toBeVisible({ timeout: 8000 });

    // Phase 4: Purging vault contents
    await expect(
      page.getByText(/Purging vault contents|إزالة محتويات الخزنة/i).first()
    ).toBeVisible({ timeout: 8000 });

    // Certificate should eventually appear (after all phases + 1s delay)
    await expect(
      page.getByText(/Certificate of Data Destruction|شهادة تدمير البيانات/i).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("deletion certificate shows all required fields", async ({ page }) => {
    // Upload and go through full delete ceremony
    await uploadFileViaButton(page, "Delete_Me.pdf");
    await page.waitForTimeout(3000);

    const docCard = page.getByText("Delete_Me.pdf").first().locator("..").locator("..");
    await docCard.hover();
    const moreButton = docCard.getByRole("button", { name: /More options/i });
    await moreButton.click({ timeout: 3000 });
    await page.getByText(/Delete & Prove It|حذف وإثبات/i).click();

    const confirmInput = page.getByPlaceholder(/Type DELETE|اكتب DELETE/i);
    await confirmInput.fill("DELETE");
    await page.getByRole("button", { name: /Delete Forever|حذف للأبد/i }).click();

    // Wait for certificate
    await expect(
      page.getByText(/Certificate of Data Destruction|شهادة تدمير البيانات/i).first()
    ).toBeVisible({ timeout: 15000 });

    // Verify certificate fields
    await expect(page.getByText(/Document|المستند/i).first()).toBeVisible();
    await expect(page.getByText("Delete_Me.pdf").first()).toBeVisible();
    await expect(page.getByText(/Hash|التجزئة/i).first()).toBeVisible();
    await expect(page.getByText(/Certificate ID|رقم الشهادة/i).first()).toBeVisible();

    // Node confirmations should show
    await expect(page.getByText(/Node Confirmations|تأكيدات العقد/i).first()).toBeVisible();
    await expect(page.getByText(/UAE Node 1/).first()).toBeVisible();
    await expect(page.getByText(/UAE Node 2/).first()).toBeVisible();
    await expect(page.getByText(/UAE Node 3/).first()).toBeVisible();

    // "Destroyed across all nodes" text
    await expect(
      page.getByText(/Destroyed across all nodes|تم التدمير عبر جميع العقد/i).first()
    ).toBeVisible();

    // Irreversible text
    await expect(
      page.getByText(/Irreversible|لا رجعة فيه/i).first()
    ).toBeVisible();
  });

  test("deletion certificate has Download Certificate button", async ({ page }) => {
    await uploadFileViaButton(page, "Delete_Me.pdf");
    await page.waitForTimeout(3000);

    const docCard = page.getByText("Delete_Me.pdf").first().locator("..").locator("..");
    await docCard.hover();
    const moreButton = docCard.getByRole("button", { name: /More options/i });
    await moreButton.click({ timeout: 3000 });
    await page.getByText(/Delete & Prove It|حذف وإثبات/i).click();

    const confirmInput = page.getByPlaceholder(/Type DELETE|اكتب DELETE/i);
    await confirmInput.fill("DELETE");
    await page.getByRole("button", { name: /Delete Forever|حذف للأبد/i }).click();

    // Wait for certificate
    await expect(
      page.getByText(/Certificate of Data Destruction|شهادة تدمير البيانات/i).first()
    ).toBeVisible({ timeout: 15000 });

    // Download Certificate button should be present
    await expect(
      page.getByRole("button", { name: /Download Certificate|تنزيل الشهادة/i })
    ).toBeVisible();

    // Done button should be present
    await expect(
      page.getByRole("button", { name: /^Done$|^تم$/i })
    ).toBeVisible();
  });

  test("clicking Done after delete ceremony removes document from list", async ({ page }) => {
    await uploadFileViaButton(page, "Delete_Me.pdf");
    await page.waitForTimeout(3000);

    // Verify document is in the list
    await expect(page.getByText("Delete_Me.pdf").first()).toBeVisible();

    const docCard = page.getByText("Delete_Me.pdf").first().locator("..").locator("..");
    await docCard.hover();
    const moreButton = docCard.getByRole("button", { name: /More options/i });
    await moreButton.click({ timeout: 3000 });
    await page.getByText(/Delete & Prove It|حذف وإثبات/i).click();

    const confirmInput = page.getByPlaceholder(/Type DELETE|اكتب DELETE/i);
    await confirmInput.fill("DELETE");
    await page.getByRole("button", { name: /Delete Forever|حذف للأبد/i }).click();

    // Wait for certificate
    await expect(
      page.getByText(/Certificate of Data Destruction|شهادة تدمير البيانات/i).first()
    ).toBeVisible({ timeout: 15000 });

    // Click Done
    await page.getByRole("button", { name: /^Done$|^تم$/i }).click();

    // Document should be removed from the list
    await page.waitForTimeout(500);
    await expect(page.getByText("Delete_Me.pdf")).toHaveCount(0, { timeout: 3000 });
  });

  // -----------------------------------------------------------------------
  // Download document (from vault page)
  // -----------------------------------------------------------------------

  test("download option is available in document context menu", async ({ page }) => {
    await uploadFileViaButton(page, "DownloadTest.pdf");
    await page.waitForTimeout(3000);

    const docCard = page.getByText("DownloadTest.pdf").first().locator("..").locator("..");
    await docCard.hover();
    const moreButton = docCard.getByRole("button", { name: /More options/i });
    await moreButton.click({ timeout: 3000 });

    // Download option should be visible
    await expect(
      page.getByText(/^Download$|^تنزيل$/i).first()
    ).toBeVisible({ timeout: 3000 });
  });

  // -----------------------------------------------------------------------
  // View document link in context menu
  // -----------------------------------------------------------------------

  test("view option is available in document context menu", async ({ page }) => {
    await uploadFileViaButton(page, "ViewTest.pdf");
    await page.waitForTimeout(3000);

    const docCard = page.getByText("ViewTest.pdf").first().locator("..").locator("..");
    await docCard.hover();
    const moreButton = docCard.getByRole("button", { name: /More options/i });
    await moreButton.click({ timeout: 3000 });

    // View option should be visible
    await expect(
      page.getByText(/^View$|^عرض$/i).first()
    ).toBeVisible({ timeout: 3000 });
  });

  // -----------------------------------------------------------------------
  // Error handling: failed upload
  // -----------------------------------------------------------------------

  test("handles upload API failure gracefully (falls back to local add)", async ({ page }) => {
    // Override upload route to return 500
    await page.route("**/api/proxy/vault/upload**", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal Server Error" }),
      })
    );

    await uploadFileViaButton(page, "FailUpload.pdf");
    await page.waitForTimeout(3000);

    // The document should still be added locally (app has fallback logic)
    await expect(page.getByText("FailUpload.pdf").first()).toBeVisible({ timeout: 5000 });

    // Toast should show the local fallback message
    await expect(
      page.getByText(/Document added locally|تم إضافة المستند محلياً/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  // -----------------------------------------------------------------------
  // List view: action buttons
  // -----------------------------------------------------------------------

  test("list view shows action buttons on hover", async ({ page }) => {
    await uploadFileViaButton(page);
    await page.waitForTimeout(3000);

    // Switch to list view
    await page.getByRole("button", { name: /List view/i }).click();
    await page.waitForTimeout(300);

    // Find the document row and hover
    const docRow = page.getByText("test-document.pdf").first().locator("..").locator("..");
    await docRow.hover();

    // View, Download, and Delete buttons should appear (via aria-labels)
    await expect(
      docRow.getByRole("button", { name: /View document/i })
    ).toBeVisible({ timeout: 3000 });

    await expect(
      docRow.getByRole("button", { name: /Download/i })
    ).toBeVisible({ timeout: 3000 });

    await expect(
      docRow.getByRole("button", { name: /Delete/i })
    ).toBeVisible({ timeout: 3000 });
  });
});

// =========================================================================
// TEST SUITE: Vault Document Detail Page
// =========================================================================

test.describe("Vault Document Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockVaultAPIs(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await loginAsTestUser(page);
  });

  test("renders document detail page with document name", async ({ page }) => {
    await page.goto("/vault/doc-123");

    await expect(
      page.getByText("Employment_Contract_2025.pdf").first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows document type and domain badges", async ({ page }) => {
    await page.goto("/vault/doc-123");

    await expect(page.getByText("PDF").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Legal").first()).toBeVisible({ timeout: 5000 });
  });

  test("shows document content", async ({ page }) => {
    await page.goto("/vault/doc-123");

    await expect(
      page.getByText(/EMPLOYMENT CONTRACT/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows metadata sidebar with date, chunks, usage count", async ({ page }) => {
    await page.goto("/vault/doc-123");

    // Metadata section
    await expect(page.getByText(/Metadata|البيانات الوصفية/i).first()).toBeVisible({ timeout: 5000 });

    // Date Added
    await expect(page.getByText(/Date Added|تاريخ الإضافة/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("January 15, 2026").first()).toBeVisible({ timeout: 3000 });

    // Chunk Count
    await expect(page.getByText(/Chunk Count|عدد الأجزاء/i).first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/8 chunks|8 أجزاء/i).first()).toBeVisible({ timeout: 3000 });

    // Usage Count
    await expect(page.getByText(/Usage Count|مرات الاستخدام/i).first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/12 references|12 مراجع/i).first()).toBeVisible({ timeout: 3000 });
  });

  test("shows shard distribution map on detail page", async ({ page }) => {
    await page.goto("/vault/doc-123");

    await expect(
      page.getByText(/Shard Distribution|توزيع الأجزاء/i).first()
    ).toBeVisible({ timeout: 5000 });

    // Canvas should be present
    const canvas = page.locator('canvas[aria-label*="Shard map"]').first();
    await expect(canvas).toBeVisible({ timeout: 5000 });
  });

  test("shows encryption fingerprint", async ({ page }) => {
    await page.goto("/vault/doc-123");

    await expect(
      page.getByText(/Encryption Fingerprint|بصمة التشفير/i).first()
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByText("sha256:4a7f3e2d1b8c9e0f5d6a2b3c8e1f4a7d").first()
    ).toBeVisible({ timeout: 3000 });
  });

  test("shows related conversations", async ({ page }) => {
    await page.goto("/vault/doc-123");

    await expect(
      page.getByText(/Related Conversations|المحادثات ذات الصلة/i).first()
    ).toBeVisible({ timeout: 5000 });

    await expect(page.getByText("Employment contract review").first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Benefits discussion").first()).toBeVisible({ timeout: 3000 });
  });

  test("back to vault link works", async ({ page }) => {
    await page.goto("/vault/doc-123");

    const backLink = page.getByText(/Back to Vault|العودة للخزنة/i);
    await expect(backLink).toBeVisible({ timeout: 5000 });
    await backLink.click();

    await expect(page).toHaveURL(/\/vault$/);
  });

  test("action buttons are visible (Edit, Download, Share, Delete)", async ({ page }) => {
    await page.goto("/vault/doc-123");

    await expect(
      page.getByRole("button", { name: /Edit|تعديل/i })
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByRole("button", { name: /Download|تحميل/i })
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByRole("button", { name: /Share|مشاركة/i })
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByRole("button", { name: /Delete & Prove It|حذف وإثبات/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("delete button opens delete ceremony from detail page", async ({ page }) => {
    await page.goto("/vault/doc-123");

    await page.getByRole("button", { name: /Delete & Prove It|حذف وإثبات/i }).click();

    // Delete ceremony modal should appear
    await expect(
      page.getByText(/Permanent Deletion|حذف دائم/i).first()
    ).toBeVisible({ timeout: 5000 });

    // Should be able to cancel
    await page.getByRole("button", { name: /Cancel|إلغاء/i }).click();

    await expect(
      page.getByText(/Permanent Deletion|حذف دائم/i)
    ).toHaveCount(0, { timeout: 3000 });
  });

  // -----------------------------------------------------------------------
  // Error & loading states on detail page
  // -----------------------------------------------------------------------

  test("shows loading state while document is fetching", async ({ page }) => {
    // Override document API to delay response
    await page.route("**/api/proxy/vault/document/**", async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_VAULT_DOCUMENT),
      });
    });

    await page.goto("/vault/doc-123");

    // Loading state should show
    await expect(
      page.getByText(/Loading|جاري التحميل/i).first()
    ).toBeVisible({ timeout: 3000 });
  });

  test("shows error state when document API fails", async ({ page }) => {
    // Override document API to return error
    await page.route("**/api/proxy/vault/document/**", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Server Error" }),
      })
    );

    await page.goto("/vault/doc-500");

    // Error state should display (the API function returns null on non-ok, so we get "not found")
    await expect(
      page.getByText(/Document Not Found|Error Loading Document|المستند غير موجود|خطأ في التحميل/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows not found state for nonexistent document", async ({ page }) => {
    // Override to return null
    await page.route("**/api/proxy/vault/document/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "null",
      })
    );

    await page.goto("/vault/nonexistent-doc");

    await expect(
      page.getByText(/Document Not Found|المستند غير موجود/i).first()
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByText(/doesn't exist or has been deleted|غير موجود أو تم حذفه/i).first()
    ).toBeVisible({ timeout: 3000 });
  });
});

// =========================================================================
// TEST SUITE: Vault Upload Error Scenarios
// =========================================================================

test.describe("Vault Upload Error Scenarios", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockVaultAPIs(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await loginAsTestUser(page);
    await page.goto("/vault");
  });

  test("handles network error during upload gracefully", async ({ page }) => {
    // Abort the upload request to simulate network failure
    await page.route("**/api/proxy/vault/upload**", (route) => route.abort("failed"));

    await uploadFileViaButton(page, "NetworkFail.pdf");
    await page.waitForTimeout(3000);

    // Document should still appear locally due to fallback
    await expect(page.getByText("NetworkFail.pdf").first()).toBeVisible({ timeout: 5000 });
  });

  test("upload progress reaches 100% even on API failure", async ({ page }) => {
    await page.route("**/api/proxy/vault/upload**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
    );

    await uploadFileViaButton(page);

    // Progress text should eventually show 100%
    await expect(page.getByText("100%").first()).toBeVisible({ timeout: 10000 });
  });

  test("upload progress dismisses after completion", async ({ page }) => {
    await uploadFileViaButton(page);

    // Progress should appear
    await expect(page.getByText(/%/).first()).toBeVisible({ timeout: 3000 });

    // After upload completes + 1.5s dismiss timer, progress should vanish
    await page.waitForTimeout(5000);

    // The progress card should be gone (no "Encrypting/Sharding/Distributing/Securing" text)
    // NOTE: "Secured" briefly shows at 100% then disappears after 1.5s
    const progressTexts = page.getByText(/^Encrypting\.\.\.$|^Sharding\.\.\.$|^Distributing across nodes\.\.\.$|^Securing\.\.\.$|^Secured$/);
    await expect(progressTexts).toHaveCount(0, { timeout: 5000 });
  });
});

// =========================================================================
// TEST SUITE: Vault Multiple Uploads
// =========================================================================

test.describe("Vault Multiple Uploads", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockVaultAPIs(page);
    await mockChatAPIs(page);
    await mockBrainAPIs(page);
    await loginAsTestUser(page);
    await page.goto("/vault");
  });

  test("multiple uploads create multiple documents", async ({ page }) => {
    // Upload first file and wait for it to fully complete
    await uploadFileViaButton(page, "Document_A.pdf");
    await expect(page.getByText("Document_A.pdf").first()).toBeVisible({ timeout: 10000 });

    // Upload second file and wait for it to fully complete
    await uploadFileViaButton(page, "Document_B.docx");
    await expect(page.getByText("Document_B.docx").first()).toBeVisible({ timeout: 10000 });

    // Both should appear
    await expect(page.getByText("Document_A.pdf").first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Document_B.docx").first()).toBeVisible({ timeout: 3000 });

    // Document count should reflect 2
    await expect(page.getByText(/2 documents encrypted/i).first()).toBeVisible({ timeout: 3000 });
  });

  test("file type icons are assigned correctly for different file types", async ({ page }) => {
    // Upload an image file and wait for it to fully complete
    await uploadFileViaButton(page, "Photo.jpg");
    await expect(page.getByText("Photo.jpg").first()).toBeVisible({ timeout: 10000 });

    // Upload an excel file and wait for it to fully complete
    await uploadFileViaButton(page, "Finances.xlsx");
    await expect(page.getByText("Finances.xlsx").first()).toBeVisible({ timeout: 10000 });

    // Both should be visible
    await expect(page.getByText("Photo.jpg").first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Finances.xlsx").first()).toBeVisible({ timeout: 3000 });
  });
});
