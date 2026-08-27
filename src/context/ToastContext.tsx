import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void
  success: (msg: string) => void
  error: (msg: string) => void
  info: (msg: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++counter
    setToasts((t) => [...t, { id, kind, message }])
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 4000)
  }, [])

  const value: ToastContextValue = {
    toast,
    success: (m) => toast(m, 'success'),
    error: (m) => toast(m, 'error'),
    info: (m) => toast(m, 'info'),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-xl backdrop-blur-sm animate-[slideIn_0.25s_ease-out] ${
              t.kind === 'error'
                ? 'border-rose-200 bg-white text-rose-900'
                : t.kind === 'success'
                  ? 'border-emerald-200 bg-white text-emerald-900'
                  : t.kind === 'warning'
                    ? 'border-amber-200 bg-white text-amber-900'
                    : 'border-brand-200 bg-white text-brand-900'
            }`}
          >
            <span className="mt-0.5 shrink-0">
              {t.kind === 'error' ? (
                <AlertCircle className="h-4 w-4 text-rose-600" />
              ) : t.kind === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <Info className="h-4 w-4 text-brand-500" />
              )}
            </span>
            <p className="flex-1 text-sm leading-relaxed">{t.message}</p>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="shrink-0 rounded-full p-1 text-brand-300 transition-colors hover:bg-brand-50 hover:text-brand-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <style>{`@keyframes slideIn { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export async function extractFunctionsError(err: unknown): Promise<string | null> {
  if (!err || typeof err !== 'object') return null
  const e = err as { message?: string; context?: unknown }
  // Supabase FunctionsHttpError: context is a Response
  try {
    const ctx = e.context as Response | undefined
    if (ctx && typeof (ctx as Response).json === 'function') {
      const clone = (ctx as Response).clone ? (ctx as Response).clone() : (ctx as Response)
      const body = (await clone.json()) as { error?: string; message?: string }
      if (body?.error) return body.error
      if (body?.message) return body.message
    }
    if (ctx && typeof ctx === 'object' && 'error' in (ctx as unknown as Record<string, unknown>)) {
      const maybe = (ctx as unknown as Record<string, unknown>).error
      if (typeof maybe === 'string' && maybe) return maybe
    }
  } catch {
    // ignore json parse
  }
  if (e.message && e.message !== 'Edge Function returned a non-2xx status code') return e.message
  return null
}
