"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SheetContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SheetContext = React.createContext<SheetContextValue | null>(null)

interface SheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function Sheet({ open = false, onOpenChange, children }: SheetProps) {
  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      onOpenChange?.(newOpen)
    },
    [onOpenChange]
  )

  return (
    <SheetContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </SheetContext.Provider>
  )
}

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "bottom" | "left" | "right"
  children: React.ReactNode
}

export function SheetContent({
  side = "right",
  className,
  children,
  ...props
}: SheetContentProps) {
  const context = React.useContext(SheetContext)
  if (!context) throw new Error("SheetContent must be used within a Sheet")

  const { open, onOpenChange } = context

  React.useEffect(() => {
    if (!open) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", onKey)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onOpenChange])

  if (!open) return null

  const sideClasses = {
    top: "inset-x-0 top-0 border-b",
    bottom: "inset-x-0 bottom-0 border-t",
    left: "inset-y-0 start-0 border-e w-full sm:w-[400px]",
    right: "inset-y-0 end-0 border-s w-full sm:w-[400px]",
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Content */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed bg-background shadow-xl flex flex-col overflow-auto",
          sideClasses[side],
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  )
}

interface SheetHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SheetHeader({ className, ...props }: SheetHeaderProps) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 p-4 border-b border-border", className)}
      {...props}
    />
  )
}

interface SheetTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export function SheetTitle({ className, ...props }: SheetTitleProps) {
  return (
    <h2
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  )
}

interface SheetDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export function SheetDescription({ className, ...props }: SheetDescriptionProps) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

interface SheetCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

export function SheetClose({ asChild, className, children, ...props }: SheetCloseProps) {
  const context = React.useContext(SheetContext)
  if (!context) throw new Error("SheetClose must be used within a Sheet")

  const handleClick = () => {
    context.onOpenChange(false)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
    })
  }

  return (
    <button
      type="button"
      className={cn(
        "absolute end-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {children || <X className="h-4 w-4" />}
      <span className="sr-only">Close</span>
    </button>
  )
}
