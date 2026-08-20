import { useEffect, useState } from 'react'
import { PackageCheck, ShoppingBag, UserRound, Shirt } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Card, Button, PageHeader, Spinner, Alert, Badge, EmptyState } from '../../components/ui'
import { formatTZS, formatDate, regaliaLabel } from '../../lib/utils'
import type { GownOrder, Profile } from '../../lib/types'

export default function AdminGowns() {
  const [orders, setOrders] = useState<GownOrder[]>([])
  const [agents, setAgents] = useState<Profile[]>([])
  const [assignedTo, setAssignedTo] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const [{ data: orders }, { data: agents }] = await Promise.all([
      supabase
        .from('gown_orders')
        .select('*, student:profiles(student_profiles(*)), agent:profiles!gown_orders_agent_id_fkey(full_name), catalog_item:regalia_items(id, name, image_path)')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name').eq('role', 'agent').eq('status', 'active'),
    ])
    setOrders((orders ?? []) as GownOrder[])
    setAgents((agents ?? []) as Profile[])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function assign(order: GownOrder) {
    const agentId = assignedTo[order.id]
    if (!agentId) return
    setMsg(null)
    setBusyId(order.id)
    const { error } = await supabase.rpc('assign_gown_agent', { p_order_id: order.id, p_agent_id: agentId })
    setBusyId(null)
    if (error) setMsg(error.message)
    else await load()
  }

  async function setStatus(order: GownOrder, status: GownOrder['status']) {
    setMsg(null)
    setBusyId(order.id)
    const fn = status === 'ready_for_pickup' ? 'mark_gown_ready' : 'mark_gown_collected'
    const { error } = await supabase.rpc(fn, { p_order_id: order.id })
    setBusyId(null)
    if (error) setMsg(error.message)
    else await load()
  }

  if (loading) return <Spinner />

  const registration = (o: GownOrder) => o.student?.student_profiles?.[0]?.registration_number ?? null

  return (
    <div>
      <PageHeader title="Graduation gowns" subtitle="Track gown orders, assign agents and manage pickup" />
      {msg && <div className="mb-4"><Alert kind="error">{msg}</Alert></div>}
      {orders.length === 0 ? (
        <EmptyState title="No gown orders yet" message="Orders will appear here once students request gowns." />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id} className="space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                {o.custom_design_url || o.catalog_item?.image_path ? (
                  <img src={o.custom_design_url ?? o.catalog_item!.image_path} alt={o.item_type} className="h-16 w-14 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-500">
                    <ShoppingBag className="h-5 w-5 text-gold-500" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-brand-900">{o.student?.full_name ?? 'Student'}</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium capitalize text-brand-700">
                      <Shirt className="h-3 w-3" /> {regaliaLabel(o.item_type)}
                    </span>
                    <Badge status={o.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-brand-500">
                    {registration(o) ?? o.student?.phone ?? o.student_user_id} · Size {o.size} · {o.ceremony_date} · {o.pickup_location}
                  </p>
                  {(o.custom_name || o.custom_note || o.catalog_item?.name) && (
                    <p className="mt-0.5 text-xs text-brand-400">
                      {o.catalog_item?.name ?? ''}
                      {o.custom_name ? ` · "${o.custom_name}"` : ''}
                      {o.custom_note ? ` — ${o.custom_note}` : ''}
                    </p>
                  )}
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-brand-500">
                    <UserRound className="h-3.5 w-3.5" />
                    Agent: {o.agent?.full_name ?? 'Not assigned'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-900">{formatTZS(o.price)}</p>
                  <p className="text-[11px] text-brand-400">Ordered {formatDate(o.created_at)}</p>
                </div>
              </div>

              {(o.status === 'paid' || o.status === 'ready_for_pickup') && (
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <select
                    value={assignedTo[o.id] ?? o.agent_id ?? ''}
                    onChange={(e) => setAssignedTo((m) => ({ ...m, [o.id]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-gold-500 sm:w-56"
                  >
                    <option value="">Assign an agent…</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.full_name}</option>
                    ))}
                  </select>
                  <Button onClick={() => void assign(o)} loading={busyId === o.id} disabled={!assignedTo[o.id] && !o.agent_id} variant="accent">
                    Assign
                  </Button>
                  {o.status === 'paid' && (
                    <Button onClick={() => void setStatus(o, 'ready_for_pickup')} loading={busyId === o.id}>
                      <PackageCheck className="h-4 w-4" /> Mark ready
                    </Button>
                  )}
                  {o.status === 'ready_for_pickup' && (
                    <Button onClick={() => void setStatus(o, 'collected')} loading={busyId === o.id} variant="success">
                      Mark collected
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}