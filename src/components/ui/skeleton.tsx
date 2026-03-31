"use client"

import { cn } from "@/lib/utils"

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full space-y-2">
      {/* Header */}
      <div className="flex gap-4 border-b pb-2">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-2">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-20 w-full" />
    </div>
  )
}

function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// MessageBubbleSkeleton — mimics a chat message bubble
// isUser=true → right-aligned jade bubble, false → left-aligned card bubble
function MessageBubbleSkeleton({ isUser = false, wide = false }: { isUser?: boolean; wide?: boolean }) {
  return (
    <div
      className={cn(
        "flex w-full mb-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "relative rounded-2xl p-4 space-y-2",
          isUser
            ? "bg-nexus-jade/10 border border-nexus-jade/20 rounded-br-sm"
            : "bg-card border border-border rounded-bl-sm",
          wide ? "w-[65%]" : "w-[45%]"
        )}
      >
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        {wide && <Skeleton className="h-4 w-3/4" />}
        <Skeleton className="h-3 w-1/3 mt-1" />
      </div>
    </div>
  )
}

// Chat page full skeleton — header toolbar + a few message bubbles
function ChatSkeleton() {
  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mock top toolbar strip */}
        <div className="flex items-center gap-2 p-4 border-b border-border/40">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        {/* Bubbles */}
        <div className="flex-1 p-4 space-y-1">
          <MessageBubbleSkeleton isUser={false} wide />
          <MessageBubbleSkeleton isUser />
          <MessageBubbleSkeleton isUser={false} wide />
          <MessageBubbleSkeleton isUser />
          <MessageBubbleSkeleton isUser={false} />
        </div>
        {/* Mock input bar */}
        <div className="p-4 border-t border-border/40">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

// TeamMemberRowSkeleton — one `<tr>` row that matches TeamMemberRow column layout
function TeamMemberRowSkeleton() {
  return (
    <tr className="border-b border-border/50">
      {/* Avatar + Name */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
          <Skeleton className="h-4 w-28" />
        </div>
      </td>
      {/* Email */}
      <td className="py-3 px-4">
        <Skeleton className="h-4 w-40" />
      </td>
      {/* Role */}
      <td className="py-3 px-4">
        <Skeleton className="h-4 w-16" />
      </td>
      {/* Last Active */}
      <td className="py-3 px-4">
        <Skeleton className="h-4 w-16" />
      </td>
      {/* Usage */}
      <td className="py-3 px-4">
        <Skeleton className="h-3 w-24" />
      </td>
      {/* Actions */}
      <td className="py-3 px-4">
        <Skeleton className="h-8 w-8 rounded-md" />
      </td>
    </tr>
  )
}

// TeamPageSkeleton — full skeleton for the team loading state
function TeamPageSkeleton() {
  return (
    <div className="container max-w-5xl mx-auto px-4 pb-24 md:pb-8">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Members table card */}
      <div className="rounded-lg border bg-card">
        {/* Card header */}
        <div className="p-6 pb-4 border-b border-border">
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Member", "Email", "Role", "Last Active", "Usage", ""].map((_, i) => (
                    <th key={i} className="py-3 px-4">
                      <Skeleton className="h-4 w-16" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TeamMemberRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// NotificationItemSkeleton — one notification card row
function NotificationItemSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border bg-card border-border">
      {/* Category icon box */}
      <Skeleton className="flex-shrink-0 w-9 h-9 rounded-lg" />
      {/* Content */}
      <div className="flex-1 space-y-2 min-w-0">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-24 mt-1" />
      </div>
      {/* Dismiss button placeholder */}
      <Skeleton className="flex-shrink-0 w-8 h-8 rounded-md" />
    </div>
  )
}

// NotificationsPageSkeleton — header + filter tabs + list of notification skeletons
function NotificationsPageSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="container max-w-3xl mx-auto px-4 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className={cn("h-8 rounded-md", i === 0 ? "w-12" : "w-16")} />
        ))}
      </div>

      {/* Group label */}
      <Skeleton className="h-4 w-12 mb-3" />

      {/* Notification items */}
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <NotificationItemSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

// ButlerCardSkeleton — one butler card matching the existing card layout
function ButlerCardSkeleton() {
  return (
    <div className="bg-card/50 border border-border rounded-2xl p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded" />
        <Skeleton className="h-4 w-10 rounded ms-auto" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
    </div>
  )
}

// AccessLogSkeleton — rows for the vault access log table
function AccessLogSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {["Timestamp", "Actor", "Action", "Resource"].map((_, i) => (
              <th key={i} className="text-start pb-3 px-2">
                <Skeleton className="h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              <td className="py-4 px-2"><Skeleton className="h-4 w-24" /></td>
              <td className="py-4 px-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-6 h-6 rounded-full flex-shrink-0" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </td>
              <td className="py-4 px-2"><Skeleton className="h-5 w-16 rounded-full" /></td>
              <td className="py-4 px-2"><Skeleton className="h-4 w-32" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export {
  Skeleton,
  TableSkeleton,
  CardSkeleton,
  ListSkeleton,
  MessageBubbleSkeleton,
  ChatSkeleton,
  TeamMemberRowSkeleton,
  TeamPageSkeleton,
  NotificationItemSkeleton,
  NotificationsPageSkeleton,
  ButlerCardSkeleton,
  AccessLogSkeleton,
}
