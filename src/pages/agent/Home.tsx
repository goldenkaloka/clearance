import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Shirt, PackageCheck, CheckCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { ClearanceTask, GownOrder } from '../../lib/types'
import { Badge, Card, Button, EmptyState, Spinner } from '../../components/ui'
import { formatDateTime, regaliaLabel } from '../../lib/utils'

interface AgentTask extends ClearanceTask {
  stage?: { id: string; name: string; order: number }
  request?: {
    request_number: string
    status: string
    priority: string
    student?: { full_name: string }
  }
}

const FILTERS = ['all', 'in_progress', 'assigned', 'pending', 'action_required', 'completed'] as const

export default function AgentHome() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [gowns, setGowns] = useState<GownOrder[]>([])
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all')
  const [loading, setLoading] = useState(true)
  const [busyGownId, setBusyGownId] = useState<string | null>(null)
  const [gownMsg, setGownMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    const load = () => {
      supabase
        .from('clearance_tasks')
        .select('*, stage:clearance_stages(id, name, "order"), request:clearance_requests(request_number, status, priority, student_user_id, student:profiles(full_name))')
        .eq('agent_id', profile.id)
        .order('updated_at', { ascending: false })
        .then(({ data }) => setTasks((data ?? []) as AgentTask[]))

      supabase
        .from('gown_orders')
        .select('*, student:profiles(student_profiles(*)), catalog_item:regalia_items(id, name, image_path)')
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
    setGownMsg(null)
    setBusyGownId(order.id)
    const fn = status === 'ready_for_pickup' ? 'mark_gown_ready' : 'mark_gown_collected'
    const { error } = await supabase.rpc(fn, { p_order_id: order.id })
    setBusyGownId(null)
    if (error) setGownMsg(error.message)
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
          {gownMsg && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{gownMsg}</div>}
          {gowns.map((g) => (
            <Card key={g.id} className="flex flex-wrap items-center gap-4">
              {g.custom_design_url || g.catalog_item?.image_path ? (
                <img src={g.custom_design_url ?? g.catalog_item!.image_path} alt={g.item_type} className="h-16 w-14 rounded-lg object-cover" />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-500">
                  <Shirt className="h-5 w-5 text-gold-500" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold text-brand-900">{g.student?.full_name ?? 'Student'}</p>
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium capitalize text-brand-700">
                    {regaliaLabel(g.item_type)}
                  </span>
                  <Badge status={g.status} />
                </div>
                <p className="mt-0.5 text-xs text-brand-500">
                  {registration(g)} · Size {g.size} · {g.ceremony_date} · {g.pickup_location}
                </p>
                {(g.custom_name || g.custom_note || g.catalog_item?.name) && (
                  <p className="mt-0.5 text-xs text-brand-400">
                    {g.catalog_item?.name ?? ''}
                    {g.custom_name ? ` · "${g.custom_name}"` : ''}
                    {g.custom_note ? ` — ${g.custom_note}` : ''}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
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