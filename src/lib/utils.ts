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

export const REGALIA_CATEGORIES = ['gown', 'sash', 'suit', 'shoes'] as const

export function regaliaLabel(category: string): string {
  return {
    gown: 'Gown',
    sash: 'Sash',
    suit: 'Suit',
    shoes: 'Shoes',
  }[category] ?? category
}

export function regaliaCategoryLabel(category: string): string {
  return {
    gown: 'Graduation Gown',
    sash: 'Sashes',
    suit: 'Suits',
    shoes: 'Shoes',
  }[category] ?? category
}

export function dashboardFor(role: string | null | undefined): string {
  if (role === 'admin') return '/admin'
  if (role === 'agent') return '/agent'
  return '/student'
}

export function homeFor(role: string | null | undefined): string {
  return role === 'admin' || role === 'agent' ? dashboardFor(role) : '/'
}

export function normalizeTzPhone(phone: string): string {
  let p = phone.replace(/[\s-]/g, '')
  if (p.startsWith('+')) p = p.slice(1)
  const digits = p.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 10) return `255${digits.slice(1)}`
  if (digits.startsWith('0')) return `255${digits.slice(1)}`
  if (!digits.startsWith('255')) return `255${digits}`
  return digits
}

// keep old name as alias for existing callers
export const normalizeWhatsApp = normalizeTzPhone

export function isValidTzPhone(phone: string): boolean {
  return /^255\d{9}$/.test(normalizeTzPhone(phone))
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

export function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
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

interface DbErrorLike {
  code?: string
  message?: string
  details?: string
  hint?: string
  status?: number
}

/*
 * Translate raw Postgres / PostgREST errors into readable messages.
 *
 * Pass anything Supabase returns as `error` (PostgrestError, RPC error,
 * or plain Error) and get back a human sentence. Unknown errors fall
 * through to the original message so nothing is ever swallowed.
 */
export function friendlyDbError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = (err ?? {}) as DbErrorLike
  const code = String(e.code ?? '')
  const haystack = `${e.message ?? ''} ${e.details ?? ''} ${e.hint ?? ''}`.toLowerCase()

  if (code === '23505' || haystack.includes('duplicate key value')) {
    if (haystack.includes('registration_number') || haystack.includes('student_profiles_reg_idx')) {
      return 'This registration number is already used by another account. Sign in with the correct account or contact support to release it.'
    }
    if (haystack.includes('request_number')) {
      return 'This request number was just taken — please submit again.'
    }
    if (haystack.includes('clearance_tasks') || haystack.includes('request_id') && haystack.includes('stage_id')) {
      return 'This request was already submitted. Check your dashboard instead of resubmitting.'
    }
    if (haystack.includes('phone') && haystack.includes('profiles')) {
      return 'This phone number is already registered to another account.'
    }
    return 'This record already exists. It looks like it was submitted before — check your dashboard.'
  }

  if (code === '23503' || haystack.includes('violates foreign key')) {
    return 'A related record (school, programme or request) could not be found. Refresh and try again.'
  }

  if (code === '23502' || haystack.includes('violates not-null')) {
    return 'A required field is missing. Fill in every required field and try again.'
  }

  if (code === '42501' || haystack.includes('permission denied') || haystack.includes('row-level security')) {
    return "You don't have permission to do that. Sign in again and retry."
  }

  if (code === 'PGRST116' || haystack.includes('0 rows') || haystack.includes('no rows')) {
    return 'Record not found. It may have been removed — refresh the page.'
  }

  if (code === '22P02' || haystack.includes('invalid input syntax')) {
    return 'One of the values looks invalid. Check your entries and try again.'
  }

  if (typeof e.message === 'string' && e.message && !e.message.toLowerCase().includes('duplicate key value')) {
    return e.message
  }
  return fallback
}

/*
 * Translate raw ClickPesa / mobile-network payment errors into readable
 * messages. Matching is case-insensitive substring matching so provider
 * wording changes still map to something helpful.
 */
export function friendlyPaymentError(message: unknown, fallback = 'Payment could not be started. Try again in a moment.'): string {
  const raw = typeof message === 'string' ? message : ''
  const text = raw.toLowerCase()

  if (!text || text === 'edge function returned a non-2xx status code') return fallback

  if (text.includes('failed to send a request to the edge function') || text.includes('failed to fetch') || text.includes('networkerror') || text.includes('network request failed') || text.includes('load failed')) {
    return 'Could not reach our servers. Check your internet connection and try again.'
  }

  if (text.includes('insufficient') && (text.includes('fund') || text.includes('balance'))) {
    return 'Your mobile-money balance is too low — it must cover the fee plus network and government charges. Top up and try again.'
  }
  if (text.includes('unable to reach') || text.includes('could not reach') || text.includes('unreachable') || text.includes('provider did not respond') || text.includes('no response from') || text.includes('timeout') || text.includes('timed out') || text.includes('try again later') || text.includes('service unavailable') || text.includes('temporarily unavailable')) {
    return 'We could not reach your mobile-money provider. Check the number is correct and has signal, wait a moment, then tap pay again.'
  }
  if (text.includes('invalid') && text.includes('phone') || text.includes('unsupported phone')) {
    return 'That phone number looks invalid or unsupported. Use a valid Tanzanian mobile number, for example 0712 345 678.'
  }
  if (text.includes('wrong pin') || text.includes('incorrect pin') || text.includes('authentication failed')) {
    return 'The mobile-money PIN was incorrect. A new prompt can be sent — enter the correct PIN on your phone.'
  }
  if (text.includes('cancelled by user') || text.includes('canceled by user') || text.includes('user cancelled') || text.includes('user canceled') || text.includes('declined')) {
    return 'You cancelled the payment on your phone. Tap pay again when ready and approve the prompt.'
  }
  if (text.includes('already used') || text.includes('already sent') || text.includes('duplicate') || text.includes('in progress') || text.includes('processing')) {
    return 'A payment request is already on its way to your phone. Approve it there instead of sending another.'
  }
  if (text.includes('expired')) {
    return 'The payment prompt expired. Tap pay again to receive a fresh prompt.'
  }
  if (text.includes('hatuwezi kufikia mfumo wa malipo')) return raw

  return raw || fallback
}