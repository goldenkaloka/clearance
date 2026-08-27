import { useEffect, useMemo, useState } from 'react'
import { Bell, CheckCheck, CheckCircle2, AlertTriangle, Info, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { timeAgo, formatDateTime, isSameLocalDay } from '../lib/utils'
import type { Notification } from '../lib/types'

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: AlertTriangle,
  alert: AlertTriangle,
  info: Info,
}

function groupLabel(ts: string) {
  const now = new Date()
  if (isSameLocalDay(new Date(ts), now)) return 'Today'
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  if (isSameLocalDay(new Date(ts), y)) return 'Yesterday'
  return 'Earlier'
}

function Skeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 border-b border-brand-100 px-5 py-5 last:border-0">
          <div className="h-9 w-9 animate-pulse rounded-full bg-brand-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 animate-pulse rounded bg-brand-100" />
            <div className="h-3 w-full animate-pulse rounded bg-brand-50" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function NotificationsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    if (!profile) return
    const load = () =>
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(200)
        .then(({ data }) => {
          setItems((data ?? []) as Notification[])
          setLoading(false)
        })
    load()
    const sub = supabase
      .channel('notifications-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => load())
      .subscribe()
    return () => {
      sub.unsubscribe()
    }
  }, [profile])

  const unread = items.filter((n) => !n.read).length
  const visible = useMemo(() => (filter === 'unread' ? items.filter((n) => !n.read) : items), [filter, items])

  const groups = useMemo(() => {
    const order = ['Today', 'Yesterday', 'Earlier']
    const map: Record<string, Notification[]> = {}
    for (const n of visible) {
      const label = groupLabel(n.created_at)
      ;(map[label] ??= []).push(n)
    }
    return order.filter((l) => map[l]).map((l) => ({ label: l, items: map[l] }))
  }, [visible])

  function toggle(id: string) {
    const n = items.find((x) => x.id === id)
    setOpenId((cur) => (cur === id ? null : id))
    if (n && !n.read) {
      supabase.from('notifications').update({ read: true }).eq('id', id).then(() => {
        setItems((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x)))
      })
    }
  }

  function mark(id: string, read: boolean) {
    supabase.from('notifications').update({ read }).eq('id', id).then(() => {
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, read } : x)))
    })
  }

  async function markAll() {
    setMarkingAll(true)
    await supabase.from('notifications').update({ read: true }).eq('user_id', profile!.id).eq('read', false)
    setItems((prev) => prev.map((x) => ({ ...x, read: true })))
    setMarkingAll(false)
  }

  if (loading) {
    return (
      <div className="page-in mx-auto max-w-3xl">
        <div className="mb-6">
          <div className="h-7 w-48 animate-pulse rounded bg-brand-100" />
          <div className="mt-2 h-4 w-32 animate-pulse rounded bg-brand-50" />
        </div>
        <Skeleton />
      </div>
    )
  }

  return (
    <div className="page-in mx-auto max-w-3xl">
      {/* header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white">
                <Bell className="h-4 w-4" />
              </span>
              <h1 className="text-2xl font-normal tracking-[0.02em] text-brand-900">Notifications</h1>
              {unread > 0 && (
                <span className="rounded-full bg-gold-500 px-2.5 py-0.5 text-xs font-semibold text-white">{unread}</span>
              )}
            </div>
            <p className="mt-2 text-sm text-brand-500">
              {unread > 0 ? `${unread} unread · ${items.length} total` : items.length === 0 ? 'No messages yet' : 'All caught up'}
            </p>
          </div>
          {unread > 0 && (
            <button
              onClick={() => void markAll()}
              disabled={markingAll}
              className="hidden items-center gap-1.5 rounded-full border border-brand-200 px-4 py-2 text-[0.625rem] uppercase tracking-[0.2em] text-brand-700 transition-colors hover:border-black hover:bg-black hover:text-white disabled:opacity-40 sm:inline-flex"
            >
              <CheckCheck className="h-3.5 w-3.5" /> {markingAll ? 'Updating…' : 'Mark all read'}
            </button>
          )}
        </div>

        {/* segmented filter — editorial underline style */}
        <div className="mt-8 flex gap-6 border-b border-brand-100">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`relative pb-3 text-xs uppercase tracking-[0.2em] transition-colors ${
                filter === f ? 'text-brand-900' : 'text-brand-400 hover:text-brand-600'
              }`}
            >
              {f === 'all' ? 'All' : `Unread${unread > 0 ? ` · ${unread}` : ''}`}
              {filter === f && <span className="absolute inset-x-0 -bottom-px h-px bg-black" />}
            </button>
          ))}
          {unread > 0 && (
            <button
              onClick={() => void markAll()}
              className="ml-auto pb-3 text-xs uppercase tracking-[0.2em] text-brand-400 hover:text-brand-900 sm:hidden"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-200 bg-white px-8 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
            <Bell className="h-5 w-5 text-brand-300" />
          </div>
          <h3 className="mt-4 text-sm font-medium tracking-[0.02em] text-brand-900">
            {filter === 'unread' ? 'No unread messages' : 'No notifications yet'}
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-brand-500">
            {filter === 'unread'
              ? 'Everything is read. New updates about your clearance and orders will appear here.'
              : 'Updates about your clearance and gown orders will appear here once there is activity.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="bg-brand-50/60 px-5 py-2.5 text-[0.625rem] uppercase tracking-[0.12em] text-brand-400">
                {group.label}
              </div>
              <div className="divide-y divide-brand-100">
                {group.items.map((n) => {
                  const open = openId === n.id
                  const Icon = TYPE_ICON[n.type] ?? Bell
                  return (
                    <div key={n.id} className={`group/item relative ${!n.read ? 'bg-gold-50/20' : 'bg-white'}`}>
                      {!n.read && <span className="absolute inset-y-0 left-0 w-0.5 bg-gold-500" />}
                      <button
                        onClick={() => toggle(n.id)}
                        className="flex w-full items-start gap-3 px-5 py-4 text-left sm:gap-4 sm:py-5"
                      >
                        <span
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                            n.read ? 'border-brand-100 bg-white text-brand-300' : 'border-gold-200 bg-gold-50 text-gold-600'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-3">
                            <span className={`pr-2 text-sm leading-snug ${n.read ? 'font-normal text-brand-800' : 'font-medium text-brand-900'}`}>
                              {n.title}
                            </span>
                            <span className="hidden shrink-0 text-xs text-brand-400 sm:block">{timeAgo(n.created_at)}</span>
                          </span>
                          <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-brand-500">{n.message}</span>
                          <span className="mt-2 flex items-center gap-2 sm:hidden">
                            <span className="text-xs text-brand-400">{timeAgo(n.created_at)}</span>
                            {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />}
                          </span>
                        </span>
                        <span className="hidden shrink-0 items-center gap-2 sm:flex">
                          {!n.read && <span className="h-2 w-2 rounded-full bg-gold-500" title="Unread" />}
                          <ChevronRight
                            className={`h-4 w-4 text-brand-300 transition-transform ${open ? 'rotate-90' : 'group-hover/item:text-brand-400'}`}
                          />
                        </span>
                      </button>

                      {open && (
                        <div className="border-t border-brand-100 bg-brand-50/30 px-5 py-4 sm:px-[4.75rem]">
                          <p className="text-sm leading-relaxed text-brand-700">{n.message}</p>
                          <p className="mt-2 text-xs text-brand-400">Received {formatDateTime(n.created_at)}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {n.link && (
                              <button
                                onClick={() => navigate(n.link!)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-[0.625rem] uppercase tracking-[0.2em] text-white transition-colors hover:bg-brand-800"
                              >
                                Open <ChevronRight className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              onClick={() => mark(n.id, !n.read)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-5 py-2 text-[0.625rem] uppercase tracking-[0.2em] text-brand-700 transition-colors hover:border-black hover:bg-black hover:text-white"
                            >
                              {n.read ? 'Mark as unread' : 'Mark as read'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {visible.length > 0 && (
        <p className="mt-6 text-center text-xs text-brand-400">
          {filter === 'unread' ? `${visible.length} unread notification${visible.length === 1 ? '' : 's'}` : `${items.length} notification${items.length === 1 ? '' : 's'} total`}
        </p>
      )}
    </div>
  )
}
