import type { Metadata } from "next"
import { AuditLogViewer } from "@/components/audit-log-viewer"

export const metadata: Metadata = {
  title: "Audit Log — NexusAD Admin",
  description: "Complete audit trail for compliance and security monitoring.",
}

/**
 * Admin Audit Log page.
 * Route: /admin/audit
 *
 * Security: This page should only be accessible to admin-role users.
 * The backend enforces this at the /api/v1/audit/logs endpoint level.
 * Add a role gate in middleware or a server-side auth check here if needed.
 */
export default function AuditLogPage() {
  return (
    <main id="main-content" className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-2xl" role="img" aria-label="audit">
          </span>
          <h1 className="text-2xl font-bold text-foreground">Audit Trail</h1>
        </div>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Complete, tamper-evident log of every user action, API call, security event, and
          document access across the NexusAD platform. All entries are PII-scrubbed and
          correlation-ID linked for end-to-end traceability.
        </p>
      </div>

      {/* Stats summary row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Retention" value="90 days" sub="UAE PDPL compliant" />
        <StatCard label="PII Policy" value="Scrubbed" sub="Before storage" />
        <StatCard label="Integrity" value="HMAC signed" sub="Tamper detection" />
        <StatCard label="Export" value="JSON / CSV" sub="For SIEM / legal" />
      </div>

      {/* Viewer */}
      <AuditLogViewer />
    </main>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
      <span className="text-lg font-semibold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  )
}
