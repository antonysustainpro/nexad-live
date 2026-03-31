"use client"

import { motion } from "motion/react"
import { 
  MessageSquare, 
  FileText, 
  Lock, 
  Search,
  Upload,
  Sparkles,
  Shield,
  type LucideIcon 
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface NexusEmptyStateProps {
  icon?: LucideIcon
  titleEn: string
  titleAr?: string
  descriptionEn: string
  descriptionAr?: string
  actionLabelEn?: string
  actionLabelAr?: string
  onAction?: () => void
  language?: "en" | "ar" | "bilingual"
  className?: string
  variant?: "default" | "vault" | "chat" | "search"
}

export function NexusEmptyState({
  icon: CustomIcon,
  titleEn,
  titleAr,
  descriptionEn,
  descriptionAr,
  actionLabelEn,
  actionLabelAr,
  onAction,
  language = "en",
  className,
  variant = "default",
}: NexusEmptyStateProps) {
  const variants = {
    default: {
      icon: Sparkles,
      gradientFrom: "from-muted/20",
      gradientTo: "to-muted/20",
      iconColor: "text-muted-foreground",
    },
    vault: {
      icon: Lock,
      gradientFrom: "from-nexus-gold/20",
      gradientTo: "to-nexus-gold/5",
      iconColor: "text-nexus-gold",
    },
    chat: {
      icon: MessageSquare,
      gradientFrom: "from-nexus-jade/20",
      gradientTo: "to-nexus-jade/5",
      iconColor: "text-nexus-jade",
    },
    search: {
      icon: Search,
      gradientFrom: "from-muted/50",
      gradientTo: "to-secondary/50",
      iconColor: "text-muted-foreground",
    },
  }

  const config = variants[variant]
  const Icon = CustomIcon || config.icon
  const isArabic = language === "ar"

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col items-center justify-center p-8 md:p-12 text-center",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={isArabic && titleAr ? titleAr : titleEn}
    >
      {/* Animated background gradient */}
      <div className="relative mb-6">
        <motion.div
          className={cn(
            "absolute inset-0 rounded-full bg-gradient-to-br blur-2xl opacity-60",
            config.gradientFrom,
            config.gradientTo
          )}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.4, 0.6, 0.4],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        
        {/* Icon container */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.1 }}
          className={cn(
            "relative p-6 rounded-2xl",
            "bg-gradient-to-br",
            config.gradientFrom.replace("/20", "/10"),
            config.gradientTo.replace("/20", "/10").replace(/\/5$/, "/10"),
            "border border-border"
          )}
        >
          <Icon className={cn("h-12 w-12", config.iconColor)} aria-hidden="true" />
        </motion.div>
      </div>

      {/* Title */}
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-xl font-semibold mb-2"
      >
        {isArabic && titleAr ? titleAr : titleEn}
      </motion.h3>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-muted-foreground max-w-md mb-6"
      >
        {isArabic && descriptionAr ? descriptionAr : descriptionEn}
      </motion.p>

      {/* Action button */}
      {actionLabelEn && onAction && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Button
            onClick={onAction}
            className="bg-nexus-jade hover:bg-nexus-jade-hover text-background"
          >
            {isArabic && actionLabelAr ? actionLabelAr : actionLabelEn}
          </Button>
        </motion.div>
      )}
    </motion.div>
  )
}

// Pre-configured empty states for common scenarios
export function EmptyVault({ 
  onUpload, 
  language = "en" 
}: { 
  onUpload?: () => void
  language?: "en" | "ar" | "bilingual"
}) {
  return (
    <NexusEmptyState
      variant="vault"
      icon={Upload}
      titleEn="Your vault is empty"
      titleAr="خزنتك فارغة"
      descriptionEn="Upload your first document to start building your sovereign vault. All files are encrypted and distributed securely."
      descriptionAr="ارفع مستندك الأول لبدء بناء خزنتك السيادية. جميع الملفات مشفرة وموزعة بأمان."
      actionLabelEn="Upload Document"
      actionLabelAr="رفع مستند"
      onAction={onUpload}
      language={language}
    />
  )
}

export function EmptyChat({ 
  onNewChat, 
  language = "en" 
}: { 
  onNewChat?: () => void
  language?: "en" | "ar" | "bilingual"
}) {
  return (
    <NexusEmptyState
      variant="chat"
      icon={MessageSquare}
      titleEn="Start a conversation"
      titleAr="ابدأ محادثة"
      descriptionEn="Ask anything about your documents, finances, health, or daily life. Your conversation is end-to-end encrypted."
      descriptionAr="اسأل أي شيء عن مستنداتك أو مالياتك أو صحتك أو حياتك اليومية. محادثتك مشفرة من طرف إلى طرف."
      actionLabelEn="New Chat"
      actionLabelAr="محادثة جديدة"
      onAction={onNewChat}
      language={language}
    />
  )
}

export function EmptySearchResults({ 
  query, 
  language = "en" 
}: { 
  query: string
  language?: "en" | "ar" | "bilingual"
}) {
  return (
    <NexusEmptyState
      variant="search"
      icon={Search}
      titleEn={`No results for "${query}"`}
      titleAr={`لا توجد نتائج لـ "${query}"`}
      descriptionEn="Try adjusting your search terms or filters to find what you're looking for."
      descriptionAr="جرب تعديل مصطلحات البحث أو الفلاتر للعثور على ما تبحث عنه."
      language={language}
    />
  )
}

export function EmptyNotifications({ 
  language = "en" 
}: { 
  language?: "en" | "ar" | "bilingual"
}) {
  return (
    <NexusEmptyState
      variant="default"
      icon={Shield}
      titleEn="All caught up"
      titleAr="لا توجد إشعارات جديدة"
      descriptionEn="You have no new notifications. Your vault is secure and operating normally."
      descriptionAr="ليس لديك إشعارات جديدة. خزنتك آمنة وتعمل بشكل طبيعي."
      language={language}
    />
  )
}
