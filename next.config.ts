import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Service ports — matches NEXUS microservice topology
const AUTH    = process.env.NEXUS_AUTH_URL    || "http://localhost:5000";
const CORE    = process.env.NEXUS_CORE_URL    || "http://localhost:5001";
const BRAIN   = process.env.NEXUS_BRAIN_URL   || "http://localhost:5005";
const RULES   = process.env.NEXUS_RULES_URL   || "http://localhost:5003";
const IOT     = process.env.NEXUS_IOT_URL     || "http://localhost:5002";
const GATEWAY = process.env.NEXUS_API_GATEWAY || "http://localhost:8080";

const nextConfig: NextConfig = {
  // Instrumentation file (src/instrumentation.ts) is auto-detected in Next.js 15+
  // No experimental flag needed for graceful shutdown (REL-006)
  // Auth service returns large Set-Cookie headers; set NODE_OPTIONS='--max-http-header-size=65536' at runtime

  // Image optimization — enable WebP/AVIF, set reasonable device sizes
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24, // 24 hours
  },

  async headers() {
    return [
      // Security headers for all routes
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // SEC-NETWORK-008: Cross-Origin-Opener-Policy prevents Spectre-class attacks
          // and cross-origin information leaks via window.opener references
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // SEC-NETWORK-009: Cross-Origin-Embedder-Policy enables cross-origin isolation.
          // Using 'credentialless' to avoid breaking third-party image/font loads while
          // still enabling SharedArrayBuffer and high-res timers protection.
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          // SEC-034 (PRIMARY): CSP is generated per-request with nonce by middleware.
          // The middleware nonce-based CSP takes precedence and overrides this header.
          //
          // SEC-046 (FALLBACK): Static CSP below activates only when middleware does not run
          // (e.g., static export, edge-runtime bypass, or misconfigured matcher).
          // It cannot use nonces, so 'unsafe-inline' is required for styles and Next.js hydration.
          // This is intentionally less strict than the middleware CSP — it is a last-resort guard,
          // not the primary control. The nonce-based middleware policy is authoritative.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js requires 'unsafe-inline' and 'unsafe-eval' in static mode (no nonce available)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.vercel-analytics.com https://*.nexusad.ai wss://*.nexusad.ai https://*.ingest.sentry.io https://*.proxy.runpod.net",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; ") + ";",
          },
        ],
      },
      // Long-lived cache for immutable static assets (JS/CSS chunks, fonts, images)
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Cache public images/favicons for 1 day with revalidation
      {
        source: "/(.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif))",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=43200" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      // Auth service (5000)
      { source: "/api/v1/auth/:path*",             destination: `${AUTH}/api/v1/auth/:path*` },
      { source: "/api/v1/roles/:path*",             destination: `${AUTH}/api/v1/roles/:path*` },
      { source: "/api/v1/organizations/:path*",     destination: `${AUTH}/api/v1/organizations/:path*` },

      // Brain service (5005)
      { source: "/api/v1/brain/:path*",             destination: `${BRAIN}/api/v1/brain/:path*` },
      { source: "/api/v1/goals/:path*",             destination: `${BRAIN}/api/v1/goals/:path*` },

      // Rules service (5003) — tasks, suppliers, alerts, audit-logs
      { source: "/api/v1/tasks/:path*",             destination: `${RULES}/api/v1/tasks/:path*` },
      { source: "/api/v1/suppliers/:path*",         destination: `${RULES}/api/v1/suppliers/:path*` },
      { source: "/api/v1/alerts/:path*",            destination: `${RULES}/api/v1/alerts/:path*` },
      { source: "/api/v1/rules/:path*",             destination: `${RULES}/api/v1/rules/:path*` },
      { source: "/api/v1/audit-logs/:path*",        destination: `${RULES}/api/v1/audit-logs/:path*` },
      { source: "/api/v1/ai/:path*",                destination: `${RULES}/api/v1/ai/:path*` },

      // IoT service (5002) — telemetry, compliance, prediction, carbon
      // Note: /devices routes to Core (5001) per gateway config
      { source: "/api/v1/telemetry/:path*",         destination: `${IOT}/api/v1/telemetry/:path*` },
      { source: "/api/v1/iot/:path*",               destination: `${IOT}/api/v1/iot/:path*` },
      { source: "/api/v1/compliance/:path*",        destination: `${IOT}/api/v1/compliance/:path*` },
      { source: "/api/v1/prediction/:path*",        destination: `${IOT}/api/v1/prediction/:path*` },
      { source: "/api/v1/carbon/:path*",            destination: `${IOT}/api/v1/carbon/:path*` },

      // Core service (5001) — catch-all for users, threads, search, etc.
      { source: "/api/v1/:path*",                   destination: `${CORE}/api/v1/:path*` },
    ];
  },
};

// Wrap with Sentry for error monitoring
export default withSentryConfig(nextConfig, {
  // Sentry webpack plugin options
  silent: true, // Suppress Sentry CLI logs
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Upload source maps for better error traces
  widenClientFileUpload: true,

  // Source map configuration
  sourcemaps: {
    deleteSourcemapsAfterUpload: true, // Hide from users (security)
  },
});
