"use client"

import React, { useState } from "react"
import { useNexus } from "@/contexts/nexus-context"
import { cn, sanitizeImageUrl } from "@/lib/utils"
import type { TeamMember, TeamMemberRole } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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
import { User, MoreHorizontal, Pencil, Trash2, Shield, UserCheck, Eye } from "lucide-react"

interface TeamMemberRowProps {
  member: TeamMember
  onEdit: (member: TeamMember) => void
  onRemove: (memberId: string) => void
}

const roleConfig: Record<TeamMemberRole, { icon: typeof Shield; color: string; labelEn: string; labelAr: string }> = {
  admin: { icon: Shield, color: "text-nexus-gold", labelEn: "Admin", labelAr: "مدير" },
  member: { icon: UserCheck, color: "text-nexus-jade", labelEn: "Member", labelAr: "عضو" },
  viewer: { icon: Eye, color: "text-muted-foreground", labelEn: "Viewer", labelAr: "مشاهد" },
}

export const TeamMemberRow = React.memo(({ member, onEdit, onRemove }: TeamMemberRowProps) => {
  const { language, isRTL } = useNexus()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const roleInfo = roleConfig[member.role]
  const RoleIcon = roleInfo.icon

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(
      language === "ar" ? "ar-AE" : "en-US",
      { month: "short", day: "numeric" }
    )
  }

  const formatNumber = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toString()
  }

  return (
    <>
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {language === "ar" ? "إزالة عضو الفريق" : "Remove team member"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {language === "ar"
              ? `هل أنت متأكد من إزالة "${member.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
              : `Are you sure you want to remove "${member.name}"? This action cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {language === "ar" ? "إلغاء" : "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => onRemove(member.id)}
          >
            {language === "ar" ? "إزالة" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <tr className="border-b border-border/50 hover:bg-muted/50 transition-colors">
      {/* Avatar & Name */}
      <td className={cn("py-3 px-2 sm:px-4", "text-start")}>
        <div className={cn("flex items-center gap-2 sm:gap-3", isRTL && "flex-row-reverse")}>
          <div className="w-8 h-8 rounded-full bg-muted border border-border overflow-hidden flex-shrink-0">
            {/* SEC-UI-110: Sanitize avatar URL from API to prevent tracking/exfiltration */}
            {member.avatarUrl ? (
              <img
                src={sanitizeImageUrl(member.avatarUrl)}
                alt=""
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <span className="font-medium truncate block max-w-[100px] sm:max-w-[150px]">{member.name}</span>
            {/* Email shown inline on mobile below name */}
            <span className="text-xs text-muted-foreground truncate block sm:hidden max-w-[100px]">{member.email}</span>
          </div>
        </div>
      </td>

      {/* Email — hidden on mobile, shown from sm up */}
      <td className={cn("py-3 px-2 sm:px-4 text-sm text-muted-foreground hidden sm:table-cell", "text-start")}>
        <span className="truncate block max-w-[160px]">{member.email}</span>
      </td>

      {/* Role */}
      <td className={cn("py-3 px-2 sm:px-4", "text-start")}>
        <div className={cn("flex items-center gap-1", isRTL && "flex-row-reverse")}>
          <RoleIcon className={cn("h-4 w-4 flex-shrink-0", roleInfo.color)} aria-hidden="true" />
          <span className={cn("text-sm whitespace-nowrap", roleInfo.color)}>
            {language === "ar" ? roleInfo.labelAr : roleInfo.labelEn}
          </span>
        </div>
      </td>

      {/* Last Active — hidden on mobile */}
      <td className={cn("py-3 px-2 sm:px-4 text-sm text-muted-foreground hidden md:table-cell", "text-start")}>
        {formatDate(member.lastActive)}
      </td>

      {/* Usage — hidden on mobile */}
      <td className={cn("py-3 px-2 sm:px-4 text-sm hidden lg:table-cell", "text-start")}>
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {formatNumber(member.apiCalls)} {language === "ar" ? "طلب" : "calls"} / {formatNumber(member.tokensUsed)} {language === "ar" ? "توكن" : "tokens"}
        </div>
      </td>

      {/* Actions */}
      <td className={cn("py-3 px-2 sm:px-4", "text-start")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8">
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{language === "ar" ? "خيارات" : "Options"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? "start" : "end"}>
            <DropdownMenuItem onClick={() => onEdit(member)} className="min-h-[44px]">
              <Pencil className="h-4 w-4 me-2" aria-hidden="true" />
              {language === "ar" ? "تعديل" : "Edit"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConfirmOpen(true)} className="text-destructive min-h-[44px]">
              <Trash2 className="h-4 w-4 me-2" aria-hidden="true" />
              {language === "ar" ? "إزالة" : "Remove"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
    </>
  )
})

TeamMemberRow.displayName = "TeamMemberRow"
