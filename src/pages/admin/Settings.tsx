import { useEffect, useState } from 'react'
import { Wallet, Phone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Card, Button, Input, PageHeader, Alert, Spinner } from '../../components/ui'
import { formatTZS } from '../../lib/utils'

export default function AdminSettings() {
  const [fee, setFee] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPhone, setSavingPhone] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    Promise.all([supabase.rpc('get_service_fee'), supabase.rpc('get_contact_phone')]).then(([service, contact]) => {
      setFee(String(Number(service.data) || 0))
      setContactPhone(String(contact.data ?? ''))
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

  async function savePhone() {
    setSavingPhone(true)
    setMsg(null)
    if (!contactPhone.trim()) {
      setMsg({ kind: 'error', text: 'Enter a contact phone number.' })
      setSavingPhone(false)
      return
    }
    const { error } = await supabase.rpc('set_contact_phone', { p_phone: contactPhone.trim() })
    setSavingPhone(false)
    if (error) setMsg({ kind: 'error', text: error.message })
    else setMsg({ kind: 'success', text: 'Contact phone updated. It now shows in the catalog contact popup.' })
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
      </Card>

      <Card className="mt-4 max-w-xl">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Phone className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Contact phone</h3>
        <p className="mt-1 text-sm text-slate-500">
          Shown in the popup when a visitor clicks a suit, sash or shoes sample on the public catalog pages, so they can
          call or WhatsApp you directly.
        </p>
        <div className="mt-4">
          <Input
            label="Phone number"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+255 712 345 678"
          />
        </div>
        <Button onClick={() => void savePhone()} loading={savingPhone} className="mt-4">Save phone</Button>
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