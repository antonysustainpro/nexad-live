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
  const roleLabel = language === "ar" ? roleInfo.labelAr : roleInfo.labelEn

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
    {/* A11Y: AlertDialog traps focus inside the modal when open, preventing keyboard users from interacting with background content */}
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
          {/* A11Y: Cancel receives focus first (safer default) */}
          <AlertDialogCancel autoFocus>
            {language === "ar" ? "إلغاء" : "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive"
            onClick={() => onRemove(member.id)}
          >
            {language === "ar" ? "إزالة" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <tr
      className="border-b border-border/50 hover:bg-muted/50 transition-colors"
      aria-label={
        language === "ar"
          ? `عضو الفريق: ${member.name}، الدور: ${roleLabel}`
          : `Team member: ${member.name}, role: ${roleLabel}`
      }
    >
      {/* Avatar & Name — always visible */}
      <td className={cn("py-3 px-2 sm:px-4", "text-start")}>
        <div className={cn("flex items-center gap-2 sm:gap-3", isRTL && "flex-row-reverse")}>
          <div
            className="w-8 h-8 rounded-full bg-muted border border-border overflow-hidden flex-shrink-0"
            aria-hidden="true"
          >
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
          {/* A11Y: name cell is the row header for assistive technologies */}
          <div className="min-w-0">
            <span className="font-medium truncate block max-w-[100px] sm:max-w-[150px]">{member.name}</span>
            {/* Show email below name on mobile since email column is hidden */}
            <span className="text-xs text-muted-foreground truncate block sm:hidden max-w-[100px]">{member.email}</span>
          </div>
        </div>
      </td>

      {/* Email — hidden on mobile, shown from sm up */}
      <td className={cn("py-3 px-2 sm:px-4 text-sm text-muted-foreground hidden sm:table-cell", "text-start")}>
        <span className="truncate block max-w-[160px]">{member.email}</span>
      </td>

      {/* Role — always visible */}
      <td className={cn("py-3 px-2 sm:px-4", "text-start")}>
        <div className={cn("flex items-center gap-1", isRTL && "flex-row-reverse")}>
          <RoleIcon className={cn("h-4 w-4 flex-shrink-0", roleInfo.color)} aria-hidden="true" />
          <span className={cn("text-sm whitespace-nowrap", roleInfo.color)}>
            {roleLabel}
          </span>
        </div>
      </td>

      {/* Last Active — hidden on mobile, shown from md up */}
      <td className={cn("py-3 px-2 sm:px-4 text-sm text-muted-foreground hidden md:table-cell", "text-start")}>
        {formatDate(member.lastActive)}
      </td>

      {/* Usage — hidden on mobile and tablet, shown from lg up */}
      <td className={cn("py-3 px-2 sm:px-4 text-sm hidden lg:table-cell", "text-start")}>
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {/* A11Y: screen-reader-friendly label wraps the numbers in context */}
          <span className="sr-only">
            {language === "ar"
              ? `${formatNumber(member.apiCalls)} طلب، ${formatNumber(member.tokensUsed)} كلمة معالجة`
              : `${formatNumber(member.apiCalls)} API calls, ${formatNumber(member.tokensUsed)} tokens`}
          </span>
          <span aria-hidden="true">
            {formatNumber(member.apiCalls)} {language === "ar" ? "طلب" : "calls"} / {formatNumber(member.tokensUsed)} {language === "ar" ? "كلمة معالجة" : "tokens"}
          </span>
        </div>
      </td>

      {/* Actions — always visible, 44x44 touch target on mobile */}
      <td className={cn("py-3 px-2 sm:px-4", "text-start")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {/* A11Y: aria-label names the specific member so context is clear */}
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 sm:h-8 sm:w-8 focus-visible:ring-2 focus-visible:ring-nexus-jade focus-visible:ring-offset-2"
              aria-label={
                language === "ar"
                  ? `خيارات للعضو ${member.name}`
                  : `Options for ${member.name}`
              }
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? "start" : "end"}>
            {/* A11Y: menu items name the specific member for screen reader context */}
            <DropdownMenuItem
              onClick={() => onEdit(member)}
              className="min-h-[44px]"
              aria-label={language === "ar" ? `تعديل بيانات ${member.name}` : `Edit ${member.name}`}
            >
              <Pencil className="h-4 w-4 me-2" aria-hidden="true" />
              {language === "ar" ? "تعديل" : "Edit"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setConfirmOpen(true)}
              className="text-destructive focus:text-destructive min-h-[44px]"
              aria-label={language === "ar" ? `إزالة العضو ${member.name}` : `Remove ${member.name}`}
            >
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
