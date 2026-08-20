import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Button, Card, Badge, Textarea, Spinner, Alert, SectionHeader } from '../../components/ui'
import { formatTZS, formatDateTime, formatDate } from '../../lib/utils'
import type { ClearanceRequest, ClearanceTask, AuditLog, Payment, Profile, Evidence } from '../../lib/types'
import { StageTimeline } from '../../components/StageTimeline'
import EvidenceList from '../../components/EvidenceList'

interface DetailRequest extends ClearanceRequest {
  clearance_tasks: ClearanceTask[]
}

export default function AdminRequestDetail() {
  const { id } = useParams()
  const [request, setRequest] = useState<DetailRequest | null>(null)
  const [agents, setAgents] = useState<Profile[]>([])
  const [audit, setAudit] = useState<AuditLog[]>([])
  const [payment, setPayment] = useState<Payment | null>(null)
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [priority, setPriority] = useState<'normal' | 'high'>('normal')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!id) return
    const { data } = await supabase
      .from('clearance_requests')
      .select('*, student:profiles!clearance_requests_student_user_id_fkey(*), agent:profiles!clearance_requests_assigned_agent_id_fkey(*), clearance_tasks(*, stage:clearance_stages(id, name, "order"))')
      .eq('id', id)
      .maybeSingle()
    const row = data as DetailRequest | null
    setRequest(row)
    setPriority(row?.priority ?? 'normal')
    setNote(row?.current_note ?? '')

    const [{ data: agents }, { data: audit }, { data: payments }, { data: evidence }] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'agent').eq('status', 'active'),
      supabase.from('audit_logs').select('*').eq('request_id', id).order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('request_id', id).order('created_at', { ascending: false }).limit(1),
      supabase.from('evidence').select('*, task:clearance_tasks!inner(request_id)').eq('task.request_id', id).order('created_at', { ascending: false }),
    ])
    setAgents((agents ?? []) as Profile[])
    setAudit((audit ?? []) as AuditLog[])
    setPayment((payments?.[0] as Payment | undefined) ?? null)
    setEvidence((evidence ?? []) as Evidence[])
  }

  useEffect(() => {
    void load()
  }, [id])

  if (!request) return <Spinner />

  const req = request

  async function assign() {
    if (!selectedAgent) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('assign_agent', { p_request_id: req.id, p_agent_id: selectedAgent })
    if (error) setError(error.message)
    else {
      setSelectedAgent('')
      await load()
    }
    setBusy(false)
  }

  async function saveRequest() {
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('clearance_requests')
      .update({ priority, current_note: note || null })
      .eq('id', req.id)
    if (error) setError(error.message)
    setBusy(false)
  }

  async function complete() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('complete_verification', { p_request_id: req.id })
    if (error) setError(error.message)
    else await load()
    setBusy(false)
  }

  return (
    <div className="space-y-4">
      <Link to="/admin/requests" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Back to requests
      </Link>

      {error && <Alert kind="error">{error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-mono text-xl font-bold text-slate-900">{request.request_number}</h1>
                <p className="mt-1 text-sm text-slate-500">{request.student?.full_name}</p>
                {request.student?.registration_number && (
                  <p className="text-xs text-slate-400">{request.student.registration_number} · {request.student.programme}</p>
                )}
              </div>
              <Badge status={request.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-400">Fee</p>
                <p className="font-semibold text-slate-800">{formatTZS(request.service_fee)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-400">Payment</p>
                <p className="font-semibold capitalize text-slate-800">{payment?.status ?? '—'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-400">Agent</p>
                <p className="truncate font-semibold text-slate-800">{request.agent?.full_name ?? 'Not assigned'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-400">Created</p>
                <p className="text-xs font-semibold text-slate-800">{formatDate(request.created_at)}</p>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Stages" />
            <StageTimeline tasks={request.clearance_tasks} />
          </Card>

          {evidence.length > 0 && (
            <Card>
              <SectionHeader title="Proof / evidence" subtitle="Photos and documents from the agent and the student" />
              <EvidenceList items={evidence} />
            </Card>
          )}

          {request.status === 'final_verification' && (
            <Card className="border-emerald-200 bg-emerald-50">
              <p className="text-sm text-emerald-800">All stages completed. Final verification is pending.</p>
              <Button onClick={() => void complete()} loading={busy} variant="success" className="mt-3">
                Mark as completed
              </Button>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="space-y-3">
            <SectionHeader title="Assign agent" />
            {agents.length === 0 && <p className="text-xs text-slate-500">No active agents. Add agents from the Agents page.</p>}
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-brand-500"
            >
              <option value="">Choose agent…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.full_name}</option>
              ))}
            </select>
            <Button onClick={() => void assign()} loading={busy} disabled={!selectedAgent} className="w-full">Assign</Button>
          </Card>

          <Card className="space-y-3">
            <SectionHeader title="Request settings" />
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">Priority</span>
              <div className="flex gap-2">
                {(['normal', 'high'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium capitalize ${priority === p ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <Textarea label="Current note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visible to the student on their dashboard" />
            <Button onClick={() => void saveRequest()} loading={busy} className="w-full">Save</Button>
          </Card>

          <Card>
            <SectionHeader title="Audit trail" />
            {audit.length === 0 && <p className="text-xs text-slate-400">No activity recorded yet.</p>}
            <ul className="space-y-2.5">
              {audit.map((a) => (
                <li key={a.id} className="border-l-2 border-brand-100 pl-3">
                  <p className="text-xs font-medium capitalize text-slate-700">{a.action.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] text-slate-400">{formatDateTime(a.created_at)}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}