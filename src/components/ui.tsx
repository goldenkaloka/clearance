import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { statusColor } from '../lib/utils'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-brand-100 bg-white p-5 ${className}`}>{children}</div>
}

export function Stat({
  label,
  value,
  icon: Icon,
  color = 'bg-brand-50 text-brand-600',
}: {
  label: string
  value: ReactNode
  icon?: React.ComponentType<{ className?: string }>
  color?: string
}) {
  return (
    <Card className="!p-4">
      {Icon && (
        <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="text-xl font-bold text-slate-900 sm:text-2xl">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </Card>
  )
}

export function ProgressBar({ value, color = 'bg-gold-500', track = 'bg-brand-100' }: { value: number; color?: string; track?: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full ${track}`}>
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-medium tracking-[0.025em] text-brand-800">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-brand-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Button({
  children,
  variant = 'primary',
  loading,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'accent'
  loading?: boolean
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-normal tracking-[0.025em] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed'
  const variants: Record<string, string> = {
    // LV primary: filled black pill that inverts to white on hover
    primary:
      'bg-black text-[#f8f8f8] border border-black hover:bg-white hover:text-[#1a1a1a] active:scale-[0.99]',
    accent: 'bg-gold-500 text-white border border-gold-500 hover:bg-gold-600 active:scale-[0.99]',
    secondary:
      'bg-white text-brand-800 border border-brand-800 hover:bg-brand-800 hover:text-white active:scale-[0.99]',
    ghost: 'text-brand-600 hover:text-brand-900',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    success: 'bg-black text-[#f8f8f8] border border-black hover:bg-white hover:text-[#1a1a1a]',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Input({
  label,
  hint,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-normal text-brand-800">{label}</span>}
      <input
        className={`h-12 w-full rounded border border-brand-200 bg-white px-4 text-sm tracking-[0.025em] outline-none transition focus:border-brand-900 focus:ring-1 focus:ring-brand-900 ${className}`}
        {...props}
      />
      {hint && <span className="mt-1 block text-xs text-brand-500">{hint}</span>}
    </label>
  )
}

export function Textarea({
  label,
  className = '',
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-normal text-brand-800">{label}</span>}
      <textarea
        className={`w-full rounded border border-brand-200 bg-white px-4 py-3 text-sm tracking-[0.025em] outline-none transition focus:border-brand-900 focus:ring-1 focus:ring-brand-900 ${className}`}
        {...props}
      />
    </label>
  )
}

export function Select({
  label,
  className = '',
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-normal text-brand-800">{label}</span>}
      <select
        className={`h-12 w-full appearance-none rounded border border-brand-200 bg-white px-4 text-sm tracking-[0.025em] outline-none transition focus:border-brand-900 focus:ring-1 focus:ring-brand-900 ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  )
}

export function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export function Spinner() {
  return (
    <div className="flex h-40 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-gold-600" />
    </div>
  )
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50 p-8 text-center">
      <p className="text-sm font-medium text-brand-800">{title}</p>
      {message && <p className="mt-1 text-sm text-brand-500">{message}</p>}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-medium tracking-[0.025em] text-brand-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-brand-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Alert({ kind, children }: { kind: 'info' | 'warning' | 'success' | 'error'; children: ReactNode }) {
  const styles: Record<string, string> = {
    info: 'bg-sky-50 text-sky-800 border-sky-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    error: 'bg-rose-50 text-rose-800 border-rose-200',
  }
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles[kind]}`}>{children}</div>
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}