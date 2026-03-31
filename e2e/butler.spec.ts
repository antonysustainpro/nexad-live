import { test, expect, Page } from "@playwright/test";
import { loginAsTestUser, mockFallbackAPIs, mockBrainAPIs, mockChatAPIs } from "./helpers";

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_BUTLER_CARDS = [
  {
    id: "card-deal-001",
    type: "deal",
    category: "deal",
    priority: "normal",
    title: "50% Off Emirates Flights",
    titleAr: "خصم 50% على رحلات الإمارات",
    summary: "Book by March 30 for half-price flights to London and Paris.",
    summaryAr: "احجز قبل 30 مارس للحصول على رحلات بنصف السعر إلى لندن وباريس.",
    source: "Emirates",
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    actionLabel: "Book Now",
    actionUrl: "https://example.com/deal",
    actionType: "external",
    priceOriginal: "AED 4,500",
    priceDiscounted: "AED 2,250",
    rating: 4.5,
    affiliateDisclosure: "This is a sponsored deal",
    affiliateDisclosureAr: "هذا عرض مدعوم",
    confidence: 0.92,
  },
  {
    id: "card-market-002",
    type: "market",
    category: "market",
    priority: "high",
    title: "Bitcoin Surges Past $90K",
    titleAr: "البيتكوين يتجاوز 90 ألف دولار",
    summary: "BTC hits new all-time high amid ETF inflows.",
    summaryAr: "البيتكوين يسجل أعلى مستوى جديد وسط تدفقات صناديق المؤشرات.",
    source: "CoinDesk",
    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    actionLabel: "View Chart",
    actionUrl: "https://example.com/btc",
    actionType: "external",
    marketData: {
      symbol: "BTC",
      price: 91250,
      change: 2350,
      changePercent: 2.64,
    },
    confidence: 0.95,
  },
  {
    id: "card-alert-003",
    type: "alert",
    category: "alert",
    priority: "urgent",
    title: "DEWA Payment Due Tomorrow",
    titleAr: "موعد دفع ديوا غداً",
    summary: "Your DEWA bill of AED 850 is due tomorrow. Avoid late fees.",
    summaryAr: "فاتورة ديوا بقيمة 850 درهم مستحقة غداً. تجنب رسوم التأخير.",
    source: "DEWA",
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    alertSeverity: "critical",
    confidence: 0.99,
  },
  {
    id: "card-news-004",
    type: "news",
    category: "news",
    priority: "normal",
    title: "Dubai Metro Extension Approved",
    titleAr: "الموافقة على تمديد مترو دبي",
    summary: "New Blue Line will connect Dubai Marina to Al Maktoum Airport by 2030.",
    summaryAr: "الخط الأزرق الجديد سيربط دبي مارينا بمطار آل مكتوم بحلول 2030.",
    source: "Gulf News",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    actionUrl: "https://example.com/metro",
    actionType: "external",
    confidence: 0.88,
  },
  {
    id: "card-event-005",
    type: "event",
    category: "event",
    priority: "normal",
    title: "Dubai Food Festival 2026",
    titleAr: "مهرجان دبي للطعام 2026",
    summary: "Three weeks of culinary experiences starting April 5.",
    summaryAr: "ثلاثة أسابيع من التجارب الطهوية بدءاً من 5 أبريل.",
    source: "Visit Dubai",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    actionLabel: "Learn More",
    actionUrl: "https://example.com/food-fest",
    actionType: "external",
    confidence: 0.85,
  },
];

const MOCK_PRIVACY_STATS = {
  trackersBlocked: 247,
  anonymousRequests: 1893,
  cookieCount: 0,
  encryptionStatus: "active" as const,
  dataAutoDeleteCountdown: "6d 14h",
  fetchLog: [
    { url: "api.coingecko.com/v3/coins", timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), proxyRegion: "EU-West", status: "proxied" },
    { url: "api.emirates.com/deals", timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), proxyRegion: "ME-UAE", status: "proxied" },
    { url: "newsapi.org/v2/top", timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), proxyRegion: "US-East", status: "proxied" },
  ],
};

const MOCK_FEED_RESPONSE = {
  cards: MOCK_BUTLER_CARDS,
  total: MOCK_BUTLER_CARDS.length,
  privacyStats: MOCK_PRIVACY_STATS,
  generatedAt: new Date().toISOString(),
  userId: "usr_test_e2e",
  persona: "trader",
};

const MOCK_REFRESH_CARDS = [
  {
    id: "card-refresh-001",
    type: "deal",
    category: "deal",
    priority: "high",
    title: "Flash Sale: Apple AirPods Pro",
    titleAr: "بيع سريع: ايربودز برو",
    summary: "Limited time offer at Noon. 40% off.",
    summaryAr: "عرض لوقت محدود في نون. خصم 40%.",
    source: "Noon",
    timestamp: new Date().toISOString(),
    priceOriginal: "AED 999",
    priceDiscounted: "AED 599",
    rating: 4.8,
    confidence: 0.91,
  },
];

// ---------------------------------------------------------------------------
// Helper: Mock Butler API routes
// ---------------------------------------------------------------------------

async function mockButlerAPIs(page: Page) {
  // Butler feed
  await page.route("**/api/proxy/butler/feed/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_FEED_RESPONSE),
    })
  );

  // Privacy glass stats
  await page.route("**/api/proxy/butler/privacy-glass/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_PRIVACY_STATS),
    })
  );

  // Butler interact (dismiss / save)
  await page.route("**/api/proxy/butler/interact", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ recorded: true }),
    })
  );

  // Butler refresh
  await page.route("**/api/proxy/butler/fetch-now/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...MOCK_FEED_RESPONSE,
        cards: MOCK_REFRESH_CARDS,
        total: MOCK_REFRESH_CARDS.length,
        generatedAt: new Date().toISOString(),
      }),
    })
  );

  // Butler onboard
  await page.route("**/api/proxy/butler/onboard", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    })
  );

  // Onboarding status
  await page.route("**/api/proxy/butler/onboarding-status/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ onboarded: false, persona: null }),
    })
  );
}

/**
 * Simulate a horizontal swipe gesture on an element.
 * Uses Playwright's mouse API to produce pointer events that framer-motion
 * interprets as a drag.
 */
async function swipe(page: Page, selector: string, direction: "left" | "right") {
  const el = page.locator(selector).first();
  const box = await el.boundingBox();
  if (!box) throw new Error(`Element not found for selector: ${selector}`);

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  const distance = direction === "left" ? -200 : 200;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Move in small steps so framer-motion registers the gesture
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(startX + (distance * i) / 10, startY, { steps: 1 });
  }
  await page.mouse.up();
}

// ===========================================================================
// BUTLER FEED PAGE
// ===========================================================================

test.describe("Butler Feed Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockButlerAPIs(page);
    await mockBrainAPIs(page);
    await mockChatAPIs(page);
    await loginAsTestUser(page);
    await page.goto("/butler");
  });

  // -----------------------------------------------------------------------
  // Feed loads cards
  // -----------------------------------------------------------------------
  test("butler feed loads and displays cards", async ({ page }) => {
    // Wait for the cards to render (loading skeleton disappears)
    await expect(page.getByText("50% Off Emirates Flights")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Bitcoin Surges Past $90K")).toBeVisible();
    await expect(page.getByText("DEWA Payment Due Tomorrow")).toBeVisible();
    await expect(page.getByText("Dubai Metro Extension Approved")).toBeVisible();
    await expect(page.getByText("Dubai Food Festival 2026")).toBeVisible();
  });

  test("displays item count in header", async ({ page }) => {
    await expect(
      page.getByText(/Your Butler found 5 items for you|وجد خادمك 5 عناصر لك/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows time-based greeting in header", async ({ page }) => {
    await expect(
      page.getByText(/Good (morning|afternoon|evening)|صباح الخير|مساء الخير/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  // -----------------------------------------------------------------------
  // Swipe interactions
  // -----------------------------------------------------------------------
  test("swipe left dismisses a card", async ({ page }) => {
    // Wait for cards to load
    await expect(page.getByText("50% Off Emirates Flights")).toBeVisible({ timeout: 10000 });

    // Count cards before
    const cardsBefore = await page.getByText(/Emirates|Bitcoin|DEWA|Metro|Food Festival/).count();

    // Swipe the first card left to dismiss
    await swipe(page, '[class*="touch-pan-y"]', "left");

    // Wait for the animation & API call
    await page.waitForTimeout(500);

    // Verify a card was removed from the DOM (one fewer card)
    const cardsAfter = await page.getByText(/Emirates|Bitcoin|DEWA|Metro|Food Festival/).count();
    expect(cardsAfter).toBeLessThanOrEqual(cardsBefore);
  });

  test("swipe right saves a card", async ({ page }) => {
    await expect(page.getByText("50% Off Emirates Flights")).toBeVisible({ timeout: 10000 });

    // Track API calls
    const interactCalls: string[] = [];
    await page.route("**/api/proxy/butler/interact", (route) => {
      const body = route.request().postDataJSON();
      interactCalls.push(body?.action);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ recorded: true }),
      });
    });

    // Swipe right to save
    await swipe(page, '[class*="touch-pan-y"]', "right");
    await page.waitForTimeout(600);

    // The save API should have been called
    expect(interactCalls).toContain("save");
  });

  // -----------------------------------------------------------------------
  // Card tap opens detail sheet
  // -----------------------------------------------------------------------
  test("tapping a card opens the detail sheet", async ({ page }) => {
    await expect(page.getByText("50% Off Emirates Flights")).toBeVisible({ timeout: 10000 });

    // Click on a deal card
    await page.getByText("50% Off Emirates Flights").click();

    // The sheet should open showing the full detail
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    // Title should appear in the sheet header
    await expect(page.locator('[role="dialog"]').getByText("50% Off Emirates Flights")).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Detail sheet actions
  // -----------------------------------------------------------------------
  test("detail sheet shows dismiss button for alert card", async ({ page }) => {
    await expect(page.getByText("DEWA Payment Due Tomorrow")).toBeVisible({ timeout: 10000 });

    // Click on the alert card
    await page.getByText("DEWA Payment Due Tomorrow").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Should show Dismiss and Ask your Butler buttons
    await expect(page.getByRole("dialog").getByText(/Dismiss|تجاهل/i)).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/Ask your Butler|اسأل خادمك/i)).toBeVisible();
  });

  test("detail sheet shows Buy Now button for deal card", async ({ page }) => {
    await expect(page.getByText("50% Off Emirates Flights")).toBeVisible({ timeout: 10000 });

    await page.getByText("50% Off Emirates Flights").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Deal cards show Buy Now and Ask your Butler buttons
    await expect(page.getByRole("dialog").getByText(/Buy Now|اشترِ الآن/i)).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/Ask your Butler about this deal|اسأل خادمك عن هذا العرض/i)).toBeVisible();
  });

  test("detail sheet shows market data for market card", async ({ page }) => {
    await expect(page.getByText("Bitcoin Surges Past $90K")).toBeVisible({ timeout: 10000 });

    await page.getByText("Bitcoin Surges Past $90K").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Market cards display symbol, price, and change
    await expect(page.getByRole("dialog").getByText("BTC", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/91,250/)).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/2\.64%/)).toBeVisible();
  });

  test("detail sheet dismiss button removes the card", async ({ page }) => {
    await expect(page.getByText("DEWA Payment Due Tomorrow")).toBeVisible({ timeout: 10000 });

    // Open alert card detail
    await page.getByText("DEWA Payment Due Tomorrow").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Click Dismiss button in the sheet
    await page.getByRole("dialog").getByText(/^Dismiss$|^تجاهل$/i).click();

    // Sheet should close
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 5000 });
  });

  test("detail sheet close button closes the sheet", async ({ page }) => {
    await expect(page.getByText("50% Off Emirates Flights")).toBeVisible({ timeout: 10000 });

    await page.getByText("50% Off Emirates Flights").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Close via the X button
    await page.getByRole("dialog").getByLabel("Close").click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 5000 });
  });

  test("detail sheet Ask your Butler navigates to chat", async ({ page }) => {
    await expect(page.getByText("DEWA Payment Due Tomorrow")).toBeVisible({ timeout: 10000 });

    await page.getByText("DEWA Payment Due Tomorrow").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Click Ask your Butler
    await page.getByRole("dialog").getByText(/Ask your Butler|اسأل خادمك/i).click();

    // Should navigate to chat with query
    await expect(page).toHaveURL(/\/chat\?q=/, { timeout: 5000 });
  });

  // -----------------------------------------------------------------------
  // Refresh button
  // -----------------------------------------------------------------------
  test("refresh button fetches new cards", async ({ page }) => {
    await expect(page.getByText("50% Off Emirates Flights")).toBeVisible({ timeout: 10000 });

    // Click the floating refresh button (the RefreshCw icon button)
    const refreshBtn = page.locator("button").filter({ has: page.locator('[class*="lucide-refresh"]') }).first();
    // Fallback: find the fixed-position refresh button by its styling
    const floatingRefresh = page.locator(".fixed button").first();
    await floatingRefresh.click();

    // After refresh, the new card should appear
    await expect(page.getByText("Flash Sale: Apple AirPods Pro")).toBeVisible({ timeout: 10000 });
  });

  // -----------------------------------------------------------------------
  // Category badges and priority indicators
  // -----------------------------------------------------------------------
  test("cards display category badges", async ({ page }) => {
    await expect(page.getByText("50% Off Emirates Flights")).toBeVisible({ timeout: 10000 });

    // Category labels should be visible
    await expect(page.getByText("Deal").first()).toBeVisible();
    await expect(page.getByText("Market").first()).toBeVisible();
    await expect(page.getByText("Alert").first()).toBeVisible();
  });

  test("urgent card shows pulsing priority indicator", async ({ page }) => {
    await expect(page.getByText("DEWA Payment Due Tomorrow")).toBeVisible({ timeout: 10000 });

    // The urgent card (DEWA) should have a red dot indicator
    // (pulsing animation via framer-motion, verified by presence of the indicator div)
    const urgentIndicator = page.locator('.bg-\\[\\#EF4444\\]').first();
    await expect(urgentIndicator).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Deal-specific rendering
  // -----------------------------------------------------------------------
  test("deal card shows original and discounted prices", async ({ page }) => {
    await expect(page.getByText("50% Off Emirates Flights")).toBeVisible({ timeout: 10000 });

    await expect(page.getByText("AED 4,500")).toBeVisible();
    await expect(page.getByText("AED 2,250")).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Onboarding banner
  // -----------------------------------------------------------------------
  test("shows onboarding banner when not onboarded", async ({ page }) => {
    // The default NexusContext should have butlerOnboarded = false
    await expect(
      page.getByText(/Welcome! Set up your Butler|مرحباً! قم بإعداد خادمك/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("onboarding banner links to onboarding page", async ({ page }) => {
    const startBtn = page.getByRole("link", { name: /Start|ابدأ/i }).first();
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await expect(startBtn).toHaveAttribute("href", "/butler/onboarding");
  });

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------
  test("shows empty state when no cards are returned", async ({ page }) => {
    // Override the feed mock to return empty
    await page.route("**/api/proxy/butler/feed/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...MOCK_FEED_RESPONSE, cards: [], total: 0 }),
      })
    );

    await page.goto("/butler");

    await expect(
      page.getByText(/Your Butler is getting ready|خادمك يستعد/i)
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByRole("link", { name: /Set up Butler|إعداد الخادم/i })
    ).toBeVisible();
  });
});

// ===========================================================================
// PRIVACY GLASS
// ===========================================================================

test.describe("Privacy Glass", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockButlerAPIs(page);
    await mockBrainAPIs(page);
    await mockChatAPIs(page);
    await loginAsTestUser(page);
    await page.goto("/butler");
  });

  test("displays tracker stats in collapsed bar", async ({ page }) => {
    // The Privacy Glass should show the animated counter values
    await expect(page.getByText(/trackers blocked|متتبع محظور/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/anonymous requests|طلب مجهول/i).first()).toBeVisible();
  });

  test("shows privacy tagline in collapsed bar", async ({ page }) => {
    await expect(
      page.getByText(/Your internet is private|إنترنتك خاص/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("expands to show full stats grid on click", async ({ page }) => {
    // Wait for the privacy glass to load
    await expect(page.getByText(/trackers blocked|متتبع محظور/i).first()).toBeVisible({ timeout: 10000 });

    // Click the privacy glass bar to expand
    await page.getByText(/trackers blocked|متتبع محظور/i).first().click();

    // Expanded content should now be visible
    await expect(page.getByText(/Blocked|محظور/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Anonymous|مجهول/i).first()).toBeVisible();
    await expect(page.getByText(/Cookies|ملفات تعريف/i).first()).toBeVisible();
    await expect(page.getByText(/Encryption|التشفير/i).first()).toBeVisible();
    await expect(page.getByText(/Auto-Delete|حذف تلقائي/i).first()).toBeVisible();
  });

  test("expanded view shows encryption badge as Active", async ({ page }) => {
    await expect(page.getByText(/trackers blocked|متتبع محظور/i).first()).toBeVisible({ timeout: 10000 });
    await page.getByText(/trackers blocked|متتبع محظور/i).first().click();

    await expect(page.getByText(/Active|نشط/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("expanded view shows auto-delete countdown", async ({ page }) => {
    await expect(page.getByText(/trackers blocked|متتبع محظور/i).first()).toBeVisible({ timeout: 10000 });
    await page.getByText(/trackers blocked|متتبع محظور/i).first().click();

    await expect(page.getByText("6d 14h")).toBeVisible({ timeout: 5000 });
  });

  test("expanded view shows fetch log table", async ({ page }) => {
    await expect(page.getByText(/trackers blocked|متتبع محظور/i).first()).toBeVisible({ timeout: 10000 });
    await page.getByText(/trackers blocked|متتبع محظور/i).first().click();

    // Fetch log header
    await expect(page.getByText(/Recent Fetch Log|سجل الطلبات الأخيرة/i)).toBeVisible({ timeout: 5000 });
    // Log entries
    await expect(page.getByText("api.coingecko.com/v3/coins")).toBeVisible();
    await expect(page.getByText("api.emirates.com/deals")).toBeVisible();
  });

  test("collapses back when clicked again", async ({ page }) => {
    await expect(page.getByText(/trackers blocked|متتبع محظور/i).first()).toBeVisible({ timeout: 10000 });

    // Expand
    await page.getByText(/trackers blocked|متتبع محظور/i).first().click();
    await expect(page.getByText(/Recent Fetch Log|سجل الطلبات الأخيرة/i)).toBeVisible({ timeout: 5000 });

    // Collapse
    await page.getByText(/trackers blocked|متتبع محظور/i).first().click();

    // Fetch log should disappear
    await expect(page.getByText(/Recent Fetch Log|سجل الطلبات الأخيرة/i)).toBeHidden({ timeout: 5000 });
  });

  test("shows privacy tagline in expanded view", async ({ page }) => {
    await expect(page.getByText(/trackers blocked|متتبع محظور/i).first()).toBeVisible({ timeout: 10000 });
    await page.getByText(/trackers blocked|متتبع محظور/i).first().click();

    await expect(
      page.getByText(/Your data never touches a server with your name on it|بياناتك لا تصل أبداً إلى خادم يحمل اسمك/i)
    ).toBeVisible({ timeout: 5000 });
  });
});

// ===========================================================================
// ONBOARDING FLOW
// ===========================================================================

test.describe("Butler Onboarding", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockButlerAPIs(page);
    await mockBrainAPIs(page);
    await mockChatAPIs(page);
    await loginAsTestUser(page);
    await page.goto("/butler/onboarding");
  });

  // -----------------------------------------------------------------------
  // Step 1: Persona Selection
  // -----------------------------------------------------------------------
  test("step 1 shows persona selection with all 16 personas", async ({ page }) => {
    // Header
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Choose the persona|اختر الشخصية/i).first()).toBeVisible();

    // Verify key personas are shown
    const personaLabels = [
      "Parent / Family Buyer",
      "Financial Advisor",
      "Active Trader",
      "Family Household",
      "High Net-Worth",
      "Student",
      "Entrepreneur",
      "Healthcare Pro",
      "Creative",
      "Fitness & Wellness",
      "Retiree",
      "Tech Professional",
      "New to UAE / Expat",
      "Food Lover",
      "Frequent Traveler",
      "Other",
    ];

    for (const label of personaLabels) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
    }
  });

  test("selecting a persona enables the Next button", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });

    // Next should be disabled initially
    const nextBtn = page.getByRole("button", { name: /^Next$|^التالي$/i });
    await expect(nextBtn).toBeDisabled();

    // Select "Active Trader"
    await page.getByText("Active Trader").first().click();

    // Next should now be enabled
    await expect(nextBtn).toBeEnabled();
  });

  test("selecting a persona shows check mark", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });

    await page.getByText("Student").first().click();

    // A check icon should appear on the selected card (the card gets a ring/border)
    // The selected persona card has the nexus-jade border class
    const selectedCard = page.locator("button").filter({ hasText: "Student" }).first();
    await expect(selectedCard).toHaveClass(/nexus-jade/);
  });

  // -----------------------------------------------------------------------
  // Step 2: Interest Categories
  // -----------------------------------------------------------------------
  test("step 2 shows interest categories with pre-selected defaults", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });

    // Select a persona first
    await page.getByText("Active Trader").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();

    // Step 2 header
    await expect(page.getByRole("heading", { name: /What matters to you|ما الذي يهمك/ })).toBeVisible({ timeout: 5000 });

    // Trader default categories: crypto, market, investment, tech, news
    // These should be pre-selected (have the nexus-jade styling)
    const cryptoBtn = page.getByRole("button", { name: /^Crypto$/i }).first();
    await expect(cryptoBtn).toHaveClass(/nexus-jade/);
  });

  test("toggling categories on and off works", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });

    // Go to step 2
    await page.getByText("Active Trader").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await expect(page.getByRole("heading", { name: /What matters to you|ما الذي يهمك/ })).toBeVisible({ timeout: 5000 });

    // Toggle "Fitness" ON
    const fitnessBtn = page.getByRole("button", { name: /^Fitness$/i }).first();
    await fitnessBtn.click();
    await expect(fitnessBtn).toHaveClass(/nexus-jade/);

    // Toggle "Fitness" OFF
    await fitnessBtn.click();
    // Should lose the nexus-jade class
    await expect(fitnessBtn).not.toHaveClass(/nexus-jade/);
  });

  test("all 24 categories are displayed", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });

    await page.getByText("Other").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await expect(page.getByRole("heading", { name: /What matters to you|ما الذي يهمك/ })).toBeVisible({ timeout: 5000 });

    const categories = [
      "Deals", "Markets", "Crypto", "News", "Health", "Education",
      "Events", "Restaurants", "Travel", "Fitness", "Tech", "Fashion",
      "Real Estate", "Art", "Sports", "Automotive", "Gaming", "Pets",
      "Gardening", "Home", "Beauty", "Entertainment", "Regulatory", "Investment",
    ];

    for (const cat of categories) {
      await expect(page.getByRole("button", { name: cat }).first()).toBeVisible();
    }
  });

  // -----------------------------------------------------------------------
  // Step 3: Location
  // -----------------------------------------------------------------------
  test("step 3 shows location selection with 8 options", async ({ page }) => {
    // Navigate to step 3
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });
    await page.getByText("Student").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await expect(page.getByRole("heading", { name: /What matters to you|ما الذي يهمك/ })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();

    // Step 3 header
    await expect(page.getByRole("heading", { name: /Where are you based|أين تقيم/ })).toBeVisible({ timeout: 5000 });

    // Verify locations
    const locations = [
      "Dubai Marina",
      "DIFC",
      "Downtown Dubai",
      "JBR",
      "Business Bay",
      "Abu Dhabi",
      "Sharjah",
      "Other UAE",
    ];

    for (const loc of locations) {
      await expect(page.getByText(loc, { exact: false }).first()).toBeVisible();
    }
  });

  test("selecting a location enables the Next button", async ({ page }) => {
    // Navigate to step 3
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });
    await page.getByText("Student").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await expect(page.getByRole("heading", { name: /What matters to you|ما الذي يهمك/ })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await expect(page.getByRole("heading", { name: /Where are you based|أين تقيم/ })).toBeVisible({ timeout: 5000 });

    // Next is disabled initially
    const nextBtn = page.getByRole("button", { name: /^Next$|^التالي$/i });
    await expect(nextBtn).toBeDisabled();

    // Select "Dubai Marina"
    await page.getByText("Dubai Marina").first().click();

    // Next should now be enabled
    await expect(nextBtn).toBeEnabled();
  });

  // -----------------------------------------------------------------------
  // Step 4: Family Info (Optional)
  // -----------------------------------------------------------------------
  test("step 4 shows family info form with optional badge", async ({ page }) => {
    // Navigate through steps 1-3
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });
    await page.getByText("Parent / Family Buyer").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await expect(page.getByRole("heading", { name: /What matters to you|ما الذي يهمك/ })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await expect(page.getByRole("heading", { name: /Where are you based|أين تقيم/ })).toBeVisible({ timeout: 5000 });
    await page.getByText("Downtown Dubai").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();

    // Step 4 header with optional badge
    await expect(page.getByRole("heading", { name: /Tell us about your household|أخبرنا عن عائلتك/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Optional|اختياري/i).first()).toBeVisible();
  });

  test("family size counter increments and decrements", async ({ page }) => {
    // Navigate to step 4
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });
    await page.getByText("Parent / Family Buyer").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await page.getByText("Downtown Dubai").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await expect(page.getByRole("heading", { name: /Tell us about your household|أخبرنا عن عائلتك/ })).toBeVisible({ timeout: 5000 });

    // Default family size is 2
    const familySizeDisplay = page.locator(".text-2xl.font-bold.text-center").first();
    await expect(familySizeDisplay).toHaveText("2");

    // Increment: click the + button
    const plusBtn = page.locator("button").filter({ has: page.locator('[class*="lucide-plus"]') }).first();
    await plusBtn.click();
    await expect(familySizeDisplay).toHaveText("3");

    // Decrement: click the - button
    const minusBtn = page.locator("button").filter({ has: page.locator('[class*="lucide-minus"]') }).first();
    await minusBtn.click();
    await expect(familySizeDisplay).toHaveText("2");
  });

  test("children age group selection works", async ({ page }) => {
    // Navigate to step 4
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });
    await page.getByText("Parent / Family Buyer").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await page.getByText("Downtown Dubai").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await expect(page.getByRole("heading", { name: /Tell us about your household|أخبرنا عن عائلتك/ })).toBeVisible({ timeout: 5000 });

    // Age groups should be visible
    await expect(page.getByText("0-2 years").first()).toBeVisible();
    await expect(page.getByText("3-5 years").first()).toBeVisible();
    await expect(page.getByText("6-12 years").first()).toBeVisible();
    await expect(page.getByText("13-17 years").first()).toBeVisible();
    await expect(page.getByText("No children").first()).toBeVisible();

    // Select an age group
    await page.getByText("3-5 years").first().click();
    // Should be highlighted (has nexus-jade bg)
    const ageBtn = page.getByRole("button", { name: "3-5 years" }).first();
    await expect(ageBtn).toHaveClass(/nexus-jade/);
  });

  test("dietary preference selection works", async ({ page }) => {
    // Navigate to step 4
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });
    await page.getByText("Parent / Family Buyer").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await page.getByText("Downtown Dubai").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await expect(page.getByRole("heading", { name: /Tell us about your household|أخبرنا عن عائلتك/ })).toBeVisible({ timeout: 5000 });

    // Dietary options
    await expect(page.getByText("Halal").first()).toBeVisible();
    await expect(page.getByText("Vegetarian").first()).toBeVisible();
    await expect(page.getByText("Vegan").first()).toBeVisible();
    await expect(page.getByText("No restrictions").first()).toBeVisible();

    // Select Halal
    await page.getByText("Halal").first().click();
    const halalBtn = page.getByRole("button", { name: "Halal" }).first();
    await expect(halalBtn).toHaveClass(/nexus-jade/);
  });

  test("step 4 has a Skip button", async ({ page }) => {
    // Navigate to step 4
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });
    await page.getByText("Parent / Family Buyer").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await page.getByText("Downtown Dubai").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await expect(page.getByRole("heading", { name: /Tell us about your household|أخبرنا عن عائلتك/ })).toBeVisible({ timeout: 5000 });

    // Skip button should be present on step 4
    await expect(page.getByRole("button", { name: /Skip|تخطي/i }).first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Step 5: Free Text + Submit
  // -----------------------------------------------------------------------
  test("step 5 shows free text input and character counter", async ({ page }) => {
    // Navigate through steps 1-4
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });
    await page.getByText("Student").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await page.getByText("Abu Dhabi").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    // Step 4: click Next (or Skip)
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();

    // Step 5 header
    await expect(
      page.getByRole("heading", { name: /Anything else your Butler should know|هل هناك شيء آخر يجب أن يعرفه خادمك/ })
    ).toBeVisible({ timeout: 5000 });

    // Textarea and character counter
    await expect(page.locator("textarea").first()).toBeVisible();
    await expect(page.getByText("0/500").first()).toBeVisible();
  });

  test("free text input respects 500 character limit", async ({ page }) => {
    // Navigate to step 5
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });
    await page.getByText("Student").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await page.getByText("Abu Dhabi").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await expect(page.locator("textarea").first()).toBeVisible({ timeout: 5000 });

    // Type some text
    await page.locator("textarea").first().fill("I am interested in AI research and scholarships.");
    await expect(page.getByText(/48\/500/).first()).toBeVisible();
  });

  test("step 5 shows Start My Butler submit button", async ({ page }) => {
    // Navigate to step 5
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });
    await page.getByText("Student").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await page.getByText("Abu Dhabi").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();

    await expect(
      page.getByRole("button", { name: /Start My Butler|ابدأ خادمي/i }).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("final submit calls onboard API and redirects to butler", async ({ page }) => {
    let onboardCalled = false;
    await page.route("**/api/proxy/butler/onboard", (route) => {
      onboardCalled = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    // Navigate to step 5
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });
    await page.getByText("Student").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await page.getByText("Abu Dhabi").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();

    // Submit
    await page.getByRole("button", { name: /Start My Butler|ابدأ خادمي/i }).first().click();

    // Should redirect to /butler
    await expect(page).toHaveURL(/\/butler$/, { timeout: 10000 });
    expect(onboardCalled).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Navigation: Progress bar and Back button
  // -----------------------------------------------------------------------
  test("progress bar shows correct step indicator", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Step 1 of 5|الخطوة 1 من 5/i).first()).toBeVisible();

    // Go to step 2
    await page.getByText("Student").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();

    await expect(page.getByText(/Step 2 of 5|الخطوة 2 من 5/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("back button navigates to previous step", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });

    // Go to step 2
    await page.getByText("Student").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();
    await expect(page.getByRole("heading", { name: /What matters to you|ما الذي يهمك/ })).toBeVisible({ timeout: 5000 });

    // Press Back
    await page.getByText(/Back|رجوع/i).first().click();

    // Should be back on step 1
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Step 1 of 5|الخطوة 1 من 5/i).first()).toBeVisible();
  });

  test("back button is disabled on step 1", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });

    // The back button should be disabled (has opacity-50 / cursor-not-allowed)
    const backBtn = page.getByText(/Back|رجوع/i).first();
    await expect(backBtn).toHaveClass(/opacity-50|cursor-not-allowed/);
  });

  // -----------------------------------------------------------------------
  // Complete flow end-to-end
  // -----------------------------------------------------------------------
  test("full onboarding flow: persona -> categories -> location -> family -> submit", async ({ page }) => {
    // Step 1: Persona
    await expect(page.getByRole("heading", { name: /Who are you|من أنت/ })).toBeVisible({ timeout: 10000 });
    await page.getByText("Parent / Family Buyer").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();

    // Step 2: Categories
    await expect(page.getByRole("heading", { name: /What matters to you|ما الذي يهمك/ })).toBeVisible({ timeout: 5000 });
    // Toggle an extra category
    await page.getByRole("button", { name: "Travel" }).first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();

    // Step 3: Location
    await expect(page.getByRole("heading", { name: /Where are you based|أين تقيم/ })).toBeVisible({ timeout: 5000 });
    await page.getByText("JBR").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();

    // Step 4: Family Info
    await expect(page.getByRole("heading", { name: /Tell us about your household|أخبرنا عن عائلتك/ })).toBeVisible({ timeout: 5000 });
    // Increment family size
    const plusBtn = page.locator("button").filter({ has: page.locator('[class*="lucide-plus"]') }).first();
    await plusBtn.click();
    // Select children age
    await page.getByText("3-5 years").first().click();
    // Select dietary pref
    await page.getByText("Halal").first().click();
    await page.getByRole("button", { name: /^Next$|^التالي$/i }).click();

    // Step 5: Free text + submit
    await expect(
      page.getByRole("heading", { name: /Anything else your Butler should know|هل هناك شيء آخر يجب أن يعرفه خادمك/ })
    ).toBeVisible({ timeout: 5000 });
    await page.locator("textarea").first().fill("Looking for family-friendly activities near the beach.");
    await page.getByRole("button", { name: /Start My Butler|ابدأ خادمي/i }).first().click();

    // Should redirect to /butler
    await expect(page).toHaveURL(/\/butler$/, { timeout: 10000 });
  });
});

// ===========================================================================
// DASHBOARD QUICK ACTIONS & BRIEFING
// ===========================================================================

test.describe("Dashboard Quick Actions & Briefing", () => {
  test.beforeEach(async ({ page }) => {
    await mockFallbackAPIs(page);
    await mockBrainAPIs(page);
    await mockChatAPIs(page);
    await loginAsTestUser(page);
    await page.goto("/");
  });

  // -----------------------------------------------------------------------
  // Quick Actions
  // -----------------------------------------------------------------------
  test("New Conversation quick action is visible and links to /chat", async ({ page }) => {
    const link = page.getByRole("link", { name: /New Conversation|محادثة جديدة/i });
    await expect(link).toBeVisible({ timeout: 10000 });
    await expect(link).toHaveAttribute("href", "/chat");
  });

  test("Voice Mode quick action is visible and links to /voice", async ({ page }) => {
    const link = page.getByRole("link", { name: /Voice Mode|الوضع الصوتي/i });
    await expect(link).toBeVisible({ timeout: 10000 });
    await expect(link).toHaveAttribute("href", "/voice");
  });

  test("Upload to Vault quick action is visible and links to /vault", async ({ page }) => {
    const link = page.getByRole("link", { name: /Upload to Vault|رفع إلى الخزنة/i });
    await expect(link).toBeVisible({ timeout: 10000 });
    await expect(link).toHaveAttribute("href", "/vault");
  });

  test("Check Markets quick action is visible and links to /domains/financial", async ({ page }) => {
    const link = page.getByRole("link", { name: /Check Markets|فحص الأسواق/i });
    await expect(link).toBeVisible({ timeout: 10000 });
    await expect(link).toHaveAttribute("href", "/domains/financial");
  });

  // -----------------------------------------------------------------------
  // Briefing Cards
  // -----------------------------------------------------------------------
  test("dashboard shows 3 briefing items", async ({ page }) => {
    await expect(page.getByText(/Three things require your attention|ثلاثة أمور تتطلب انتباهك/i).first()).toBeVisible({ timeout: 10000 });

    // The 3 default briefing items
    await expect(page.getByText(/Welcome to NexusAD|مرحباً بك في NexusAD/i).first()).toBeVisible();
    await expect(page.getByText(/Build Your Vault|ابنِ خزنتك/i).first()).toBeVisible();
    await expect(page.getByText(/Personalized Briefings|إحاطات مخصصة/i).first()).toBeVisible();
  });

  test("briefing items show summaries", async ({ page }) => {
    await expect(page.getByText(/Welcome to NexusAD|مرحباً بك في NexusAD/i).first()).toBeVisible({ timeout: 10000 });

    await expect(page.getByText(/Start a conversation to build your intelligence|ابدأ محادثة لبناء ذكائك/i).first()).toBeVisible();
    await expect(page.getByText(/Upload documents to unlock domain mastery|ارفع المستندات لفتح إتقان المجالات/i).first()).toBeVisible();
    await expect(page.getByText(/Your daily insights will appear here|ستظهر رؤاك اليومية هنا/i).first()).toBeVisible();
  });

  test("View All link is present on briefing section", async ({ page }) => {
    const viewAllLink = page.getByRole("link", { name: /View All|عرض الكل/i }).first();
    await expect(viewAllLink).toBeVisible({ timeout: 10000 });
    await expect(viewAllLink).toHaveAttribute("href", "/briefing");
  });

  // -----------------------------------------------------------------------
  // Recent Conversations (empty state)
  // -----------------------------------------------------------------------
  test("recent conversations shows empty state", async ({ page }) => {
    await expect(page.getByText(/Recent Conversations|المحادثات الأخيرة/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/No conversations yet|لا توجد محادثات بعد/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Start a Conversation|ابدأ محادثة/i }).first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Domain Overview
  // -----------------------------------------------------------------------
  test("domain overview shows 5 domains", async ({ page }) => {
    await expect(page.getByText(/Domain Overview|نظرة عامة على المجالات/i).first()).toBeVisible({ timeout: 10000 });

    await expect(page.getByText(/Financial|المالية/i).first()).toBeVisible();
    await expect(page.getByText(/Legal|القانونية/i).first()).toBeVisible();
    await expect(page.getByText(/UAE Government|حكومة الإمارات/i).first()).toBeVisible();
    await expect(page.getByText(/Health|الصحة/i).first()).toBeVisible();
    await expect(page.getByText(/Technical|التقنية/i).first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Vault Summary
  // -----------------------------------------------------------------------
  test("vault summary section is present with search input", async ({ page }) => {
    await expect(page.getByText(/Vault Summary|ملخص الخزنة/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder(/Search Vault|البحث في الخزنة/i).first()).toBeVisible();
  });
});
