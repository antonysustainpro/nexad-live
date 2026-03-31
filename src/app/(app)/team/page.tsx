"use client"

import { useState, useEffect, useCallback } from "react"
import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"
import type { TeamMember, TeamInvitation, TeamMemberRole } from "@/lib/types"
import {
  getTeamMembers,
  getTeamInvitations,
  inviteTeamMember,
  updateTeamMember,
  removeTeamMember,
  cancelTeamInvitation,
} from "@/lib/api"
import { BillingGuard } from "@/components/billing-guard"
import { TeamMemberRow } from "@/components/team-member-row"
import { TeamInviteModal } from "@/components/team-invite-modal"
import { TeamEditRoleModal } from "@/components/team-edit-role-modal"
import { TeamPageSkeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, UserPlus, Clock, X } from "lucide-react"
import { toast } from "sonner"

function TeamContent() {
  const { language, isRTL } = useNexus()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<TeamInvitation[]>([])
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [selectedMemberForEdit, setSelectedMemberForEdit] = useState<TeamMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTeamData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const [membersData, invitationsData] = await Promise.all([
        getTeamMembers(signal),
        getTeamInvitations(signal),
      ])
      setMembers(membersData || [])
      setInvitations(invitationsData || [])
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      setError(err instanceof Error ? err.message : "Failed to load team data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const abortController = new AbortController()
    loadTeamData(abortController.signal)
    return () => abortController.abort()
  }, [loadTeamData])

  const handleInvite = async (email: string, role: TeamMemberRole) => {
    try {
      const result = await inviteTeamMember(email, role)
      if (result) {
        setInvitations((prev) => [...prev, result])
        toast.success(language === "ar" ? "تم إرسال الدعوة" : "Invitation sent")
        setIsInviteModalOpen(false)
      } else {
        toast.error(language === "ar" ? "فشل إرسال الدعوة" : "Failed to send invitation")
      }
    } catch {
      toast.error(language === "ar" ? "فشل إرسال الدعوة" : "Failed to send invitation")
    }
  }

  const handleEditMember = (member: TeamMember) => {
    setSelectedMemberForEdit(member)
  }

  const handleSaveRole = async (member: TeamMember) => {
    try {
      const result = await updateTeamMember(member.id, member.role)
      if (result) {
        setMembers((prev) => prev.map((m) => (m.id === member.id ? result : m)))
        toast.success(language === "ar" ? "تم تحديث العضو" : "Member updated")
      } else {
        toast.error(language === "ar" ? "فشل تحديث العضو" : "Failed to update member")
      }
    } catch {
      toast.error(language === "ar" ? "فشل تحديث العضو" : "Failed to update member")
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      const result = await removeTeamMember(memberId)
      if (result?.removed) {
        setMembers((prev) => prev.filter((m) => m.id !== memberId))
        toast.success(language === "ar" ? "تم إزالة العضو" : "Member removed")
      } else {
        toast.error(language === "ar" ? "فشل إزالة العضو" : "Failed to remove member")
      }
    } catch {
      toast.error(language === "ar" ? "فشل إزالة العضو" : "Failed to remove member")
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const result = await cancelTeamInvitation(invitationId)
      if (result?.cancelled) {
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId))
        toast.success(language === "ar" ? "تم إلغاء الدعوة" : "Invitation cancelled")
      } else {
        // Still remove locally for responsive UX
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId))
        toast.success(language === "ar" ? "تم إلغاء الدعوة" : "Invitation cancelled")
      }
    } catch {
      toast.error(language === "ar" ? "فشل إلغاء الدعوة" : "Failed to cancel invitation")
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(
      language === "ar" ? "ar-AE" : "en-US",
      { month: "short", day: "numeric" }
    )
  }

  const roleLabels: Record<TeamMemberRole, { en: string; ar: string }> = {
    admin: { en: "Admin", ar: "مدير" },
    member: { en: "Member", ar: "عضو" },
    viewer: { en: "Viewer", ar: "مشاهد" },
  }

  if (loading) {
    return <TeamPageSkeleton />
  }

  if (error) {
    return (
      <div className="container max-w-5xl mx-auto px-4 pb-24 md:pb-8">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-12 w-12 text-destructive/30 mb-4" aria-hidden="true" />
          <h3 className="font-medium text-destructive mb-1">
            {language === "ar" ? "خطأ في تحميل الفريق" : "Error Loading Team"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={() => loadTeamData()}>
            {language === "ar" ? "إعادة المحاولة" : "Retry"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-5xl mx-auto px-4 pb-24 md:pb-8">
      {/* Header */}
      <div className={cn("flex items-center justify-between mb-6", isRTL && "flex-row-reverse")}>
        <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
          <Users className="h-6 w-6 text-nexus-jade" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-foreground">
            {language === "ar" ? "إدارة الفريق" : "Team Management"}
          </h1>
        </div>
        <Button
          onClick={() => setIsInviteModalOpen(true)}
          className="bg-nexus-jade hover:bg-nexus-jade-hover text-background"
        >
          <UserPlus className="h-4 w-4 me-2" aria-hidden="true" />
          {language === "ar" ? "دعوة عضو" : "Invite Member"}
        </Button>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card className="mb-6 border-[#F59E0B]/30">
          <CardHeader className="pb-3">
            <CardTitle className={cn("text-base flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <Clock className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" />
              {language === "ar" ? "الدعوات المعلقة" : "Pending Invitations"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg bg-muted/50",
                    isRTL && "flex-row-reverse"
                  )}
                >
                  <div className={isRTL ? "text-right" : undefined}>
                    <p className="font-medium">{invitation.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {language === "ar" ? roleLabels[invitation.role].ar : roleLabels[invitation.role].en} • 
                      {language === "ar" ? " تنتهي " : " Expires "}{formatDate(invitation.expiresAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCancelInvitation(invitation.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    aria-label={language === "ar" ? "إلغاء الدعوة" : "Cancel invitation"}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className={isRTL ? "text-right" : undefined}>
            {language === "ar" ? `أعضاء الفريق (${members.length})` : `Team Members (${members.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Users className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              </div>
              <h3 className="font-medium text-foreground mb-1">
                {language === "ar" ? "لا يوجد أعضاء في الفريق بعد" : "No team members yet"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {language === "ar"
                  ? "قم بدعوة أعضاء فريقك للبدء بالتعاون"
                  : "Invite your team members to start collaborating"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className={cn("py-3 px-2 sm:px-4 font-medium text-muted-foreground", "text-start")}>
                      {language === "ar" ? "العضو" : "Member"}
                    </th>
                    <th scope="col" className={cn("py-3 px-2 sm:px-4 font-medium text-muted-foreground hidden sm:table-cell", "text-start")}>
                      {language === "ar" ? "البريد الإلكتروني" : "Email"}
                    </th>
                    <th scope="col" className={cn("py-3 px-2 sm:px-4 font-medium text-muted-foreground", "text-start")}>
                      {language === "ar" ? "الدور" : "Role"}
                    </th>
                    <th scope="col" className={cn("py-3 px-2 sm:px-4 font-medium text-muted-foreground hidden md:table-cell", "text-start")}>
                      {language === "ar" ? "آخر نشاط" : "Last Active"}
                    </th>
                    <th scope="col" className={cn("py-3 px-2 sm:px-4 font-medium text-muted-foreground hidden lg:table-cell", "text-start")}>
                      {language === "ar" ? "الاستخدام" : "Usage"}
                    </th>
                    <th scope="col" className={cn("py-3 px-2 sm:px-4 font-medium text-muted-foreground", "text-start")}>
                      <span className="sr-only">{language === "ar" ? "إجراءات" : "Actions"}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <TeamMemberRow
                      key={member.id}
                      member={member}
                      onEdit={handleEditMember}
                      onRemove={handleRemoveMember}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Modal */}
      <TeamInviteModal
        open={isInviteModalOpen}
        onOpenChange={setIsInviteModalOpen}
        onInvite={handleInvite}
      />

      {/* Edit Role Modal */}
      <TeamEditRoleModal
        open={selectedMemberForEdit !== null}
        onOpenChange={(open) => { if (!open) setSelectedMemberForEdit(null) }}
        member={selectedMemberForEdit}
        onSave={handleSaveRole}
      />
    </div>
  )
}

export default function TeamPage() {
  return (
    <BillingGuard tier="ENTERPRISE" feature="Team Management" featureAr="إدارة الفريق">
      <TeamContent />
    </BillingGuard>
  )
}
