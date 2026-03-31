"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"
import { deleteUserAccount } from "@/lib/api"
import { AlertTriangle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export function ProfileDangerZone() {
  const router = useRouter()
  const { language, isRTL } = useNexus()
  const [isOpen, setIsOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const requiredText = language === "ar" ? "حذف حسابي" : "DELETE MY ACCOUNT"

  const handleDelete = async () => {
    if (confirmText !== requiredText) return

    setIsDeleting(true)
    try {
      // SEC-SM-003: Safe JSON.parse — localStorage can be corrupted/tampered
      let userId: string | null = null
      try {
        const storedUser = typeof window !== "undefined" ? localStorage.getItem("nexus-user-display") : null
        userId = storedUser ? JSON.parse(storedUser).id : null
      } catch {
        // Corrupted localStorage
      }
      if (!userId) {
        throw new Error("User session not found")
      }
      const result = await deleteUserAccount(userId)
      if (!result) {
        throw new Error("Service unavailable")
      }
      // Clear localStorage
      localStorage.clear()
      toast.success(language === "ar" ? "تم حذف الحساب" : "Account deleted")
      setIsOpen(false)
      // Redirect to goodbye/login page
      router.push("/login")
    } catch {
      toast.error(language === "ar" ? "تعذّر حذف الحساب. يرجى المحاولة مرة أخرى أو التواصل مع الدعم." : "We couldn't delete your account. Please try again or contact support.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-6">
      <div className={cn("flex items-start gap-4", isRTL && "flex-row-reverse")}>
        <div className="p-2 rounded-lg bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
        </div>
        <div className={cn("flex-1", isRTL && "text-right")}>
          <h3 className="font-semibold text-destructive">
            {language === "ar" ? "منطقة الخطر" : "Danger Zone"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "ar"
              ? "حذف حسابك نهائي ولا يمكن التراجع عنه. سيتم حذف جميع بياناتك."
              : "Deleting your account is permanent and cannot be undone. All your data will be erased."}
          </p>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" className="mt-4">
                <Trash2 className="h-4 w-4 me-2" aria-hidden="true" />
                {language === "ar" ? "حذف الحساب" : "Delete Account"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className={isRTL ? "text-right" : undefined}>
                  {language === "ar" ? "تأكيد حذف الحساب" : "Confirm Account Deletion"}
                </DialogTitle>
                <DialogDescription className={isRTL ? "text-right" : undefined}>
                  {language === "ar"
                    ? "هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع بياناتك بشكل دائم."
                    : "This action cannot be undone. All your data will be permanently deleted."}
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className={cn("text-sm text-muted-foreground mb-2", isRTL && "text-right")}>
                  {language === "ar"
                    ? `اكتب "${requiredText}" للتأكيد:`
                    : `Type "${requiredText}" to confirm:`}
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={requiredText}
                  className={isRTL ? "text-right" : undefined}
                  dir={isRTL ? "rtl" : "ltr"}
                />
              </div>
              <DialogFooter className={isRTL ? "flex-row-reverse" : undefined}>
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  {language === "ar" ? "إلغاء" : "Cancel"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={confirmText !== requiredText || isDeleting}
                >
                  {isDeleting
                    ? language === "ar"
                      ? "جارٍ الحذف..."
                      : "Deleting..."
                    : language === "ar"
                    ? "حذف نهائي"
                    : "Delete Forever"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}
