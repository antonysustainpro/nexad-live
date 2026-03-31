"use client"

/**
 * AuditLogViewer — Admin component for searching, filtering, and exporting
 * the NexusAD audit trail.
 *
 * Features:
 *   - Filter by category, severity, user ID, date range, free-text search
 *   - Real-time polling for new events (configurable interval)
 *   - Export to JSON or CSV
 *   - Expandable row detail view
 *   - Correlation ID click-through (filter to same flow)
 *   - Color-coded severity badges
 *
 * Data source: GET /api/proxy/api/v1/audit/logs (backend-side stored logs)
 * Admin-only: this component should only be rendered inside a role-guard.
 */

import { useState, useEffect, useCallback, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { AuditEvent, AuditEventCategory, AuditEventSeverity } from "@/lib/audit-logger"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AuditLogFilters {
  category: AuditEventCategory | "ALL"
  severity: AuditEventSeverity | "ALL"
  userId: string
  correlationId: string
  search: string
  fromDate: string
  toDate: string
}

interface AuditLogPage {
  events: AuditEvent[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

const DEFAULT_FILTERS: AuditLogFilters = {
  category: "ALL",
  severity: "ALL",
  userId: "",
  correlationId: "",
  search: "",
  fromDate: "",
  toDate: "",
}

const PAGE_SIZE = 50
const POLL_INTERVAL_MS = 15000

// ─────────────────────────────────────────────────────────────────────────────
// Severity badge styling
// ─────────────────────────────────────────────────────────────────────────────

function severityBadge(severity: AuditEventSeverity) {
  const map: Record<AuditEventSeverity, { label: string; variant: "success" | "warning" | "danger" | "default" }> = {
    info:     { label: "INFO",     variant: "success" },
    warn:     { label: "WARN",     variant: "warning" },
    error:    { label: "ERROR",    variant: "danger" },
    critical: { label: "CRITICAL", variant: "danger" },
  }
  const { label, variant } = map[severity] ?? { label: severity.toUpperCase(), variant: "default" }
  return <Badge variant={variant}>{label}</Badge>
}

function categoryBadge(category: AuditEventCategory) {
  const colors: Record<AuditEventCategory, string> = {
    USER_ACTION: "bg-blue-900/40 text-blue-300",
    API_CALL:    "bg-purple-900/40 text-purple-300",
    SESSION:     "bg-teal-900/40 text-teal-300",
    SECURITY:    "bg-red-900/40 text-red-300",
    AUTH:        "bg-orange-900/40 text-orange-300",
    VAULT:       "bg-yellow-900/40 text-yellow-300",
    PII:         "bg-pink-900/40 text-pink-300",
    SYSTEM:      "bg-gray-700/60 text-gray-300",
  }
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium", colors[category] ?? colors.SYSTEM)}>
      {category}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Data fetching
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAuditLogs(
  filters: AuditLogFilters,
  page: number
): Promise<AuditLogPage> {
  const params = new URLSearchParams()
  params.set("page", String(page))
  params.set("page_size", String(PAGE_SIZE))
  if (filters.category !== "ALL") params.set("category", filters.category)
  if (filters.severity !== "ALL") params.set("severity", filters.severity)
  if (filters.userId) params.set("user_id", filters.userId)
  if (filters.correlationId) params.set("correlation_id", filters.correlationId)
  if (filters.search) params.set("search", filters.search)
  if (filters.fromDate) params.set("from", filters.fromDate)
  if (filters.toDate) params.set("to", filters.toDate)

  const res = await fetch(`/api/proxy/api/v1/audit/logs?${params.toString()}`, {
    credentials: "include",
  })

  if (!res.ok) {
    throw new Error(`Audit log fetch failed: ${res.status}`)
  }

  return res.json() as Promise<AuditLogPage>
}

// ─────────────────────────────────────────────────────────────────────────────
// Export helpers
// ─────────────────────────────────────────────────────────────────────────────

function exportToJson(events: AuditEvent[]): void {
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `nexusad-audit-${new Date().toISOString().split("T")[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function exportToCsv(events: AuditEvent[]): void {
  const headers = ["timestamp", "eventId", "category", "severity", "action", "userId", "sessionId", "correlationId", "requestId", "source"]
  const rows = events.map((e) => [
    e.timestamp,
    e.eventId,
    e.category,
    e.severity,
    e.action,
    e.userId ?? "",
    e.sessionId,
    e.correlationId,
    e.requestId ?? "",
    e.source ?? "",
  ])
  const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `nexusad-audit-${new Date().toISOString().split("T")[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function AuditLogViewer() {
  const [filters, setFilters] = useState<AuditLogFilters>(DEFAULT_FILTERS)
  const [pendingFilters, setPendingFilters] = useState<AuditLogFilters>(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AuditLogPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [liveMode, setLiveMode] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(
    async (f: AuditLogFilters, p: number, silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        const result = await fetchAuditLogs(f, p)
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load audit logs")
      } finally {
        if (!silent) setLoading(false)
      }
    },
    []
  )

  // Load on filter/page change
  useEffect(() => {
    load(filters, page)
  }, [filters, page, load])

  // Live polling
  useEffect(() => {
    if (liveMode) {
      pollRef.current = setInterval(() => {
        load(filters, 1, true)
      }, POLL_INTERVAL_MS)
    } else {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [liveMode, filters, load])

  const applyFilters = () => {
    setFilters(pendingFilters)
    setPage(1)
  }

  const resetFilters = () => {
    setPendingFilters(DEFAULT_FILTERS)
    setFilters(DEFAULT_FILTERS)
    setPage(1)
  }

  const filterByCorrelation = (correlationId: string) => {
    const f = { ...DEFAULT_FILTERS, correlationId }
    setPendingFilters(f)
    setFilters(f)
    setPage(1)
  }

  const events = data?.events ?? []
  const total = data?.total ?? 0

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Audit Log</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total.toLocaleString()} events — complete compliance trail
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={liveMode ? "destructive" : "outline"}
            size="sm"
            onClick={() => setLiveMode((v) => !v)}
          >
            {liveMode ? "Stop Live" : "Live Mode"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={events.length === 0}
            onClick={() => exportToJson(events)}
          >
            Export JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={events.length === 0}
            onClick={() => exportToCsv(events)}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {/* Category */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Category</label>
            <Select
              value={pendingFilters.category}
              onValueChange={(v) => setPendingFilters((f) => ({ ...f, category: v as AuditEventCategory | "ALL" }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {(["USER_ACTION","API_CALL","SESSION","SECURITY","AUTH","VAULT","PII","SYSTEM"] as AuditEventCategory[]).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severity */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Severity</label>
            <Select
              value={pendingFilters.severity}
              onValueChange={(v) => setPendingFilters((f) => ({ ...f, severity: v as AuditEventSeverity | "ALL" }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Free text search */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Search action / metadata</label>
            <Input
              placeholder="e.g. vault.document.viewed"
              value={pendingFilters.search}
              onChange={(e) => setPendingFilters((f) => ({ ...f, search: e.target.value }))}
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>

          {/* User ID */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">User ID</label>
            <Input
              placeholder="user-id"
              value={pendingFilters.userId}
              onChange={(e) => setPendingFilters((f) => ({ ...f, userId: e.target.value }))}
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>

          {/* Correlation ID */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Correlation ID</label>
            <Input
              placeholder="correlation-id"
              value={pendingFilters.correlationId}
              onChange={(e) => setPendingFilters((f) => ({ ...f, correlationId: e.target.value }))}
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>

          {/* From date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">From</label>
            <Input
              type="datetime-local"
              value={pendingFilters.fromDate}
              onChange={(e) => setPendingFilters((f) => ({ ...f, fromDate: e.target.value }))}
              className="h-8 text-xs"
            />
          </div>

          {/* To date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">To</label>
            <Input
              type="datetime-local"
              value={pendingFilters.toDate}
              onChange={(e) => setPendingFilters((f) => ({ ...f, toDate: e.target.value }))}
              className="h-8 text-xs"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onClick={applyFilters} disabled={loading}>
            Apply Filters
          </Button>
          <Button size="sm" variant="ghost" onClick={resetFilters}>
            Reset
          </Button>
          {loading && (
            <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-xs w-44">Timestamp</TableHead>
              <TableHead className="text-xs w-24">Category</TableHead>
              <TableHead className="text-xs w-20">Severity</TableHead>
              <TableHead className="text-xs">Action</TableHead>
              <TableHead className="text-xs w-36">User ID</TableHead>
              <TableHead className="text-xs w-36">Correlation ID</TableHead>
              <TableHead className="text-xs w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">
                  No events found matching the current filters.
                </TableCell>
              </TableRow>
            )}
            {events.map((event) => (
              <>
                <TableRow
                  key={event.eventId}
                  className={cn(
                    "border-border cursor-pointer hover:bg-muted/30 transition-colors",
                    expandedRow === event.eventId && "bg-muted/20"
                  )}
                  onClick={() => setExpandedRow(expandedRow === event.eventId ? null : event.eventId)}
                >
                  <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleString("en-GB", {
                      year: "numeric", month: "2-digit", day: "2-digit",
                      hour: "2-digit", minute: "2-digit", second: "2-digit",
                      hour12: false,
                    })}
                  </TableCell>
                  <TableCell>{categoryBadge(event.category)}</TableCell>
                  <TableCell>{severityBadge(event.severity)}</TableCell>
                  <TableCell className="text-xs font-mono">{event.action}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-[144px]">
                    {event.userId ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    <button
                      className="text-nexus-jade hover:underline truncate max-w-[144px] block"
                      onClick={(e) => {
                        e.stopPropagation()
                        filterByCorrelation(event.correlationId)
                      }}
                      title="Filter by this correlation ID"
                    >
                      {event.correlationId.slice(0, 8)}…
                    </button>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {expandedRow === event.eventId ? "▲" : "▼"}
                  </TableCell>
                </TableRow>

                {/* Expanded detail row */}
                {expandedRow === event.eventId && (
                  <TableRow key={`${event.eventId}-detail`} className="border-border bg-muted/10">
                    <TableCell colSpan={7} className="py-3 px-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                        <Detail label="Event ID" value={event.eventId} mono />
                        <Detail label="Session ID" value={event.sessionId} mono />
                        <Detail label="Correlation ID" value={event.correlationId} mono />
                        {event.requestId && <Detail label="Request ID" value={event.requestId} mono />}
                        {event.source && <Detail label="Source" value={event.source} mono />}
                        {event.userAgent && (
                          <Detail label="User Agent" value={event.userAgent.slice(0, 80)} mono />
                        )}
                        {event.geoRegion && <Detail label="Region" value={event.geoRegion} />}
                        {event.metadata && Object.keys(event.metadata).length > 0 && (
                          <div className="col-span-full">
                            <span className="text-muted-foreground font-medium">Metadata</span>
                            <pre className="mt-1 rounded bg-background/60 p-2 text-[11px] font-mono overflow-x-auto text-foreground/80 border border-border">
                              {JSON.stringify(event.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {Math.ceil(total / PAGE_SIZE)} ({total.toLocaleString()} total)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data?.hasMore || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helper
// ─────────────────────────────────────────────────────────────────────────────

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className={cn("text-foreground/90 break-all", mono && "font-mono")}>{value}</span>
    </div>
  )
}
