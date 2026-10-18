import * as React from "react"
import { Drawer } from "vaul"

import { cn } from "@/lib/utils"

function BottomSheet({
  open,
  onOpenChange,
  children,
  dismissible = true,
  shouldScaleBackground = false,
  ...props
}: React.ComponentProps<typeof Drawer.Root>) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      dismissible={dismissible}
      shouldScaleBackground={shouldScaleBackground}
      {...props}
    >
      {children}
    </Drawer.Root>
  )
}

const SHEET_CONTENT_CLASS =
  "fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[28px] border-t border-border/60 bg-[hsl(var(--card)/0.94)] text-[hsl(var(--card-foreground))] shadow-2xl outline-none backdrop-blur-2xl max-h-[94vh] pb-[env(safe-area-inset-bottom)]"

interface BottomSheetContentProps
  extends React.ComponentProps<typeof Drawer.Content> {
  hideHandle?: boolean
  hideClose?: boolean
  title?: React.ReactNode
  subtitle?: React.ReactNode
}

function BottomSheetContent({
  className,
  children,
  hideHandle = false,
  hideClose,
  title,
  subtitle,
  ...props
}: BottomSheetContentProps) {
  const hasHeader = Boolean(title) || Boolean(subtitle)

  return (
    <Drawer.Portal>
      <Drawer.Overlay className="vaul-sheet-overlay fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
      <Drawer.Content
        className={cn("vaul-sheet-content", SHEET_CONTENT_CLASS, className)}
        {...props}
      >
        <Drawer.Title className="sr-only">
          {typeof title === "string" ? title : "Sheet"}
        </Drawer.Title>
        <Drawer.Description className="sr-only">
          {typeof subtitle === "string" ? subtitle : ""}
        </Drawer.Description>

        {!hideHandle && (
          <div
            data-vaul-no-drag
            className="flex shrink-0 justify-center px-5 pt-3 pb-1.5"
          >
            <div className="h-1.5 w-10 rounded-full bg-border/70" />
          </div>
        )}

        {hasHeader && (
          <div
            data-vaul-no-drag
            className="shrink-0 px-5 pb-3 pt-1"
          >
            {title && (
              <h3 className="text-[17px] font-semibold leading-tight tracking-tight text-[hsl(var(--foreground))]">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        )}

        {hasHeader && (
          <div data-vaul-no-drag className="h-px shrink-0 bg-border/60" />
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </Drawer.Content>
    </Drawer.Portal>
  )
}

function BottomSheetBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn(className)} {...props} />
}

function BottomSheetHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-vaul-no-drag
      className={cn(
        "shrink-0 px-5 pb-3 pt-1",
        className
      )}
      {...props}
    />
  )
}

function BottomSheetFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-vaul-no-drag
      className={cn(
        "shrink-0 border-t border-border/60 bg-[hsl(var(--card)/0.6)] px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]",
        className
      )}
      {...props}
    />
  )
}

function BottomSheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof Drawer.Title>) {
  return (
    <Drawer.Title
      className={cn(
        "text-[17px] font-semibold leading-tight tracking-tight text-[hsl(var(--foreground))]",
        className
      )}
      {...props}
    />
  )
}

function BottomSheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof Drawer.Description>) {
  return (
    <Drawer.Description
      className={cn("text-[13px] text-muted-foreground", className)}
      {...props}
    />
  )
}

function BottomSheetHandle({ className }: { className?: string }) {
  return (
    <div
      data-vaul-no-drag
      className="flex shrink-0 justify-center px-5 pt-3 pb-1.5"
    >
      <div
        className={cn("h-1.5 w-10 rounded-full bg-border/70", className)}
      />
    </div>
  )
}

function BottomSheetClose({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Drawer.Close>) {
  return (
    <Drawer.Close className={className} {...props}>
      {children}
    </Drawer.Close>
  )
}

export {
  BottomSheet,
  BottomSheetContent,
  BottomSheetBody,
  BottomSheetHeader,
  BottomSheetFooter,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetHandle,
  BottomSheetClose,
}
