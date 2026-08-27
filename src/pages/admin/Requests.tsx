import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Card, Badge, Input, PageHeader, EmptyState, Spinner, Select } from '../../components/ui'
import { formatDateTime, requestStatusLabel } from '../../lib/utils'
import type { ClearanceRequest, School } from '../../lib/types'

const STATUSES = [
  'all',
  'payment_pending',
  'payment_confirmed',
  'agent_assigned',
  'in_progress',
  'action_required',
  'final_verification',
  'completed',
]

export default function ClearanceRequests() {
  const [requests, setRequests] = useState<ClearanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [schoolFilter, setSchoolFilter] = useState('all')
  const [schools, setSchools] = useState<School[]>([])

  useEffect(() => {
    supabase
      .from('schools')
      .select('*')
      .order('order')
      .then(({ data }) => setSchools((data ?? []) as School[]))
  }, [])

  useEffect(() => {
    let query = supabase
      .from('clearance_requests')
      .select(
        '*, student:profiles!clearance_requests_student_user_id_fkey(full_name, student_profiles(school, school_id)), agent:profiles!clearance_requests_assigned_agent_id_fkey(full_name)',
      )
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') query = query.eq('status', statusFilter)

    query.then(({ data }) => {
      let rows = (data ?? []) as ClearanceRequest[]
      if (schoolFilter !== 'all') {
        rows = rows.filter((r) => r.student?.student_profiles?.[0]?.school_id === schoolFilter)
      }
      if (search.trim()) {
        const q = search.toLowerCase()
        rows = rows.filter(
          (r) =>
            r.request_number.toLowerCase().includes(q) ||
            (r.student?.full_name ?? '').toLowerCase().includes(q) ||
            (r.agent?.full_name ?? '').toLowerCase().includes(q),
        )
      }
      setRequests(rows)
      setLoading(false)
    })
  }, [statusFilter, search, schoolFilter])

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <PageHeader title="Requests" subtitle="Search, filter and manage clearance requests" />

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search by name, request ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full md:w-auto"
          aria-label="Filter by status"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s === 'all' ? 'All statuses' : requestStatusLabel[s as keyof typeof requestStatusLabel] ?? s}</option>
          ))}
        </Select>
        <Select
          value={schoolFilter}
          onChange={(e) => setSchoolFilter(e.target.value)}
          className="w-full md:w-auto"
          aria-label="Filter by school"
        >
          <option value="all">All schools</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>{s.short_name ?? s.name}</option>
          ))}
        </Select>
      </div>

      {requests.length === 0 ? (
        <EmptyState title="No requests found" message="Try changing the filter or search term." />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {requests.map((r) => (
              <Link key={r.id} to={`/admin/requests/${r.id}`}>
                <Card className="transition hover:border-brand-300">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{r.student?.full_name ?? 'Student'}</p>
                      <p className="font-mono text-xs text-slate-400">{r.request_number}</p>
                    </div>
                    <Badge status={r.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    {r.agent && <span className="rounded bg-slate-100 px-1.5 py-0.5">→ {r.agent.full_name}</span>}
                    <span>{formatDateTime(r.created_at)}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Request</th>
                  <th className="px-4 py-3 font-semibold">Agent</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r) => (
                  <tr key={r.id} className="transition hover:bg-brand-50/40">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <Link to={`/admin/requests/${r.id}`} className="hover:text-brand-700">{r.student?.full_name ?? 'Student'}</Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.request_number}</td>
                    <td className="px-4 py-3 text-slate-500">{r.agent?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{formatDateTime(r.created_at)}</td>
                    <td className="px-4 py-3 text-right"><Badge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}