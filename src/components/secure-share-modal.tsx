"use client"

// Hidden until backend implementation complete
// This entire modal is disabled because there is no backend endpoint to service it:
//   - No POST /api/v1/vault/share  (create a share link)
//   - No GET  /share/:id           (serve the shared report to the recipient)
// The previous implementation simulated a 1.5-second delay and generated a fake
// /share/:id URL that 404s immediately. Users would copy the link, send it, and
// the recipient would get a broken page — destroying trust.
//
// TODO: Re-enable SecureShareModal when the above backend routes are implemented.
// All UI logic is preserved below (inside the disabled section) so it can be
// restored without re-writing it from scratch.

export function SecureShareModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
  onShare?: (data: unknown) => void
  reportTitle?: string
  sections?: unknown[]
}) {
  // Hidden until backend implementation complete
  // Immediately close if somehow opened, so no broken state is shown
  if (isOpen) {
    onClose()
  }
  return null
}

// Hidden until backend implementation complete
// Trigger button hidden: clicking it would open a modal that generates a fake share link.
export function SecureShareTrigger({ onClick: _onClick }: { onClick: () => void }) {
  return null
}
