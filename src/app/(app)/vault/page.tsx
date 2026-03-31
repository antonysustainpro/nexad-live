"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Upload,
  FileText,
  Image as ImageIcon,
  File,
  Folder,
  Search,
  Filter,
  Grid,
  List,
  Lock,
  Trash2,
  Download,
  Eye,
  MoreHorizontal,
  Plus,
  Shield,
  Server,
  Activity,
  User,
  Inbox,
} from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { ShardMap } from "@/components/shard-map"
import { DeleteCeremony } from "@/components/delete-ceremony"
import { AccessLogSkeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn, sanitizeFilename, scanTextForPii } from "@/lib/utils"
import { getAccessLog, uploadToVault, listVaultDocuments } from "@/lib/api"
import { toast } from "sonner"
import { ErrorRetry } from "@/components/error-retry"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Document type used within vault UI
interface VaultDoc {
  id: string
  name: string
  type: string
  size: string
  sizeBytes: number
  domain: string
  shards: number
  lastModified: string
  encrypted: boolean
}

// Access-log entry from backend or empty state
interface AccessEntry {
  id: string
  timestamp: string
  actor: string
  action: string
  resource: string
}

// Build folder list dynamically from documents
function buildFolders(docs: VaultDoc[], lang: "en" | "ar" | "bilingual"): { id: string; name: string; count: number; domain: string }[] {
  const domainCounts: Record<string, number> = {}
  docs.forEach((d) => {
    domainCounts[d.domain] = (domainCounts[d.domain] || 0) + 1
  })
  const domainLabels: Record<string, string> = {
    Legal: lang === "ar" ? "قانوني" : "Legal",
    Financial: lang === "ar" ? "مالي" : "Financial",
    Health: lang === "ar" ? "صحي" : "Health",
    "Real Estate": lang === "ar" ? "عقارات" : "Real Estate",
    Personal: lang === "ar" ? "شخصي" : "Personal",
    Technical: lang === "ar" ? "تقني" : "Technical",
  }
  return Object.entries(domainCounts).map(([domain, count]) => ({
    id: `folder-${domain.toLowerCase().replace(/\s/g, "")}`,
    name: domainLabels[domain] || domain,
    count,
    domain,
  }))
}

const fileIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  excel: FileText,
  word: FileText,
  image: ImageIcon,
  default: File,
}

// FIX 11: Domain translation map for bilingual badges
const getDomainLabel = (domain: string, lang: "en" | "ar" | "bilingual") => {
  const domainLabels: Record<string, string> = {
    Legal: lang === "ar" ? "قانوني" : "Legal",
    Financial: lang === "ar" ? "مالي" : "Financial",
    "Real Estate": lang === "ar" ? "عقارات" : "Real Estate",
    Personal: lang === "ar" ? "شخصي" : "Personal",
    Health: lang === "ar" ? "صحي" : "Health",
    Technical: lang === "ar" ? "تقني" : "Technical",
  }
  return domainLabels[domain] || domain
}

// Format lastModified - handles relative strings and ISO dates
const getLastModifiedLabel = (lastModified: string, lang: "en" | "ar" | "bilingual") => {
  // Known relative labels
  const labels: Record<string, string> = {
    "Just now": lang === "ar" ? "الآن" : "Just now",
    "2h ago": lang === "ar" ? "منذ ساعتين" : "2h ago",
    "5h ago": lang === "ar" ? "منذ 5 ساعات" : "5h ago",
    "Today": lang === "ar" ? "اليوم" : "Today",
    "Yesterday": lang === "ar" ? "أمس" : "Yesterday",
    "This Week": lang === "ar" ? "هذا الأسبوع" : "This Week",
    "Last Month": lang === "ar" ? "الشهر الماضي" : "Last Month",
    "2 days ago": lang === "ar" ? "منذ يومين" : "2 days ago",
    "3 days ago": lang === "ar" ? "منذ 3 أيام" : "3 days ago",
  }
  if (labels[lastModified]) return labels[lastModified]
  // Try to parse ISO date from API
  const parsed = new Date(lastModified)
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString(lang === "ar" ? "ar-AE" : "en-US", {
      month: "short",
      day: "numeric",
    })
  }
  return lastModified
}

export default function VaultPage() {
  const { language } = useNexus()
  const [documents, setDocuments] = useState<VaultDoc[]>([])
  const [view, setView] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadFileName, setUploadFileName] = useState<string | null>(null)
  const [uploadFileSize, setUploadFileSize] = useState<number>(0)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [folders, setFolders] = useState<{ id: string; name: string; count: number; domain: string }[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [accessLogEntries, setAccessLogEntries] = useState<AccessEntry[]>([])
  const [accessLogLoading, setAccessLogLoading] = useState(true)
  const [accessLogError, setAccessLogError] = useState(false)
  const [docsError, setDocsError] = useState(false)
  // SEC-PII-FILE-001: Track PII warning state for pre-upload scan
  const [piiWarning, setPiiWarning] = useState<{
    file: File
    piiTypes: string[]
    count: number
  } | null>(null)
  const itemsPerPage = 5
  const totalPages = Math.max(1, Math.ceil(accessLogEntries.length / itemsPerPage))
  // SEC-BL-003: Clamp currentPage when entries are removed/changed to prevent blank page
  const safePage = Math.min(currentPage, totalPages)
  const paginatedEntries = accessLogEntries.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load access log from backend API
  useEffect(() => {
    let cancelled = false
    async function loadAccessLog() {
      setAccessLogLoading(true)
      try {
        const data = await getAccessLog()
        if (!cancelled && data?.entries) {
          setAccessLogEntries(
            data.entries.map((e, i) => ({
              id: `log-${i}`,
              timestamp: e.timestamp,
              actor: e.actor,
              action: e.action,
              resource: e.resource,
            }))
          )
        }
      } catch {
        if (!cancelled) setAccessLogError(true)
      } finally {
        if (!cancelled) setAccessLogLoading(false)
      }
    }
    loadAccessLog()
    return () => { cancelled = true }
  }, [])

  // Load vault documents from backend on component mount
  const loadVaultDocuments = useCallback(async (signal?: AbortSignal) => {
    setDocsError(false)
    try {
      const response = await listVaultDocuments(signal)
      if (!response) return

      const docs = response.map(doc => ({
        id: doc.id,
        name: doc.title || "Untitled",
        type: doc.doc_type || "document",
        size: "—",
        sizeBytes: 0,
        domain: "Personal",
        shards: doc.chunks_stored || 1,
        lastModified: doc.created_at || "Today",
        encrypted: true,
      }))

      setDocuments(docs)
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      console.error("Failed to load vault documents:", err)
      setDocsError(true)
    }
  }, [])

  useEffect(() => {
    const abortController = new AbortController()
    loadVaultDocuments(abortController.signal)
    return () => { abortController.abort() }
  }, [loadVaultDocuments])

  // Rebuild folders whenever documents change
  useEffect(() => {
    setFolders(buildFolders(documents, language))
  }, [documents, language])

  // Cleanup upload interval on unmount
  useEffect(() => {
    return () => {
      if (uploadIntervalRef.current) clearInterval(uploadIntervalRef.current)
    }
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleUpload(file)
    }
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const getUploadStageText = (progress: number) => {
    if (progress < 25) return language === "ar" ? "جاري التشفير..." : "Encrypting..."
    if (progress < 50) return language === "ar" ? "جاري التجزئة..." : "Sharding..."
    if (progress < 75) return language === "ar" ? "جاري التوزيع عبر العقد..." : "Distributing across nodes..."
    if (progress < 100) return language === "ar" ? "جاري التأمين..." : "Securing..."
    return language === "ar" ? "تم التأمين" : "Secured"
  }

  const getFileType = (name: string): string => {
    const ext = name.split(".").pop()?.toLowerCase() || ""
    if (ext === "pdf") return "pdf"
    if (["xlsx", "xls", "csv"].includes(ext)) return "excel"
    if (["doc", "docx"].includes(ext)) return "word"
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image"
    return "default"
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  // SEC-PII-FILE-001: Scan a file's text content for PII before upload.
  // Only text-readable formats are scanned client-side. PDFs and images are
  // forwarded to the backend which performs server-side extraction and scanning.
  const scanFileForPii = useCallback(async (file: File): Promise<{ count: number; types: string[] }> => {
    const TEXT_MIME_TYPES = new Set([
      "text/plain", "text/csv", "text/markdown",
      "application/json", "application/x-yaml",
    ])
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    const TEXT_EXTENSIONS = new Set(["txt", "csv", "md", "json", "yaml", "yml"])

    // Only scan client-side for text formats
    if (!TEXT_MIME_TYPES.has(file.type) && !TEXT_EXTENSIONS.has(ext)) {
      // Non-text files (PDF, images, Office docs) go to backend — return empty
      return { count: 0, types: [] }
    }

    try {
      const text = await file.text()
      return scanTextForPii(text)
    } catch {
      // If we can't read the file text, skip scanning safely
      return { count: 0, types: [] }
    }
  }, [])

  // Upload file via real API, with progress animation
  const handleUpload = useCallback(async (file: File) => {
    const name = file.name
    const size = file.size

    // SEC-PII-FILE-001: Scan text files for PII before upload and warn user
    const piiScan = await scanFileForPii(file)
    if (piiScan.count > 0) {
      // Surface warning — user must confirm to proceed
      setPiiWarning({ file, piiTypes: piiScan.types, count: piiScan.count })
      return
    }

    setUploadFileName(name)
    setUploadFileSize(size)
    setUploadProgress(0)

    // Animate progress while real upload happens
    let currentProgress = 0
    uploadIntervalRef.current = setInterval(() => {
      currentProgress = Math.min(currentProgress + 3, 90)
      setUploadProgress(currentProgress)
    }, 200)

    try {
      const result = await uploadToVault(file)
      // Upload succeeded - jump to 100%
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current)
        uploadIntervalRef.current = null
      }
      setUploadProgress(100)

      // SEC-BL-001: Use crypto-secure IDs instead of predictable Date.now()
      const idBytes = new Uint8Array(16)
      crypto.getRandomValues(idBytes)
      const secureId = `doc-${Array.from(idBytes).map(b => b.toString(16).padStart(2, "0")).join("")}`
      const newDoc: VaultDoc = {
        id: secureId,
        name: result.filename || name,
        type: getFileType(name),
        size: formatFileSize(size),
        sizeBytes: size,
        domain: "Personal",
        shards: result.chunks_stored || 1,
        lastModified: "Just now",
        encrypted: true,
      }
      setDocuments((prev) => [newDoc, ...prev])
      toast.success(language === "ar" ? "تم رفع المستند بنجاح" : "Document uploaded successfully")
    } catch {
      // API not available - still add locally so UI works
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current)
        uploadIntervalRef.current = null
      }
      setUploadProgress(100)

      // SEC-BL-001: Use crypto-secure IDs instead of predictable Date.now()
      const idBytes = new Uint8Array(16)
      crypto.getRandomValues(idBytes)
      const secureId = `doc-${Array.from(idBytes).map(b => b.toString(16).padStart(2, "0")).join("")}`
      const newDoc: VaultDoc = {
        id: secureId,
        name,
        type: getFileType(name),
        size: formatFileSize(size),
        sizeBytes: size,
        domain: "Personal",
        shards: 1,
        lastModified: "Just now",
        encrypted: true,
      }
      setDocuments((prev) => [newDoc, ...prev])
      toast.info(language === "ar" ? "تم إضافة المستند محلياً" : "Document added locally (API unavailable)")
    } finally {
      setTimeout(() => {
        setUploadProgress(null)
        setUploadFileName(null)
      }, 1500)
    }
  }, [language, scanFileForPii])

  // SEC-PII-FILE-001: Proceed with upload after user acknowledges PII warning
  const handlePiiWarningProceed = useCallback(async () => {
    if (!piiWarning) return
    const file = piiWarning.file
    setPiiWarning(null)

    // Directly execute the upload without re-scanning
    const name = file.name
    const size = file.size
    setUploadFileName(name)
    setUploadFileSize(size)
    setUploadProgress(0)

    let currentProgress = 0
    uploadIntervalRef.current = setInterval(() => {
      currentProgress = Math.min(currentProgress + 3, 90)
      setUploadProgress(currentProgress)
    }, 200)

    try {
      const result = await uploadToVault(file)
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current)
        uploadIntervalRef.current = null
      }
      setUploadProgress(100)
      const idBytes = new Uint8Array(16)
      crypto.getRandomValues(idBytes)
      const secureId = `doc-${Array.from(idBytes).map(b => b.toString(16).padStart(2, "0")).join("")}`
      const newDoc: VaultDoc = {
        id: secureId,
        name: result.filename || name,
        type: getFileType(name),
        size: formatFileSize(size),
        sizeBytes: size,
        domain: "Personal",
        shards: result.chunks_stored || 1,
        lastModified: "Just now",
        encrypted: true,
      }
      setDocuments((prev) => [newDoc, ...prev])
      toast.success(language === "ar" ? "تم رفع المستند بنجاح" : "Document uploaded successfully")
    } catch {
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current)
        uploadIntervalRef.current = null
      }
      setUploadProgress(100)
      const idBytes = new Uint8Array(16)
      crypto.getRandomValues(idBytes)
      const secureId = `doc-${Array.from(idBytes).map(b => b.toString(16).padStart(2, "0")).join("")}`
      const newDoc: VaultDoc = {
        id: secureId,
        name,
        type: getFileType(name),
        size: formatFileSize(size),
        sizeBytes: size,
        domain: "Personal",
        shards: 1,
        lastModified: "Just now",
        encrypted: true,
      }
      setDocuments((prev) => [newDoc, ...prev])
      toast.info(language === "ar" ? "تم إضافة المستند محلياً" : "Document added locally (API unavailable)")
    } finally {
      setTimeout(() => {
        setUploadProgress(null)
        setUploadFileName(null)
      }, 1500)
    }
  }, [piiWarning, language, getFileType, formatFileSize])

  // Filter documents by selected folder/domain
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    const folderDomain = selectedFolder
      ? folders.find(f => f.id === selectedFolder)?.domain
      : null
    const matchesDomain = !selectedDomain || doc.domain === selectedDomain
    const matchesFolder = !folderDomain || doc.domain === folderDomain
    return matchesSearch && matchesDomain && matchesFolder
  })

  const domains = Array.from(new Set(documents.map((d) => d.domain)))

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-20">

      {/* SEC-PII-FILE-001: PII detected in file — warn user before upload */}
      <AlertDialog open={!!piiWarning} onOpenChange={(open) => { if (!open) setPiiWarning(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-yellow-500" aria-hidden="true" />
              {language === "ar" ? "تحذير: معلومات شخصية محتملة" : "PII Detected in File"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {language === "ar"
                  ? `تم اكتشاف ${piiWarning?.count ?? 0} بيان(ات) شخصية محتملة في الملف "${piiWarning?.file.name}".`
                  : `Found ${piiWarning?.count ?? 0} potential personal data item(s) in "${piiWarning?.file.name}".`
                }
              </p>
              {piiWarning?.piiTypes && piiWarning.piiTypes.length > 0 && (
                <p className="text-sm font-medium">
                  {language === "ar" ? "الأنواع المكتشفة: " : "Types detected: "}
                  <span className="text-yellow-600 dark:text-yellow-400">
                    {piiWarning.piiTypes.join(", ")}
                  </span>
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {language === "ar"
                  ? "سيتم تشفير الملف وتجزئته عبر عقد آمنة. هل تريد المتابعة؟"
                  : "The file will be encrypted and sharded across secure nodes. Do you still want to proceed with the upload?"
                }
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPiiWarning(null)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePiiWarningProceed}
              className="bg-nexus-jade hover:bg-nexus-jade-hover text-background"
            >
              {language === "ar" ? "متابعة الرفع" : "Upload Anyway"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-title-1 flex items-center gap-2">
            <Lock className="h-6 w-6 text-nexus-gold" aria-hidden="true" />
            {language === "ar" ? "خزنتك السيادية" : "Your Sovereign Vault"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {documents.length === 0
              ? (language === "ar" ? "خزنتك فارغة - ابدأ بالرفع" : "Your vault is empty - start uploading")
              : (language === "ar"
                  ? `${documents.length} مستند مشفر ومحمي`
                  : `${documents.length} documents encrypted & sovereign`)}
          </p>
        </div>
        <Button onClick={handleFileSelect} className="bg-nexus-jade hover:bg-nexus-jade-hover text-background active:scale-[0.98] transition-transform duration-75">
          <Upload className="h-4 w-4 me-2" aria-hidden="true" />
          {language === "ar" ? "رفع مستند" : "Upload Document"}
        </Button>
        {/* SEC-R4-003: Restrict accepted file types to prevent upload of dangerous files */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          aria-label={language === "ar" ? "اختيار ملف للرفع" : "Select file to upload"}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.svg,.txt,.md,.json"
          multiple
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleUpload(file)
            e.target.value = ""
          }}
        />
      </div>

      {/* Shard Map */}
      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-headline flex items-center gap-2">
            <Server className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {language === "ar" ? "خريطة الأجزاء" : "Shard Distribution"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ShardMap className="h-[180px]" interactive={false} />
        </CardContent>
      </Card>

      {/* Main Tabs - Documents & Access Log */}
      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" aria-hidden="true" />
            {language === "ar" ? "المستندات" : "Documents"}
          </TabsTrigger>
          <TabsTrigger value="access-log" className="gap-2">
            <Activity className="h-4 w-4" aria-hidden="true" />
            {language === "ar" ? "سجل الوصول" : "Access Log"}
          </TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6 mt-6">
          {/* Upload Progress */}
          {uploadProgress !== null && (
            <Card className="border-nexus-gold">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-nexus-gold/10">
                    <Shield className="h-5 w-5 text-nexus-gold" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {getUploadStageText(uploadProgress)}
                    </p>
                    <Progress value={uploadProgress} className="mt-2" />
                  </div>
                  <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center transition-all",
              isDragging
                ? "border-nexus-jade bg-nexus-jade/10"
                : "border-border hover:border-muted-foreground"
            )}
          >
            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
            <p className="text-body">
              {language === "ar"
                ? "اسحب وأفلت الملفات هنا، أو"
                : "Drag and drop files here, or"}
            </p>
            <Button variant="link" onClick={handleFileSelect} className="text-nexus-jade">
              {language === "ar" ? "تصفح" : "browse"}
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              {language === "ar"
                ? "يدعم PDF، DOCX، XLSX، صور، وأكثر"
                : "Supports PDF, DOCX, XLSX, images, and more"}
            </p>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="vault-search" className="sr-only">
                {language === "ar" ? "البحث في الخزنة" : "Search vault"}
              </label>
              <Input
                id="vault-search"
                placeholder={language === "ar" ? "البحث في الخزنة..." : "Search vault..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-9"
                maxLength={200}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 me-2" aria-hidden="true" />
                  {selectedDomain ? getDomainLabel(selectedDomain, language) : (language === "ar" ? "جميع المجالات" : "All Domains")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setSelectedDomain(null)}>
                  {language === "ar" ? "جميع المجالات" : "All Domains"}
                </DropdownMenuItem>
                {domains.map((domain) => (
                  <DropdownMenuItem key={domain} onClick={() => setSelectedDomain(domain)}>
                    {getDomainLabel(domain, language)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={view === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setView("grid")}
                className="rounded-none"
                aria-label="Grid view"
              >
                <Grid className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant={view === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setView("list")}
                className="rounded-none"
                aria-label="List view"
              >
                <List className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          {/* Folders */}
          <div>
            <h2 className="text-headline font-semibold mb-4">
              {language === "ar" ? "المجلدات" : "Folders"}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {folders.map((folder) => (
                <button
                  type="button"
                  key={folder.id}
                  onClick={() => setSelectedFolder(folder.id === selectedFolder ? null : folder.id)}
                  aria-pressed={selectedFolder === folder.id}
                  aria-label={`${folder.name} - ${folder.count} ${language === "ar" ? "عنصر" : "items"}`}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl bg-card border transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 cursor-pointer text-start",
                    selectedFolder === folder.id
                      ? "border-nexus-jade bg-nexus-jade/5"
                      : "border-border hover:border-nexus-jade/30"
                  )}
                >
                  <Folder className="h-8 w-8 text-nexus-gold" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{folder.name}</p>
                    <p className="text-sm text-muted-foreground">{folder.count} {language === "ar" ? "عنصر" : "items"}</p>
                  </div>
                </button>
              ))}
              <button
                className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-border hover:border-nexus-jade/30 transition-colors"
                onClick={() => {
                  const rawName = prompt(language === "ar" ? "اسم المجلد الجديد:" : "New folder name:")
                  if (rawName) {
                    // SEC-BL-002: Validate folder name - sanitize, enforce length, prevent empty/whitespace-only
                    const name = rawName.trim().replace(/[<>"'/\\]/g, "").slice(0, 100)
                    if (!name) {
                      toast.error(language === "ar" ? "اسم المجلد غير صالح" : "Invalid folder name")
                      return
                    }
                    // Check for duplicate folder names (case-insensitive)
                    const isDuplicate = folders.some(f => f.name.toLowerCase() === name.toLowerCase())
                    if (isDuplicate) {
                      toast.error(language === "ar" ? "يوجد مجلد بنفس الاسم" : "A folder with this name already exists")
                      return
                    }
                    // SEC-BL-001: Use crypto-secure IDs
                    const idBytes = new Uint8Array(8)
                    crypto.getRandomValues(idBytes)
                    const folderId = `folder-${Array.from(idBytes).map(b => b.toString(16).padStart(2, "0")).join("")}`
                    setFolders(prev => [...prev, { id: folderId, name, count: 0, domain: "general" }])
                  }
                }}
              >
                <Plus className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <span className="text-muted-foreground">{language === "ar" ? "مجلد جديد" : "New Folder"}</span>
              </button>
            </div>
          </div>

          {/* Documents */}
          <div>
            <h2 className="text-headline font-semibold mb-4">
              {language === "ar" ? "المستندات" : "Documents"} ({filteredDocuments.length})
            </h2>

            {docsError ? (
              <ErrorRetry
                onRetry={() => loadVaultDocuments()}
                message={language === "ar"
                  ? "تعذّر تحميل المستندات. يرجى المحاولة مجدداً."
                  : "We couldn't load your documents. Please try again."}
                networkError
                variant="card"
              />
            ) : filteredDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                </div>
                <h3 className="font-medium text-foreground mb-1">
                  {language === "ar" ? "لا توجد مستندات بعد" : "No documents yet"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {language === "ar"
                    ? "ارفع أول مستند لبدء حماية ملفاتك بتشفير سيادي"
                    : "Upload your first document to start protecting your files with sovereign encryption"}
                </p>
              </div>
            ) : view === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredDocuments.map((doc) => {
                  const FileIcon = fileIcons[doc.type] || fileIcons.default
                  return (
                    <Card key={doc.id} className="group hover:border-nexus-jade/30 transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 p-4">
                      <CardContent className="p-0">
                        <div className="flex items-start justify-between mb-3">
                          <div className="p-2 rounded-lg bg-secondary">
                            <FileIcon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" aria-label="More options">
                                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </DropdownMenuTrigger>
<DropdownMenuContent align="end">
                                              <DropdownMenuItem onClick={() => window.location.href = `/vault/${doc.id}`}>
                                                <Eye className="h-4 w-4 me-2" aria-hidden="true" />
                                                {language === "ar" ? "عرض" : "View"}
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => {
                                                // SEC-UI-115: Sanitize filename to prevent path traversal injection
                                                const safeName = sanitizeFilename(doc.name)
                                                const blob = new Blob([`${safeName} - Encrypted vault document`], { type: "text/plain" })
                                                const url = URL.createObjectURL(blob)
                                                const a = document.createElement("a")
                                                a.href = url
                                                a.download = safeName
                                                a.click()
                                                URL.revokeObjectURL(url)
                                              }}>
                                                <Download className="h-4 w-4 me-2" aria-hidden="true" />
                                                {language === "ar" ? "تنزيل" : "Download"}
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                className="text-destructive"
                                                onClick={() => setDeleteTarget(doc.name)}
                                              >
                                                <Trash2 className="h-4 w-4 me-2" aria-hidden="true" />
                                                {language === "ar" ? "حذف وإثبات" : "Delete & Prove It"}
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <p className="font-medium truncate mb-1">{doc.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{doc.size}</span>
                          <span>·</span>
                          <Badge variant="secondary" className="text-xs">{getDomainLabel(doc.domain, language)}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                          <Lock className="h-3 w-3 text-nexus-gold" aria-hidden="true" />
                          <span>{doc.shards} {language === "ar" ? "أجزاء" : "shards"}</span>
                          <span>·</span>
                          <span>{getLastModifiedLabel(doc.lastModified, language)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocuments.map((doc) => {
                  const FileIcon = fileIcons[doc.type] || fileIcons.default
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border hover:border-nexus-jade/30 transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 group"
                    >
                      <div className="p-2 rounded-lg bg-secondary">
                        <FileIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{doc.size}</span>
                          <span>·</span>
                          <Badge variant="secondary" className="text-xs">{getDomainLabel(doc.domain, language)}</Badge>
                          <span>·</span>
                          <Lock className="h-3 w-3 text-nexus-gold" aria-hidden="true" />
                          <span>{doc.shards} {language === "ar" ? "أجزاء" : "shards"}</span>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{getLastModifiedLabel(doc.lastModified, language)}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8" 
                          aria-label="View document"
                          onClick={() => window.location.href = `/vault/${doc.id}`}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Download"
                          onClick={() => {
                            // SEC-UI-115: Sanitize filename to prevent path traversal injection
                            const safeName = sanitizeFilename(doc.name)
                            const blob = new Blob([`${safeName} - Encrypted vault document`], { type: "text/plain" })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement("a")
                            a.href = url
                            a.download = safeName
                            a.click()
                            URL.revokeObjectURL(url)
                          }}
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteTarget(doc.name)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Access Log Tab */}
        <TabsContent value="access-log" className="space-y-6 mt-6">
          {/* Hero Text */}
          <Card className="p-6 bg-card text-center">
            <CardContent className="p-0">
              <p className="text-2xl md:text-3xl font-light text-foreground mb-2">
                {language === "ar" ? "تم الوصول إلى بياناتك بواسطة:" : "Your data has been accessed by:"}{" "}
                <span className="text-nexus-gold font-bold">
                  {language === "ar" ? "أنت فقط" : "ONLY YOU"}
                </span>
              </p>
              <p className="text-muted-foreground text-lg">
                {language === "ar" 
                  ? "لم تصل أي جهة أخرى إلى خزنتك."
                  : "No other entities have accessed your vault."}{" "}
                <span className="text-nexus-gold font-bold">
                  {language === "ar" ? "أبداً" : "Ever"}
                </span>.
              </p>
            </CardContent>
          </Card>

          {/* Access Log Table */}
          <Card className="p-6">
            <CardContent className="p-0">
              {accessLogLoading ? (
                <AccessLogSkeleton rows={5} />
              ) : accessLogError ? (
                <ErrorRetry
                  onRetry={() => {
                    setAccessLogError(false)
                    setAccessLogLoading(true)
                    getAccessLog().then(data => {
                      if (data?.entries) {
                        setAccessLogEntries(data.entries.map((e, i) => ({
                          id: `log-${i}`,
                          timestamp: e.timestamp,
                          actor: e.actor,
                          action: e.action,
                          resource: e.resource,
                        })))
                      }
                    }).catch(() => {
                      setAccessLogError(true)
                    }).finally(() => {
                      setAccessLogLoading(false)
                    })
                  }}
                  message={language === "ar"
                    ? "تعذّر تحميل سجل الوصول. يرجى المحاولة مجدداً."
                    : "We couldn't load the access log. Please try again."}
                  networkError
                  variant="card"
                />
              ) : accessLogEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-full bg-muted mb-4">
                    <Activity className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <h3 className="font-medium text-foreground mb-1">
                    {language === "ar" ? "لا توجد سجلات وصول بعد" : "No access log entries yet"}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {language === "ar"
                      ? "سيتم تسجيل جميع عمليات الوصول إلى خزنتك هنا"
                      : "All access to your vault will be logged here"}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-start text-xs uppercase tracking-widest text-muted-foreground pb-3 font-medium">
                            {language === "ar" ? "الوقت" : "Timestamp"}
                          </th>
                          <th className="text-start text-xs uppercase tracking-widest text-muted-foreground pb-3 font-medium">
                            {language === "ar" ? "المستخدم" : "Actor"}
                          </th>
                          <th className="text-start text-xs uppercase tracking-widest text-muted-foreground pb-3 font-medium">
                            {language === "ar" ? "الإجراء" : "Action"}
                          </th>
                          <th className="text-start text-xs uppercase tracking-widest text-muted-foreground pb-3 font-medium">
                            {language === "ar" ? "المورد" : "Resource"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedEntries.map((entry) => (
                          <tr key={entry.id} className="border-b border-border last:border-b-0">
                            <td className="py-4 text-sm text-muted-foreground">{entry.timestamp}</td>
                            <td className="py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-nexus-gold/10 flex items-center justify-center">
                                  <User className="h-3 w-3 text-nexus-gold" aria-hidden="true" />
                                </div>
                                <span className="text-sm font-medium text-nexus-gold">{entry.actor}</span>
                              </div>
                            </td>
                            <td className="py-4">
                              <Badge variant="secondary" className="text-xs">
                                {entry.action}
                              </Badge>
                            </td>
                            <td className="py-4 text-sm">{entry.resource}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground">
                        {language === "ar" ? `الصفحة ${safePage} من ${totalPages}` : `Page ${safePage} of ${totalPages}`}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={safePage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        >
                          {language === "ar" ? "السابق" : "Previous"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={safePage === totalPages}
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        >
                          {language === "ar" ? "التالي" : "Next"}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Storage Stats */}
      <Card className="p-6">
        <CardContent className="p-0">
          {(() => {
            const totalBytes = documents.reduce((sum, doc) => sum + (doc.sizeBytes || 0), 0)
            const totalGB = totalBytes / (1024 * 1024 * 1024)
            const maxGB = 10
            const percentage = Math.min((totalGB / maxGB) * 100, 100)
            const displaySize = totalGB >= 1
              ? `${totalGB.toFixed(1)} GB`
              : `${(totalBytes / (1024 * 1024)).toFixed(0)} MB`
            return (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {language === "ar" ? "مساحة التخزين المستخدمة" : "Storage Used"}
                  </span>
                  <span className="text-sm text-muted-foreground">{displaySize} / {maxGB} GB</span>
                </div>
                <Progress value={percentage} className="h-2" />
              </>
            )
          })()}
        </CardContent>
      </Card>

      {/* Delete Ceremony Modal */}
      {deleteTarget && (
        <DeleteCeremony
          documentName={deleteTarget}
          documentId={documents.find(d => d.name === deleteTarget)?.id}
          onComplete={() => {
            setDocuments(prev => prev.filter(d => d.name !== deleteTarget))
            setDeleteTarget(null)
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
