import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Bell, CheckCheck, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Card, PageHeader, Spinner, EmptyState, Button } from '../components/ui'
import { timeAgo, formatDateTime, isSameLocalDay } from '../lib/utils'
import type { Notification } from '../lib/types'

const TYPE_STYLE: Record<string, string> = {
  info: 'bg-sky-50 text-sky-700',
  success: 'bg-emerald-50 text-emerald-700',
  error: 'bg-rose-50 text-rose-700',
  alert: 'bg-amber-50 text-amber-700',
}

function groupLabel(ts: string) {
  const now = new Date()
  if (isSameLocalDay(new Date(ts), now)) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameLocalDay(new Date(ts), yesterday)) return 'Yesterday'
  return 'Earlier'
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
    const load = () => {
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
    }
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
    return order.filter((label) => map[label]).map((label) => ({ label, items: map[label] }))
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

  if (loading) return <Spinner />

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread message${unread === 1 ? '' : 's'}` : 'You are all caught up'}
        action={
          unread > 0 ? (
            <Button variant="secondary" onClick={() => void markAll()} loading={markingAll} className="!py-2 !text-xs">
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex gap-1.5 rounded-full border border-brand-100 p-1">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-full py-2 text-xs uppercase tracking-[0.2em] transition ${
              filter === f ? 'bg-black text-white' : 'text-brand-500 hover:text-brand-900'
            }`}
          >
            {f === 'all' ? 'All' : `Unread${filter === 'unread' && unread > 0 ? ` (${unread})` : ''}`}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            title={filter === 'unread' ? 'No unread messages' : 'No notifications yet'}
            message={filter === 'unread' ? 'Everything is read. Nice and tidy.' : 'Updates about your clearance and orders will appear here.'}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label}>
              <p className="lux-label mb-2 px-1 text-brand-400">{group.label}</p>
              <div className="space-y-2">
                {group.items.map((n) => {
                  const open = openId === n.id
                  return (
                    <Card key={n.id} className="!p-0 overflow-hidden">
                      <button
                        onClick={() => toggle(n.id)}
                        className={`flex w-full items-start gap-3 px-4 py-4 text-left transition-colors ${open ? 'bg-brand-50' : 'hover:bg-brand-50/60'}`}
                      >
                        <span
                          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.read ? 'bg-brand-200' : 'bg-gold-500'}`}
                          title={n.read ? 'Read' : 'Unread'}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-brand-900">{n.title}</span>
                            {!n.read && (
                              <span className="rounded-full bg-gold-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.0625rem] text-gold-700">
                                New
                              </span>
                            )}
                          </span>
                          <span className={`mt-0.5 block text-sm leading-relaxed ${open ? 'text-brand-700' : 'text-brand-500'}`}>
                            {n.message}
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-brand-400">
                            <span className="uppercase tracking-[0.0625rem]">{timeAgo(n.created_at)}</span>
                            {n.type && (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.0625rem] ${TYPE_STYLE[n.type] ?? 'bg-brand-50 text-brand-500'}`}>
                                {n.type}
                              </span>
                            )}
                          </span>
                        </span>
                        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-brand-300 transition-transform ${open ? 'rotate-180' : ''}`} />
                      </button>
                      {open && (
                        <div className="border-t border-brand-100 bg-white px-4 py-4">
                          <div className="flex items-center gap-2 text-brand-400">
                            <Bell className="h-3.5 w-3.5" />
                            <p className="text-[11px] uppercase tracking-[0.0625rem]">Details</p>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-brand-700">{n.message}</p>
                          <p className="mt-3 text-xs text-brand-400">Received {formatDateTime(n.created_at)}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-brand-100 pt-3">
                            {n.link && (
                              <button
                                onClick={() => navigate(n.link!)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-1.5 text-[0.625rem] uppercase tracking-[0.2em] text-white transition-colors hover:bg-brand-700"
                              >
                                <ArrowUpRight className="h-3.5 w-3.5" /> Open
                              </button>
                            )}
                            <button
                              onClick={() => mark(n.id, !n.read)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 px-4 py-1.5 text-[0.625rem] uppercase tracking-[0.2em] text-brand-700 transition-colors hover:border-black hover:bg-black hover:text-white"
                            >
                              {n.read ? 'Mark as unread' : 'Mark as read'}
                            </button>
                          </div>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}