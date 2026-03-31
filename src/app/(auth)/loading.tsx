/**
 * REL-002: Loading state for Auth Route Group
 *
 * Shows a minimal loading spinner while auth pages (login, register, etc.)
 * are being loaded. Uses minimal dependencies to avoid cascading failures.
 */
export default function AuthLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-nexus-jade/30 border-t-nexus-jade rounded-full motion-safe:animate-spin" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}
