"use client"

import { useState } from "react"
import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"
import type { TeamMemberRole } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Mail, Shield, UserCheck, Eye } from "lucide-react"
import { toast } from "sonner"

interface TeamInviteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvite: (email: string, role: TeamMemberRole) => Promise<void>
}

const roles: Array<{ value: TeamMemberRole; icon: typeof Shield; labelEn: string; labelAr: string; descEn: string; descAr: string }> = [
  { value: "admin", icon: Shield, labelEn: "Admin", labelAr: "مدير", descEn: "Full access to all features", descAr: "وصول كامل لجميع الميزات" },
  { value: "member", icon: UserCheck, labelEn: "Member", labelAr: "عضو", descEn: "Can use all features except billing", descAr: "يمكنه استخدام جميع الميزات عدا الفوترة" },
  { value: "viewer", icon: Eye, labelEn: "Viewer", labelAr: "مشاهد", descEn: "Read-only access", descAr: "وصول للقراءة فقط" },
]

export function TeamInviteModal({ open, onOpenChange, onInvite }: TeamInviteModalProps) {
  const { language, isRTL } = useNexus()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<TeamMemberRole>("member")
  const [isInviting, setIsInviting] = useState(false)

  // SEC-BL-004: Validate email format, not just emptiness
  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      toast.error(language === "ar" ? "الرجاء إدخال البريد الإلكتروني" : "Please enter an email")
      return
    }

    if (!isValidEmail(trimmedEmail)) {
      toast.error(language === "ar" ? "صيغة البريد الإلكتروني غير صالحة" : "Invalid email format")
      return
    }

    setIsInviting(true)
    try {
      await onInvite(email.trim(), role)
      toast.success(language === "ar" ? "تم إرسال الدعوة" : "Invitation sent")
      setEmail("")
      setRole("member")
      onOpenChange(false)
    } catch {
      toast.error(language === "ar" ? "تعذّر إرسال الدعوة. يرجى المحاولة مرة أخرى." : "We couldn't send the invitation. Please try again.")
    } finally {
      setIsInviting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className={isRTL ? "text-right" : undefined}>
              {language === "ar" ? "دعوة عضو فريق" : "Invite Team Member"}
            </DialogTitle>
            <DialogDescription className={isRTL ? "text-right" : undefined}>
              {language === "ar"
                ? "أرسل دعوة للانضمام لفريقك"
                : "Send an invitation to join your team"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="invite-email" className={isRTL ? "text-right block" : undefined}>
                {language === "ar" ? "البريد الإلكتروني" : "Email"}
              </Label>
              <div className={cn("relative", isRTL && "text-right")}>
                <Mail className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground", isRTL ? "right-3" : "left-3")} aria-hidden="true" />
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className={cn(isRTL ? "pr-10" : "pl-10")}
                  dir="ltr"
                  maxLength={254}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="invite-role" className={isRTL ? "text-right block" : undefined}>
                {language === "ar" ? "الدور" : "Role"}
              </Label>
              <Select value={role} onValueChange={(v) => setRole(v as TeamMemberRole)}>
                <SelectTrigger id="invite-role" className={isRTL ? "text-right" : undefined}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => {
                    const Icon = r.icon
                    return (
                      <SelectItem key={r.value} value={r.value}>
                        <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          <span>{language === "ar" ? r.labelAr : r.labelEn}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <p className={cn("text-xs text-muted-foreground", isRTL && "text-right")}>
                {language === "ar"
                  ? roles.find((r) => r.value === role)?.descAr
                  : roles.find((r) => r.value === role)?.descEn}
              </p>
            </div>
          </div>

          <DialogFooter className={isRTL ? "flex-row-reverse" : undefined}>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={isInviting}
              className="bg-nexus-jade hover:bg-nexus-jade-hover text-background"
            >
              {isInviting ? (
                <>
                  <Loader2 className="h-4 w-4 me-2 motion-safe:animate-spin" aria-hidden="true" />
                  {language === "ar" ? "جارٍ الإرسال..." : "Sending..."}
                </>
              ) : (
                language === "ar" ? "إرسال الدعوة" : "Send Invitation"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
