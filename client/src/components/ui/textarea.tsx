import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-input bg-background/50 px-4 py-3 font-ui text-base placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-foreground/40 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
