"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import {
  ChevronLeft,
  FileText,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  Filter,
} from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import Link from "next/link"
import { cn, sanitizeUrl } from "@/lib/utils"
import {
  getInvoices,
  type Invoice,
  USD_TO_AED,
  formatCurrency,
  formatDate,
} from "@/lib/billing-api"

export default function InvoicesPage() {
  const { language, isRTL } = useNexus()
  const locale = language === "ar" ? "ar-AE" : "en-US"

  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getInvoices()
        setInvoices(data ?? [])
      } catch {
        setInvoices([])
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Resolved invoices list (never null after loading)
  const invoiceList = invoices ?? []

  // Filter invoices by date range
  // SEC-BL-015: Handle invalid invoice dates — show them when no filter is active, exclude when filtered
  const filteredInvoices = invoiceList.filter((invoice) => {
    const date = new Date(invoice.date)
    if (isNaN(date.getTime())) {
      // If date is invalid, only show when no filter is applied
      return !dateRange.from && !dateRange.to
    }
    if (dateRange.from && date < dateRange.from) return false
    if (dateRange.to && date > dateRange.to) return false
    return true
  })

  const statusConfig: Record<Invoice["status"], { icon: typeof CheckCircle2; color: string; labelEn: string; labelAr: string }> = {
    paid: {
      icon: CheckCircle2,
      color: "text-[#10B981]",
      labelEn: "Paid",
      labelAr: "مدفوع",
    },
    pending: {
      icon: Clock,
      color: "text-[#F59E0B]",
      labelEn: "Pending",
      labelAr: "معلق",
    },
    failed: {
      icon: XCircle,
      color: "text-[#EF4444]",
      labelEn: "Failed",
      labelAr: "فشل",
    },
  }

  const MotionCard = prefersReducedMotion ? Card : motion.create(Card)

  // Skeleton loading state
  if (loading) {
    return (
      <div className={cn("p-6 space-y-6 max-w-4xl mx-auto pb-20", isRTL && "text-right")}>
        <Skeleton className="h-4 w-32" />
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-56 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("p-6 space-y-6 max-w-4xl mx-auto pb-20", isRTL && "text-right")}>
      {/* Back Link */}
      <Link
        href="/billing"
        className={cn(
          "inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors",
          isRTL && "flex-row-reverse"
        )}
      >
        <ChevronLeft className={cn("h-4 w-4", isRTL && "rotate-180")} aria-hidden="true" />
        {language === "ar" ? "العودة للفواتير" : "Back to Billing"}
      </Link>

      {/* Header */}
      <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
        <div>
          <h1 className="text-title-1 flex items-center gap-2">
            <FileText className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            {language === "ar" ? "سجل الفواتير" : "Invoice History"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === "ar"
              ? "عرض وتحميل فواتيرك السابقة"
              : "View and download your past invoices"}
          </p>
        </div>

        {/* Date Filter - only show when there are invoices */}
        {invoiceList.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2", isRTL && "flex-row-reverse")}>
                <Filter className="h-4 w-4" aria-hidden="true" />
                {language === "ar" ? "تصفية" : "Filter"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align={isRTL ? "start" : "end"}>
              <div className="p-3 border-b">
                <p className="font-medium text-sm">
                  {language === "ar" ? "نطاق التاريخ" : "Date Range"}
                </p>
              </div>
              <CalendarComponent
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                numberOfMonths={1}
              />
              {(dateRange.from || dateRange.to) && (
                <div className="p-3 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setDateRange({})}
                  >
                    {language === "ar" ? "مسح الفلتر" : "Clear Filter"}
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Active Filter Display */}
      {(dateRange.from || dateRange.to) && (
        <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
          <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">
            {dateRange.from && formatDate(dateRange.from.toISOString(), locale)}
            {dateRange.from && dateRange.to && " - "}
            {dateRange.to && formatDate(dateRange.to.toISOString(), locale)}
          </span>
        </div>
      )}

      {/* Invoices Table */}
      <MotionCard
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <CardHeader>
          <CardTitle className="text-headline">
            {language === "ar" ? "الفواتير" : "Invoices"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoiceList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
              <p className="font-medium">
                {language === "ar"
                  ? "لا توجد فواتير بعد"
                  : "No invoices yet"}
              </p>
              <p className="text-sm mt-1">
                {language === "ar"
                  ? "ستظهر فواتيرك هنا عند الاشتراك في خطة مدفوعة."
                  : "Your invoices will appear here when you subscribe to a paid plan."}
              </p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
              <p>
                {language === "ar"
                  ? "لا توجد فواتير تطابق التصفية"
                  : "No invoices match the selected filter"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={"text-start"}>
                    {language === "ar" ? "التاريخ" : "Date"}
                  </TableHead>
                  <TableHead className={"text-start"}>
                    {language === "ar" ? "رقم الفاتورة" : "Invoice"}
                  </TableHead>
                  <TableHead className={"text-start"}>
                    {language === "ar" ? "المبلغ" : "Amount"}
                  </TableHead>
                  <TableHead className={"text-start"}>
                    {language === "ar" ? "الحالة" : "Status"}
                  </TableHead>
                  <TableHead className={"text-start"}>
                    <span className="sr-only">{language === "ar" ? "إجراءات" : "Actions"}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => {
                  const status = statusConfig[invoice.status]
                  const StatusIcon = status.icon

                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className={"text-start"}>
                        {formatDate(invoice.date, locale)}
                      </TableCell>
                      <TableCell className={cn("font-mono text-sm", "text-start")}>
                        {invoice.id}
                      </TableCell>
                      <TableCell className={"text-start"}>
                        <div>
                          <p>{formatCurrency(invoice.amountUsd, "USD", locale)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(invoice.amountUsd * USD_TO_AED, "AED", locale)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "gap-1",
                            isRTL && "flex-row-reverse"
                          )}
                        >
                          <StatusIcon className={cn("h-3 w-3", status.color)} aria-hidden="true" />
                          {language === "ar" ? status.labelAr : status.labelEn}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                          onClick={() => { const safeUrl = sanitizeUrl(invoice.pdfUrl); if (safeUrl !== "#") window.open(safeUrl, "_blank", "noopener,noreferrer") }}
                          aria-label={language === "ar" ? "تحميل PDF" : "Download PDF"}
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only sm:not-sr-only">PDF</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </MotionCard>

      {/* Summary - only show when there are invoices */}
      {invoiceList.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          {language === "ar"
            ? `عرض ${filteredInvoices.length} من ${invoiceList.length} فاتورة`
            : `Showing ${filteredInvoices.length} of ${invoiceList.length} invoices`}
        </p>
      )}
    </div>
  )
}
