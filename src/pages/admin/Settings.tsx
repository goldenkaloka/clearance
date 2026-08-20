import { useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Card, Button, Input, PageHeader, Alert, Spinner } from '../../components/ui'
import { formatTZS } from '../../lib/utils'

export default function AdminSettings() {
  const [fee, setFee] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    supabase.rpc('get_service_fee').then(({ data }) => {
      setFee(String(Number(data) || 0))
      setLoading(false)
    })
  }, [])

  if (loading) return <Spinner />

  async function save() {
    setSaving(true)
    setMsg(null)
    const value = parseFloat(fee)
    if (isNaN(value) || value <= 0) {
      setMsg({ kind: 'error', text: 'Enter a valid amount.' })
      setSaving(false)
      return
    }
    const { error } = await supabase.rpc('set_service_fee', { p_fee: Math.round(value) })
    if (error) setMsg({ kind: 'error', text: error.message })
    else setMsg({ kind: 'success', text: `Service fee updated to ${formatTZS(value)}. This applies to new requests.` })
    setSaving(false)
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure the service" />

      <Card className="max-w-xl">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Wallet className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Service fee</h3>
        <p className="mt-1 text-sm text-slate-500">
          A single amount charged to every student for graduation clearance assistance. Existing requests keep the fee
          they had when created.
        </p>
        <div className="mt-4">
          <Input
            label="Amount (TZS)"
            type="number"
            min={100}
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </div>
        <Button onClick={() => void save()} loading={saving} className="mt-4">Save fee</Button>
        {msg && <div className="mt-4"><Alert kind={msg.kind}>{msg.text}</Alert></div>}
      </Card>

      <Card className="mt-4 max-w-xl bg-slate-50">
        <p className="text-sm text-slate-600">
          Other configuration (SMS provider, payment gateway keys) is managed through Supabase project secrets and the
          edge functions.
        </p>
      </Card>
    </div>
  )
}