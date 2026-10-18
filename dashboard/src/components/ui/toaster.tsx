import * as React from "react"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { AlertCircle, AlertTriangle, CheckCircle, Info } from "@/lib/icon-map"
import { cn } from "@/lib/utils"

type ToastVariant = "default" | "destructive" | "success" | "warning" | "info"

const VARIANT_ICON = {
  default: Info,
  destructive: AlertTriangle,
  success: CheckCircle,
  warning: AlertCircle,
  info: Info,
} as const

/**
 * Measures the rendered toast height so the exit animation can collapse the
 * element back to zero — the remaining toasts glide up instead of snapping.
 */
function useToastHeight() {
  return React.useCallback((node: HTMLLIElement | null) => {
    if (!node) return
    const apply = () =>
      node.style.setProperty("--sq-toast-h", `${node.offsetHeight}px`)
    apply()
    requestAnimationFrame(apply)
  }, [])
}

export function Toaster() {
  const { toasts } = useToast()
  const [isMobile, setIsMobile] = React.useState(false)
  const measureHeight = useToastHeight()

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const mediaQuery = window.matchMedia("(max-width: 640px)")
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)

    setIsMobile(mediaQuery.matches)

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const { className, duration, variant, ...toastProps } = props
        const resolvedVariant: ToastVariant =
          (variant as ToastVariant) ?? "default"
        const resolvedDuration = duration ?? (isMobile ? 3600 : 5600)
        const resolvedClassName = cn(
          "touch-pan-y",
          isMobile ? "w-full max-w-[min(92vw,380px)]" : "w-full max-w-[380px]",
          className
        )

        const Icon = VARIANT_ICON[resolvedVariant] ?? Info

        return (
          <Toast
            key={id}
            {...toastProps}
            ref={measureHeight}
            variant={resolvedVariant}
            duration={resolvedDuration}
            className={resolvedClassName}
            style={
              {
                "--sq-toast-duration": `${resolvedDuration}ms`,
              } as React.CSSProperties
            }
          >
            <span className="sq-toast-chip" aria-hidden="true">
              <Icon />
            </span>
            <div className="sq-toast-body">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
            <span className="sq-toast-progress" aria-hidden="true" />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
