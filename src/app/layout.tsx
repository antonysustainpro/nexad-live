import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Toaster } from "sonner"
import { cookies } from "next/headers"
import "./globals.css"
import { NexusProvider } from "@/contexts/nexus-context"
import { PrivacyMetricsProvider } from "@/contexts/privacy-metrics-context"
import { AuthProvider } from "@/contexts/auth-context"
import { CookieConsentBanner } from "@/components/cookie-consent-banner"
import { ConditionalAnalytics } from "@/components/conditional-analytics"
import { OfflineBanner } from "@/components/offline-banner"
import { ServiceWorkerRegister } from "@/components/sw-register"
import { SpeedInsights } from "@vercel/speed-insights/next"

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "NexusAD Ai - Your Sovereign Intelligence",
  description: "A sovereign AI platform for UAE CEOs. Your data, your intelligence, your control.",
  generator: "v0.app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NexusAD",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const savedLang = cookieStore.get("nexus-language")?.value
  const lang = savedLang === "ar" ? "ar" : savedLang === "bilingual" ? "ar-en" : "en"
  const dir = savedLang === "ar" ? "rtl" : "ltr"

  // Get CSRF token from cookie (set by middleware with proper security flags - SEC-001)
  // The middleware ensures the cookie exists with SameSite=Strict and Secure flags
  const csrfToken = cookieStore.get("csrf-token")?.value || ""

  return (
    <html suppressHydrationWarning className="dark" lang={lang} dir={dir}>
      <head>
        {/* CSRF token in meta tag for client-side JS to read and include in headers */}
        {/* The actual cookie is set by middleware (SEC-001) with proper security flags */}
        <meta name="csrf-token" content={csrfToken} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <NexusProvider>
          <AuthProvider>
            <PrivacyMetricsProvider>
              <ServiceWorkerRegister />
              <OfflineBanner />
              {children}
              <CookieConsentBanner />
            </PrivacyMetricsProvider>
          </AuthProvider>
        </NexusProvider>
        <Toaster
          richColors
          position="top-center"
          toastOptions={{ duration: 3000 }}
          style={{ top: '1rem' }}
          offset="1rem"
        />
        <ConditionalAnalytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
