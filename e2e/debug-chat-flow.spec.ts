/**
 * DIAGNOSTIC SCRIPT: Test the full chat flow on nexusad.ai
 *
 * Run: BASE_URL=https://nexusad.ai npx playwright test e2e/debug-chat-flow.spec.ts --project=desktop
 */

import { test, expect } from "@playwright/test";

const SITE_URL = "https://nexusad.ai";
const SS = "/Users/antonybousader/nexad-live/tests/debug-screenshots";

// Collect network + errors
const networkLog: Array<{
  ts: string;
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  reqHeaders?: Record<string, string>;
  resHeaders?: Record<string, string>;
  reqBody?: string;
  resBody?: string;
  error?: string;
}> = [];

const consoleLog: Array<{ ts: string; type: string; text: string }> = [];

test.describe("NexusAD Chat Debug", () => {
  test("Full chat flow diagnostic", async ({ page }) => {
    test.setTimeout(120000);

    // --- Listeners ---
    page.on("console", (msg) => {
      consoleLog.push({ ts: new Date().toISOString(), type: msg.type(), text: msg.text() });
    });
    page.on("pageerror", (error) => {
      consoleLog.push({ ts: new Date().toISOString(), type: "PAGE_ERROR", text: `${error.name}: ${error.message}` });
    });
    page.on("request", (req) => {
      const entry: (typeof networkLog)[0] = {
        ts: new Date().toISOString(),
        method: req.method(),
        url: req.url(),
      };
      if (req.url().includes("/api/") || req.url().includes("/proxy/")) {
        entry.reqHeaders = Object.fromEntries(
          Object.entries(req.headers()).filter(([k]) =>
            ["content-type", "x-csrf-token", "x-user-id", "cookie", "authorization"].includes(k.toLowerCase())
          )
        );
        if (req.method() === "POST") {
          entry.reqBody = req.postData()?.substring(0, 2000) || "";
        }
      }
      networkLog.push(entry);
    });
    page.on("response", async (res) => {
      const match = [...networkLog].reverse().find((e) => e.url === res.url() && !e.status);
      if (match) {
        match.status = res.status();
        match.statusText = res.statusText();
        if (res.url().includes("/api/") || res.url().includes("/proxy/")) {
          match.resHeaders = Object.fromEntries(
            Object.entries(res.headers()).filter(([k]) =>
              ["content-type", "set-cookie", "x-request-id", "location"].includes(k.toLowerCase())
            )
          );
          // Capture response body for error/important API calls
          if (res.status() >= 400 || res.url().includes("/proxy/chat")) {
            try {
              match.resBody = (await res.text()).substring(0, 2000);
            } catch {
              match.resBody = "(could not read)";
            }
          }
        }
      }
    });
    page.on("requestfailed", (req) => {
      networkLog.push({
        ts: new Date().toISOString(),
        method: req.method(),
        url: req.url(),
        error: req.failure()?.errorText || "Unknown",
      });
    });

    // =====================================================================
    // STEP 1: Load the site (use "load" not "networkidle" to avoid timeout)
    // =====================================================================
    console.log("\n=== STEP 1: Navigate to", SITE_URL, "===");
    await page.goto(SITE_URL, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(3000); // let JS hydrate
    console.log(`Current URL: ${page.url()}`);
    await page.screenshot({ path: `${SS}/01-landing.png`, fullPage: true });

    // Dismiss cookie banner if present
    const cookieAccept = page.locator('button:text("Accept All"), button:text("Essential Only")').first();
    if (await cookieAccept.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cookieAccept.click();
      console.log("Dismissed cookie banner");
      await page.waitForTimeout(500);
    }

    // =====================================================================
    // STEP 2: Check cookie state
    // =====================================================================
    console.log("\n=== STEP 2: Check cookies ===");
    const cookies = await page.context().cookies();
    const authCookies = cookies.filter(
      (c) => c.name.includes("csrf") || c.name.includes("nexus") || c.name.includes("session")
    );
    for (const c of authCookies) {
      console.log(`  Cookie: ${c.name} = ${c.value.substring(0, 30)}... (httpOnly=${c.httpOnly}, secure=${c.secure}, sameSite=${c.sameSite})`);
    }

    const hasCsrf = authCookies.some((c) => c.name === "csrf-token");
    const hasSession = authCookies.some((c) => c.name === "nexus-session");
    console.log(`Has csrf-token cookie: ${hasCsrf}`);
    console.log(`Has nexus-session cookie: ${hasSession}`);

    // =====================================================================
    // STEP 3: Navigate to chat page
    // =====================================================================
    console.log("\n=== STEP 3: Navigate to /chat ===");
    await page.goto(`${SITE_URL}/chat`, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(3000);
    console.log(`Chat URL: ${page.url()}`);
    await page.screenshot({ path: `${SS}/02-chat-page.png`, fullPage: true });

    // =====================================================================
    // STEP 4: Look for chat input and try to send a message
    // =====================================================================
    console.log("\n=== STEP 4: Look for chat UI elements ===");

    // Check for chat textarea
    const textarea = page.locator("textarea").first();
    const textareaVisible = await textarea.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Textarea visible: ${textareaVisible}`);

    if (textareaVisible) {
      await textarea.fill("Hello, testing the chat system");
      await page.screenshot({ path: `${SS}/03-typed-message.png`, fullPage: true });

      // Press Enter or look for send button
      console.log("\n=== STEP 5: Sending message ===");
      const chatStartIdx = networkLog.length;

      // Try pressing Enter
      await textarea.press("Enter");
      console.log("Pressed Enter to send");
      await page.waitForTimeout(8000);
      await page.screenshot({ path: `${SS}/04-after-enter.png`, fullPage: true });

      // Check what happened
      let chatReqs = networkLog.slice(chatStartIdx).filter(
        (e) => e.url.includes("/api/") || e.url.includes("/proxy/")
      );

      if (chatReqs.length === 0) {
        console.log("No API requests after Enter. Trying button click...");

        // Re-fill and try clicking the actual send button
        await textarea.fill("Hello, testing the chat system second try");

        // Try multiple selectors for the send button
        const sendSelectors = [
          'button[type="submit"]',
          'button[aria-label*="Send" i]',
          'button[aria-label*="send" i]',
          'button:has(svg)',
        ];
        for (const sel of sendSelectors) {
          const btn = page.locator(sel).last();
          if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
            console.log(`Found send button with selector: ${sel}`);
            const idx2 = networkLog.length;
            await btn.click();
            await page.waitForTimeout(8000);
            await page.screenshot({ path: `${SS}/05-after-button.png`, fullPage: true });
            chatReqs = networkLog.slice(idx2).filter(
              (e) => e.url.includes("/api/") || e.url.includes("/proxy/")
            );
            break;
          }
        }
      }

      console.log(`\n=== CHAT API REQUESTS (${chatReqs.length}) ===`);
      for (const r of chatReqs) {
        console.log(`\n  ${r.method} ${r.url}`);
        console.log(`  Status: ${r.status ?? "PENDING"} ${r.statusText ?? ""}`);
        if (r.error) console.log(`  ERROR: ${r.error}`);
        if (r.reqHeaders) console.log(`  Req Headers: ${JSON.stringify(r.reqHeaders)}`);
        if (r.reqBody) console.log(`  Req Body: ${r.reqBody.substring(0, 500)}`);
        if (r.resHeaders) console.log(`  Res Headers: ${JSON.stringify(r.resHeaders)}`);
        if (r.resBody) console.log(`  Res Body: ${r.resBody.substring(0, 500)}`);
      }
    } else {
      console.log("No textarea found. Checking for suggestion prompts...");
      // Maybe there are quick prompt buttons in the empty state
      const promptBtns = page.locator('button:has-text("New Conversation"), button:has-text("Start")');
      const promptCount = await promptBtns.count();
      console.log(`Suggestion/prompt buttons: ${promptCount}`);

      // List all visible buttons
      const allBtns = await page.locator("button:visible").allTextContents();
      console.log("Visible buttons:", allBtns.slice(0, 15).join(" | "));
    }

    // =====================================================================
    // STEP 6: Direct API test from page context
    // =====================================================================
    console.log("\n=== STEP 6: Direct API test - /api/proxy/chat ===");
    const apiResult = await page.evaluate(async () => {
      const csrfToken = (() => {
        for (const c of document.cookie.split(";")) {
          const parts = c.trim().split("=");
          if (parts[0]?.trim() === "csrf-token" && parts[1]) return decodeURIComponent(parts[1]);
        }
        return null;
      })();

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

      try {
        const res = await fetch("/api/proxy/chat", {
          method: "POST",
          headers,
          body: JSON.stringify({
            messages: [{ role: "user", content: "Hello test" }],
            stream: true,
            use_rag: true,
            mode: "standard",
            language: "en",
            provider: null,
            model: null,
            max_tokens: 4096,
          }),
          credentials: "include",
        });

        // For SSE, read the first chunk
        const reader = res.body?.getReader();
        let text = "";
        if (reader) {
          const decoder = new TextDecoder();
          // Read up to 3 chunks or 2000 chars
          for (let i = 0; i < 3 && text.length < 2000; i++) {
            const { done, value } = await reader.read();
            if (done) break;
            text += decoder.decode(value, { stream: true });
          }
          reader.cancel();
        }

        return {
          status: res.status,
          statusText: res.statusText,
          contentType: res.headers.get("content-type"),
          xRequestId: res.headers.get("x-request-id"),
          body: text.substring(0, 2000),
          csrfTokenUsed: csrfToken ? csrfToken.substring(0, 20) + "..." : null,
          allCookieNames: document.cookie
            .split(";")
            .map((c) => c.trim().split("=")[0])
            .filter(Boolean),
        };
      } catch (e: unknown) {
        return { error: (e as Error).message, csrfTokenUsed: csrfToken };
      }
    });
    console.log("DIRECT API RESULT:", JSON.stringify(apiResult, null, 2));

    // =====================================================================
    // STEP 7: Test backend directly from browser (CORS)
    // =====================================================================
    console.log("\n=== STEP 7: Test backend CORS from browser ===");
    const corsHealth = await page.evaluate(async () => {
      try {
        const res = await fetch("https://4ljj3bdk1x0vhv-9000.proxy.runpod.net/health");
        return { status: res.status, body: (await res.text()).substring(0, 300) };
      } catch (e: unknown) {
        return { error: (e as Error).message, type: (e as Error).name };
      }
    });
    console.log("Backend CORS health:", JSON.stringify(corsHealth, null, 2));

    // =====================================================================
    // STEP 8: Test proxy health
    // =====================================================================
    console.log("\n=== STEP 8: Test proxy health ===");
    const proxyHealth = await page.evaluate(async () => {
      try {
        const res = await fetch("/api/proxy/health", { credentials: "include" });
        return { status: res.status, body: (await res.text()).substring(0, 500) };
      } catch (e: unknown) {
        return { error: (e as Error).message };
      }
    });
    console.log("Proxy health:", JSON.stringify(proxyHealth, null, 2));

    // =====================================================================
    // FINAL REPORT
    // =====================================================================
    console.log("\n" + "=".repeat(80));
    console.log("DIAGNOSTIC SUMMARY");
    console.log("=".repeat(80));

    const errors = consoleLog.filter((e) => e.type === "error" || e.type === "PAGE_ERROR");
    console.log(`\nConsole errors: ${errors.length}`);
    for (const e of errors.slice(0, 20)) {
      console.log(`  [${e.type}] ${e.text.substring(0, 300)}`);
    }

    const failed = networkLog.filter((e) => e.error || (e.status && e.status >= 400));
    console.log(`\nFailed requests: ${failed.length}`);
    for (const f of failed) {
      console.log(`  ${f.method} ${f.url} -> ${f.status ?? "N/A"} ${f.error ?? ""}`);
      if (f.resBody) console.log(`    Body: ${f.resBody.substring(0, 200)}`);
    }

    const allApi = networkLog.filter((e) => e.url.includes("/api/"));
    console.log(`\nAll API calls: ${allApi.length}`);
    for (const a of allApi) {
      console.log(`  ${a.method} ${a.url} -> ${a.status ?? "PENDING"}`);
    }

    await page.screenshot({ path: `${SS}/99-final.png`, fullPage: true });
    expect(true).toBe(true);
  });
});
