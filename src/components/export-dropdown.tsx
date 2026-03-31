"use client"

import { useState } from "react"
import { FileText, FileType, Code, FileCode, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { exportDocument } from "@/lib/api"

export type ExportFormat = "pdf" | "docx" | "html" | "md"

interface ExportDropdownProps {
  /**
   * Function to get the content to export.
   * Called when user selects a format.
   */
  getContent: () => string
  /**
   * Document title for cover page
   */
  title: string
  /**
   * Optional subtitle
   */
  subtitle?: string
  /**
   * Language for labels - uses "ar" for Arabic, defaults to English for all other values
   */
  language?: string
  /**
   * Disabled state
   */
  disabled?: boolean
  /**
   * Optional className for the trigger button
   */
  className?: string
}

const formatIcons = {
  pdf: FileText,
  docx: FileType,
  html: Code,
  md: FileCode,
}

const formatLabels = {
  en: {
    pdf: "PDF Document",
    docx: "Word Document",
    html: "HTML Page",
    md: "Markdown",
    export: "Export",
    exporting: "Exporting...",
    success: "Document exported successfully",
    error: "Export failed",
    noContent: "No content to export",
  },
  ar: {
    pdf: "مستند PDF",
    docx: "مستند Word",
    html: "صفحة HTML",
    md: "Markdown",
    export: "تصدير",
    exporting: "جاري التصدير...",
    success: "تم تصدير المستند بنجاح",
    error: "فشل التصدير",
    noContent: "لا يوجد محتوى للتصدير",
  },
}

export function ExportDropdown({
  getContent,
  title,
  subtitle,
  language = "en",
  disabled = false,
  className,
}: ExportDropdownProps) {
  const [isExporting, setIsExporting] = useState(false)
  // Use Arabic labels if language is "ar", otherwise default to English
  const labels = language === "ar" ? formatLabels.ar : formatLabels.en

  const handleExport = async (format: ExportFormat) => {
    const content = getContent()

    if (!content || content.trim().length === 0) {
      toast.error(labels.noContent)
      return
    }

    setIsExporting(true)

    try {
      const blob = await exportDocument({
        content,
        title,
        format,
        include_cover: true,
        include_toc: true,
        confidential: true,
        subtitle,
      })

      if (!blob) {
        throw new Error("No data received")
      }

      // Create download link
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url

      // Build filename
      const safeTitle = title.replace(/[^a-zA-Z0-9\s-_]/g, "").replace(/\s+/g, "_").slice(0, 50)
      const extensions = { pdf: ".pdf", docx: ".docx", html: ".html", md: ".md" }
      a.download = `${safeTitle}${extensions[format]}`

      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(labels.success)
    } catch (error) {
      console.error("Export error:", error)
      toast.error(labels.error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isExporting}
          className={className}
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 me-2 motion-safe:animate-spin" aria-hidden="true" />
              {labels.exporting}
            </>
          ) : (
            <>
              <Download className="h-4 w-4 me-2" aria-hidden="true" />
              {labels.export}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>
          {language === "ar" ? "اختر التنسيق" : "Select Format"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(["pdf", "docx", "html", "md"] as const).map((format) => {
          const Icon = formatIcons[format]
          return (
            <DropdownMenuItem
              key={format}
              onClick={() => handleExport(format)}
              disabled={isExporting}
              className="cursor-pointer"
            >
              <Icon className="h-4 w-4 me-2" aria-hidden="true" />
              {labels[format]}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
