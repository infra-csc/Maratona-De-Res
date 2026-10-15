import { AlertCircle, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    // label: o leitor de tela anuncia "Notificação", não "Notification".
    <ToastProvider label="Notificação">
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const danger = props.variant === "destructive"
        const Icon = danger ? AlertCircle : CheckCircle2
        return (
          <Toast key={id} {...props}>
            <Icon
              size={18}
              aria-hidden="true"
              className={danger ? "mt-px shrink-0 text-[var(--status-danger)]" : "mt-px shrink-0 text-[var(--accent-text)]"}
            />
            <div className="grid min-w-0 flex-1 gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport label="Notificações ({hotkey})" />
    </ToastProvider>
  )
}
