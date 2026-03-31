"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { motion } from "motion/react"
import {
  ChevronLeft,
  FileText,
  Download,
  Share2,
  Trash2,
  Calendar,
  Layers,
  Eye,
  Lock,
  MessageCircle,
  ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useNexus } from "@/contexts/nexus-context"
import { ShardMap } from "@/components/shard-map"
import { DeleteCeremony } from "@/components/delete-ceremony"

import { getVaultDocument, type VaultDocumentDetail } from "@/lib/api"
import { sanitizeFilename } from "@/lib/utils"
import { auditVault } from "@/lib/audit-logger"

export default function VaultDocumentPage() {
  const { language } = useNexus()
  const params = useParams()
  const [showDeleteCeremony, setShowDeleteCeremony] = useState(false)
  const [doc, setDoc] = useState<VaultDocumentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load document from API with proper cleanup
  useEffect(() => {
    const abortController = new AbortController()
    let isMounted = true

    setLoading(true)
    setError(null)

    getVaultDocument(params.id as string, abortController.signal)
      .then((document) => {
        if (!isMounted) return
        setDoc(document)
        setLoading(false)
        // AUD-010: Log vault document access
        auditVault("document.viewed", params.id as string)
      })
      .catch((err) => {
        if (!isMounted) return
        if (err?.name === "AbortError") return
        setError("We couldn't load this document. Please try again in a moment.")
        setLoading(false)
      })

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [params.id])

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="motion-safe:animate-pulse text-muted-foreground">
          {language === "ar" ? "جاري التحميل..." : "Loading..."}
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-background p-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/vault"
            className="inline-flex items-center text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 me-1" aria-hidden="true" />
            {language === "ar" ? "العودة للخزنة" : "Back to Vault"}
          </Link>
          <div className="text-center py-16">
            <FileText className="h-16 w-16 mx-auto text-destructive/30 mb-4" aria-hidden="true" />
            <h1 className="text-xl font-semibold mb-2 text-destructive">
              {language === "ar" ? "خطأ في التحميل" : "Error Loading Document"}
            </h1>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  // Show empty state if document not found
  if (!doc) {
    return (
      <div className="min-h-screen bg-background p-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/vault"
            className="inline-flex items-center text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 me-1" aria-hidden="true" />
            {language === "ar" ? "العودة للخزنة" : "Back to Vault"}
          </Link>
          <div className="text-center py-16">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" aria-hidden="true" />
            <h1 className="text-xl font-semibold mb-2">
              {language === "ar" ? "المستند غير موجود" : "Document Not Found"}
            </h1>
            <p className="text-muted-foreground">
              {language === "ar"
                ? "هذا المستند غير موجود أو تم حذفه"
                : "This document doesn't exist or has been deleted"}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-5xl mx-auto">
        {/* Back Link */}
        <Link 
          href="/vault" 
          className="inline-flex items-center text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 me-1" aria-hidden="true" />
          {language === "ar" ? "العودة للخزنة" : "Back to Vault"}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Document Header */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-4"
            >
              <div className="p-4 rounded-xl bg-nexus-gold/10">
                <FileText className="h-8 w-8 text-nexus-gold" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-semibold mb-2">
                  {language === "ar" ? doc.nameAr : doc.name}
                </h1>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{doc.type}</Badge>
                  <Badge variant="outline" className="text-nexus-gold border-nexus-gold/30">
                    {language === "ar" ? doc.domainAr : doc.domain}
                  </Badge>
                </div>
              </div>
            </motion.div>

            {/* Document Content */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardContent className="p-8">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-foreground/80 leading-relaxed">
                      {doc.content}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap gap-3"
            >
              {/* Hidden until backend implementation complete */}
              {/* Edit button previously showed an alert saying "coming soon" — removed to avoid confusing users */}
              <Button 
                variant="outline" 
                className="active:scale-[0.98] transition-transform"
                onClick={() => {
                  // SEC-UI-115: Sanitize filename to prevent path traversal injection
                  const safeName = sanitizeFilename(doc.name)
                  const blob = new Blob([doc.content], { type: "text/plain" })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = `${safeName}.txt`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                <Download className="h-4 w-4 me-2" aria-hidden="true" />
                {language === "ar" ? "تحميل" : "Download"}
              </Button>
              <Button 
                variant="outline" 
                className="active:scale-[0.98] transition-transform"
                onClick={async () => {
                  // SEC-SM-001: Clipboard API can throw if permission denied
                  try {
                    await navigator.clipboard.writeText(window.location.href)
                    alert(language === "ar" ? "تم نسخ الرابط" : "Link copied to clipboard")
                  } catch {
                    alert(language === "ar" ? "تعذّر النسخ. يرجى المحاولة مرة أخرى." : "Couldn't copy to clipboard. Please try again.")
                  }
                }}
              >
                <Share2 className="h-4 w-4 me-2" aria-hidden="true" />
                {language === "ar" ? "مشاركة" : "Share"}
              </Button>
              <Button 
                variant="outline" 
                className="text-destructive border-destructive/30 hover:bg-destructive/5 active:scale-[0.98] transition-transform"
                onClick={() => setShowDeleteCeremony(true)}
              >
                <Trash2 className="h-4 w-4 me-2" aria-hidden="true" />
                {language === "ar" ? "حذف وإثبات" : "Delete & Prove It"}
              </Button>
            </motion.div>

            {/* Related Conversations */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {language === "ar" ? "المحادثات ذات الصلة" : "Related Conversations"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {doc.relatedConversations.map((conv) => (
                    <Link
                      key={conv.id}
                      href={`/chat/${conv.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <MessageCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <span className="text-sm">{conv.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{conv.date}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Metadata */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {language === "ar" ? "البيانات الوصفية" : "Metadata"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-muted-foreground">{language === "ar" ? "تاريخ الإضافة" : "Date Added"}</p>
                      <p className="text-sm">{doc.dateAdded}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Layers className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-muted-foreground">{language === "ar" ? "عدد الأجزاء" : "Chunk Count"}</p>
                      <p className="text-sm">{doc.chunks} {language === "ar" ? "أجزاء" : "chunks"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Eye className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-muted-foreground">{language === "ar" ? "مرات الاستخدام" : "Usage Count"}</p>
                      <p className="text-sm">{doc.usageCount} {language === "ar" ? "مراجع" : "references"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Shard Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {language === "ar" ? "توزيع الأجزاء" : "Shard Distribution"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ShardMap className="h-[120px] w-full" />
                </CardContent>
              </Card>
            </motion.div>

            {/* Encryption Fingerprint */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="border-nexus-gold/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Lock className="h-4 w-4 text-nexus-gold" aria-hidden="true" />
                    {language === "ar" ? "بصمة التشفير" : "Encryption Fingerprint"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-sm text-nexus-gold/80 break-all">
                    {doc.fingerprint}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Delete Ceremony Modal */}
      {showDeleteCeremony && (
        <DeleteCeremony
          documentId={params.id as string}
          documentName={language === "ar" ? doc.nameAr : doc.name}
          onComplete={() => setShowDeleteCeremony(false)}
          onCancel={() => setShowDeleteCeremony(false)}
        />
      )}
    </div>
  )
}
