import React from "react"

import { cn } from "@/lib/utils"
import {
  BottomSheet,
  BottomSheetContent,
} from "@/components/ui/bottom-sheet"

interface MobileSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  title?: React.ReactNode
  subtitle?: React.ReactNode
  className?: string
}

const MobileSheet: React.FC<MobileSheetProps> = ({
  open,
  onOpenChange,
  children,
  title,
  subtitle,
  className,
}) => {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent
        title={title}
        subtitle={subtitle}
        className={cn("gap-0", className)}
      >
        {children}
      </BottomSheetContent>
    </BottomSheet>
  )
}

export default MobileSheet
