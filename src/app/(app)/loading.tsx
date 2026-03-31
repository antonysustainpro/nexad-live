export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-nexus-jade/30 border-t-nexus-jade rounded-full motion-safe:animate-spin" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Loading... / جاري التحميل...</p>
      </div>
    </div>
  )
}
