import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, CheckCircle2, AlertTriangle, Hourglass, Wallet, FileText, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Card, Spinner, Badge, PageHeader, Stat, SectionHeader } from '../../components/ui'
import { formatTZS, formatDateTime } from '../../lib/utils'
import type { ClearanceRequest } from '../../lib/types'

interface Summary {
  active_requests: number
  completed: number
  in_progress: number
  action_required: number
  payment_pending: number
  revenue: number
  total_requests: number
}

export default function AdminDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [recent, setRecent] = useState<ClearanceRequest[]>([])

  useEffect(() => {
    supabase.rpc('dashboard_summary').then(({ data }) => setSummary(data as Summary | null))
    supabase
      .from('clearance_requests')
      .select('*, student:profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setRecent((data ?? []) as ClearanceRequest[]))
  }, [])

  if (!summary) return <Spinner />

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" subtitle="Operations at a glance" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Active requests" value={summary.active_requests} icon={Activity} color="bg-brand-50 text-brand-600" />
        <Stat label="In progress" value={summary.in_progress} icon={Hourglass} color="bg-amber-50 text-amber-600" />
        <Stat label="Action required" value={summary.action_required} icon={AlertTriangle} color="bg-rose-50 text-rose-600" />
        <Stat label="Payment pending" value={summary.payment_pending} icon={FileText} color="bg-sky-50 text-sky-600" />
        <Stat label="Completed" value={summary.completed} icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
        <Stat label="Revenue" value={formatTZS(summary.revenue)} icon={Wallet} color="bg-brand-50 text-brand-600" />
      </div>

      <div>
        <SectionHeader
          title="Recent requests"
          action={
            <Link to="/admin/requests" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {recent.map((r) => (
            <Link key={r.id} to={`/admin/requests/${r.id}`}>
              <Card className="h-full transition hover:border-brand-300 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{r.student?.full_name ?? 'Student'}</p>
                    <p className="font-mono text-xs text-slate-400">{r.request_number}</p>
                  </div>
                  <Badge status={r.status} />
                </div>
                <p className="mt-3 text-[11px] text-slate-400">{formatDateTime(r.created_at)}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}