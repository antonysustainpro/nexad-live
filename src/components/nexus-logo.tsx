"use client"

import { cn } from "@/lib/utils"

interface NexusLogoProps {
  size?: "sm" | "md" | "lg" | "xl"
  showShimmer?: boolean
  className?: string
}

const sizeClasses = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-6xl",
}

export function NexusLogo({ size = "md", showShimmer = true, className }: NexusLogoProps) {
  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <span
        className={cn(
          "font-bold tracking-tight text-foreground",
          sizeClasses[size]
        )}
        role="img"
        aria-label="NexusAD Ai"
      >
        <span className="text-foreground">NexusAD</span>
        <span className="text-foreground"> Ai</span>
      </span>
      {showShimmer && (
        <div
          className="absolute inset-0 pointer-events-none animate-shimmer rounded-lg"
          aria-hidden="true"
        />
      )}
    </div>
  )
}

export function NexusLogoIcon({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="NexusAD Ai"
    >
      {/* Hexagon background */}
      <path
        d="M16 2L28 9V23L16 30L4 23V9L16 2Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        className="text-card"
      />
      {/* N letter stylized */}
      <path
        d="M10 22V10L16 16L22 10V22"
        stroke="url(#nexus-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Central node */}
      <circle cx="16" cy="16" r="2" fill="url(#nexus-gradient)" />
      {/* Connection lines */}
      <line x1="10" y1="10" x2="16" y2="16" stroke="url(#nexus-gradient)" strokeWidth="1" opacity="0.5" />
      <line x1="22" y1="10" x2="16" y2="16" stroke="url(#nexus-gradient)" strokeWidth="1" opacity="0.5" />
      <defs>
        <linearGradient id="nexus-gradient" x1="10" y1="10" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--nexus-jade)" />
          <stop offset="1" stopColor="var(--nexus-gold)" />
        </linearGradient>
      </defs>
    </svg>
  )
}
