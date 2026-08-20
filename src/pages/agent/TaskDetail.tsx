import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Phone, User, Flag } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { ClearanceTask, Evidence } from '../../lib/types'
import { Button, Card, Badge, Input, Textarea, Alert, Spinner, SectionHeader } from '../../components/ui'
import EvidenceList from '../../components/EvidenceList'
import { formatDate } from '../../lib/utils'

interface TaskDetail extends ClearanceTask {
  stage?: { id: string; name: string; order: number }
  request?: {
    request_number: string
    status: string
    priority: string
    service_fee: number
    current_note: string | null
    student?: { full_name: string; phone: string | null }
  }
}

export default function AgentTaskDetail() {
  const { taskId } = useParams()
  const { profile } = useAuth()
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [comment, setComment] = useState('')
  const [actionNote, setActionNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!taskId) return
    const { data } = await supabase
      .from('clearance_tasks')
      .select('*, stage:clearance_stages(id, name, "order"), request:clearance_requests(request_number, status, priority, service_fee, current_note, student:profiles!clearance_requests_student_user_id_fkey(full_name, phone))')
      .eq('id', taskId)
      .maybeSingle()
    setTask(data as TaskDetail | null)
    const { data: ev } = await supabase.from('evidence').select('*').eq('task_id', taskId).order('created_at', { ascending: false })
    setEvidence((ev ?? []) as Evidence[])
  }

  useEffect(() => {
    void load()
  }, [taskId])

  if (!task) return <Spinner />

  const t = task

  async function run(rpc: string, params: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc(rpc, params)
    if (error) setError(error.message)
    else await load()
    setBusy(false)
  }

  async function start() {
    await run('start_task', { p_task_id: t.id })
  }

  async function markComplete() {
    await run('complete_task', { p_task_id: t.id, p_notes: comment })
  }

  async function requestAction() {
    await run('set_action_required', { p_task_id: t.id, p_note: actionNote })
  }

  async function uploadProof() {
    if (!file) return
    setBusy(true)
    setError(null)
    const path = `${t.id}/${Date.now()}_${file.name}`
    const { error: upErr } = await supabase.storage.from('evidence').upload(path, file)
    if (upErr) {
      setError(upErr.message)
      setBusy(false)
      return
    }
    const { error: evErr } = await supabase
      .from('evidence')
      .insert({ task_id: t.id, file_path: path, file_name: file.name, uploaded_by: profile!.id })
    if (evErr) setError(evErr.message)
    else setFile(null)
    setBusy(false)
    await load()
  }

  const canAct = task.agent_id === profile?.id

  return (
    <div className="space-y-4">
      <Link to="/agent" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Back to tasks
      </Link>

      {error && <Alert kind="error">{error}</Alert>}

      <Card className="overflow-hidden !p-0">
        <div className="bg-black !border-0 p-5 text-[#f8f8f8]">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-sm text-[#b4b4b4]">{task.request?.request_number}</p>
            <Badge status={task.status} />
          </div>
          <h1 className="lv-logo mt-1 text-xl">{task.stage?.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#b4b4b4]">
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {task.request?.student?.full_name}</span>
            {task.request?.priority === 'high' && (
              <span className="flex items-center gap-1 rounded-lg bg-rose-500/20 px-2 py-0.5 text-xs font-semibold">
                <Flag className="h-3 w-3" /> High priority
              </span>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {task.notes && (
            <Card>
              <SectionHeader title="Notes" />
              <p className="whitespace-pre-wrap text-sm text-slate-600">{task.notes}</p>
            </Card>
          )}

          {canAct && (
            <Card className="space-y-4">
              <SectionHeader title="Update this stage" />

              {task.status === 'pending' || task.status === 'assigned' ? (
                <Button onClick={() => void start()} loading={busy} className="w-full sm:w-auto">Start working</Button>
              ) : null}

              {task.status === 'in_progress' || task.status === 'action_required' ? (
                <div className="space-y-3">
                  <Textarea label="Comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Student cleared by the library." />
                  <Button onClick={() => void markComplete()} loading={busy} variant="success" className="w-full sm:w-auto">
                    Mark as completed
                  </Button>
                </div>
              ) : null}

              {task.status !== 'completed' && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <div>
                    <Textarea
                      label="Needs something from the student"
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                      placeholder="e.g. Please upload a copy of your Student ID to continue."
                    />
                    <Button onClick={() => void requestAction()} loading={busy} variant="danger" className="mt-3 w-full sm:w-auto">
                      Request action from student
                    </Button>
                  </div>
                  <div className="border-t border-slate-100 pt-4">
                    <h4 className="mb-2 text-sm font-semibold text-slate-700">Upload proof</h4>
                    <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                    <Button onClick={() => void uploadProof()} loading={busy} disabled={!file} variant="secondary" className="mt-3 w-full sm:w-auto">
                      Upload evidence
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <SectionHeader title="Student details" />
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Name</span>
                <span className="text-right font-medium text-slate-800">{task.request?.student?.full_name}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="flex items-center gap-1 text-slate-500"><Phone className="h-3.5 w-3.5" /> Phone</span>
                <span className="font-medium text-slate-800">{task.request?.student?.phone ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Priority</span>
                <span className={`font-medium ${task.request?.priority === 'high' ? 'text-rose-600' : 'text-slate-800'}`}>{task.request?.priority}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Started</span>
                <span className="font-medium text-slate-800">{formatDate(task.started_at)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Completed</span>
                <span className="font-medium text-slate-800">{formatDate(task.completed_at)}</span>
              </div>
            </div>
          </Card>

          {evidence.length > 0 && (
            <Card>
              <SectionHeader title="Evidence / proof" subtitle="Photos and documents attached to this stage" />
              <EvidenceList items={evidence} />
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}