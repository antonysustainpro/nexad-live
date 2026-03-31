"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Languages, ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNexus } from "@/contexts/nexus-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Language = "ar" | "en" | "bilingual"

const languageConfig: Record<Language, {
  label: string
  labelAr: string
  description: string
  descriptionAr: string
  flag: string
}> = {
  en: {
    label: "English",
    labelAr: "الإنجليزية",
    description: "Interface in English",
    descriptionAr: "الواجهة بالإنجليزية",
    flag: "EN",
  },
  ar: {
    label: "Arabic",
    labelAr: "العربية",
    description: "Interface in Arabic (RTL)",
    descriptionAr: "الواجهة بالعربية",
    flag: "ع",
  },
  bilingual: {
    label: "Bilingual",
    labelAr: "ثنائي اللغة",
    description: "English + Arabic mixed",
    descriptionAr: "إنجليزي + عربي",
    flag: "EN/ع",
  },
}

interface LanguageSelectorProps {
  disabled?: boolean
}

export function LanguageSelector({ disabled }: LanguageSelectorProps) {
  const { language, setLanguage, isRTL } = useNexus()
  const [open, setOpen] = useState(false)

  const currentLang = languageConfig[language]

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label={language === "ar" ? "اختيار اللغة" : "Select language"}
          className={cn(
            "gap-2 border-border/50 bg-card/80 backdrop-blur-sm text-foreground",
            isRTL && "flex-row-reverse"
          )}
        >
          <Languages className="h-4 w-4" />
          <span className="font-medium">
            {currentLang.flag}
          </span>
          <ChevronDown className={cn(
            "h-3 w-3 transition-transform",
            open && "rotate-180"
          )} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isRTL ? "end" : "start"}
        className="w-56 p-2"
      >
        <AnimatePresence>
          {(Object.keys(languageConfig) as Language[]).map((langKey, index) => {
            const config = languageConfig[langKey]
            const isSelected = language === langKey

            return (
              <motion.div
                key={langKey}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <DropdownMenuItem
                  onClick={() => {
                    setLanguage(langKey)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex flex-col items-start gap-1 p-3 cursor-pointer rounded-lg",
                    isSelected && "bg-secondary",
                    isRTL && "items-end text-right"
                  )}
                >
                  <div className={cn(
                    "flex items-center gap-2 w-full",
                    isRTL && "flex-row-reverse"
                  )}>
                    <span className="text-sm font-medium min-w-[2rem] text-center">
                      {config.flag}
                    </span>
                    <span className="font-medium">
                      {language === "ar" ? config.labelAr : config.label}
                    </span>
                    {isSelected && (
                      <Check className="ms-auto h-4 w-4 text-nexus-jade" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" ? config.descriptionAr : config.description}
                  </p>
                </DropdownMenuItem>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
