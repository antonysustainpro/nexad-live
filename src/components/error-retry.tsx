"use client"

import { RefreshCw, AlertTriangle, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useNexus } from "@/contexts/nexus-context"

interface ErrorRetryProps {
  /** Called when the user presses the retry button */
  onRetry: () => void
  /** Human-readable message shown to the user. Falls back to a default. */
  message?: string
  /** Optional secondary/detail line */
  detail?: string
  /** Visual variant: "card" (bordered box) | "inline" (compact, no border) | "page" (full-height centred) */
  variant?: "card" | "inline" | "page"
  /** Whether the retry is currently in progress (shows a spinner, disables the button) */
  isRetrying?: boolean
  /** Extra class names on the root element */
  className?: string
  /** Show a wifi-off icon instead of the default alert triangle (good for network errors) */
  networkError?: boolean
}

/**
 * ErrorRetry — universal error state with a retry button.
 *
 * Use this everywhere the app can fail and leave users abandoned:
 *   - API call failures (chat, vault, butler, briefing, sovereignty…)
 *   - Streaming errors in chat
 *   - File upload failures
 *   - Page-level data-fetch failures
 *
 * It is fully bilingual (EN / AR) and honours the app's language context.
 */
export function ErrorRetry({
  onRetry,
  message,
  detail,
  variant = "card",
  isRetrying = false,
  className,
  networkError = false,
}: ErrorRetryProps) {
  const { language } = useNexus()

  const defaultMessage =
    language === "ar"
      ? "تعذّر الاتصال. يرجى المحاولة مجدداً."
      : "We couldn't connect. Please try again."

  const retryLabel =
    language === "ar" ? "إعادة المحاولة" : "Try Again"

  const Icon = networkError ? WifiOff : AlertTriangle

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 text-sm text-muted-foreground",
          className
        )}
        role="alert"
      >
        <Icon className="h-4 w-4 text-destructive flex-shrink-0" aria-hidden="true" />
        <span className="flex-1">{message ?? defaultMessage}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          disabled={isRetrying}
          className="shrink-0 h-7 gap-1.5 text-xs"
          aria-label={retryLabel}
        >
          <RefreshCw
            className={cn("h-3 w-3", isRetrying && "animate-spin")}
            aria-hidden="true"
          />
          {retryLabel}
        </Button>
      </div>
    )
  }

  if (variant === "page") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center min-h-[50vh] p-8 text-center",
          className
        )}
        role="alert"
      >
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <Icon className="h-8 w-8 text-destructive" aria-hidden="true" />
        </div>
        <p className="text-lg font-semibold mb-1">{message ?? defaultMessage}</p>
        {detail && (
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">{detail}</p>
        )}
        {!detail && <div className="mb-6" />}
        <Button
          onClick={onRetry}
          disabled={isRetrying}
          className="bg-nexus-jade hover:bg-nexus-jade-hover text-background gap-2"
        >
          <RefreshCw
            className={cn("h-4 w-4", isRetrying && "animate-spin")}
            aria-hidden="true"
          />
          {retryLabel}
        </Button>
      </div>
    )
  }

  // default: "card"
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 p-6 rounded-xl",
        "border border-destructive/20 bg-destructive/5 text-center",
        className
      )}
      role="alert"
    >
      <div className="flex items-center gap-2 text-destructive">
        <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
        <p className="font-medium text-sm">{message ?? defaultMessage}</p>
      </div>
      {detail && (
        <p className="text-xs text-muted-foreground max-w-xs">{detail}</p>
      )}
      <Button
        size="sm"
        onClick={onRetry}
        disabled={isRetrying}
        className="bg-nexus-jade hover:bg-nexus-jade-hover text-background gap-2"
        aria-label={retryLabel}
      >
        <RefreshCw
          className={cn("h-3.5 w-3.5", isRetrying && "animate-spin")}
          aria-hidden="true"
        />
        {retryLabel}
      </Button>
    </div>
  )
}
