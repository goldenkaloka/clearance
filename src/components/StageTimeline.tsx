import { CheckCircle2, Circle, Loader2, AlertTriangle, Clock } from 'lucide-react'
import type { ClearanceTask, Evidence } from '../lib/types'
import EvidenceList from './EvidenceList'

interface StageTimelineProps {
  tasks: ClearanceTask[]
  evidenceByTask?: Record<string, Evidence[]>
}

export function StageTimeline({ tasks, evidenceByTask }: StageTimelineProps) {
  const sorted = [...tasks].sort((a, b) => (a.stage?.order ?? 0) - (b.stage?.order ?? 0))

  return (
    <ol className="space-y-3">
      {sorted.map((t) => {
        const done = t.status === 'completed'
        const active = t.status === 'in_progress'
        const required = t.status === 'action_required'
        const assigned = t.status === 'assigned'

        return (
          <li key={t.id} className="flex items-start gap-3">
            <div className="mt-0.5">
              {done ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : active ? (
                <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
              ) : required ? (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              ) : assigned ? (
                <Clock className="h-5 w-5 text-sky-500" />
              ) : (
                <Circle className="h-5 w-5 text-slate-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className={`text-sm font-medium ${done ? 'text-slate-400 line-through' : required ? 'text-red-600' : 'text-slate-800'}`}>
                  {t.stage?.name ?? 'Stage'}
                </p>
                <span className="text-[11px] font-medium capitalize text-slate-400">{t.status.replace(/_/g, ' ')}</span>
              </div>
              {t.notes && <p className="mt-0.5 text-xs text-slate-500">{t.notes}</p>}
              {evidenceByTask?.[t.id] && evidenceByTask[t.id].length > 0 && (
                <div className="mt-2">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Proof</p>
                  <EvidenceList items={evidenceByTask[t.id]} />
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}