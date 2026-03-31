"use client"

import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Copy, Mail, MessageCircle } from "lucide-react"
import { toast } from "sonner"

interface ReferralShareCardProps {
  referralCode: string
}

export function ReferralShareCard({ referralCode }: ReferralShareCardProps) {
  const { language, isRTL } = useNexus()

  const referralLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://nexusad.ai'}/refer/${referralCode}`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      toast.success(language === "ar" ? "تم نسخ الرابط" : "Link copied")
    } catch {
      toast.error(language === "ar" ? "تعذّر النسخ. يرجى المحاولة مرة أخرى." : "Couldn't copy to clipboard. Please try again.")
    }
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode)
      toast.success(language === "ar" ? "تم نسخ الكود" : "Code copied")
    } catch {
      toast.error(language === "ar" ? "تعذّر النسخ. يرجى المحاولة مرة أخرى." : "Couldn't copy to clipboard. Please try again.")
    }
  }

  const handleShareWhatsApp = () => {
    const text = language === "ar"
      ? `انضم إلى NexusAD AI واحصل على شهر مجاني! استخدم كودي: ${referralCode}`
      : `Join NexusAD AI and get a free month! Use my code: ${referralCode}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text + "\n" + referralLink)}`, "_blank", "noopener,noreferrer")
  }

  const handleShareEmail = () => {
    const subject = language === "ar" ? "دعوة لـ NexusAD AI" : "Invitation to NexusAD AI"
    const body = language === "ar"
      ? `أدعوك لتجربة NexusAD AI - الذكاء الاصطناعي السيادي.\n\nاستخدم كود الإحالة الخاص بي: ${referralCode}\n\n${referralLink}`
      : `I invite you to try NexusAD AI - sovereign AI assistant.\n\nUse my referral code: ${referralCode}\n\n${referralLink}`
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-6">
      {/* Referral Code */}
      <div className="space-y-2">
        <label className={cn("text-sm font-medium text-muted-foreground", isRTL && "text-right block")}>
          {language === "ar" ? "كود الإحالة" : "Referral Code"}
        </label>
        <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
          <Input
            value={referralCode}
            readOnly
            className="font-mono text-lg font-bold text-center"
            dir="ltr"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopyCode}
            aria-label={language === "ar" ? "نسخ الكود" : "Copy code"}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Referral Link */}
      <div className="space-y-2">
        <label className={cn("text-sm font-medium text-muted-foreground", isRTL && "text-right block")}>
          {language === "ar" ? "رابط الإحالة" : "Referral Link"}
        </label>
        <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
          <Input
            value={referralLink}
            readOnly
            className="text-sm"
            dir="ltr"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopyLink}
            aria-label={language === "ar" ? "نسخ الرابط" : "Copy link"}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Share Buttons */}
      <div className="space-y-2">
        <label className={cn("text-sm font-medium text-muted-foreground", isRTL && "text-right block")}>
          {language === "ar" ? "مشاركة عبر" : "Share via"}
        </label>
        <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
          <Button
            variant="outline"
            onClick={handleShareWhatsApp}
            className="flex-1"
          >
            <MessageCircle className="h-4 w-4 me-2" aria-hidden="true" />
            {language === "ar" ? "واتساب" : "WhatsApp"}
          </Button>
          <Button
            variant="outline"
            onClick={handleShareEmail}
            className="flex-1"
          >
            <Mail className="h-4 w-4 me-2" aria-hidden="true" />
            {language === "ar" ? "بريد إلكتروني" : "Email"}
          </Button>
          <Button
            variant="outline"
            onClick={handleCopyLink}
            className="flex-1"
          >
            <Copy className="h-4 w-4 me-2" aria-hidden="true" />
            {language === "ar" ? "نسخ الرابط" : "Copy Link"}
          </Button>
        </div>
      </div>
    </div>
  )
}
