"use client"

import { motion } from "motion/react"
import { cn } from "@/lib/utils"

interface NexusLoaderProps {
  size?: "sm" | "md" | "lg"
  label?: string
  className?: string
}

export function NexusLoader({ size = "md", label, className }: NexusLoaderProps) {
  const sizes = {
    sm: { container: "w-8 h-8", ring: 12, stroke: 2 },
    md: { container: "w-16 h-16", ring: 24, stroke: 3 },
    lg: { container: "w-24 h-24", ring: 36, stroke: 4 },
  }

  const { container, ring, stroke } = sizes[size]
  const circumference = 2 * Math.PI * ring

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)} role="status" aria-label={label || "Loading"}>
      <div className={cn("relative", container)} aria-hidden="true">
        {/* Outer ring - slow rotation */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
          {/* Background track */}
          <circle
            cx="40"
            cy="40"
            r={ring}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-secondary opacity-30"
          />
          {/* Animated progress arc */}
          <motion.circle
            cx="40"
            cy="40"
            r={ring}
            fill="none"
            stroke="url(#loaderGradient)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{
              strokeDashoffset: [circumference, circumference * 0.25, circumference],
              rotate: [0, 360],
            }}
            transition={{
              strokeDashoffset: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              },
              rotate: {
                duration: 3,
                repeat: Infinity,
                ease: "linear",
              },
            }}
          />
          <defs>
            <linearGradient id="loaderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--nexus-gold)" />
              <stop offset="50%" stopColor="var(--nexus-gold)" />
              <stop offset="100%" stopColor="var(--nexus-gold)" />
            </linearGradient>
          </defs>
        </svg>

        {/* Inner particles */}
        <div className="absolute inset-0 flex items-center justify-center">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-nexus-gold"
              initial={{ opacity: 0.4, scale: 0.5 }}
              animate={{
                opacity: [0.4, 1, 0.4],
                scale: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.3,
              }}
              style={{
                left: `${50 + 30 * Math.cos((i * 2 * Math.PI) / 3)}%`,
                top: `${50 + 30 * Math.sin((i * 2 * Math.PI) / 3)}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}
        </div>
      </div>

      {label && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-muted-foreground"
        >
          {label}
        </motion.p>
      )}
    </div>
  )
}

// Full page loader with vault animation
export function NexusPageLoader({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6"
      >
        <NexusLoader size="lg" />
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <p className="text-lg font-medium text-foreground">{message}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Securing your connection...
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}

// Inline shimmer skeleton for cards
export function NexusCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(
      "rounded-xl border bg-card p-6 space-y-4",
      "shadow-[0_0_0_1px_rgba(var(--nexus-gold-glow),0.05)]",
      "dark:shadow-[0_0_16px_rgba(176,142,106,0.04)]",
      className
    )}>
      <div className="flex items-start justify-between">
        {/* Icon placeholder with subtle gold glow */}
        <div className={cn(
          "relative overflow-hidden h-10 w-10 rounded-lg bg-secondary/60 dark:bg-secondary/40",
          "after:absolute after:inset-0",
          "after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent",
          "after:dark:via-white/[0.06]",
          "after:bg-[length:200%_100%]",
          "after:[animation:shimmer_1.8s_ease-in-out_infinite]",
          "after:translate-x-[-100%]",
          "ring-1 ring-nexus-gold/10 dark:ring-nexus-gold/10"
        )} />
        {/* Badge placeholder */}
        <div className={cn(
          "relative overflow-hidden h-6 w-16 rounded-full bg-secondary/60 dark:bg-secondary/40",
          "after:absolute after:inset-0",
          "after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent",
          "after:dark:via-white/[0.06]",
          "after:bg-[length:200%_100%]",
          "after:[animation:shimmer_1.8s_ease-in-out_infinite_0.2s]",
          "after:translate-x-[-100%]",
        )} />
      </div>
      {/* Text lines — varied widths for realism */}
      <div className="space-y-2.5">
        {[
          { delay: "0s",    width: "w-3/4" },
          { delay: "0.1s",  width: "w-[55%]" },
          { delay: "0.2s",  width: "w-2/5" },
        ].map(({ delay, width }, i) => (
          <div
            key={i}
            className={cn(
              "relative overflow-hidden h-3.5 rounded-sm bg-secondary/60 dark:bg-secondary/40",
              width,
              "after:absolute after:inset-0",
              "after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent",
              "after:dark:via-white/[0.06]",
              "after:bg-[length:200%_100%]",
              `after:[animation:shimmer_1.8s_ease-in-out_infinite_${delay}]`,
              "after:translate-x-[-100%]",
            )}
          />
        ))}
      </div>
      {/* Tag pills */}
      <div className="flex gap-2">
        {[
          { delay: "0s",   width: "w-20" },
          { delay: "0.15s", width: "w-14" },
          { delay: "0.3s",  width: "w-16" },
        ].map(({ delay, width }, i) => (
          <div
            key={i}
            className={cn(
              "relative overflow-hidden h-5 rounded-full bg-secondary/60 dark:bg-secondary/40",
              width,
              "after:absolute after:inset-0",
              "after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent",
              "after:dark:via-white/[0.06]",
              "after:bg-[length:200%_100%]",
              `after:[animation:shimmer_1.8s_ease-in-out_infinite_${delay}]`,
              "after:translate-x-[-100%]",
            )}
          />
        ))}
      </div>
    </div>
  )
}

// Chat skeleton
export function NexusChatSkeleton() {
  return (
    <div className="space-y-5 p-4">
      {/* User message skeleton */}
      <div className="flex justify-end">
        <div className="max-w-[80%] space-y-2">
          <div className={cn(
            "relative overflow-hidden h-3.5 w-36 rounded-sm bg-secondary/60 dark:bg-secondary/40 ms-auto",
            "after:absolute after:inset-0",
            "after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent",
            "after:dark:via-white/[0.06]",
            "after:bg-[length:200%_100%]",
            "after:[animation:shimmer_1.8s_ease-in-out_infinite]",
            "after:translate-x-[-100%]",
          )} />
          <div className={cn(
            "relative overflow-hidden h-12 w-56 rounded-2xl",
            "bg-nexus-gold/8 dark:bg-nexus-gold/10",
            "ring-1 ring-nexus-gold/15 dark:ring-nexus-gold/20",
            "after:absolute after:inset-0",
            "after:bg-gradient-to-r after:from-transparent after:via-nexus-gold/10 after:to-transparent",
            "after:bg-[length:200%_100%]",
            "after:[animation:shimmer_2s_ease-in-out_infinite_0.1s]",
            "after:translate-x-[-100%]",
          )} />
        </div>
      </div>

      {/* AI message skeleton */}
      <div className="flex justify-start gap-3">
        {/* Avatar glow dot */}
        <div className={cn(
          "relative overflow-hidden flex-shrink-0 h-8 w-8 rounded-full",
          "bg-nexus-gold/15 dark:bg-nexus-gold/20",
          "ring-1 ring-nexus-gold/25",
          "shadow-[0_0_10px_rgba(176,142,106,0.12)]",
          "after:absolute after:inset-0",
          "after:bg-gradient-to-r after:from-transparent after:via-nexus-gold/20 after:to-transparent",
          "after:bg-[length:200%_100%]",
          "after:[animation:shimmer_2s_ease-in-out_infinite]",
          "after:translate-x-[-100%]",
        )} />
        <div className="max-w-[80%] space-y-2.5">
          <div className={cn(
            "relative overflow-hidden h-3.5 w-20 rounded-sm bg-secondary/60 dark:bg-secondary/40",
            "after:absolute after:inset-0",
            "after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent",
            "after:dark:via-white/[0.06]",
            "after:bg-[length:200%_100%]",
            "after:[animation:shimmer_1.8s_ease-in-out_infinite_0.1s]",
            "after:translate-x-[-100%]",
          )} />
          {[
            { delay: "0s",   width: "w-72" },
            { delay: "0.1s", width: "w-64" },
            { delay: "0.2s", width: "w-48" },
          ].map(({ delay, width }, i) => (
            <div
              key={i}
              className={cn(
                "relative overflow-hidden h-3.5 rounded-sm bg-secondary/60 dark:bg-secondary/40",
                width,
                "after:absolute after:inset-0",
                "after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent",
                "after:dark:via-white/[0.06]",
                "after:bg-[length:200%_100%]",
                `after:[animation:shimmer_1.8s_ease-in-out_infinite_${delay}]`,
                "after:translate-x-[-100%]",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Document grid skeleton
export function NexusDocumentGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[...Array(count)].map((_, i) => (
        <NexusCardSkeleton key={i} />
      ))}
    </div>
  )
}
