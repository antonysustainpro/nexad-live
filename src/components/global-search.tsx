"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useNexus } from "@/contexts/nexus-context"
import { globalSearch, type SearchResult as APISearchResult } from "@/lib/api"
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, FileText, Settings, HelpCircle, Clock, Search, ArrowRight, Sparkles, Loader2 } from "lucide-react"
import { cn, sanitizeUrl } from "@/lib/utils"

interface SearchResult {
  id: string
  type: "conversation" | "document" | "setting" | "help"
  title: string
  titleAr?: string
  description?: string
  descriptionAr?: string
  href: string
  domain?: string
  date?: string
  tags?: string[]
}

// Quick links shown when search is empty (not mock search results)
const quickLinks: SearchResult[] = [
  { id: "ql-1", type: "setting", title: "Privacy Settings", titleAr: "إعدادات الخصوصية", description: "Manage your privacy preferences", descriptionAr: "إدارة تفضيلات الخصوصية", href: "/settings" },
  { id: "ql-2", type: "help", title: "Getting Started Guide", titleAr: "دليل البدء", description: "Learn how to use NexusAD", descriptionAr: "تعلم كيفية استخدام NexusAD", href: "/help" },
]

const recentSearches = ["budget analysis", "investor meeting", "privacy settings"]

const typeIcons: Record<SearchResult["type"], typeof MessageCircle> = {
  conversation: MessageCircle,
  document: FileText,
  setting: Settings,
  help: HelpCircle,
}

const typeLabels: Record<SearchResult["type"], { en: string; ar: string }> = {
  conversation: { en: "Conversations", ar: "المحادثات" },
  document: { en: "Documents", ar: "المستندات" },
  setting: { en: "Settings", ar: "الإعدادات" },
  help: { en: "Help", ar: "المساعدة" },
}

export function GlobalSearch() {
  const { language, isRTL } = useNexus()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [apiResults, setApiResults] = useState<SearchResult[]>([])

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // Debounced API search with stale-result protection
  useEffect(() => {
    if (!query.trim()) {
      setApiResults([])
      return
    }

    let cancelled = false

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await globalSearch(query)
        // SEC: Guard against stale closure - skip if query changed during fetch
        if (cancelled) return
        if (results) {
          // Map API results to local format
          setApiResults(results.map(r => ({
            ...r,
            titleAr: r.title, // Use same title for both
          })))
        } else {
          // API returned null - show empty results
          setApiResults([])
        }
      } catch {
        // API failed - show empty results
        if (!cancelled) setApiResults([])
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const filteredResults = apiResults

  const groupedResults = useMemo(() => {
    const groups: Record<SearchResult["type"], SearchResult[]> = {
      conversation: [],
      document: [],
      setting: [],
      help: [],
    }
    filteredResults.forEach(result => {
      groups[result.type].push(result)
    })
    return groups
  }, [filteredResults])

  // SEC-UI-117: Validate search result href before navigation to prevent open redirect from API
  const handleSelect = useCallback((href: string) => {
    setOpen(false)
    setQuery("")
    const safeHref = sanitizeUrl(href)
    if (safeHref !== "#") {
      router.push(safeHref)
    }
  }, [router])

  const ResultItem = ({ result }: { result: SearchResult }) => {
    const Icon = typeIcons[result.type]
    return (
      <CommandItem
        value={result.title}
        onSelect={() => handleSelect(result.href)}
        className="flex items-start gap-3 p-3 cursor-pointer"
      >
        <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {language === "ar" ? result.titleAr : result.title}
            </span>
            {result.domain && (
              <Badge variant="secondary" className="text-xs">
                {result.domain}
              </Badge>
            )}
          </div>
          {(result.description || result.descriptionAr) && (
            <p className="text-xs text-muted-foreground truncate">
              {language === "ar" ? result.descriptionAr : result.description}
            </p>
          )}
          {result.date && (
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              {result.date}
            </p>
          )}
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 self-center" />
      </CommandItem>
    )
  }

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-white/10 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors text-sm w-full md:w-64"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-start">
          {language === "ar" ? "بحث..." : "Search..."}
        </span>
        <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border border-white/10 bg-secondary/50 px-1.5 text-xs text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Command dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command className="rounded-lg border-white/10 bg-card" dir={isRTL ? "rtl" : "ltr"}>
          <CommandInput 
            placeholder={language === "ar" ? "ابحث في المحادثات، المستندات، الإعدادات..." : "Search conversations, documents, settings..."}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[400px]">
            {isSearching ? (
              <div className="py-12 flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-nexus-jade mb-4" />
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "جاري البحث..." : "Searching..."}
                </p>
              </div>
            ) : query.trim() === "" ? (
              <>
                {/* Recent searches */}
                <CommandGroup heading={language === "ar" ? "عمليات البحث الأخيرة" : "Recent Searches"}>
                  {recentSearches.map((search, index) => (
                    <CommandItem
                      key={index}
                      value={search}
                      onSelect={() => setQuery(search)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{search}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                {/* Quick actions */}
                <CommandGroup heading={language === "ar" ? "إجراءات سريعة" : "Quick Actions"}>
                  <CommandItem
                    value="new-chat"
                    onSelect={() => handleSelect("/chat")}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4 text-nexus-jade" />
                    <span>{language === "ar" ? "محادثة جديدة" : "New Chat"}</span>
                  </CommandItem>
                  <CommandItem
                    value="upload-document"
                    onSelect={() => handleSelect("/vault")}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <FileText className="h-4 w-4 text-nexus-gold" />
                    <span>{language === "ar" ? "رفع مستند" : "Upload Document"}</span>
                  </CommandItem>
                </CommandGroup>
              </>
            ) : filteredResults.length === 0 ? (
              <CommandEmpty className="py-12 text-center">
                <Search className="h-10 w-10 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  {language === "ar" ? "لم يتم العثور على نتائج" : "No results found"}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {language === "ar" ? `جرب البحث عن شيء آخر` : `Try searching for something else`}
                </p>
              </CommandEmpty>
            ) : (
              <>
                {Object.entries(groupedResults).map(([type, results]) => {
                  if (results.length === 0) return null
                  const typeLabel = typeLabels[type as SearchResult["type"]]
                  return (
                    <CommandGroup 
                      key={type} 
                      heading={language === "ar" ? typeLabel.ar : typeLabel.en}
                    >
                      {results.map(result => (
                        <ResultItem key={result.id} result={result} />
                      ))}
                    </CommandGroup>
                  )
                })}
              </>
            )}
          </CommandList>
          <div className="border-t border-white/10 p-2 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-secondary/50 border border-white/10">↑↓</kbd>
                {language === "ar" ? "للتنقل" : "to navigate"}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-secondary/50 border border-white/10">↵</kbd>
                {language === "ar" ? "للفتح" : "to open"}
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-secondary/50 border border-white/10">esc</kbd>
              {language === "ar" ? "للإغلاق" : "to close"}
            </span>
          </div>
        </Command>
      </CommandDialog>
    </>
  )
}
