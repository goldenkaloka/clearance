import { useEffect, useState } from 'react'
import { Wallet, Banknote, Receipt, RotateCcw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Card, Badge, PageHeader, EmptyState, Spinner, Stat } from '../../components/ui'
import { formatTZS, formatDateTime } from '../../lib/utils'

interface PaymentRow {
  id: string
  amount: number
  transaction_reference: string | null
  provider: string
  status: string
  paid_at: string | null
  created_at: string
  request?: { request_number: string; student?: { full_name: string } }
}

export default function AdminPayments() {
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('payments')
      .select('*, request:clearance_requests(request_number, student_user_id, student:profiles(full_name))')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setPayments((data ?? []) as PaymentRow[])
        setLoading(false)
      })
  }, [])

  if (loading) return <Spinner />

  const paid = payments.filter((p) => p.status === 'paid')
  const revenue = paid.reduce((sum, p) => sum + Number(p.amount), 0)
  const refunded = payments.filter((p) => p.status === 'refunded').length

  return (
    <div className="space-y-4">
      <PageHeader title="Payments" subtitle="Revenue and payment history" />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Total paid" value={formatTZS(revenue)} icon={Wallet} color="bg-emerald-50 text-emerald-600" />
        <Stat label="Paid transactions" value={paid.length} icon={Banknote} color="bg-brand-50 text-brand-600" />
        <Stat label="Total transactions" value={payments.length} icon={Receipt} color="bg-sky-50 text-sky-600" />
        <Stat label="Refunds" value={refunded} icon={RotateCcw} color="bg-rose-50 text-rose-600" />
      </div>

      {payments.length === 0 ? (
        <EmptyState title="No payments yet" />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {payments.map((p) => (
              <Card key={p.id}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">{p.request?.student?.full_name ?? 'Student'}</p>
                  <Badge status={p.status === 'paid' ? 'completed' : p.status === 'failed' ? 'failed' : 'pending'} />
                </div>
                <p className="mt-1 font-mono text-xs text-slate-400">
                  {p.request?.request_number} · {p.transaction_reference ?? 'no-ref'}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[11px] text-slate-400">{formatDateTime(p.paid_at ?? p.created_at)}</p>
                  <p className="font-bold text-slate-900">{formatTZS(p.amount)}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Request</th>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{p.request?.student?.full_name ?? 'Student'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.request?.request_number}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.transaction_reference ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{formatDateTime(p.paid_at ?? p.created_at)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatTZS(p.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge status={p.status === 'paid' ? 'completed' : p.status === 'failed' ? 'failed' : 'pending'} />
                    </td>
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