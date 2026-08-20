import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Card, PageHeader, EmptyState, Spinner } from '../../components/ui'
import RoleMenu from '../../components/RoleMenu'
import { formatDate } from '../../lib/utils'
import type { Profile } from '../../lib/types'

interface StudentWithRequests extends Profile {
  requests: { id: string; request_number: string; status: string }[]
}

export default function AdminStudents() {
  const [students, setStudents] = useState<StudentWithRequests[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase
      .from('profiles')
      .select('*, requests:clearance_requests!clearance_requests_student_user_id_fkey(id, request_number, status)')
      .eq('role', 'student')
      .order('created_at', { ascending: false })
    setStudents((data ?? []) as StudentWithRequests[])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Students" subtitle="Everyone who has signed up" />
      {students.length === 0 && <EmptyState title="No students yet" />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {students.map((s) => (
          <Card key={s.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{s.full_name}</p>
                <p className="truncate text-xs text-slate-400">{s.phone ?? s.email ?? '—'}</p>
              </div>
              <RoleMenu userId={s.id} role={s.role} onChanged={() => void load()} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {s.requests.length === 0 && <span className="text-xs text-slate-400">No requests</span>}
              {s.requests.map((r) => (
                <Link
                  key={r.id}
                  to={`/admin/requests/${r.id}`}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                >
                  {r.request_number}
                </Link>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Joined {formatDate(s.created_at)}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}