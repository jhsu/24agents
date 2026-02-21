import * as React from "react"

import { cn } from "@/lib/utils"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onOpenChange(false)
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div data-slot="dialog">
      <div
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      {children}
    </div>
  )
}

function DialogContent({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-content"
      className={cn(
        "fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] bg-card text-card-foreground shadow-lg ring-1 ring-foreground/10 rounded-none p-0 flex flex-col gap-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1 px-4 py-3 border-b border-border", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-title"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-xs/relaxed", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex items-center justify-end gap-2 border-t border-border px-4 py-3", className)}
      {...props}
    />
  )
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("px-4 py-4 flex flex-col gap-4", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
}
