import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, BadgeCheck, CreditCard, Rocket } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { ClearanceRequest, ClearanceTask, Payment, Evidence } from '../../lib/types'
import { formatTZS, formatDateTime, STEP_ORDER, STEPS } from '../../lib/utils'
import { Card, Badge, Spinner, Button, Alert, Modal, Input, ProgressBar, SectionHeader } from '../../components/ui'
import { StageTimeline } from '../../components/StageTimeline'
import EvidenceList from '../../components/EvidenceList'

interface RequestWithTasks extends ClearanceRequest {
  clearance_tasks: ClearanceTask[]
}

export default function StudentHome() {
  const { profile } = useAuth()
  const [request, setRequest] = useState<RequestWithTasks | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<ClearanceTask | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    if (!profile) return
    const { data } = await supabase
      .from('clearance_requests')
      .select('*, clearance_tasks(*, stage:clearance_stages(id, name, "order"))')
      .eq('student_user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
    const req = (data?.[0] as RequestWithTasks | undefined) ?? null
    setRequest(req)
    if (req) {
      const { data: p } = await supabase.from('payments').select('*').eq('request_id', req.id).limit(1)
      setPayment((p?.[0] as Payment | undefined) ?? null)
      const { data: ev } = await supabase
        .from('evidence')
        .select('*, task:clearance_tasks!inner(request_id)')
        .eq('task.request_id', req.id)
        .order('created_at', { ascending: false })
      setEvidence((ev ?? []).filter((e) => e.uploaded_by !== profile.id) as Evidence[])
    } else {
      setPayment(null)
      setEvidence([])
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  useEffect(() => {
    if (!payment || (payment.status !== 'pending' && payment.status !== 'processing')) return
    const paymentId = payment.id
    let active = true
    let attempts = 0
    async function sync() {
      if (!active) return
      const { data } = await supabase.functions.invoke<{ status?: string }>('payment-status', {
        body: { payment_id: paymentId },
      })
      if (!active) return
      if (data?.status === 'paid' || data?.status === 'failed') {
        await load()
      }
    }
    const interval = window.setInterval(() => {
      attempts += 1
      if (attempts >= 40) {
        window.clearInterval(interval)
        return
      }
      void sync()
    }, 4000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.id, payment?.status])

  const actionTask = request?.clearance_tasks.find((t) => t.status === 'action_required')
  const doneCount = request?.clearance_tasks.filter((t) => t.status === 'completed').length ?? 0
  const totalCount = request?.clearance_tasks.length ?? 0
  const stepIdx = request ? STEP_ORDER[request.status] : 0
  const evidenceByTask = useMemo(() => {
    const map: Record<string, Evidence[]> = {}
    for (const e of evidence) {
      if (!map[e.task_id]) map[e.task_id] = []
      map[e.task_id].push(e)
    }
    return map
  }, [evidence])

  async function resolveAction() {
    if (!resolving || !file) return
    setUploading(true)
    setMsg(null)
    const path = `${profile!.id}/${resolving.id}/${Date.now()}_${file.name}`
    const { error: upErr } = await supabase.storage.from('student-documents').upload(path, file)
    if (upErr) {
      setMsg(`Upload failed: ${upErr.message}`)
      setUploading(false)
      return
    }
    const { error: evErr } = await supabase
      .from('evidence')
      .insert({ task_id: resolving.id, file_path: path, file_name: file.name, uploaded_by: profile!.id })
    if (evErr) {
      setMsg(`Could not save evidence: ${evErr.message}`)
      setUploading(false)
      return
    }
    const { error: rpcErr } = await supabase.rpc('resolve_action_required', { p_task_id: resolving.id })
    if (rpcErr) {
      setMsg(rpcErr.message)
      setUploading(false)
      return
    }
    setResolving(null)
    setFile(null)
    setUploading(false)
    await load()
  }

  if (loading) return <Spinner />

  if (!request) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="overflow-hidden !p-0">
          <div className="bg-black px-6 py-8 text-center text-[#f8f8f8]">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border border-gold-500">
              <BadgeCheck className="h-9 w-9 text-gold-400" />
            </div>
            <p className="lux-label text-gold-400">Ardhi University</p>
            <h2 className="lv-logo mt-2 text-2xl">Finalists</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#b4b4b4]">
              Submit your details, pay, and let our team handle the clearance offices while you track every step.
            </p>
          </div>
          <div className="p-6 text-center">
            <Link to="/student/apply" className="mt-5 block">
              <Button variant="accent" className="w-full sm:max-w-xs sm:mx-auto">
                Start clearance <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const pct = Math.round((doneCount / Math.max(totalCount, 1)) * 100)

  return (
    <div className="space-y-4">
      {request.status === 'action_required' && actionTask && (
        <Card className="border-amber-200 bg-amber-50 !p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-amber-800">Action required — {actionTask.stage?.name}</p>
              <p className="mt-0.5 text-sm text-amber-700">{actionTask.notes}</p>
            </div>
            <Button className="shrink-0" onClick={() => setResolving(actionTask)}>Resolve now</Button>
          </div>
        </Card>
      )}

      {/* Hero */}
      <Card className="!border-0 !p-0 overflow-hidden bg-black text-[#f8f8f8]">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <div className="flex items-center gap-2">
              <p className="lux-label text-gold-400">Graduation Clearance</p>
              <Badge status={request.status} />
            </div>
            <p className="mt-1 font-mono text-lg font-bold sm:text-xl">{request.request_number}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-2xl font-extrabold sm:text-3xl">{pct}%</p>
            <p className="text-xs text-[#b4b4b4]">{doneCount} / {totalCount} stages completed</p>
          </div>
        </div>
        <div className="px-5 pb-5 sm:px-6">
          <ProgressBar value={pct} color="bg-gold-500" track="bg-white/20" />
        </div>
      </Card>

      {/* Step indicator */}
      <Card className="!p-4">
        <div className="flex items-center">
          {STEPS.map((s, i) => {
            const reached = i <= stepIdx
            return (
              <div key={s} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                      reached ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={`hidden text-center text-[10px] leading-tight sm:block ${reached ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>
                    {s}
                  </span>
                </div>
                {i < STEPS.length - 1 && <div className={`mx-1 h-0.5 flex-1 rounded ${i < stepIdx ? 'bg-brand-600' : 'bg-slate-200'}`} />}
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-400 sm:hidden">
          {STEPS[Math.max(stepIdx, 0)]}
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <SectionHeader title="Clearance stages" subtitle="Where your application is in the process" />
            <StageTimeline tasks={request.clearance_tasks} evidenceByTask={evidenceByTask} />
          </Card>

          <Card>
            <SectionHeader title="Current activity" />
            <p className="text-sm text-slate-600">
              {request.status === 'payment_pending'
                ? 'Awaiting your payment to begin.'
                : request.status === 'completed'
                  ? 'Your clearance is complete. Well done! 🎓'
                  : request.current_note || 'Our team is working on your clearance. Check back soon.'}
            </p>
            <p className="mt-2 text-xs text-slate-400">Last updated: {formatDateTime(request.updated_at)}</p>
          </Card>

          {evidence.length > 0 && (
            <Card>
              <SectionHeader title="Proof from your agent" subtitle="Photos of completed stages so you can follow along" />
              <EvidenceList items={evidence} />
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-brand-600" />
              <h3 className="text-sm font-bold text-slate-900">Payment</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Service fee</span>
                <span className="font-semibold text-slate-900">{formatTZS(request.service_fee)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Status</span>
                <span className="font-semibold capitalize text-slate-900">{payment?.status ?? request.status.replace(/_/g, ' ')}</span>
              </div>
              {payment?.transaction_reference && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Reference</span>
                  <span className="font-mono text-xs text-slate-500">{payment.transaction_reference}</span>
                </div>
              )}
            </div>
            {request.status === 'payment_pending' && (
              <Link to="/student/apply" className="mt-4 block">
                <Button variant="success" className="w-full">Pay now</Button>
              </Link>
            )}
          </Card>

          <Card className="bg-slate-50">
            <div className="flex items-start gap-2">
              <Rocket className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <p className="text-xs leading-relaxed text-slate-500">
                Our team visits each clearance office on your behalf. When a stage needs something from you, you'll
                see an alert and can submit the document right from your phone.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <Modal open={!!resolving} onClose={() => setResolving(null)} title="Action required">
        {resolving && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{resolving.notes}</p>
            <Input label="Upload document" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {msg && <Alert kind="error">{msg}</Alert>}
            <Button onClick={() => void resolveAction()} loading={uploading} disabled={!file} className="w-full">
              Submit document
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}