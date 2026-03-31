"use client"

import { motion } from "motion/react"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type EmptyStateVariant = "conversations" | "vault" | "team" | "notifications" | "search" | "billing"

interface EmptyStateAction {
  label: string
  labelAr: string
  onClick: () => void
}

interface EmptyStateProps {
  variant: EmptyStateVariant
  title?: string
  titleAr?: string
  description?: string
  descriptionAr?: string
  action?: EmptyStateAction
  className?: string
}

const defaultContent: Record<EmptyStateVariant, { title: string; titleAr: string; description: string; descriptionAr: string; actionLabel?: string; actionLabelAr?: string }> = {
  conversations: {
    title: "No conversations yet",
    titleAr: "لا توجد محادثات بعد",
    description: "Start chatting with NexusAD to begin your journey",
    descriptionAr: "ابدأ المحادثة مع NexusAD لبدء رحلتك",
    actionLabel: "New Chat",
    actionLabelAr: "محادثة جديدة",
  },
  vault: {
    title: "Your vault is empty",
    titleAr: "خزنتك فارغة",
    description: "Upload documents to securely store and analyze them",
    descriptionAr: "ارفع المستندات لتخزينها وتحليلها بشكل آمن",
    actionLabel: "Upload Document",
    actionLabelAr: "رفع مستند",
  },
  team: {
    title: "No team members yet",
    titleAr: "لا يوجد أعضاء فريق",
    description: "Invite your team to collaborate securely",
    descriptionAr: "ادعُ فريقك للتعاون بشكل آمن",
    actionLabel: "Invite Member",
    actionLabelAr: "دعوة عضو",
  },
  notifications: {
    title: "All caught up!",
    titleAr: "لا توجد إشعارات",
    description: "We'll notify you when something needs your attention",
    descriptionAr: "سنبلغك عندما يحتاج شيء ما اهتمامك",
  },
  search: {
    title: "No results found",
    titleAr: "لم يتم العثور على نتائج",
    description: "Try adjusting your search or filter criteria",
    descriptionAr: "جرب تعديل معايير البحث أو الفلاتر",
    actionLabel: "Clear filters",
    actionLabelAr: "مسح الفلاتر",
  },
  billing: {
    title: "No invoices yet",
    titleAr: "لا توجد فواتير",
    description: "Your billing history will appear here once you make a purchase",
    descriptionAr: "سيظهر سجل الفواتير هنا بمجرد إجراء عملية شراء",
  },
}

// SVG Illustrations for each variant
function ConversationsIllustration() {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" className="text-muted-foreground" aria-hidden="true">
      <motion.g
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Chat bubble 1 */}
        <rect x="30" y="40" width="60" height="40" rx="8" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="45" cy="60" r="4" fill="currentColor" opacity="0.3" />
        <circle cx="60" cy="60" r="4" fill="currentColor" opacity="0.3" />
        <circle cx="75" cy="60" r="4" fill="currentColor" opacity="0.3" />
        
        {/* Chat bubble 2 */}
        <rect x="70" y="90" width="60" height="35" rx="8" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.6" />
        <line x1="85" y1="102" x2="115" y2="102" stroke="currentColor" strokeWidth="2" opacity="0.3" />
        <line x1="85" y1="112" x2="105" y2="112" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      </motion.g>
      
      {/* Sparkle accent */}
      <motion.g
        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <circle cx="120" cy="50" r="3" className="fill-nexus-jade" />
        <circle cx="45" cy="100" r="2" className="fill-nexus-gold" />
      </motion.g>
    </svg>
  )
}

function VaultIllustration() {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" className="text-muted-foreground" aria-hidden="true">
      <motion.g
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Folder */}
        <path d="M30 50 L30 120 L130 120 L130 60 L75 60 L65 50 Z" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M30 50 L65 50 L75 60 L30 60 Z" stroke="currentColor" strokeWidth="2" fill="none" />
        
        {/* Document inside */}
        <rect x="55" y="75" width="50" height="35" rx="4" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" />
        <line x1="65" y1="85" x2="95" y2="85" stroke="currentColor" strokeWidth="2" opacity="0.3" />
        <line x1="65" y1="95" x2="85" y2="95" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      </motion.g>
      
      {/* Sparkles */}
      <motion.g
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <path d="M115 40 L117 44 L121 42 L117 46 L115 50 L113 46 L109 42 L113 44 Z" className="fill-nexus-gold" />
        <path d="M45 95 L46 98 L49 97 L46 99 L45 102 L44 99 L41 97 L44 98 Z" className="fill-nexus-jade" opacity="0.7" />
      </motion.g>
    </svg>
  )
}

function TeamIllustration() {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" className="text-muted-foreground" aria-hidden="true">
      <motion.g
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Center person */}
        <circle cx="80" cy="60" r="20" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M60 110 Q60 85 80 85 Q100 85 100 110" stroke="currentColor" strokeWidth="2" fill="none" />
        
        {/* Left person */}
        <circle cx="40" cy="70" r="14" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" />
        <path d="M26 108 Q26 90 40 90 Q54 90 54 108" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" />
        
        {/* Right person */}
        <circle cx="120" cy="70" r="14" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" />
        <path d="M106 108 Q106 90 120 90 Q134 90 134 108" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" />
      </motion.g>
      
      {/* Connection lines */}
      <motion.g
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <line x1="55" y1="65" x2="65" y2="65" stroke="currentColor" strokeWidth="1" strokeDasharray="4 2" />
        <line x1="95" y1="65" x2="105" y2="65" stroke="currentColor" strokeWidth="1" strokeDasharray="4 2" />
      </motion.g>
    </svg>
  )
}

function NotificationsIllustration() {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" className="text-muted-foreground" aria-hidden="true">
      <motion.g
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "80px 50px" }}
      >
        {/* Bell */}
        <path d="M80 40 L80 30" stroke="currentColor" strokeWidth="2" />
        <path d="M55 75 Q55 50 80 50 Q105 50 105 75 L110 90 L50 90 L55 75 Z" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M70 95 Q70 105 80 105 Q90 105 90 95" stroke="currentColor" strokeWidth="2" fill="none" />
      </motion.g>
      
      {/* ZZZ */}
      <motion.g
        animate={{ opacity: [0.3, 0.8, 0.3], x: [0, 5, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <text x="100" y="55" className="fill-muted-foreground" fontSize="14" fontWeight="bold">z</text>
        <text x="110" y="45" className="fill-muted-foreground" fontSize="12" fontWeight="bold">z</text>
        <text x="118" y="38" className="fill-muted-foreground" fontSize="10" fontWeight="bold">z</text>
      </motion.g>
      
      {/* Checkmark */}
      <motion.g
        animate={{ scale: [0.9, 1.1, 0.9] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <circle cx="80" cy="130" r="15" className="stroke-emotion-joyful" strokeWidth="2" fill="none" />
        <path d="M72 130 L78 136 L90 124" className="stroke-emotion-joyful" strokeWidth="2" fill="none" />
      </motion.g>
    </svg>
  )
}

function SearchIllustration() {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" className="text-muted-foreground" aria-hidden="true">
      <motion.g
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Magnifying glass */}
        <circle cx="70" cy="70" r="30" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="92" y1="92" x2="115" y2="115" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </motion.g>
      
      {/* Question mark */}
      <motion.g
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2.5, repeat: Infinity }}
      >
        <text x="60" y="80" className="fill-muted-foreground" fontSize="30" fontWeight="bold">?</text>
      </motion.g>
      
      {/* Scattered dots */}
      <motion.g
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <circle cx="130" cy="50" r="3" fill="currentColor" />
        <circle cx="40" cy="110" r="3" fill="currentColor" />
        <circle cx="120" cy="100" r="2" fill="currentColor" />
      </motion.g>
    </svg>
  )
}

function BillingIllustration() {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" className="text-muted-foreground" aria-hidden="true">
      <motion.g
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Credit card */}
        <rect x="35" y="55" width="90" height="55" rx="8" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="35" y1="75" x2="125" y2="75" stroke="currentColor" strokeWidth="2" />
        <rect x="45" y="90" width="30" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5" />
        <circle cx="100" cy="94" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5" />
        <circle cx="112" cy="94" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.3" />
      </motion.g>
      
      {/* Receipt lines */}
      <motion.g
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <line x1="50" y1="125" x2="110" y2="125" stroke="currentColor" strokeWidth="1" strokeDasharray="8 4" />
        <line x1="60" y1="135" x2="100" y2="135" stroke="currentColor" strokeWidth="1" strokeDasharray="6 4" opacity="0.5" />
      </motion.g>
    </svg>
  )
}

const illustrations: Record<EmptyStateVariant, React.FC> = {
  conversations: ConversationsIllustration,
  vault: VaultIllustration,
  team: TeamIllustration,
  notifications: NotificationsIllustration,
  search: SearchIllustration,
  billing: BillingIllustration,
}

export function EmptyState({
  variant,
  title,
  titleAr,
  description,
  descriptionAr,
  action,
  className,
}: EmptyStateProps) {
  const { language } = useNexus()
  const content = defaultContent[variant]
  const Illustration = illustrations[variant]

  const displayTitle = (language === "ar" ? (titleAr || content.titleAr) : (title || content.title))
  const displayDescription = (language === "ar" ? (descriptionAr || content.descriptionAr) : (description || content.description))
  const displayActionLabel = action 
    ? (language === "ar" ? action.labelAr : action.label)
    : (language === "ar" ? content.actionLabelAr : content.actionLabel)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "flex flex-col items-center justify-center text-center p-8",
        className
      )}
    >
      <div className="mb-4">
        <Illustration />
      </div>
      
      <h3 className="text-lg font-medium mb-2">
        {displayTitle}
      </h3>
      
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        {displayDescription}
      </p>
      
      {(action || content.actionLabel) && displayActionLabel && (
        <Button
          onClick={action?.onClick}
          className="bg-nexus-jade hover:bg-nexus-jade-hover text-background btn-press"
        >
          {displayActionLabel}
        </Button>
      )}
    </motion.div>
  )
}

// Named exports for specific variants
export function EmptyConversations(props: Omit<EmptyStateProps, "variant">) {
  return <EmptyState variant="conversations" {...props} />
}

export function EmptyVault(props: Omit<EmptyStateProps, "variant">) {
  return <EmptyState variant="vault" {...props} />
}

export function EmptyTeam(props: Omit<EmptyStateProps, "variant">) {
  return <EmptyState variant="team" {...props} />
}

export function EmptyNotifications(props: Omit<EmptyStateProps, "variant">) {
  return <EmptyState variant="notifications" {...props} />
}

export function EmptySearch(props: Omit<EmptyStateProps, "variant">) {
  return <EmptyState variant="search" {...props} />
}

export function EmptyBilling(props: Omit<EmptyStateProps, "variant">) {
  return <EmptyState variant="billing" {...props} />
}
