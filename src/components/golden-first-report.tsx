"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { 
  Building2, Home, FileText, Globe, RefreshCw, Users, 
  Diamond, Pencil, ChevronRight, ChevronLeft, Check,
  BarChart3, Scale, Search, AlertTriangle, ListChecks, X
} from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

interface GoldenFirstReportProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (query: string, category: string) => void
  isFirstReport?: boolean
}

type Category = 
  | "business_launch"
  | "real_estate"
  | "regulatory"
  | "market_entry"
  | "restructuring"
  | "family_office"
  | "digital_asset"
  | "custom"

interface CategoryConfig {
  id: Category
  icon: React.ReactNode
  labelEn: string
  labelAr: string
}

const categories: CategoryConfig[] = [
  { id: "business_launch", icon: <Building2 className="h-6 w-6" aria-hidden="true" />, labelEn: "New Business Launch", labelAr: "إطلاق عمل جديد" },
  { id: "real_estate", icon: <Home className="h-6 w-6" aria-hidden="true" />, labelEn: "Real Estate Investment", labelAr: "استثمار عقاري" },
  { id: "regulatory", icon: <FileText className="h-6 w-6" aria-hidden="true" />, labelEn: "Regulatory Compliance", labelAr: "الامتثال التنظيمي" },
  { id: "market_entry", icon: <Globe className="h-6 w-6" aria-hidden="true" />, labelEn: "Market Entry Strategy", labelAr: "استراتيجية دخول السوق" },
  { id: "restructuring", icon: <RefreshCw className="h-6 w-6" aria-hidden="true" />, labelEn: "Restructuring & Optimization", labelAr: "إعادة الهيكلة والتحسين" },
  { id: "family_office", icon: <Users className="h-6 w-6" aria-hidden="true" />, labelEn: "Family Office Strategy", labelAr: "استراتيجية المكتب العائلي" },
  { id: "digital_asset", icon: <Diamond className="h-6 w-6" aria-hidden="true" />, labelEn: "Digital Asset Venture", labelAr: "مشروع أصول رقمية" },
  { id: "custom", icon: <Pencil className="h-6 w-6" aria-hidden="true" />, labelEn: "Custom Query", labelAr: "استفسار مخصص" },
]

interface ShardConfig {
  id: string
  icon: React.ReactNode
  nameEn: string
  nameAr: string
  descriptionEn: string
  descriptionAr: string
  enabled: boolean
}

const realEstateShards: ShardConfig[] = [
  { id: "financial", icon: <BarChart3 className="h-4 w-4" aria-hidden="true" />, nameEn: "Financial Model", nameAr: "النموذج المالي", descriptionEn: "IRR, NPV, cash flow projections for your property", descriptionAr: "IRR، NPV، توقعات التدفق النقدي لعقارك", enabled: true },
  { id: "legal", icon: <Scale className="h-4 w-4" aria-hidden="true" />, nameEn: "Legal & RERA", nameAr: "القانوني وRERA", descriptionEn: "Fee structure, DLD registration, Oqood compliance", descriptionAr: "هيكل الرسوم، تسجيل DLD، امتثال عقود", enabled: true },
  { id: "market", icon: <Search className="h-4 w-4" aria-hidden="true" />, nameEn: "Market Analysis", nameAr: "تحليل السوق", descriptionEn: "Comparable sales, rental yields, area trends", descriptionAr: "المبيعات المماثلة، عوائد الإيجار، اتجاهات المنطقة", enabled: true },
  { id: "risk", icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />, nameEn: "Risk Assessment", nameAr: "تقييم المخاطر", descriptionEn: "Market risks, regulatory risks, liquidity analysis", descriptionAr: "مخاطر السوق، المخاطر التنظيمية، تحليل السيولة", enabled: true },
  { id: "implementation", icon: <ListChecks className="h-4 w-4" aria-hidden="true" />, nameEn: "Implementation Plan", nameAr: "خطة التنفيذ", descriptionEn: "Step-by-step timeline with milestones", descriptionAr: "جدول زمني خطوة بخطوة مع المعالم", enabled: true },
]

export function GoldenFirstReport({
  isOpen,
  onClose,
  onComplete,
  isFirstReport = true,
}: GoldenFirstReportProps) {
  const { language, isRTL } = useNexus()
  const [step, setStep] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [shards, setShards] = useState(realEstateShards)
  const [customQuery, setCustomQuery] = useState("")

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category)
    if (category === "custom") {
      setStep(4) // Skip to custom query
    } else {
      setStep(2)
    }
  }

  const handleBack = () => {
    if (step === 4 && selectedCategory === "custom") {
      setStep(1)
      setSelectedCategory(null)
    } else {
      setStep(step - 1)
    }
  }

  const handleNext = () => {
    setStep(step + 1)
  }

  const toggleShard = (shardId: string) => {
    setShards(prev => prev.map(s => 
      s.id === shardId ? { ...s, enabled: !s.enabled } : s
    ))
  }

  const handleGenerate = () => {
    let query = ""
    
    if (selectedCategory === "custom") {
      query = customQuery
    } else if (selectedCategory === "real_estate") {
      const location = formData.location || "Dubai Marina"
      const budget = formData.budget || "AED 10-20M"
      const propertyType = formData.propertyType || "Residential"
      const timeline = formData.timeline || "3 months"
      const financing = formData.financing || "Cash"
      const additional = formData.additional || ""
      
      query = `Generate a comprehensive Pro report for a ${propertyType.toLowerCase()} real estate investment in ${location}. Budget range: ${budget}. Timeline: ${timeline}. Financing: ${financing}. ${additional ? `Additional context: ${additional}` : ""}`
    }
    
    onComplete(query, selectedCategory || "custom")
    handleClose()
  }

  const handleClose = () => {
    setStep(1)
    setSelectedCategory(null)
    setFormData({})
    setShards(realEstateShards)
    setCustomQuery("")
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(10, 22, 40, 0.95)", backdropFilter: "blur(12px)" }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={language === "ar" ? "تقرير الذكاء الأول" : "First Intelligence Report"}
          className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl"
          style={{
            background: "rgba(15, 29, 50, 0.9)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-[rgba(255,255,255,0.1)] transition-colors z-10"
            aria-label={language === "ar" ? "إغلاق" : "Close"}
          >
            <X className="h-5 w-5 text-[#94A3B8]" aria-hidden="true" />
          </button>

          {/* Progress bar */}
          {selectedCategory !== "custom" && (
            <div className="p-4 border-b border-[rgba(255,255,255,0.08)]">
              <div className="flex items-center gap-2">
                {[1, 2, 3].map(s => (
                  <div
                    key={s}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      s <= step ? "bg-[#2563EB]" : "bg-[rgba(255,255,255,0.1)]"
                    )}
                  />
                ))}
              </div>
              <p className="text-xs text-[#94A3B8] mt-2">
                {language === "ar" ? `الخطوة ${step} من 3` : `Step ${step} of 3`}
              </p>
            </div>
          )}

          {/* Step 1: Category Selection */}
          {step === 1 && (
            <div className="p-6">
              <h2 className="text-2xl font-semibold text-white text-center mb-2">
                {language === "ar" ? "لنبني تقريرك الاستخباراتي الأول" : "Let's build your first intelligence report"}
              </h2>
              <p className="text-sm text-[#94A3B8] text-center mb-8">
                {language === "ar" ? "اختر فئة وسنرشدك خلالها" : "Choose a category and we'll guide you through it"}
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {categories.map(cat => (
                  <motion.button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat.id)}
                    className={cn(
                      "p-4 rounded-xl flex flex-col items-center gap-2 transition-all",
                      "bg-[#0A1628] border border-[rgba(255,255,255,0.08)]",
                      "hover:border-[#2563EB] hover:shadow-[0_0_20px_rgba(37,99,235,0.2)]"
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="text-[#2563EB]">{cat.icon}</span>
                    <span className="text-xs text-white text-center">
                      {language === "ar" ? cat.labelAr : cat.labelEn}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Guided Intake (Real Estate example) */}
          {step === 2 && selectedCategory === "real_estate" && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white mb-6">
                {language === "ar" ? "تفاصيل الاستثمار العقاري" : "Real Estate Investment Details"}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[#94A3B8] mb-1.5 block">
                    {language === "ar" ? "الموقع المفضل؟" : "Location preference?"}
                  </label>
                  <Select 
                    value={formData.location} 
                    onValueChange={(v) => setFormData(p => ({ ...p, location: v }))}
                  >
                    <SelectTrigger className="bg-[#0A1628] border-[rgba(255,255,255,0.08)]">
                      <SelectValue placeholder={language === "ar" ? "اختر الموقع" : "Select location"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dubai Marina">Dubai Marina</SelectItem>
                      <SelectItem value="Downtown Dubai">Downtown Dubai</SelectItem>
                      <SelectItem value="Business Bay">Business Bay</SelectItem>
                      <SelectItem value="JBR">JBR</SelectItem>
                      <SelectItem value="Abu Dhabi Saadiyat">Abu Dhabi Saadiyat</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-[#94A3B8] mb-1.5 block">
                    {language === "ar" ? "نطاق الميزانية؟" : "Budget range?"}
                  </label>
                  <Select 
                    value={formData.budget} 
                    onValueChange={(v) => setFormData(p => ({ ...p, budget: v }))}
                  >
                    <SelectTrigger className="bg-[#0A1628] border-[rgba(255,255,255,0.08)]">
                      <SelectValue placeholder={language === "ar" ? "اختر النطاق" : "Select range"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="<5M">{"< AED 5M"}</SelectItem>
                      <SelectItem value="5-20M">AED 5-20M</SelectItem>
                      <SelectItem value="20-50M">AED 20-50M</SelectItem>
                      <SelectItem value="50-200M">AED 50-200M</SelectItem>
                      <SelectItem value="200M+">AED 200M+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-[#94A3B8] mb-2 block">
                    {language === "ar" ? "نوع العقار؟" : "Property type?"}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {["Residential", "Commercial", "Mixed-Use", "Industrial"].map(type => (
                      <button
                        key={type}
                        onClick={() => setFormData(p => ({ ...p, propertyType: type }))}
                        className={cn(
                          "p-3 rounded-lg text-xs text-center transition-all border",
                          formData.propertyType === type
                            ? "bg-[#2563EB]/20 border-[#2563EB] text-white"
                            : "bg-[#0A1628] border-[rgba(255,255,255,0.08)] text-[#94A3B8] hover:border-[#2563EB]/50"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#94A3B8] mb-2 block">
                    {language === "ar" ? "الجدول الزمني؟" : "Timeline?"}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {["Immediate", "3 months", "6 months", "12+ months"].map(time => (
                      <button
                        key={time}
                        onClick={() => setFormData(p => ({ ...p, timeline: time }))}
                        className={cn(
                          "p-3 rounded-lg text-xs text-center transition-all border",
                          formData.timeline === time
                            ? "bg-[#2563EB]/20 border-[#2563EB] text-white"
                            : "bg-[#0A1628] border-[rgba(255,255,255,0.08)] text-[#94A3B8] hover:border-[#2563EB]/50"
                        )}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#94A3B8] mb-2 block">
                    {language === "ar" ? "التمويل؟" : "Financing?"}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {["Cash", "Mortgage", "Investor Fund", "Mixed"].map(fin => (
                      <button
                        key={fin}
                        onClick={() => setFormData(p => ({ ...p, financing: fin }))}
                        className={cn(
                          "p-3 rounded-lg text-xs text-center transition-all border",
                          formData.financing === fin
                            ? "bg-[#2563EB]/20 border-[#2563EB] text-white"
                            : "bg-[#0A1628] border-[rgba(255,255,255,0.08)] text-[#94A3B8] hover:border-[#2563EB]/50"
                        )}
                      >
                        {fin}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#94A3B8] mb-1.5 block">
                    {language === "ar" ? "أي شيء آخر؟ (اختياري)" : "Anything else? (optional)"}
                  </label>
                  <Textarea
                    value={formData.additional || ""}
                    onChange={(e) => setFormData(p => ({ ...p, additional: e.target.value }))}
                    placeholder={language === "ar" ? "سياق إضافي..." : "Additional context..."}
                    className="bg-[#0A1628] border-[rgba(255,255,255,0.08)] min-h-[60px]"
                  />
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between mt-6">
                <Button variant="ghost" onClick={handleBack}>
                  <ChevronLeft className="h-4 w-4 me-1" aria-hidden="true" />
                  {language === "ar" ? "رجوع" : "Back"}
                </Button>
                <Button onClick={handleNext} className="bg-[#2563EB] hover:bg-[#2563EB]/90">
                  {language === "ar" ? "متابعة" : "Continue"}
                  <ChevronRight className="h-4 w-4 ms-1" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Report Preview */}
          {step === 3 && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white mb-2">
                {language === "ar" ? "هذا ما سيغطيه تقريرك الاحترافي من NexusAD" : "Here's what your NexusAD Pro Report will cover"}
              </h2>
              <p className="text-sm text-[#94A3B8] mb-6">
                {language === "ar" ? "تبديل الأقسام لتخصيص تقريرك" : "Toggle sections to customize your report"}
              </p>
              
              {/* Shards */}
              <div className="space-y-2 mb-6">
                {shards.map(shard => (
                  <div
                    key={shard.id}
                    className={cn(
                      "p-3 rounded-lg flex items-start gap-3 transition-all",
                      "bg-[#0A1628] border",
                      shard.enabled 
                        ? "border-[#2563EB]/50" 
                        : "border-[rgba(255,255,255,0.08)] opacity-50"
                    )}
                  >
                    <Checkbox
                      checked={shard.enabled}
                      onCheckedChange={() => toggleShard(shard.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[#2563EB]">{shard.icon}</span>
                        <span className="text-sm font-medium text-white">
                          {language === "ar" ? shard.nameAr : shard.nameEn}
                        </span>
                      </div>
                      <p className="text-xs text-[#94A3B8] mt-1">
                        {language === "ar" ? shard.descriptionAr : shard.descriptionEn}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Estimates */}
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="px-4 py-2 rounded-lg bg-[#0A1628]">
                  <span className="text-xs text-[#94A3B8]">{language === "ar" ? "وقت التسليم" : "Delivery time"}</span>
                  <p className="text-sm text-[#2563EB] font-medium">~3-5 {language === "ar" ? "دقائق" : "minutes"}</p>
                </div>
                <div className="px-4 py-2 rounded-lg bg-[#0A1628]">
                  <span className="text-xs text-[#94A3B8]">{language === "ar" ? "طول التقرير" : "Report length"}</span>
                  <p className="text-sm text-[#2563EB] font-medium">25,000+ {language === "ar" ? "حرف" : "characters"}</p>
                </div>
                <div className="px-4 py-2 rounded-lg bg-[#0A1628]">
                  <span className="text-xs text-[#94A3B8]">{language === "ar" ? "التكلفة" : "Cost"}</span>
                  <p className="text-sm font-medium">
                    {isFirstReport ? (
                      <span className="text-[#10B981]">{language === "ar" ? "مجاني — تقريرك الأول علينا" : "FREE — Your first report is on us"}</span>
                    ) : (
                      <span className="text-white">$50</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between">
                <Button variant="ghost" onClick={handleBack}>
                  <ChevronLeft className="h-4 w-4 me-1" aria-hidden="true" />
                  {language === "ar" ? "رجوع" : "Back"}
                </Button>
                <Button
                  onClick={handleGenerate}
                  className="bg-[#2563EB] hover:bg-[#2563EB]/90 px-8"
                >
                  {language === "ar" ? "إنشاء التقرير" : "Generate Report"}
                  <ChevronRight className="h-4 w-4 ms-1" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Custom Query */}
          {step === 4 && selectedCategory === "custom" && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white mb-2">
                {language === "ar" ? "استفسارك المخصص" : "Your Custom Query"}
              </h2>
              <p className="text-sm text-[#94A3B8] mb-6">
                {language === "ar" ? "صف ما تريد أن يحلله NexusAD بالتفصيل" : "Describe what you'd like NexusAD to analyze in detail"}
              </p>
              
              <Textarea
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder={language === "ar" 
                  ? "مثال: أريد تحليلاً شاملاً لفرص الاستثمار في قطاع التكنولوجيا المالية في الإمارات..."
                  : "Example: I want a comprehensive analysis of fintech investment opportunities in the UAE..."
                }
                className="bg-[#0A1628] border-[rgba(255,255,255,0.08)] min-h-[200px]"
              />

              {/* Navigation */}
              <div className="flex justify-between mt-6">
                <Button variant="ghost" onClick={handleBack}>
                  <ChevronLeft className="h-4 w-4 me-1" aria-hidden="true" />
                  {language === "ar" ? "رجوع" : "Back"}
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={!customQuery.trim()}
                  className="bg-[#2563EB] hover:bg-[#2563EB]/90 px-8"
                >
                  {language === "ar" ? "إنشاء التقرير" : "Generate Report"}
                  <ChevronRight className="h-4 w-4 ms-1" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
