import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type ToastType = 'info' | 'success' | 'warning' | 'error'

type Toast = {
  id: string
  message: string
  type: ToastType
}

type ToastContextValue = {
  toasts: Toast[]
  showToast: (message: string, type?: ToastType) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

const TOAST_DURATION = 4000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const toast: Toast = { id, message, type }

      setToasts((prev) => [...prev, toast])

      setTimeout(() => {
        dismissToast(id)
      }, TOAST_DURATION)
    },
    [dismissToast]
  )

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

const TOAST_EMOJI: Record<ToastType, string> = {
  info: 'ℹ️',
  success: '🎉',
  warning: '⚠️',
  error: '😅'
}

function ToastContainer({
  toasts,
  onDismiss
}: {
  toasts: Toast[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span className="toast-icon" aria-hidden="true">{TOAST_EMOJI[toast.type]}</span>
          <span className="toast-message">{toast.message}</span>
          <button
            type="button"
            className="toast-dismiss"
            onClick={() => onDismiss(toast.id)}
            aria-label="닫기"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}
