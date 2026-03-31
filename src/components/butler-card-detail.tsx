"use client"

import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  X,
  ExternalLink,
  MessageCircle,
  Star,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  Info,
  Bookmark,
  FileText,
  Clock
} from "lucide-react"
import { cn, sanitizeUrl } from "@/lib/utils"
import type { ButlerCard } from "@/lib/types"

// Lazy-load recharts — only needed for market/crypto cards (large dependency ~200KB)
const LazySparkline = dynamic(
  () => import("recharts").then((mod) => {
    const { AreaChart, Area, ResponsiveContainer } = mod
    return {
      default: ({ data, isPositive }: { data: { value: number }[]; isPositive: boolean }) => (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={isPositive ? "#10B981" : "#EF4444"}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={isPositive ? "#10B981" : "#EF4444"}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={isPositive ? "#10B981" : "#EF4444"}
              strokeWidth={2}
              fill="url(#sparklineGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      ),
    }
  }),
  { ssr: false, loading: () => <div className="h-16 bg-muted motion-safe:animate-pulse rounded" /> }
)

interface ButlerCardDetailProps {
  card: ButlerCard | null
  onClose: () => void
  onAction: (cardId: string, actionType: string) => void
  language: "en" | "ar" | "bilingual"
  isRTL: boolean
}

// Placeholder sparkline data for market card visualization
// Actual data loaded from card.sparklineData when available
const placeholderSparklineData = [
  { value: 100 },
  { value: 100 },
  { value: 100 },
  { value: 100 },
  { value: 100 },
  { value: 100 },
  { value: 100 },
]

export function ButlerCardDetail({ card, onClose, onAction, language, isRTL }: ButlerCardDetailProps) {
  const router = useRouter()

  if (!card) return null

  const title = language === "ar" ? card.titleAr : card.title
  const summary = language === "ar" ? card.summaryAr : card.summary
  const affiliateText = language === "ar" ? card.affiliateDisclosureAr : card.affiliateDisclosure

  const handleAskButler = (query?: string) => {
    const searchParams = new URLSearchParams()
    if (query) {
      searchParams.set("q", query)
    } else {
      searchParams.set("q", title)
    }
    router.push(`/chat?${searchParams.toString()}`)
    onClose()
  }

  // SEC-UI-106: Validate actionUrl before opening to prevent open redirect attacks
  const handleExternalLink = () => {
    if (card.actionUrl) {
      const safeUrl = sanitizeUrl(card.actionUrl)
      if (safeUrl !== "#") {
        window.open(safeUrl, "_blank", "noopener,noreferrer")
      }
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString(language === "ar" ? "ar-AE" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    })
  }

  return (
    <Sheet open={card !== null} onOpenChange={() => onClose()}>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] rounded-t-3xl overflow-y-auto">
        {/* Handle indicator */}
        <div className="absolute top-3 inset-x-0 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-muted" />
        </div>

        <SheetHeader className="flex flex-row items-start justify-between pt-4 pb-4">
          <div className="flex-1 pe-4">
            <SheetTitle className={cn("text-xl font-bold", isRTL && "text-right")}>
              {title}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {language === "ar" ? "تفاصيل البطاقة" : "Card details"}
            </SheetDescription>
            <div className={cn("flex items-center gap-2 mt-2", isRTL && "flex-row-reverse justify-end")}>
              <Badge variant="secondary" className="text-xs">
                {card.source}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {formatTimestamp(card.timestamp)}
              </span>
            </div>
          </div>
          <SheetClose asChild>
            <button className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="Close">
              <X className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </button>
          </SheetClose>
        </SheetHeader>

        <div className="space-y-4 pb-8">
          {/* Deal Card Content */}
          {card.category === "deal" && (
            <>
              {/* Price comparison */}
              {(card.priceOriginal || card.priceDiscounted) && (
                <div className={cn("flex items-center gap-3 p-4 bg-[#10B981]/5 rounded-xl border border-[rgba(255,255,255,0.08)]", isRTL && "flex-row-reverse")}>
                  {card.priceOriginal && (
                    <span className="text-lg text-muted-foreground line-through">{card.priceOriginal}</span>
                  )}
                  {card.priceDiscounted && (
                    <span className="text-3xl font-bold text-[#10B981]">{card.priceDiscounted}</span>
                  )}
                  {card.rating && (
                    <div className="flex items-center gap-1 ms-auto">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          aria-hidden="true"
                          className={cn(
                            "h-4 w-4",
                            i < Math.floor(card.rating!) 
                              ? "fill-[#D4A574] text-[#D4A574]" 
                              : "text-[#8E8E93]/30"
                          )} 
                        />
                      ))}
                      <span className="text-sm font-medium ms-1">{card.rating}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Summary */}
              <p className={cn("text-muted-foreground", isRTL && "text-right")}>{summary}</p>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                {card.actionUrl && (
                  <Button onClick={handleExternalLink} className="w-full bg-[#C6AD90] hover:bg-[#D4C4A8] text-background rounded-md">
                    {language === "ar" ? "اشترِ الآن" : "Buy Now"}
                    <ExternalLink className="h-4 w-4 ms-2" aria-hidden="true" />
                  </Button>
                )}
                <Button variant="outline" onClick={() => handleAskButler(`Tell me more about this deal: ${title}`)}>
                  <MessageCircle className="h-4 w-4 me-2" aria-hidden="true" />
                  {language === "ar" ? "اسأل خادمك عن هذا العرض" : "Ask your Butler about this deal"}
                </Button>
              </div>

              {/* Affiliate disclosure */}
              {affiliateText && (
                <p className="text-xs text-muted-foreground/60 pt-2 border-t border-border/50">
                  {affiliateText}
                </p>
              )}
            </>
          )}

          {/* Market/Crypto Card Content */}
          {(card.category === "market" || card.category === "crypto") && card.marketData && (
            <>
              {/* Price and change */}
              <div className={cn("p-4 bg-card/50 rounded-xl", isRTL && "text-right")}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground font-mono">{card.marketData.symbol}</p>
                    <p className="text-3xl font-bold">${card.marketData.price.toLocaleString()}</p>
                  </div>
                  <div className={cn(
                    "flex flex-col items-end",
                    card.marketData.change >= 0 ? "text-[#10B981]" : "text-[#EF4444]"
                  )}>
                    <div className="flex items-center gap-1">
                      {card.marketData.change >= 0 ? (
                        <TrendingUp className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <TrendingDown className="h-5 w-5" aria-hidden="true" />
                      )}
                      <span className="text-xl font-bold">
                        {card.marketData.change >= 0 ? "+" : ""}{card.marketData.changePercent.toFixed(2)}%
                      </span>
                    </div>
                    <span className="text-sm">
                      {card.marketData.change >= 0 ? "+" : ""}${card.marketData.change.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Mini sparkline chart — lazy-loaded to reduce initial bundle */}
                <div className="h-16">
                  <LazySparkline
                    data={placeholderSparklineData}
                    isPositive={card.marketData.change >= 0}
                  />
                </div>
              </div>

              {/* Summary */}
              <p className={cn("text-muted-foreground", isRTL && "text-right")}>{summary}</p>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button onClick={() => handleAskButler(`Generate a full report on ${card.marketData?.symbol}`)}>
                  <FileText className="h-4 w-4 me-2" aria-hidden="true" />
                  {language === "ar" ? "إنشاء تقرير كامل" : "Generate Full Report"}
                </Button>
                <Button variant="outline" onClick={() => onAction(card.id, "save")}>
                  <Bookmark className="h-4 w-4 me-2" aria-hidden="true" />
                  {language === "ar" ? "تتبع هذا" : "Track this"}
                </Button>
              </div>
            </>
          )}

          {/* Alert Card Content */}
          {(card.category === "alert" || card.alertSeverity) && (
            <>
              {/* Severity badge */}
              {card.alertSeverity && (
                <Badge 
                  className={cn(
                    "text-sm",
                    card.alertSeverity === "critical" && "bg-[#EF4444]/10 text-[#EF4444]",
                    card.alertSeverity === "warning" && "bg-[#F59E0B]/10 text-[#F59E0B]",
                    card.alertSeverity === "info" && "bg-[#2563EB]/10 text-[#2563EB]"
                  )}
                >
                  {card.alertSeverity === "critical" && <AlertCircle className="h-4 w-4 me-1" aria-hidden="true" />}
                  {card.alertSeverity === "warning" && <AlertTriangle className="h-4 w-4 me-1" aria-hidden="true" />}
                  {card.alertSeverity === "info" && <Info className="h-4 w-4 me-1" aria-hidden="true" />}
                  {card.alertSeverity.charAt(0).toUpperCase() + card.alertSeverity.slice(1)}
                </Badge>
              )}

              {/* Full alert text */}
              <div className={cn("p-4 bg-card/50 rounded-xl", isRTL && "text-right")}>
                <p className="text-foreground">{summary}</p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button onClick={() => handleAskButler(summary)}>
                  <MessageCircle className="h-4 w-4 me-2" aria-hidden="true" />
                  {language === "ar" ? "اسأل خادمك" : "Ask your Butler"}
                </Button>
                <Button variant="outline" onClick={() => {
                  onAction(card.id, "dismiss")
                  onClose()
                }}>
                  <X className="h-4 w-4 me-2" aria-hidden="true" />
                  {language === "ar" ? "تجاهل" : "Dismiss"}
                </Button>
              </div>
            </>
          )}

          {/* News/Lifestyle/Other Card Content */}
          {!["deal", "market", "crypto", "alert"].includes(card.category) && !card.alertSeverity && (
            <>
              {/* Full summary */}
              <div className={cn("p-4 bg-card/50 rounded-xl", isRTL && "text-right")}>
                <p className="text-foreground">{summary}</p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                {card.actionUrl && (
                  <Button onClick={handleExternalLink}>
                    {language === "ar" ? "اقرأ المزيد" : "Read More"}
                    <ExternalLink className="h-4 w-4 ms-2" aria-hidden="true" />
                  </Button>
                )}
                <Button variant="outline" onClick={() => handleAskButler()}>
                  <MessageCircle className="h-4 w-4 me-2" aria-hidden="true" />
                  {language === "ar" ? "اسأل خادمك" : "Ask your Butler"}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
