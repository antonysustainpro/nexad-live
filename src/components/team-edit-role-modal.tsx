"use client"

import { useState } from "react"
import { useNexus } from "@/contexts/nexus-context"
import type { TeamMember, TeamMemberRole } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { Shield, UserCheck, Eye, Loader2 } from "lucide-react"

interface TeamEditRoleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: TeamMember | null
  onSave: (member: TeamMember) => Promise<void>
}

const roleOptions: Array<{
  id: TeamMemberRole
  icon: typeof Shield
  color: string
  labelEn: string
  labelAr: string
  descEn: string
  descAr: string
}> = [
  {
    id: "admin",
    icon: Shield,
    color: "text-nexus-gold",
    labelEn: "Admin",
    labelAr: "مدير",
    descEn: "Full access to all features and settings",
    descAr: "وصول كامل لجميع الميزات والإعدادات",
  },
  {
    id: "member",
    icon: UserCheck,
    color: "text-nexus-jade",
    labelEn: "Member",
    labelAr: "عضو",
    descEn: "Can use AI features and view documents",
    descAr: "يمكنه استخدام الذكاء الاصطناعي وعرض المستندات",
  },
  {
    id: "viewer",
    icon: Eye,
    color: "text-muted-foreground",
    labelEn: "Viewer",
    labelAr: "مشاهد",
    descEn: "Read-only access to shared content",
    descAr: "وصول للقراءة فقط للمحتوى المشترك",
  },
]

export function TeamEditRoleModal({
  open,
  onOpenChange,
  member,
  onSave,
}: TeamEditRoleModalProps) {
  const { language, isRTL } = useNexus()
  const [selectedRole, setSelectedRole] = useState<TeamMemberRole>(
    member?.role || "member"
  )
  const [saving, setSaving] = useState(false)
  const [lastMemberId, setLastMemberId] = useState<string | null>(null)

  // Sync selectedRole only when the member prop actually changes (different member selected)
  if (member && member.id !== lastMemberId) {
    setLastMemberId(member.id)
    setSelectedRole(member.role)
  }

  // SEC-BL-021: Validate selectedRole is a known value before saving, and handle errors
  const VALID_ROLES: TeamMemberRole[] = ["admin", "member", "viewer"]
  const handleSave = async () => {
    if (!member) return
    if (!VALID_ROLES.includes(selectedRole)) return
    setSaving(true)
    try {
      await onSave({ ...member, role: selectedRole })
      onOpenChange(false)
    } catch {
      // Error handling delegated to parent via onSave — just stop saving spinner
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={cn(isRTL && "text-right")}>
            {language === "ar" ? "تعديل دور العضو" : "Edit Member Role"}
          </DialogTitle>
          <DialogDescription className={cn(isRTL && "text-right")}>
            {member && (
              <>
                {language === "ar" ? "تغيير دور " : "Change role for "}
                <span className="font-medium text-foreground">{member.name}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup
            value={selectedRole}
            onValueChange={(v) => setSelectedRole(v as TeamMemberRole)}
            className="space-y-3"
          >
            {roleOptions.map((option) => {
              const Icon = option.icon
              return (
                <Label
                  key={option.id}
                  htmlFor={`role-${option.id}`}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                    selectedRole === option.id
                      ? "border-nexus-jade bg-nexus-jade/10"
                      : "border-border hover:border-muted-foreground",
                    isRTL && "flex-row-reverse"
                  )}
                >
                  <RadioGroupItem
                    value={option.id}
                    id={`role-${option.id}`}
                    className="mt-0.5"
                  />
                  <Icon
                    className={cn("h-5 w-5 mt-0.5 flex-shrink-0", option.color)}
                    aria-hidden="true"
                  />
                  <div className={cn("flex-1", isRTL && "text-right")}>
                    <span className="font-medium block">
                      {language === "ar" ? option.labelAr : option.labelEn}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {language === "ar" ? option.descAr : option.descEn}
                    </span>
                  </div>
                </Label>
              )
            })}
          </RadioGroup>
        </div>

        <DialogFooter className={cn("gap-2", isRTL && "flex-row-reverse")}>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {language === "ar" ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || selectedRole === member?.role}
            className="bg-nexus-jade hover:bg-nexus-jade-hover text-background"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 me-2 motion-safe:animate-spin" aria-hidden="true" />
                {language === "ar" ? "جاري الحفظ..." : "Saving..."}
              </>
            ) : (
              language === "ar" ? "حفظ التغييرات" : "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
