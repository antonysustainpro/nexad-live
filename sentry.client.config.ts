import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 1.0,

  // Session Replay for debugging user issues
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Filter out common noise
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
  ],

  // Privacy - scrub PII before sending to Sentry
  beforeSend(event) {
    // Remove any potential PII from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
        if (breadcrumb.message) {
          // Scrub Emirates ID pattern
          breadcrumb.message = breadcrumb.message.replace(
            /784[\s\-]?\d{4}[\s\-]?\d{7}[\s\-]?\d/g,
            "[EMIRATES_ID]"
          );
          // Scrub phone numbers
          breadcrumb.message = breadcrumb.message.replace(
            /(?:\+971|00971|0)[\s-]?(?:5[0-9]|[2-9])[\s-]?\d{3}[\s-]?\d{4}/g,
            "[PHONE]"
          );
          // Scrub email
          breadcrumb.message = breadcrumb.message.replace(
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            "[EMAIL]"
          );
        }
        return breadcrumb;
      });
    }
    return event;
  },
});
