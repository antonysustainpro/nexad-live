/**
 * NexusAD Ai — Service Worker (PWA-001)
 *
 * Provides:
 * - App shell caching (HTML, CSS, JS, fonts, icons)
 * - Offline fallback page
 * - Network-first strategy for API calls, cache-first for static assets
 * - Automatic cache versioning and cleanup
 */

const CACHE_NAME = "nexusad-v1"

// App shell files to pre-cache during install
const APP_SHELL = [
  "/",
  "/manifest.json",
  "/icon.svg",
  "/icon-dark-32x32.png",
  "/icon-light-32x32.png",
  "/apple-icon.png",
]

// Offline fallback HTML — shown when network is unavailable and page is not cached
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>NexusAD Ai — Offline</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: #0A0A0A;
      color: #F5F5F7;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      min-height: 100dvh;
      padding: 24px;
      padding: env(safe-area-inset-top, 24px) env(safe-area-inset-right, 24px) env(safe-area-inset-bottom, 24px) env(safe-area-inset-left, 24px);
    }
    .container {
      text-align: center;
      max-width: 420px;
    }
    .icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 24px;
      opacity: 0.6;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 12px;
      color: #C6AD90;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #A8A8AD;
      margin-bottom: 24px;
    }
    button {
      background: #C6AD90;
      color: #0A0A0A;
      border: none;
      border-radius: 12px;
      padding: 12px 32px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      min-height: 44px;
      min-width: 44px;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: opacity 0.2s;
    }
    button:hover { opacity: 0.9; }
    button:active { transform: scale(0.98); }
  </style>
</head>
<body>
  <div class="container">
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
    <h1>You are offline</h1>
    <p>NexusAD requires an internet connection to access your sovereign intelligence. Please check your connection and try again.</p>
    <button onclick="window.location.reload()">Retry Connection</button>
  </div>
</body>
</html>`

// Install — pre-cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

// Activate — clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

// Fetch — strategy based on request type
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== "GET") return

  // Skip API calls and auth endpoints — always go to network
  if (url.pathname.startsWith("/api/")) return

  // Skip Chrome extensions and other non-http(s) requests
  if (!url.protocol.startsWith("http")) return

  // For navigation requests (HTML pages): network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache a clone for offline use
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || new Response(OFFLINE_HTML, {
              status: 200,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            }))
        )
    )
    return
  }

  // For static assets (JS, CSS, images, fonts): cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(js|css|woff2?|ttf|png|jpg|jpeg|svg|ico|webp|avif)$/)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
            return response
          })
      )
    )
    return
  }

  // Default: network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        return response
      })
      .catch(() => caches.match(request))
  )
})
