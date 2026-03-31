"use client"

import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type DragEvent } from "react"
import { Paperclip, Mic, ArrowUp, X, FileText, Video, Image, Music, FileSpreadsheet, Presentation, Archive, Book, Loader2, CheckCircle2, AlertCircle, Square, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNexus } from "@/contexts/nexus-context"
import { uploadToVault } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { getAllSupportedExtensions, getFileCategory, type UploadingFile, type FileUploadStatus, type ChatTier } from "@/lib/types"

interface ChatInputProps {
  onSend: (message: string, files?: File[]) => void
  onVoiceStart?: () => void
  onVideoStart?: () => void
  onStop?: () => void
  disabled?: boolean
  isStreaming?: boolean
  placeholder?: string
  initialValue?: string
  tier?: ChatTier
  maxFileSizeMb?: number
  maxFiles?: number
}

// File category icons
const categoryIcons: Record<string, React.ElementType> = {
  document: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  text: FileText,
  data: FileText,
  image: Image,
  audio: Music,
  video: Video,
  archive: Archive,
  ebook: Book,
  unknown: FileText,
}

export function ChatInput({
  onSend,
  onVoiceStart,
  onVideoStart,
  onStop,
  disabled,
  isStreaming = false,
  placeholder,
  initialValue,
  tier = "basic",
  maxFileSizeMb = 10,
  maxFiles = 10,
}: ChatInputProps) {
  const { language, isRTL } = useNexus()
  const [message, setMessage] = useState(initialValue || "")
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Update message when initialValue changes from parent
  useEffect(() => {
    if (initialValue) setMessage(initialValue)
  }, [initialValue])

  const defaultPlaceholder = language === "ar" ? "اسأل أي شيء..." : "Ask anything..."

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [message])

  // Get tier-specific limits
  const tierLimits = {
    basic: { maxFiles: 10, maxSizeMb: 10, voice: false, video: false },
    pro: { maxFiles: 50, maxSizeMb: 50, voice: true, video: false },
    enterprise: { maxFiles: 200, maxSizeMb: 200, voice: true, video: true },
  }
  const limits = tierLimits[tier]

  const handleSubmit = () => {
    const trimmedMessage = message.trim()
    const completedFiles = uploadingFiles.filter(f => f.status === "complete").map(f => f.file)

    // SEC-BL-006: Guard against empty or whitespace-only messages with no files
    if (!trimmedMessage && completedFiles.length === 0) return
    if (disabled) return
    // SEC-BL-006: Prevent submission while files are still uploading
    if (uploadingFiles.some(f => f.status === "uploading" || f.status === "processing")) return

    onSend(trimmedMessage, completedFiles.length > 0 ? completedFiles : undefined)
    setMessage("")
    setUploadingFiles([])

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Real file upload to Vault API
  const uploadFile = useCallback(async (fileId: string, file: File) => {
    // Set initial uploading state with progress animation
    let progress = 0
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + 10, 90)
      setUploadingFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, progress, status: "uploading" as FileUploadStatus } : f
      ))
    }, 200)

    try {
      // Call real Vault API
      await uploadToVault(file)

      clearInterval(progressInterval)
      setUploadingFiles(prev => prev.map(f =>
        f.id === fileId
          ? { ...f, progress: 100, status: "complete" as FileUploadStatus, completedAt: new Date().toISOString() }
          : f
      ))
    } catch (error) {
      clearInterval(progressInterval)
      setUploadingFiles(prev => prev.map(f =>
        f.id === fileId
          ? { ...f, status: "error" as FileUploadStatus, error: "Upload failed" }
          : f
      ))
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    processFiles(selectedFiles)
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const processFiles = (files: File[]) => {
    const maxSizeBytes = limits.maxSizeMb * 1024 * 1024
    const currentCount = uploadingFiles.length
    const availableSlots = limits.maxFiles - currentCount

    if (availableSlots <= 0) {
      // Could show toast here
      return
    }

    const filesToAdd = files.slice(0, availableSlots).map(file => {
      // SEC-SM-004 + SEC-SM-R3-008: Use crypto.getRandomValues for fully unpredictable IDs.
      // Removed Date.now() prefix — it leaks the exact upload timestamp which can be used
      // for timing correlation attacks. A pure random ID is both unique and private.
      const randomBytes = new Uint8Array(16)
      crypto.getRandomValues(randomBytes)
      const id = Array.from(randomBytes).map(b => b.toString(16).padStart(2, "0")).join("")
      const isOversize = file.size > maxSizeBytes

      return {
        id,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: isOversize ? "error" : "pending" as FileUploadStatus,
        progress: 0,
        error: isOversize ? `File exceeds ${limits.maxSizeMb}MB limit` : undefined,
        startedAt: new Date().toISOString(),
      } as UploadingFile
    })

    setUploadingFiles(prev => [...prev, ...filesToAdd])

    // Start uploads for valid files
    filesToAdd.filter(f => f.status !== "error").forEach(f => {
      uploadFile(f.id, f.file)
    })
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    processFiles(droppedFiles)
  }

  const removeFile = (id: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== id))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getStatusIcon = (status: FileUploadStatus) => {
    switch (status) {
      case "uploading":
      case "processing":
        return <Loader2 className="h-3 w-3 animate-spin text-nexus-jade" />
      case "complete":
        return <CheckCircle2 className="h-3 w-3 text-green-500" />
      case "error":
        return <AlertCircle className="h-3 w-3 text-red-500" />
      default:
        return null
    }
  }

  const completedCount = uploadingFiles.filter(f => f.status === "complete").length
  const hasErrors = uploadingFiles.some(f => f.status === "error")
  const isUploading = uploadingFiles.some(f => f.status === "uploading" || f.status === "processing")
  const canSend = (message.trim().length > 0 || completedCount > 0) && !disabled && !isUploading

  return (
    <div
      className={cn(
        "sticky bottom-0 p-4 bg-background border-t border-border",
        isDragging && "ring-2 ring-nexus-jade ring-inset"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-nexus-jade/10 border-2 border-dashed border-nexus-jade rounded-2xl flex items-center justify-center z-10">
          <div className="text-center">
            <Paperclip className="h-8 w-8 text-nexus-jade mx-auto mb-2" />
            <p className="text-nexus-jade font-medium">
              {language === "ar" ? "أفلت الملفات هنا" : "Drop files here"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {language === "ar"
                ? `الحد الأقصى ${limits.maxSizeMb} ميجابايت لكل ملف`
                : `Max ${limits.maxSizeMb}MB per file`
              }
            </p>
          </div>
        </div>
      )}

      {/* Uploading Files with Progress */}
      {uploadingFiles.length > 0 && (
        <div className="mb-3 space-y-2 max-h-[200px] overflow-y-auto">
          {uploadingFiles.map((uf) => {
            const category = getFileCategory(uf.name)
            const IconComponent = categoryIcons[category] || FileText

            return (
              <div
                key={uf.id}
                className={cn(
                  "flex items-center gap-3 p-2 bg-secondary rounded-lg",
                  uf.status === "error" && "bg-red-500/10 border border-red-500/20"
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-md",
                  uf.status === "error" ? "bg-red-500/20" : "bg-muted"
                )}>
                  <IconComponent className={cn(
                    "h-4 w-4",
                    uf.status === "error" ? "text-red-500" : "text-muted-foreground"
                  )} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm truncate max-w-[150px]">{uf.name}</span>
                    {getStatusIcon(uf.status)}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(uf.size)}
                    </span>
                    {uf.status === "uploading" && (
                      <Progress value={uf.progress} className="h-1 flex-1 max-w-[100px]" />
                    )}
                    {uf.error && (
                      <span className="text-xs text-red-500 truncate">{uf.error}</span>
                    )}
                  </div>
                </div>

                {/* Retry button — only shown on upload errors, not size errors */}
                {uf.status === "error" && !uf.error?.includes("limit") && (
                  <button
                    onClick={() => uf.id && uf.file && uploadFile(uf.id, uf.file)}
                    className="p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-nexus-jade"
                    aria-label={language === "ar" ? `إعادة رفع ${uf.name}` : `Retry uploading ${uf.name}`}
                    title={language === "ar" ? "إعادة المحاولة" : "Retry upload"}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={() => removeFile(uf.id)}
                  className="p-1 rounded-full hover:bg-muted transition-colors"
                  aria-label={language === "ar" ? `إزالة ${uf.name}` : `Remove ${uf.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Upload summary */}
      {uploadingFiles.length > 0 && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {language === "ar"
              ? `${completedCount} من ${uploadingFiles.length} ملفات جاهزة`
              : `${completedCount} of ${uploadingFiles.length} files ready`
            }
          </span>
          {hasErrors && (
            <span className="text-red-500">
              {language === "ar" ? "• بعض الملفات بها أخطاء" : "• Some files have errors"}
            </span>
          )}
        </div>
      )}

      {/* Input Container */}
      <div
        className={cn(
          "flex items-end gap-3 bg-card border border-border rounded-2xl p-3",
          isRTL && "flex-row-reverse"
        )}
      >
        {/* File Attachment */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => fileInputRef.current?.click()}
          aria-label={language === "ar" ? "إرفاق ملف" : "Attach file"}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept={getAllSupportedExtensions()}
          aria-label={language === "ar" ? "اختيار ملفات للإرفاق" : "Select files to attach"}
        />

        {/* Text Input */}
        {/* SEC-BL-005: Enforce maxLength matching backend ChatMessageSchema (50000 chars) */}
        <Textarea
          ref={textareaRef}
          dir="auto"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || defaultPlaceholder}
          disabled={disabled}
          rows={1}
          maxLength={50000}
          className="flex-1 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[32px] max-h-[120px] py-1 text-start"
        />

        {/* Voice Button - Pro & Enterprise */}
        {limits.voice && onVoiceStart && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onVoiceStart}
            aria-label={language === "ar" ? "التحدث" : "Voice input"}
          >
            <Mic className="h-5 w-5" />
          </Button>
        )}

        {/* Video Button - Enterprise only */}
        {limits.video && onVideoStart && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onVideoStart}
            aria-label={language === "ar" ? "مكالمة فيديو" : "Video call"}
          >
            <Video className="h-5 w-5" />
          </Button>
        )}

        {/* Stop / Send Button */}
        {isStreaming && onStop ? (
          <Button
            type="button"
            size="icon"
            onClick={onStop}
            className="h-8 w-8 shrink-0 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all"
            aria-label={language === "ar" ? "وقف الرد" : "Stop generating"}
          >
            <Square className="h-4 w-4 fill-current" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            onClick={handleSubmit}
            disabled={!canSend}
            className={cn(
              "h-8 w-8 shrink-0 rounded-full transition-all",
              canSend
                ? "bg-nexus-jade hover:bg-nexus-jade-hover text-background"
                : "bg-nexus-jade/30 text-background/50 cursor-not-allowed"
            )}
            aria-label={language === "ar" ? "إرسال" : "Send"}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Tier indicator */}
      {tier !== "basic" && (
        <div className={cn(
          "mt-2 flex items-center gap-1.5 text-xs",
          tier === "enterprise" ? "text-nexus-gold" : "text-nexus-jade"
        )}>
          <span className={cn(
            "px-1.5 py-0.5 rounded-full text-[10px] font-medium",
            tier === "enterprise" ? "bg-nexus-gold/20" : "bg-nexus-jade/20"
          )}>
            {tier.toUpperCase()}
          </span>
          <span className="text-muted-foreground">
            {language === "ar"
              ? tier === "enterprise"
                ? "نص + صوت + فيديو"
                : "نص + صوت"
              : tier === "enterprise"
                ? "Text + Voice + Video"
                : "Text + Voice"
            }
          </span>
        </div>
      )}
    </div>
  )
}
