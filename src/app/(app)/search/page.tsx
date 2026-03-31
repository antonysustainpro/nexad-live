"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { motion } from "motion/react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useNexus } from "@/contexts/nexus-context"
import { globalSearch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, MessageCircle, FileText, Settings, HelpCircle, Calendar, Tag, LayoutGrid, List, Filter, X, ArrowLeft, Loader2 } from "lucide-react"
import { cn, sanitizeUrl } from "@/lib/utils"

interface SearchResult {
  id: string
  type: "conversation" | "document" | "setting" | "help"
  title: string
  titleAr: string
  description?: string
  descriptionAr?: string
  href: string
  domain?: string
  date: string
  tags?: string[]
  highlight?: string
}

// Empty placeholder - search results are loaded from API only
const emptyResults: SearchResult[] = []

const typeFilters = [
  { id: "all", label: "All", labelAr: "الكل", icon: Search },
  { id: "conversation", label: "Conversations", labelAr: "المحادثات", icon: MessageCircle },
  { id: "document", label: "Documents", labelAr: "المستندات", icon: FileText },
  { id: "setting", label: "Settings", labelAr: "الإعدادات", icon: Settings },
  { id: "help", label: "Help", labelAr: "المساعدة", icon: HelpCircle },
]

const typeIcons: Record<string, typeof MessageCircle> = {
  conversation: MessageCircle,
  document: FileText,
  setting: Settings,
  help: HelpCircle,
}

function SearchPageContent() {
  const { language, isRTL } = useNexus()
  const searchParams = useSearchParams()
  // SEC-BL-007: Sanitize URL-provided search query — limit length, strip null bytes
  const rawQuery = searchParams.get("q") || ""
  const initialQuery = rawQuery.replace(/\0/g, "").slice(0, 500)

  const [query, setQuery] = useState(initialQuery)
  const [typeFilter, setTypeFilter] = useState("all")
  const [sortBy, setSortBy] = useState("relevance")
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const [showFilters, setShowFilters] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [apiResults, setApiResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

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
          // Map API results to local format with Arabic titles
          setApiResults(results.map(r => ({
            ...r,
            titleAr: r.title,
            descriptionAr: r.description,
            date: r.date || new Date().toISOString().split('T')[0],
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

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    apiResults.forEach(r => r.tags?.forEach(t => tags.add(t)))
    return Array.from(tags)
  }, [apiResults])

  const filteredResults = useMemo(() => {
    // Only show results when user has searched
    let results = apiResults

    // Filter by type
    if (typeFilter !== "all") {
      results = results.filter(r => r.type === typeFilter)
    }

    // Filter by tags
    if (selectedTags.length > 0) {
      results = results.filter(r => r.tags?.some(t => selectedTags.includes(t)))
    }

    // Sort — SEC-BL-008: Guard against invalid date strings returning NaN from getTime()
    if (sortBy === "date") {
      results = [...results].sort((a, b) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        // Push items with invalid dates to end
        if (isNaN(dateA) && isNaN(dateB)) return 0
        if (isNaN(dateA)) return 1
        if (isNaN(dateB)) return -1
        return dateB - dateA
      })
    } else if (sortBy === "name") {
      results = [...results].sort((a, b) => a.title.localeCompare(b.title))
    }

    return results
  }, [apiResults, typeFilter, sortBy, selectedTags])

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const ResultCard = ({ result }: { result: SearchResult }) => {
    const Icon = typeIcons[result.type]
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* SEC-UI-118: Sanitize API-returned href to prevent open redirect */}
        <Link href={sanitizeUrl(result.href)}>
          <Card className={cn(
            "border-white/10 hover:border-nexus-jade/30 transition-all cursor-pointer card-hover",
            viewMode === "grid" ? "h-full" : ""
          )}>
            <CardContent className={cn(
              "p-4",
              viewMode === "list" ? "flex items-start gap-4" : ""
            )}>
              <div className={cn(
                "w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0",
                viewMode === "grid" ? "mb-3" : ""
              )}>
                <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium truncate">
                    {language === "ar" ? result.titleAr : result.title}
                  </h3>
                  {result.domain && (
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      {result.domain}
                    </Badge>
                  )}
                </div>
                {(result.description || result.descriptionAr) && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {language === "ar" ? result.descriptionAr : result.description}
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground/60">
                    {new Date(result.date).toLocaleDateString(language === "ar" ? "ar-AE" : "en-US")}
                  </span>
                  {result.tags?.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs border-white/10">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </motion.div>
    )
  }

  return (
    <div 
      className="min-h-screen bg-background p-4 md:p-8"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href="/chat" 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {language === "ar" ? "العودة" : "Back"}
          </Link>
          <h1 className="text-title-1 mb-2">
            {language === "ar" ? "البحث" : "Search"}
          </h1>
        </div>

        {/* Search input */}
        <div className="relative mb-6">
          <Search className={cn(
            "absolute top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground",
            isRTL ? "right-4" : "left-4"
          )} aria-hidden="true" />
          <label htmlFor="global-search" className="sr-only">
            {language === "ar" ? "ابحث في كل شيء" : "Search everything"}
          </label>
          <Input
            id="global-search"
            type="text"
            placeholder={language === "ar" ? "ابحث في كل شيء..." : "Search everything..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={cn(
              "h-12 bg-secondary/50 border-white/10 focus:border-nexus-jade text-lg",
              isRTL ? "pr-12" : "pl-12"
            )}
            autoFocus
            maxLength={500}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground",
                isRTL ? "left-4" : "right-4"
              )}
              aria-label={language === "ar" ? "مسح البحث" : "Clear search"}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Filters sidebar */}
          <div className={cn(
            "w-full md:w-64 flex-shrink-0",
            showFilters ? "block" : "hidden md:block"
          )}>
            <Card className="border-white/10 sticky top-4">
              <CardContent className="p-4 space-y-6">
                {/* Type filter */}
                <div>
                  <h3 className="text-sm font-medium mb-3">
                    {language === "ar" ? "النوع" : "Type"}
                  </h3>
                  <Tabs value={typeFilter} onValueChange={setTypeFilter}>
                    <TabsList className="flex flex-wrap gap-1 h-auto bg-transparent p-0">
                      {typeFilters.map(filter => (
                        <TabsTrigger
                          key={filter.id}
                          value={filter.id}
                          className="data-[state=active]:bg-nexus-jade data-[state=active]:text-background text-xs px-2 py-1"
                        >
                          {language === "ar" ? filter.labelAr : filter.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                {/* Tags filter */}
                <div>
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Tag className="h-4 w-4" aria-hidden="true" />
                    {language === "ar" ? "الوسوم" : "Tags"}
                  </h3>
                  <div className="space-y-2">
                    {allTags.map(tag => (
                      <div key={tag} className="flex items-center gap-2">
                        <Checkbox
                          id={tag}
                          checked={selectedTags.includes(tag)}
                          onCheckedChange={() => toggleTag(tag)}
                          className="border-white/20 data-[state=checked]:bg-nexus-jade data-[state=checked]:border-nexus-jade"
                        />
                        <Label htmlFor={tag} className="text-sm cursor-pointer">
                          {tag}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Clear filters */}
                {(typeFilter !== "all" || selectedTags.length > 0) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setTypeFilter("all"); setSelectedTags([]) }}
                    className="w-full text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4 me-2" aria-hidden="true" />
                    {language === "ar" ? "مسح الفلاتر" : "Clear Filters"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="flex-1">
            {/* Results header */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {language === "ar" 
                  ? `${filteredResults.length} نتيجة` 
                  : `${filteredResults.length} results`}
              </p>
              <div className="flex items-center gap-2">
                {/* Mobile filter toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  className="md:hidden border-white/10"
                  onClick={() => setShowFilters(!showFilters)}
                  aria-label={language === "ar" ? "تبديل الفلاتر" : "Toggle filters"}
                  aria-expanded={showFilters}
                >
                  <Filter className="h-4 w-4" aria-hidden="true" />
                </Button>
                
                {/* Sort */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-32 h-8 text-xs border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">{language === "ar" ? "الصلة" : "Relevance"}</SelectItem>
                    <SelectItem value="date">{language === "ar" ? "التاريخ" : "Date"}</SelectItem>
                    <SelectItem value="name">{language === "ar" ? "الاسم" : "Name"}</SelectItem>
                  </SelectContent>
                </Select>

                {/* View mode */}
                <div className="flex border border-white/10 rounded-lg overflow-hidden" role="group" aria-label={language === "ar" ? "وضع العرض" : "View mode"}>
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "p-1.5",
                      viewMode === "list" ? "bg-secondary" : "hover:bg-secondary/50"
                    )}
                    aria-label={language === "ar" ? "عرض قائمة" : "List view"}
                    aria-pressed={viewMode === "list"}
                  >
                    <List className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "p-1.5",
                      viewMode === "grid" ? "bg-secondary" : "hover:bg-secondary/50"
                    )}
                    aria-label={language === "ar" ? "عرض شبكة" : "Grid view"}
                    aria-pressed={viewMode === "grid"}
                  >
                    <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            {/* Results grid/list */}
            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-8 w-8 motion-safe:animate-spin text-nexus-jade mb-4" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "جاري البحث..." : "Searching..."}
                </p>
              </div>
            ) : filteredResults.length > 0 ? (
              <div className={cn(
                viewMode === "grid" 
                  ? "grid grid-cols-1 md:grid-cols-2 gap-4" 
                  : "space-y-3"
              )}>
                {filteredResults.map(result => (
                  <ResultCard key={result.id} result={result} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" aria-hidden="true" />
                <h3 className="text-lg font-medium mb-2">
                  {language === "ar" ? "لم يتم العثور على نتائج" : "No Results Found"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" 
                    ? "جرب تغيير معايير البحث أو الفلاتر" 
                    : "Try adjusting your search criteria or filters"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <SearchPageContent />
    </Suspense>
  )
}
