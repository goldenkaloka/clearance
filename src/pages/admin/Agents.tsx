import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, PageHeader, EmptyState, Spinner, Alert } from '../../components/ui'
import RoleMenu from '../../components/RoleMenu'
import type { Profile } from '../../lib/types'

interface AgentWithStats extends Profile {
  active_tasks?: number
  completed_tasks?: number
}

export default function AdminAgents() {
  const [agents, setAgents] = useState<AgentWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'agent')
    const rows = (data ?? []) as AgentWithStats[]
    const stats = await Promise.all(
      rows.map(async (a) => {
        const [active, completed] = await Promise.all([
          supabase.from('clearance_tasks').select('id', { count: 'exact' }).eq('agent_id', a.id).not('status', 'eq', 'completed'),
          supabase.from('clearance_tasks').select('id', { count: 'exact' }).eq('agent_id', a.id).eq('status', 'completed'),
        ])
        return { active_tasks: active.count ?? 0, completed_tasks: completed.count ?? 0 }
      }),
    )
    setAgents(rows.map((r, i) => ({ ...r, ...stats[i] })))
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  if (loading) return <Spinner />

  async function toggleStatus(agent: AgentWithStats) {
    setMsg(null)
    const { error } = await supabase
      .from('profiles')
      .update({ status: agent.status === 'active' ? 'inactive' : 'active' })
      .eq('id', agent.id)
    if (error) setMsg(error.message)
    else await load()
  }

  return (
    <div>
      <PageHeader title="Agents" subtitle="Manage the clearance team" />
      {msg && <div className="mb-4"><Alert kind="error">{msg}</Alert></div>}
      <Card className="mb-4 bg-slate-50">
        <p className="text-sm text-slate-600">
          Everyone signs up as a student. Promote a user to agent (or demote them) using the role selector. You can also activate/deactivate them here.
        </p>
      </Card>
      {agents.length === 0 && <EmptyState title="No agents yet" message="Promote a student to agent using the role selector, or activate an existing agent." />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((a) => (
          <Card key={a.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">{a.full_name}</p>
                <p className="text-xs text-slate-400">{a.phone ?? a.email}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  a.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {a.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 py-2">
                <p className="text-lg font-bold text-slate-800">{a.active_tasks}</p>
                <p className="text-[11px] text-slate-500">Active tasks</p>
              </div>
              <div className="rounded-xl bg-slate-50 py-2">
                <p className="text-lg font-bold text-slate-800">{a.completed_tasks}</p>
                <p className="text-[11px] text-slate-500">Completed</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">Role</span>
              <RoleMenu userId={a.id} role={a.role} onChanged={() => void load()} />
            </div>
            <button
              onClick={() => void toggleStatus(a)}
              className={`mt-3 w-full rounded-xl py-2 text-sm font-semibold ${a.status === 'active' ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
            >
              {a.status === 'active' ? 'Deactivate' : 'Activate'}
            </button>
          </Card>
        ))}
      </div>
    </div>
  )
}