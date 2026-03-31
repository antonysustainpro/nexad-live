"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"
import type { Notification, NotificationCategory } from "@/lib/types"
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
} from "@/lib/api"
import { NotificationItem } from "@/components/notification-item"
import { NotificationsPageSkeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Bell, CheckCheck, Inbox } from "lucide-react"
import { AnimatePresence } from "motion/react"
import { toast } from "sonner"

type FilterTab = "all" | NotificationCategory

export default function NotificationsPage() {
  const { language, isRTL } = useNexus()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadNotifications = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      // SEC-SM-003: Safe JSON.parse — localStorage can be corrupted/tampered
      let userId: string | null = null
      try {
        const storedUser = typeof window !== "undefined" ? localStorage.getItem("nexus-user-display") : null
        userId = storedUser ? JSON.parse(storedUser).id : null
      } catch {
        // Corrupted localStorage
      }
      if (!userId) {
        setNotifications([])
        setLoading(false)
        return
      }
      const data = await getNotifications(userId, signal)
      setNotifications(data || [])
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      setError("We couldn't load your notifications. Please try again in a moment.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const abortController = new AbortController()
    loadNotifications(abortController.signal)
    return () => abortController.abort()
  }, [loadNotifications])

  const filterTabs: Array<{ id: FilterTab; labelEn: string; labelAr: string }> = [
    { id: "all", labelEn: "All", labelAr: "الكل" },
    { id: "alerts", labelEn: "Alerts", labelAr: "التنبيهات" },
    { id: "butler", labelEn: "Butler", labelAr: "الخادم" },
    { id: "billing", labelEn: "Billing", labelAr: "الفواتير" },
    { id: "security", labelEn: "Security", labelAr: "الأمان" },
  ]

  const filteredNotifications = useMemo(() => {
    if (activeFilter === "all") return notifications
    return notifications.filter((n) => n.category === activeFilter)
  }, [notifications, activeFilter])

  const groupedNotifications = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

    const groups: { today: Notification[]; thisWeek: Notification[]; earlier: Notification[] } = {
      today: [],
      thisWeek: [],
      earlier: [],
    }

    filteredNotifications.forEach((n) => {
      const date = new Date(n.timestamp)
      // SEC-BL-014: Guard against invalid timestamps — treat as "earlier" if unparseable
      if (isNaN(date.getTime())) {
        groups.earlier.push(n)
      } else if (date >= today) {
        groups.today.push(n)
      } else if (date >= weekAgo) {
        groups.thisWeek.push(n)
      } else {
        groups.earlier.push(n)
      }
    })

    return groups
  }, [filteredNotifications])

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleMarkAllRead = async () => {
    // SEC-SM-003: Safe JSON.parse — localStorage can be corrupted/tampered
    let userId: string | null = null
    try {
      const storedUser = typeof window !== "undefined" ? localStorage.getItem("nexus-user-display") : null
      userId = storedUser ? JSON.parse(storedUser).id : null
    } catch {
      // Corrupted localStorage
    }
    if (!userId) return

    // Save previous state for rollback
    const previousState = [...notifications]
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))

    try {
      const result = await markAllNotificationsRead(userId)
      if (result) {
        toast.success(language === "ar" ? "تم تحديد الكل كمقروء" : "All marked as read")
      } else {
        throw new Error("Failed")
      }
    } catch {
      // Rollback on failure
      setNotifications(previousState)
      toast.error(language === "ar" ? "تعذّر تحديث الإشعارات. يرجى المحاولة مرة أخرى." : "We couldn't update your notifications. Please try again.")
    }
  }

  const handleDismiss = async (id: string) => {
    // Save previous state for rollback
    const previousState = [...notifications]
    // Optimistic update
    setNotifications((prev) => prev.filter((n) => n.id !== id))

    try {
      const result = await dismissNotification(id)
      if (!result) {
        throw new Error("Failed")
      }
    } catch {
      // Rollback on failure
      setNotifications(previousState)
      toast.error(language === "ar" ? "تعذّر حذف الإشعار. يرجى المحاولة مرة أخرى." : "We couldn't dismiss that notification. Please try again.")
    }
  }

  const handleMarkRead = async (id: string) => {
    // SEC-BL-013: Save previous state for rollback on failure (consistent with other optimistic ops)
    const previousState = [...notifications]
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    // Persist to backend
    try {
      const result = await markNotificationRead(id)
      if (!result) {
        throw new Error("Failed")
      }
    } catch {
      // Rollback on failure
      setNotifications(previousState)
      toast.error(language === "ar" ? "تعذّر تحديث الإشعار. يرجى المحاولة مرة أخرى." : "We couldn't update that notification. Please try again.")
    }
  }

  const renderGroup = (
    title: string,
    titleAr: string,
    items: Notification[]
  ) => {
    if (items.length === 0) return null
    return (
      <div className="space-y-3">
        <h3 className={cn("text-sm font-medium text-muted-foreground px-1", isRTL && "text-right")}>
          {language === "ar" ? titleAr : title}
        </h3>
        <AnimatePresence mode="popLayout">
          {items.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onDismiss={handleDismiss}
              onMarkRead={handleMarkRead}
            />
          ))}
        </AnimatePresence>
      </div>
    )
  }

  if (loading) {
    return <NotificationsPageSkeleton count={6} />
  }

  if (error) {
    return (
      <div className="container max-w-3xl mx-auto px-4 pb-24 md:pb-8">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell className="h-12 w-12 text-destructive/30 mb-4" aria-hidden="true" />
          <h3 className="font-medium text-destructive mb-1">
            {language === "ar" ? "خطأ في تحميل الإشعارات" : "Error Loading Notifications"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={() => loadNotifications()}>
            {language === "ar" ? "إعادة المحاولة" : "Retry"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-3xl mx-auto px-4 pb-24 md:pb-8">
      {/* Header */}
      <div className={cn("flex items-center justify-between mb-6", isRTL && "flex-row-reverse")}>
        <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
          <Bell className="h-6 w-6 text-nexus-jade" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-foreground">
            {language === "ar" ? "الإشعارات" : "Notifications"}
          </h1>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-nexus-jade/20 text-nexus-jade rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllRead}
            className="text-muted-foreground hover:text-foreground"
          >
            <CheckCheck className="h-4 w-4 me-2" aria-hidden="true" />
            {language === "ar" ? "تحديد الكل كمقروء" : "Mark all read"}
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className={cn("flex gap-2 mb-6 overflow-x-auto pb-2", isRTL && "flex-row-reverse")}>
        {filterTabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeFilter === tab.id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(tab.id)}
            className={cn(
              activeFilter === tab.id && "bg-nexus-jade text-background hover:bg-nexus-jade-hover"
            )}
          >
            {language === "ar" ? tab.labelAr : tab.labelEn}
          </Button>
        ))}
      </div>

      {/* Notification List */}
      {filteredNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 rounded-full bg-muted mb-4">
            <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          </div>
          <h3 className="font-medium text-foreground mb-1">
            {language === "ar" ? "لا توجد إشعارات" : "No notifications"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {language === "ar"
              ? "ستظهر إشعاراتك هنا"
              : "Your notifications will appear here"}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {renderGroup("Today", "اليوم", groupedNotifications.today)}
          {renderGroup("This Week", "هذا الأسبوع", groupedNotifications.thisWeek)}
          {renderGroup("Earlier", "سابقاً", groupedNotifications.earlier)}
        </div>
      )}
    </div>
  )
}
