"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Home,
  MessageCircle,
  Mic,
  Lock,
  Compass,
  Shield,
  Crown,
  User,
  Settings,
  Plus,
  Pin,
  ChevronLeft,
  ChevronRight,
  Bell,
  CreditCard,
  Users,
  Gift,
  HelpCircle,
  Brain,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useNexus } from "@/contexts/nexus-context"
import { NexusLogo } from "@/components/nexus-logo"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getConversations, type Conversation } from "@/lib/conversations"
import { GlobalSearch } from "@/components/global-search"

const iconMap = {
  Home,
  MessageCircle,
  Mic,
  Lock,
  Compass,
  Shield,
  Crown,
  User,
  Settings,
  Bell,
  CreditCard,
  Users,
  Gift,
  HelpCircle,
  Brain,
}

const navItems = [
  { path: "/butler", labelEn: "Butler", labelAr: "الخادم", icon: "Crown", isGold: true },
  { path: "/", labelEn: "Dashboard", labelAr: "لوحة التحكم", icon: "Home" },
  { path: "/chat", labelEn: "Chat", labelAr: "المحادثة", icon: "MessageCircle" },
  { path: "/voice", labelEn: "Voice", labelAr: "الصوت", icon: "Mic" },
  { path: "/vault", labelEn: "Vault", labelAr: "الخزنة", icon: "Lock", isGold: true },
  { path: "/domains", labelEn: "Domains", labelAr: "المجالات", icon: "Compass" },
  { path: "/notifications", labelEn: "Notifications", labelAr: "الإشعارات", icon: "Bell" },
  { path: "/billing", labelEn: "Billing", labelAr: "الفواتير", icon: "CreditCard" },
  { path: "/team", labelEn: "Team", labelAr: "الفريق", icon: "Users" },
  { path: "/referral", labelEn: "Referrals", labelAr: "الإحالات", icon: "Gift" },
  { path: "/profile", labelEn: "Profile", labelAr: "الملف الشخصي", icon: "User" },
  { path: "/memory", labelEn: "Memory", labelAr: "الذاكرة", icon: "Brain", isGold: true },
  { path: "/help", labelEn: "Help", labelAr: "المساعدة", icon: "HelpCircle" },
  { path: "/settings", labelEn: "Settings", labelAr: "الإعدادات", icon: "Settings" },
]

// Helper to group conversations by time
function getTimeGroup(dateStr: string, lang: "en" | "ar" | "bilingual"): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return lang === "ar" ? "اليوم" : "Today"
  if (diffDays === 1) return lang === "ar" ? "أمس" : "Yesterday"
  if (diffDays <= 7) return lang === "ar" ? "هذا الأسبوع" : "This Week"
  return lang === "ar" ? "أقدم" : "Older"
}

export function AppSidebar() {
  const pathname = usePathname()
  const { language, isRTL, sidebarCollapsed, setSidebarCollapsed } = useNexus()
  const [conversations, setConversations] = useState<Conversation[]>([])

  // Load conversations from localStorage
  useEffect(() => {
    const loadConversations = () => {
      const stored = getConversations()
      setConversations(stored)
    }
    loadConversations()

    // Listen for storage changes (from other tabs/components)
    window.addEventListener("storage", loadConversations)
    // Listen for custom event dispatched by conversation write operations (same-tab)
    const handleConversationUpdate = () => loadConversations()
    window.addEventListener("nexus-conversations-updated", handleConversationUpdate)
    // Fallback poll at 30s for edge cases (was 2s — reduced 15x to save CPU)
    const interval = setInterval(loadConversations, 30000)

    return () => {
      window.removeEventListener("storage", loadConversations)
      window.removeEventListener("nexus-conversations-updated", handleConversationUpdate)
      clearInterval(interval)
    }
  }, [])

  // Transform conversations for display
  const displayConversations = conversations.map(c => ({
    id: c.id,
    title: c.title,
    domain: c.domain || "general",
    pinned: false,
    timestamp: getTimeGroup(c.updatedAt, language),
  }))

  const groupedConversations = {
    pinned: displayConversations.filter((c) => c.pinned),
    today: displayConversations.filter((c) => !c.pinned && (c.timestamp === "Today" || c.timestamp === "اليوم")),
    yesterday: displayConversations.filter((c) => !c.pinned && (c.timestamp === "Yesterday" || c.timestamp === "أمس")),
    thisWeek: displayConversations.filter((c) => !c.pinned && (c.timestamp === "This Week" || c.timestamp === "هذا الأسبوع")),
  }

  return (
    <TooltipProvider>
      <aside
        role="navigation"
        className={cn(
          "hidden md:flex flex-col h-screen bg-sidebar border-e border-sidebar-border transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-[280px]"
        )}
        aria-label={language === "ar" ? "الشريط الجانبي" : "Sidebar navigation"}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          {!sidebarCollapsed && <NexusLogo size="md" />}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="h-8 w-8"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isRTL ? (
              sidebarCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : (
              sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Search */}
        {!sidebarCollapsed && (
          <div className="p-3">
            <GlobalSearch />
          </div>
        )}

        {/* Navigation */}
        <nav className="px-2 py-2">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = iconMap[item.icon as keyof typeof iconMap]
              const isActive = pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path))
              const label = language === "ar" ? item.labelAr : item.labelEn

              const navLink = (
                <Link
                  href={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary/10 text-sidebar-primary border-s-[3px] border-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    sidebarCollapsed && "justify-center px-2"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.isGold ? (
                    <span className="relative">
                      <Icon className="h-5 w-5 text-nexus-gold" />
                      <span className="absolute -top-0.5 -end-0.5 w-2 h-2 bg-nexus-gold rounded-full animate-pulse-sovereignty" />
                    </span>
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                  {!sidebarCollapsed && <span>{label}</span>}
                </Link>
              )

              return (
                <li key={item.path}>
                  {sidebarCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                      <TooltipContent side={isRTL ? "left" : "right"}>
                        <p>{label}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    navLink
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Conversations List */}
        {!sidebarCollapsed && (
          <ScrollArea className="flex-1 px-2">
            <div className="py-2 space-y-4">
              {Object.entries(groupedConversations).map(([group, conversations]) => {
                if (conversations.length === 0) return null
                const groupLabels: Record<string, { en: string; ar: string }> = {
                  pinned: { en: "Pinned", ar: "المثبتة" },
                  today: { en: "Today", ar: "اليوم" },
                  yesterday: { en: "Yesterday", ar: "أمس" },
                  thisWeek: { en: "This Week", ar: "هذا الأسبوع" },
                }

                return (
                  <div key={group}>
                    <h3 className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {language === "ar" ? groupLabels[group].ar : groupLabels[group].en}
                    </h3>
                    <ul className="space-y-0.5">
                      {conversations.map((conv) => (
                        <li key={conv.id}>
                          <Link
                            href={`/chat/${conv.id}`}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-sidebar-accent transition-colors group"
                          >
                            {conv.pinned && <Pin className="h-3 w-3 text-muted-foreground" />}
                            <span className="flex-1 truncate">{conv.title}</span>
                            <Lock className="h-3 w-3 text-nexus-gold opacity-60" aria-hidden="true" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}

        {/* New Chat Button */}
        <div className="p-3 border-t border-sidebar-border">
          {sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  size="icon"
                  className="w-full bg-nexus-jade hover:bg-nexus-jade-hover text-background"
                >
                  <Link href="/chat">
                    <Plus className="h-5 w-5" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side={isRTL ? "left" : "right"}>
                <p>{language === "ar" ? "محادثة جديدة" : "New Chat"}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              asChild
              className="w-full bg-nexus-jade hover:bg-nexus-jade-hover text-background"
            >
              <Link href="/chat">
                <Plus className="h-4 w-4 me-2" />
                {language === "ar" ? "محادثة جديدة" : "New Chat"}
              </Link>
            </Button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}
