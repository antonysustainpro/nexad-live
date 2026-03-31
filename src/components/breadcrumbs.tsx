"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"
import { ChevronRight, ChevronLeft, Home } from "lucide-react"
import { NAV_ITEMS } from "@/lib/constants"

// Extended route labels for nested pages
const routeLabels: Record<string, { en: string; ar: string }> = {
  "/": { en: "Dashboard", ar: "لوحة التحكم" },
  "/chat": { en: "Chat", ar: "المحادثة" },
  "/voice": { en: "Voice", ar: "الصوت" },
  "/vault": { en: "Vault", ar: "الخزنة" },
  "/domains": { en: "Domains", ar: "المجالات" },
  "/privacy": { en: "Privacy", ar: "الخصوصية" },
  "/sovereignty": { en: "Sovereignty", ar: "السيادة" },
  "/persona": { en: "Persona", ar: "الشخصية" },
  "/settings": { en: "Settings", ar: "الإعدادات" },
  "/butler": { en: "Butler", ar: "الخادم" },
  "/billing": { en: "Billing", ar: "الفواتير" },
  "/billing/pricing": { en: "Pricing", ar: "الأسعار" },
  "/billing/invoices": { en: "Invoices", ar: "الفواتير" },
  "/billing/usage": { en: "Usage", ar: "الاستخدام" },
  "/notifications": { en: "Notifications", ar: "الإشعارات" },
  "/profile": { en: "Profile", ar: "الملف الشخصي" },
  "/help": { en: "Help", ar: "المساعدة" },
  "/team": { en: "Team", ar: "الفريق" },
  "/referral": { en: "Referral", ar: "الإحالة" },
  "/terms": { en: "Terms", ar: "الشروط" },
  "/privacy-policy": { en: "Privacy Policy", ar: "سياسة الخصوصية" },
}

// Dynamic segment labels
const dynamicLabels: Record<string, { en: string; ar: string }> = {
  document: { en: "Document", ar: "مستند" },
  conversation: { en: "Conversation", ar: "محادثة" },
  domain: { en: "Domain", ar: "مجال" },
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const { language, isRTL } = useNexus()

  // Don't show on root
  if (pathname === "/") return null

  // Build breadcrumb segments
  const segments = pathname.split("/").filter(Boolean)
  const breadcrumbs: Array<{ href: string; label: string }> = []

  // Always start with home
  breadcrumbs.push({
    href: "/",
    label: language === "ar" ? "الرئيسية" : "Home",
  })

  // Build path progressively
  let currentPath = ""
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`
    
    // Check if it's a known route
    const routeLabel = routeLabels[currentPath]
    if (routeLabel) {
      breadcrumbs.push({
        href: currentPath,
        label: language === "ar" ? routeLabel.ar : routeLabel.en,
      })
    } else {
      // Check if it's a dynamic segment (UUID, ID)
      const isDynamic = /^[a-f0-9-]{8,}$/i.test(segment) || /^\d+$/.test(segment)
      if (isDynamic) {
        // Determine context from parent segment
        const parentSegment = segments[index - 1]
        let dynamicLabel = { en: "Item", ar: "عنصر" }
        
        if (parentSegment === "vault") {
          dynamicLabel = dynamicLabels.document
        } else if (parentSegment === "chat") {
          dynamicLabel = dynamicLabels.conversation
        } else if (parentSegment === "domains") {
          dynamicLabel = dynamicLabels.domain
        }
        
        breadcrumbs.push({
          href: currentPath,
          label: language === "ar" ? dynamicLabel.ar : dynamicLabel.en,
        })
      } else {
        // Capitalize segment as fallback
        breadcrumbs.push({
          href: currentPath,
          label: segment.charAt(0).toUpperCase() + segment.slice(1),
        })
      }
    }
  })

  // Don't show if only home
  if (breadcrumbs.length <= 1) return null

  const Separator = isRTL ? ChevronLeft : ChevronRight

  return (
    <nav
      aria-label={language === "ar" ? "مسار التنقل" : "Breadcrumb"}
      className={cn("mb-4", isRTL && "text-right")}
    >
      <ol className={cn("flex items-center gap-1 text-sm", isRTL && "flex-row-reverse")}>
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1
          
          return (
            <li
              key={crumb.href}
              className={cn("flex items-center gap-1", isRTL && "flex-row-reverse")}
            >
              {index === 0 ? (
                <Link
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={crumb.label}
                >
                  <Home className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : isLast ? (
                <span className="text-foreground font-medium" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
              
              {!isLast && (
                <Separator className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
