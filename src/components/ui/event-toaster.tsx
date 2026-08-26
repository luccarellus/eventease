import React from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="w-4 h-4 text-emerald-400 shrink-0" />
        ),
        info: (
          <InfoIcon className="w-4 h-4 text-blue-400 shrink-0" />
        ),
        warning: (
          <TriangleAlertIcon className="w-4 h-4 text-amber-400 shrink-0" />
        ),
        error: (
          <OctagonXIcon className="w-4 h-4 text-red-400 shrink-0" />
        ),
        loading: (
          <LoadingSpinner size="xs" />
        ),
      }}
      toastOptions={{
        classNames: {
          toast: "!rounded-full !px-4 !py-2 !w-auto !max-w-[90vw] !bg-[#0a111e]/95 !backdrop-blur-xl !border !border-white/15 !text-white !shadow-2xl !text-xs !font-semibold !flex !items-center !gap-2",
          title: "!text-xs !font-semibold !text-white",
          description: "!text-[11px] !text-white/60",
          icon: "!mr-0 !shrink-0",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
