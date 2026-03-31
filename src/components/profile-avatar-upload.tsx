"use client"

import { useState, useRef } from "react"
import { useNexus } from "@/contexts/nexus-context"
import { cn, sanitizeImageUrl } from "@/lib/utils"
import { Camera, User } from "lucide-react"
import { toast } from "sonner"
import { uploadAvatar } from "@/lib/api"

interface ProfileAvatarUploadProps {
  currentAvatarUrl: string | null
  onAvatarChange: (url: string | null) => void
  userId: string
}

export function ProfileAvatarUpload({ currentAvatarUrl, onAvatarChange, userId }: ProfileAvatarUploadProps) {
  const { language, isRTL } = useNexus()
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input so the same file can be re-selected if needed
    e.target.value = ""

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error(language === "ar" ? "الرجاء اختيار صورة" : "Please select an image file")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(language === "ar" ? "حجم الملف كبير جداً (الحد الأقصى 5 ميجابايت)" : "File too large (max 5MB)")
      return
    }

    // Show an optimistic local preview immediately while uploading
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    setIsUploading(true)
    try {
      const result = await uploadAvatar(userId, file)

      if (!result || !result.avatar_url) {
        // Revert preview on failure
        setPreviewUrl(null)
        toast.error(language === "ar" ? "فشل تحميل الصورة" : "Failed to upload image")
        return
      }

      // Revoke the local object URL now that we have a persistent backend URL
      URL.revokeObjectURL(objectUrl)
      setPreviewUrl(null)

      onAvatarChange(result.avatar_url)
      toast.success(language === "ar" ? "تم تحديث الصورة" : "Avatar updated")
    } catch {
      setPreviewUrl(null)
      toast.error(language === "ar" ? "فشل تحميل الصورة" : "Failed to upload image")
    } finally {
      setIsUploading(false)
    }
  }

  // Prefer the optimistic preview while uploading, otherwise use the persisted URL
  const displayUrl = previewUrl ?? currentAvatarUrl

  return (
    <div className={cn("flex flex-col items-center", isRTL && "items-center")}>
      <div className="relative group">
        {/* Avatar circle */}
        <div className="w-24 h-24 rounded-full bg-muted border-2 border-border overflow-hidden">
          {/* SEC-UI-111: Validate avatar src to prevent javascript: or data:text/html injection */}
          {displayUrl ? (
            <img
              src={sanitizeImageUrl(displayUrl)}
              alt={language === "ar" ? "صورة الملف الشخصي" : "Profile avatar"}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Camera overlay */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-full",
            "bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity",
            "cursor-pointer focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-nexus-jade",
            isUploading && "cursor-wait opacity-100"
          )}
          aria-label={language === "ar" ? "تغيير الصورة الشخصية" : "Change profile picture"}
        >
          <Camera
            className={cn(
              "h-6 w-6 text-foreground",
              isUploading && "opacity-50"
            )}
            aria-hidden="true"
          />
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        {isUploading
          ? (language === "ar" ? "جارٍ التحميل..." : "Uploading...")
          : (language === "ar" ? "انقر لتغيير الصورة" : "Click to change photo")}
      </p>
    </div>
  )
}
