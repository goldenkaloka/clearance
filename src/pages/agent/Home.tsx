import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Shirt, PackageCheck, CheckCheck, Phone } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { ClearanceTask, GownOrder } from '../../lib/types'
import { Badge, Card, Button, EmptyState, Spinner } from '../../components/ui'
import { normalizeWhatsApp } from '../../lib/utils'
import { formatDateTime } from '../../lib/utils'
import { useGownStatus } from '../../hooks/useGownStatus'

interface AgentTask extends ClearanceTask {
  stage?: { id: string; name: string; order: number }
  request?: {
    request_number: string
    status: string
    priority: string
    student?: { full_name: string; phone: string | null }
  }
}

const FILTERS = ['all', 'in_progress', 'assigned', 'pending', 'action_required', 'completed'] as const

export default function AgentHome() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [gowns, setGowns] = useState<GownOrder[]>([])
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all')
  const [loading, setLoading] = useState(true)
  const { busyId: busyGownId, updateStatus } = useGownStatus(() => {
    // reload gowns after status change
    if (!profile) return
    supabase
      .from('gown_orders')
      .select('*, student:profiles!gown_orders_student_user_id_fkey(student_profiles(*), phone)')
      .eq('agent_id', profile.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => setGowns((data ?? []) as GownOrder[]))
  })

  useEffect(() => {
    if (!profile) return
    const load = () => {
      supabase
        .from('clearance_tasks')
        .select('*, stage:clearance_stages(id, name, "order"), request:clearance_requests(request_number, status, priority, student_user_id, student:profiles!clearance_requests_student_user_id_fkey(full_name))')
        .eq('agent_id', profile.id)
        .order('updated_at', { ascending: false })
        .then(({ data }) => setTasks((data ?? []) as AgentTask[]))

      supabase
        .from('gown_orders')
        .select('*, student:profiles!gown_orders_student_user_id_fkey(student_profiles(*), phone)')
        .eq('agent_id', profile.id)
        .order('updated_at', { ascending: false })
        .then(({ data }) => setGowns((data ?? []) as GownOrder[]))

      setLoading(false)
    }
    load()

    const sub = supabase
      .channel('agent-work')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clearance_tasks', filter: `agent_id=eq.${profile.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gown_orders', filter: `agent_id=eq.${profile.id}` }, () => load())
      .subscribe()
    return () => {
      sub.unsubscribe()
    }
  }, [profile])

  async function gownAction(order: GownOrder, status: GownOrder['status']) {
    await updateStatus(order.id, status as 'ready_for_pickup' | 'collected')
  }

  if (loading) return <Spinner />

  const counts = {
    all: tasks.length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    assigned: tasks.filter((t) => t.status === 'assigned').length,
    action_required: tasks.filter((t) => t.status === 'action_required').length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  }

  const visible = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter)
  const gownsToHandle = gowns.filter((g) => g.status === 'paid' || g.status === 'ready_for_pickup')
  const registration = (g: GownOrder) => g.student?.student_profiles?.[0]?.registration_number ?? g.student?.phone ?? g.student_user_id

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My tasks</h1>
          <p className="text-sm text-slate-500">
            {counts.in_progress} active · {counts.action_required} need student action · {gownsToHandle.length} gown{ gownsToHandle.length === 1 ? '' : 's' } to prepare
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-2xl border p-3 text-left transition ${
              filter === f ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <p className={`text-lg font-bold ${filter === f ? 'text-brand-700' : 'text-slate-800'}`}>{counts[f]}</p>
            <p className="text-[11px] capitalize text-slate-500">{f.replace(/_/g, ' ')}</p>
          </button>
        ))}
      </div>

      {visible.length === 0 && <EmptyState title="No tasks" message="Tasks assigned to you will appear here." />}

      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((t) => (
          <Link key={t.id} to={`/agent/tasks/${t.id}`}>
            <Card className="h-full transition hover:border-brand-300 hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{t.request?.student?.full_name ?? 'Student'}</p>
                  <p className="font-mono text-xs text-slate-400">{t.request?.request_number}</p>
                  {t.request?.student?.phone && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Phone className="h-3 w-3" /> {t.request.student.phone}
                    </p>
                  )}
                </div>
                <Badge status={t.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{t.stage?.name}</span>
                {t.request?.priority === 'high' && (
                  <span className="rounded-lg bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-600">High priority</span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                <span>Updated {formatDateTime(t.updated_at)}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {gowns.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shirt className="h-5 w-5 text-gold-500" />
            <h2 className="text-lg font-bold text-slate-900">Gown orders</h2>
            <Badge status={gownsToHandle.length > 0 ? 'paid' : 'collected'} />
          </div>
          {gowns.map((g) => (
            <Card key={g.id} className="flex flex-wrap items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-500">
                <Shirt className="h-5 w-5 text-gold-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold text-brand-900">{g.student?.full_name ?? 'Student'}</p>
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium capitalize text-brand-700">
                    Gown
                  </span>
                  <Badge status={g.status} />
                </div>
                <p className="mt-0.5 text-xs text-brand-500">
                  {registration(g)} · Size {g.size} · {g.ceremony_date} · {g.pickup_location}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {g.student?.phone && (
                  <>
                    <a
                      href={`tel:${g.student.phone}`}
                      title="Call student"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-black hover:bg-black hover:text-white"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                    <a
                      href={`https://wa.me/${normalizeWhatsApp(g.student.phone)}`}
                      target="_blank"
                      rel="noreferrer"
                      title="WhatsApp student"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-black hover:bg-black hover:text-white"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.83 14.03c-.24.68-1.4 1.3-1.93 1.35-.52.05-1.01.24-3.4-.71-2.87-1.13-4.7-4.06-4.84-4.25-.14-.19-1.16-1.55-1.16-2.95 0-1.4.73-2.09 1-2.38.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.41-.07.64.49.24.56.8 1.96.87 2.1.07.15.12.32.02.51-.09.19-.14.31-.28.48-.14.17-.3.38-.43.51-.14.14-.29.3-.12.58.16.29.73 1.2 1.57 1.95 1.08.96 1.99 1.26 2.27 1.4.28.14.44.12.61-.07.16-.19.7-.82.89-1.1.19-.29.38-.24.64-.14.26.09 1.65.78 1.93.92.28.14.47.21.54.33.07.12.07.68-.17 1.36Z"/></svg>
                    </a>
                  </>
                )}
                {g.status === 'paid' && (
                  <Button onClick={() => void gownAction(g, 'ready_for_pickup')} loading={busyGownId === g.id}>
                    <PackageCheck className="h-4 w-4" /> Mark ready
                  </Button>
                )}
                {g.status === 'ready_for_pickup' && (
                  <Button onClick={() => void gownAction(g, 'collected')} loading={busyGownId === g.id} variant="success">
                    <CheckCheck className="h-4 w-4" /> Mark collected
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}