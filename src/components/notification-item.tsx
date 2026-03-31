"use client"

import { motion } from "motion/react"
import React, { useState, useEffect } from "react"
import { useNexus } from "@/contexts/nexus-context"
import { cn, sanitizeUrl } from "@/lib/utils"
import type { Notification } from "@/lib/types"
import { X, Bell, AlertTriangle, CreditCard, Shield, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface NotificationItemProps {
  notification: Notification
  onDismiss: (id: string) => void
  onMarkRead: (id: string) => void
}

const categoryIcons: Record<string, typeof Bell> = {
  alerts: AlertTriangle,
  butler: Crown,
  billing: CreditCard,
  security: Shield,
}

export const NotificationItem = React.memo(({ notification, onDismiss, onMarkRead }: NotificationItemProps) => {
  const { language, isRTL } = useNexus()
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mql.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [])

  const Icon = categoryIcons[notification.category] || Bell
  const title = language === "ar" ? notification.titleAr : notification.title
  const body = language === "ar" ? notification.bodyAr : notification.body
  const actionLabel = language === "ar" ? notification.actionLabelAr : notification.actionLabel

  const formattedTime = new Date(notification.timestamp).toLocaleDateString(
    language === "ar" ? "ar-AE" : "en-US",
    { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
  )

  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification.id)
    }
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? undefined : { opacity: 0, x: isRTL ? 20 : -20 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0, x: isRTL ? -20 : 20 }}
      className={cn(
        "group relative flex items-start gap-3 p-4 rounded-xl border transition-colors",
        notification.read
          ? "bg-card border-border"
          : "bg-card/80 border-nexus-jade/30",
        isRTL && "flex-row-reverse"
      )}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick() } }}
      tabIndex={0}
      role="article"
      aria-label={`${title}${!notification.read ? ` - ${language === "ar" ? "غير مقروء" : "Unread"}` : ""}`}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <span
          className={cn(
            "absolute top-4 w-2 h-2 rounded-full bg-nexus-jade",
            isRTL ? "left-4" : "right-4"
          )}
          aria-label={language === "ar" ? "غير مقروء" : "Unread"}
        />
      )}

      {/* Icon */}
      <div className="flex-shrink-0 p-2 rounded-lg bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>

      {/* Content */}
      <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
        <h4 className="font-medium text-foreground line-clamp-1">{title}</h4>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{body}</p>
        <div className={cn("flex items-center gap-3 mt-2", isRTL && "flex-row-reverse")}>
          <span className="text-xs text-muted-foreground">{formattedTime}</span>
          {/* SEC-UI-105: Sanitize actionUrl to prevent open redirect from backend-controlled notifications */}
          {notification.actionUrl && actionLabel && (
            <Link
              href={sanitizeUrl(notification.actionUrl)}
              className="text-xs text-nexus-jade hover:underline"
            >
              {actionLabel}
            </Link>
          )}
        </div>
      </div>

      {/* Dismiss button */}
      <Button
        variant="ghost"
        size="icon"
        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
        onClick={(e) => {
          e.stopPropagation()
          onDismiss(notification.id)
        }}
        aria-label={language === "ar" ? "إزالة الإشعار" : "Dismiss notification"}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </motion.div>
  )
})

NotificationItem.displayName = "NotificationItem"
