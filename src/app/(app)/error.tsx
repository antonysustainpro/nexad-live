"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { useNexus } from "@/contexts/nexus-context"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { language } = useNexus()
  
  useEffect(() => {
    // Error is displayed in the UI
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
      </div>
      <h2 className="text-2xl font-semibold mb-2">
        {language === "ar" ? "حدث خطأ ما" : "Something went wrong"}
      </h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        {language === "ar" 
          ? "بياناتك تبقى مشفرة وآمنة."
          : "Your data remains encrypted and secure."}
      </p>
      <button
        onClick={reset}
        className="bg-nexus-jade text-background px-6 py-2 rounded-lg font-medium hover:bg-nexus-jade-hover transition-colors"
      >
        {language === "ar" ? "إعادة المحاولة" : "Try Again"}
      </button>
    </div>
  )
}
