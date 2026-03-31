"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import Link from "next/link"
import { useNexus } from "@/contexts/nexus-context"
import { requestDataExport, getDataExports, type DataExport } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { Download, FileJson, FileText, FileSpreadsheet, Shield, Clock, AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const dataTypes = [
  { id: "all", label: "Export all my data", labelAr: "تصدير جميع بياناتي", description: "Full archive of all your data", descriptionAr: "أرشيف كامل لجميع بياناتك" },
  { id: "conversations", label: "Conversations only", labelAr: "المحادثات فقط", description: "Chat history and messages", descriptionAr: "سجل المحادثات والرسائل" },
  { id: "vault", label: "Vault documents only", labelAr: "مستندات الخزنة فقط", description: "Uploaded files and documents", descriptionAr: "الملفات والمستندات المرفوعة" },
  { id: "profile", label: "Profile data only", labelAr: "بيانات الملف الشخصي فقط", description: "Account information and settings", descriptionAr: "معلومات الحساب والإعدادات" },
]

const formats = [
  { id: "json", label: "JSON", icon: FileJson, description: "Machine-readable format" },
  { id: "csv", label: "CSV", icon: FileSpreadsheet, description: "Spreadsheet compatible" },
  { id: "pdf", label: "PDF", icon: FileText, description: "Human-readable document" },
]

// Empty default - populated from API only
const emptyExportHistory: DataExport[] = []

export default function DataExportPage() {
  const { language, isRTL } = useNexus()
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedFormat, setSelectedFormat] = useState<"json" | "csv" | "pdf">("json")
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)
  const [requestSuccess, setRequestSuccess] = useState(false)
  const [exportHistory, setExportHistory] = useState<DataExport[]>(emptyExportHistory)

  // Load export history from API
  useEffect(() => {
    async function loadExports() {
      const data = await getDataExports()
      if (data) {
        setExportHistory(data)
      }
    }
    loadExports()
  }, [])

  const handleTypeToggle = (typeId: string) => {
    if (typeId === "all") {
      setSelectedTypes(selectedTypes.includes("all") ? [] : ["all"])
    } else {
      const newTypes = selectedTypes.filter(t => t !== "all")
      if (newTypes.includes(typeId)) {
        setSelectedTypes(newTypes.filter(t => t !== typeId))
      } else {
        setSelectedTypes([...newTypes, typeId])
      }
    }
  }

  const handleRequestExport = async () => {
    setIsRequesting(true)
    try {
      const result = await requestDataExport({
        types: selectedTypes,
        format: selectedFormat,
      })
      if (result) {
        setRequestSuccess(true)
        // Refresh export history
        const data = await getDataExports()
        if (data) setExportHistory(data)
      } else {
        toast.error(language === "ar" ? "تعذّر طلب التصدير. يرجى المحاولة مرة أخرى." : "We couldn't start your export. Please try again.")
      }
    } catch {
      toast.error(language === "ar" ? "حدث خطأ. يرجى المحاولة مرة أخرى." : "Something went wrong. Please try again.")
    } finally {
      setIsRequesting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return <Badge className="bg-emotion-joyful/20 text-emotion-joyful border-emotion-joyful/30">{language === "ar" ? "جاهز" : "Ready"}</Badge>
      case "processing":
        return <Badge className="bg-emotion-excited/20 text-emotion-excited border-emotion-excited/30">{language === "ar" ? "جاري المعالجة" : "Processing"}</Badge>
      case "expired":
        return <Badge variant="secondary" className="text-muted-foreground">{language === "ar" ? "منتهي الصلاحية" : "Expired"}</Badge>
      default:
        return null
    }
  }

  return (
    <div 
      className="min-h-screen bg-background p-4 md:p-8"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/settings" 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {language === "ar" ? "العودة للإعدادات" : "Back to Settings"}
          </Link>
          <h1 className="text-title-1 mb-2">
            {language === "ar" ? "تصدير البيانات" : "Data Export"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar" 
              ? "قم بتصدير بياناتك في أي وقت. بياناتك ملك لك." 
              : "Export your data anytime. Your data belongs to you."}
          </p>
        </div>

        {/* Legal notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-nexus-jade/30 bg-nexus-jade/5 mb-8">
            <CardContent className="p-4 flex items-start gap-3">
              <Shield className="h-5 w-5 text-nexus-jade flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h3 className="font-medium mb-1">
                  {language === "ar" ? "حقوقك في البيانات" : "Your Data Rights"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" 
                    ? "بموجب قوانين حماية البيانات (GDPR/PDPL)، لديك الحق في الوصول إلى بياناتك وتصديرها. نحتفظ بالتصديرات لمدة 7 أيام." 
                    : "Under data protection laws (GDPR/PDPL), you have the right to access and export your data. Exports are available for 7 days."}
                </p>
                <Link href="/privacy" className="text-sm text-nexus-jade hover:text-nexus-jade-hover mt-1 inline-block">
                  {language === "ar" ? "قراءة سياسة الخصوصية" : "Read Privacy Policy"}
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Export options */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-white/10">
              <CardHeader>
                <CardTitle className="text-lg">
                  {language === "ar" ? "اختر البيانات للتصدير" : "Select Data to Export"}
                </CardTitle>
                <CardDescription>
                  {language === "ar" ? "اختر نوع البيانات التي تريد تصديرها" : "Choose which data types you want to export"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dataTypes.map((type) => (
                  <div key={type.id} className="flex items-start gap-3">
                    <Checkbox
                      id={type.id}
                      checked={selectedTypes.includes(type.id) || (type.id === "all" && selectedTypes.includes("all"))}
                      onCheckedChange={() => handleTypeToggle(type.id)}
                      disabled={type.id !== "all" && selectedTypes.includes("all")}
                      className="mt-0.5 border-white/20 data-[state=checked]:bg-nexus-jade data-[state=checked]:border-nexus-jade"
                    />
                    <div className="flex-1">
                      <Label htmlFor={type.id} className="cursor-pointer font-medium">
                        {language === "ar" ? type.labelAr : type.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {language === "ar" ? type.descriptionAr : type.description}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Format selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-white/10">
              <CardHeader>
                <CardTitle className="text-lg">
                  {language === "ar" ? "اختر التنسيق" : "Select Format"}
                </CardTitle>
                <CardDescription>
                  {language === "ar" ? "اختر تنسيق الملف المفضل" : "Choose your preferred file format"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={selectedFormat} onValueChange={(v) => setSelectedFormat(v as "json" | "csv" | "pdf")} className="space-y-3">
                  {formats.map((format) => (
                    <div key={format.id} className="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:bg-secondary/30 transition-colors">
                      <RadioGroupItem 
                        value={format.id} 
                        id={format.id}
                        className="border-white/20 data-[state=checked]:border-nexus-jade data-[state=checked]:text-nexus-jade"
                      />
                      <format.icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      <div className="flex-1">
                        <Label htmlFor={format.id} className="cursor-pointer font-medium">
                          {format.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{format.description}</p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>

                <Button
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={selectedTypes.length === 0}
                  className="w-full mt-6 bg-nexus-jade hover:bg-nexus-jade-hover text-background btn-press"
                >
                  <Download className="h-4 w-4 me-2" aria-hidden="true" />
                  {language === "ar" ? "طلب التصدير" : "Request Export"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Export history */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <Card className="border-white/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                {language === "ar" ? "سجل التصدير" : "Export History"}
              </CardTitle>
              <CardDescription>
                {language === "ar" ? "روابط التحميل صالحة لمدة 7 أيام" : "Download links are valid for 7 days"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {exportHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                      <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                      <TableHead>{language === "ar" ? "التنسيق" : "Format"}</TableHead>
                      <TableHead>{language === "ar" ? "الحجم" : "Size"}</TableHead>
                      <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                      <TableHead><span className="sr-only">{language === "ar" ? "تحميل" : "Download"}</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exportHistory.map((export_) => (
                      <TableRow key={export_.id} className="border-white/10">
                        <TableCell className="font-mono text-sm">{export_.date}</TableCell>
                        <TableCell>{export_.type}</TableCell>
                        <TableCell>{export_.format}</TableCell>
                        <TableCell>{export_.size}</TableCell>
                        <TableCell>{getStatusBadge(export_.status)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={export_.status !== "ready"}
                            className={cn(
                              "text-nexus-jade hover:text-nexus-jade-hover",
                              export_.status !== "ready" && "opacity-50"
                            )}
                          >
                            <Download className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {language === "ar" ? "لا توجد تصديرات سابقة" : "No previous exports"}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="border-white/10 bg-card">
          {requestSuccess ? (
            <div className="text-center py-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
                className="w-16 h-16 mx-auto rounded-full bg-emotion-joyful/20 flex items-center justify-center mb-4"
              >
                <CheckCircle2 className="h-8 w-8 text-emotion-joyful" aria-hidden="true" />
              </motion.div>
              <DialogTitle className="mb-2">
                {language === "ar" ? "تم إرسال الطلب!" : "Request Submitted!"}
              </DialogTitle>
              <DialogDescription>
                {language === "ar" 
                  ? "سنرسل لك بريداً إلكترونياً عندما يكون التصدير جاهزاً للتحميل." 
                  : "We'll email you when your export is ready to download."}
              </DialogDescription>
              <Button 
                onClick={() => { setShowConfirmDialog(false); setRequestSuccess(false); setSelectedTypes([]) }}
                className="mt-4 bg-nexus-jade hover:bg-nexus-jade-hover text-background"
              >
                {language === "ar" ? "حسناً" : "Got it"}
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  {language === "ar" ? "تأكيد طلب التصدير" : "Confirm Export Request"}
                </DialogTitle>
                <DialogDescription>
                  {language === "ar" 
                    ? "قد يستغرق إعداد التصدير ما يصل إلى 24 ساعة حسب حجم البيانات." 
                    : "This may take up to 24 hours depending on the size of your data."}
                </DialogDescription>
              </DialogHeader>
              <div className="p-4 rounded-lg bg-secondary/50 border border-white/10">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-emotion-excited flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    {language === "ar" 
                      ? "سيتم إرسال إشعار بالبريد الإلكتروني عند اكتمال التصدير." 
                      : "You'll receive an email notification when your export is complete."}
                  </p>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowConfirmDialog(false)}
                  className="border-white/10"
                >
                  {language === "ar" ? "إلغاء" : "Cancel"}
                </Button>
                <Button 
                  onClick={handleRequestExport}
                  disabled={isRequesting}
                  className="bg-nexus-jade hover:bg-nexus-jade-hover text-background"
                >
                  {isRequesting ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    language === "ar" ? "تأكيد الطلب" : "Confirm Request"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
