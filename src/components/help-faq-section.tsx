"use client"

import { useNexus } from "@/contexts/nexus-context"
import { cn } from "@/lib/utils"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface FAQItem {
  questionEn: string
  questionAr: string
  answerEn: string
  answerAr: string
}

interface HelpFAQSectionProps {
  title: string
  titleAr: string
  items: FAQItem[]
}

export function HelpFAQSection({ title, titleAr, items }: HelpFAQSectionProps) {
  const { language, isRTL } = useNexus()

  return (
    <div className="space-y-3">
      <h3 className={cn("text-lg font-semibold text-foreground", isRTL && "text-right")}>
        {language === "ar" ? titleAr : title}
      </h3>
      <Accordion type="single" collapsible className="space-y-2">
        {items.map((item, index) => (
          <AccordionItem
            key={index}
            value={`item-${index}`}
            className="border border-border rounded-lg px-4 data-[state=open]:bg-muted/50 last:border-b"
          >
            <AccordionTrigger className={cn("text-sm font-medium hover:no-underline", isRTL && "text-right flex-row-reverse")}>
              {language === "ar" ? item.questionAr : item.questionEn}
            </AccordionTrigger>
            <AccordionContent className={cn("text-sm text-muted-foreground", isRTL && "text-right")}>
              {language === "ar" ? item.answerAr : item.answerEn}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
