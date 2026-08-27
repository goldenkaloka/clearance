import { useEffect, useState } from 'react'
import { Wallet, Phone, Shirt } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Card, Button, Input, PageHeader, Alert, Spinner } from '../../components/ui'
import { formatTZS } from '../../lib/utils'

export default function AdminSettings() {
  const [fee, setFee] = useState('')
  const [gownFee, setGownFee] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingGown, setSavingGown] = useState(false)
  const [savingPhone, setSavingPhone] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    Promise.all([supabase.rpc('get_service_fee'), supabase.rpc('get_gown_fee'), supabase.rpc('get_contact_phone')]).then(([service, gown, contact]) => {
      setFee(String(Number(service.data) || 0))
      setGownFee(String(Number(gown.data) || 10000))
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

  async function saveGownFee() {
    setSavingGown(true)
    setMsg(null)
    const value = parseFloat(gownFee)
    if (isNaN(value) || value <= 0) {
      setMsg({ kind: 'error', text: 'Enter a valid amount.' })
      setSavingGown(false)
      return
    }
    const { error } = await supabase.rpc('set_gown_fee', { p_fee: Math.round(value) })
    if (error) setMsg({ kind: 'error', text: error.message })
    else setMsg({ kind: 'success', text: `Gown fee updated to ${formatTZS(value)}. Students will pay via ARU control number and upload PDF receipt.` })
    setSavingGown(false)
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
          <Shirt className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Gown fee</h3>
        <p className="mt-1 text-sm text-slate-500">Amount for graduation gown, paid via official ARU control number. Students upload PDF receipt. Default {formatTZS(10000)}.</p>
        <div className="mt-4">
          <Input label="Amount (TZS)" type="number" min={100} value={gownFee} onChange={(e) => setGownFee(e.target.value)} />
        </div>
        <Button onClick={() => void saveGownFee()} loading={savingGown} className="mt-4">Save gown fee</Button>
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
            placeholder="+255 616622485"
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