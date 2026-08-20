import type { RequestStatus, TaskStatus } from './types'

export const requestStatusLabel: Record<RequestStatus, string> = {
  payment_pending: 'Payment Pending',
  payment_confirmed: 'Payment Confirmed',
  request_submitted: 'Request Submitted',
  agent_assigned: 'Agent Assigned',
  in_progress: 'In Progress',
  action_required: 'Action Required',
  final_verification: 'Final Verification',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const taskStatusLabel: Record<TaskStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  action_required: 'Action Required',
  completed: 'Completed',
  failed: 'Failed',
}

export function formatTZS(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0)
  return `TZS ${n.toLocaleString('en-US')}`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${formatDate(iso)} — ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export const statusColor: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  assigned: 'bg-sky-100 text-sky-700',
  in_progress: 'bg-amber-100 text-amber-700',
  action_required: 'bg-red-100 text-red-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
  payment_pending: 'bg-slate-100 text-slate-600',
  payment_confirmed: 'bg-sky-100 text-sky-700',
  request_submitted: 'bg-sky-100 text-sky-700',
  agent_assigned: 'bg-indigo-100 text-indigo-700',
  final_verification: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-slate-200 text-slate-600',
  ordered: 'bg-slate-100 text-slate-600',
  paid: 'bg-emerald-100 text-emerald-700',
  ready_for_pickup: 'bg-gold-100 text-gold-700',
  collected: 'bg-slate-200 text-slate-600',
}

export const STEP_ORDER: Record<RequestStatus, number> = {
  payment_pending: 0,
  payment_confirmed: 1,
  request_submitted: 1,
  agent_assigned: 2,
  in_progress: 3,
  action_required: 3,
  final_verification: 4,
  completed: 5,
  cancelled: -1,
}

export const STEPS = ['Payment', 'Submitted', 'Agent Assigned', 'In Progress', 'Final Verification', 'Completed']