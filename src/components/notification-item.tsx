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

  // A11Y: full accessible label includes unread status so screen readers announce it immediately
  const itemAriaLabel = [
    title,
    !notification.read ? (language === "ar" ? "غير مقروء" : "Unread") : null,
    body,
    formattedTime,
  ].filter(Boolean).join(", ")

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
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleClick()
        }
      }}
      tabIndex={0}
      role="article"
      aria-label={itemAriaLabel}
      // A11Y: notify screen readers when read state changes
      aria-live="polite"
    >
      {/* A11Y: unread dot is purely visual — its meaning is already in the container aria-label */}
      {!notification.read && (
        <span
          className={cn(
            "absolute top-4 w-2 h-2 rounded-full bg-nexus-jade",
            isRTL ? "left-4" : "right-4"
          )}
          aria-hidden="true"
        />
      )}

      {/* Icon */}
      <div className="flex-shrink-0 p-2 rounded-lg bg-muted" aria-hidden="true">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>

      {/* Content */}
      <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
        {/* A11Y: h4 gives semantic heading structure within the article */}
        <h4 className="font-medium text-foreground line-clamp-1">{title}</h4>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{body}</p>
        <div className={cn("flex items-center gap-3 mt-2", isRTL && "flex-row-reverse")}>
          <time
            className="text-xs text-muted-foreground"
            dateTime={new Date(notification.timestamp).toISOString()}
          >
            {formattedTime}
          </time>
          {/* SEC-UI-105: Sanitize actionUrl to prevent open redirect from backend-controlled notifications */}
          {notification.actionUrl && actionLabel && (
            <Link
              href={sanitizeUrl(notification.actionUrl)}
              className="text-xs text-nexus-jade hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-nexus-jade focus-visible:ring-offset-2 rounded-sm"
              // A11Y: include notification title for context so link is not ambiguous out of context
              aria-label={`${actionLabel} — ${title}`}
              onClick={(e) => e.stopPropagation()}
            >
              {actionLabel}
            </Link>
          )}
        </div>
      </div>

      {/* Dismiss button */}
      {/* A11Y: always visible to keyboard users via focus-visible, not just on hover */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "transition-opacity h-8 w-8 flex-shrink-0",
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-nexus-jade focus-visible:ring-offset-2"
        )}
        onClick={(e) => {
          e.stopPropagation()
          onDismiss(notification.id)
        }}
        aria-label={
          language === "ar"
            ? `إزالة الإشعار: ${title}`
            : `Dismiss notification: ${title}`
        }
        tabIndex={0}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </motion.div>
  )
})

NotificationItem.displayName = "NotificationItem"
