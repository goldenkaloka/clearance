import { useEffect, useState } from 'react'
import { Shirt, CreditCard, MapPin, CalendarDays, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast, extractFunctionsError } from '../../context/ToastContext'
import { Button, Input, Select, Card, Alert, Spinner, SectionHeader, Badge, PageHeader } from '../../components/ui'
import { formatTZS, normalizeTzPhone, isValidTzPhone } from '../../lib/utils'
import type { GownOrder, GownSize } from '../../lib/types'

interface InitiateResult {
  success: boolean
  sandbox?: boolean
  paymentId?: string
  transaction_reference?: string
  amount?: number
  message?: string
  error?: string
}

const SIZES: GownSize[] = ['S', 'M', 'L', 'XL', 'XXL']
const LOCATIONS = ['Main Campus', 'Masani Campus', 'Zanzibar Campus']

export default function StudentGown() {
  const { profile } = useAuth()
  const toast = useToast()

  const [fee, setFee] = useState<number | null>(null)
  const [order, setOrder] = useState<GownOrder | null>(null)
  const [loading, setLoading] = useState(true)

  const [size, setSize] = useState<GownSize>('M')
  const [ceremonyDate, setCeremonyDate] = useState('')
  const [pickupLocation, setPickupLocation] = useState(LOCATIONS[0])
  const [payPhone, setPayPhone] = useState(profile?.phone ?? '')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [sandboxMode, setSandboxMode] = useState(false)

  async function load() {
    if (!profile) return
    const [{ data: feeData }, { data: orders }] = await Promise.all([
      supabase.rpc('get_gown_fee'),
      supabase.from('gown_orders').select('*, agent:profiles!gown_orders_agent_id_fkey(full_name)').eq('student_user_id', profile.id).order('created_at', { ascending: false }).limit(1),
    ])
    setFee(Number(feeData ?? 20000))
    setOrder((orders?.[0] as GownOrder | undefined) ?? null)
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  async function placeOrder() {
    setError(null)
    setBusy(true)
    const { data, error } = await supabase.rpc('order_gown', {
      p_size: size,
      p_ceremony_date: ceremonyDate,
      p_pickup_location: pickupLocation,
    })
    if (error || !data) {
      const msg = error?.message ?? 'Could not place the gown order'
      setError(msg)
      toast.error(msg)
      setBusy(false)
      return
    }
    setOrder(data as GownOrder)
    setBusy(false)
  }

  async function pay() {
    if (!order) return
    const raw = payPhone.trim()
    if (!raw) {
      const msg = 'Enter the phone number to receive the mobile-money prompt.'
      setError(msg)
      toast.error(msg)
      return
    }
    const phone = normalizeTzPhone(raw)
    if (!isValidTzPhone(phone)) {
      const msg = 'Enter a valid Tanzania mobile number, for example 0712 345 678.'
      setError(msg)
      toast.error(msg)
      return
    }
    setError(null)
    setNotice(null)
    setBusy(true)
    const { data, error } = await supabase.functions.invoke<InitiateResult>('initiate-payment', {
      body: { gown_order_id: order.id, phone },
    })
    if (error) {
      const extracted = await extractFunctionsError(error)
      const msg = extracted ?? data?.error ?? 'Payment could not be initiated.'
      const friendly = msg === 'Edge Function returned a non-2xx status code' ? 'Payment could not be initiated. Try again.' : msg
      setError(friendly)
      toast.error(friendly)
      setBusy(false)
      return
    }
    if (!data?.success) {
      const msg = data?.error ?? 'Payment could not be initiated.'
      setError(msg)
      toast.error(msg)
      setBusy(false)
      return
    }
    if (data.sandbox && data.transaction_reference) {
      setSandboxMode(true)
      const m = 'Sandbox mode: simulate the gateway confirming your payment below.'
      setNotice(m)
      toast.success(m)
    } else {
      const m = data.message ?? 'Payment request sent to your phone. Complete it on your device.'
      setNotice(m)
      toast.success(m)
    }
    setBusy(false)
  }

  async function confirmSandbox() {
    if (!order) return
    setBusy(true)
    setError(null)
    const { data: p } = await supabase.from('payments').select('transaction_reference').eq('gown_order_id', order.id).limit(1)
    const ref = p?.[0]?.transaction_reference
    if (!ref) {
      const msg = 'No pending payment found. Try initiating the payment again.'
      setError(msg)
      toast.error(msg)
      setBusy(false)
      return
    }
    const { error: webhookErr } = await supabase.functions.invoke('clickpesa-webhook', {
      body: { test_key: 'clearance-test-key', transaction_reference: ref, status: 'paid' },
    })
    if (webhookErr) {
      const msg = (await extractFunctionsError(webhookErr)) ?? webhookErr.message
      setError(msg)
      toast.error(msg)
      setBusy(false)
      return
    }
    const m = 'Gown payment confirmed! We will prepare your gown for pickup.'
    setNotice(m)
    toast.success(m)
    setBusy(false)
    await load()
  }

  if (loading) return <Spinner />

  const paying = order?.status === 'ordered'
  const settled = order && order.status !== 'ordered'

  return (
    <div className="space-y-4">
      <PageHeader title="Graduation gown" subtitle="Order and pay for your gown, then pick it up before the ceremony" />

      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind={notice.includes('confirmed') ? 'success' : 'info'}>{notice}</Alert>}

      <Card className="!border-0 bg-black text-[#f8f8f8]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shirt className="h-6 w-6 text-gold-400" />
            <div>
              <h3 className="lux-label text-gold-400">Gown fee</h3>
              <p className="text-2xl font-extrabold">{fee ? formatTZS(fee) : '…'}</p>
            </div>
          </div>
          <p className="max-w-xs text-xs leading-relaxed text-[#b4b4b4]">
            Gowns are typically ordered once your clearance is complete. Pickup is arranged from your chosen campus
            before the ceremony.
          </p>
        </div>
      </Card>

      {settled ? (
        <Card>
          <SectionHeader title="Your gown order" />
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gold-500">
              {order!.status === 'collected' ? (
                <CheckCircle2 className="h-7 w-7 text-gold-500" />
              ) : (
                <Shirt className="h-7 w-7 text-gold-500" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-brand-900">Size {order!.size}</p>
                <Badge status={order!.status} />
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-brand-500">
                <CalendarDays className="h-3.5 w-3.5" /> Ceremony: {order!.ceremony_date}
              </p>
              <p className="flex items-center gap-1.5 text-sm text-brand-500">
                <MapPin className="h-3.5 w-3.5" /> Pickup: {order!.pickup_location}
              </p>
              {order!.agent?.full_name && (
                <p className="flex items-center gap-1.5 text-sm text-brand-500">
                  <Shirt className="h-3.5 w-3.5" /> Prepared by: {order!.agent.full_name}
                </p>
              )}
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-brand-400">Paid</p>
              <p className="font-bold text-brand-900">{formatTZS(order!.price)}</p>
            </div>
          </div>
          {order!.status === 'ready_for_pickup' && (
            <p className="mt-4 rounded-xl bg-gold-50 p-3 text-sm text-gold-700">
              Your gown is ready for pickup at {order!.pickup_location}. Bring a valid ID.
            </p>
          )}
          {order!.status === 'collected' && (
            <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
              Gown collected. Congratulations, graduate!
            </p>
          )}
        </Card>
      ) : paying ? (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-brand-600" />
            <h3 className="text-sm font-semibold text-brand-900">Gown payment</h3>
          </div>
          <div className="mb-4 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 text-sm">
            <span className="text-brand-600">Size {order!.size} gown</span>
            <span className="font-bold text-brand-900">{formatTZS(order!.price)}</span>
          </div>
          <div className="space-y-4">
            <Input
              label="Pay with phone number (M-Pesa / Tigo Pesa / Airtel Money)"
              type="tel"
              value={payPhone}
              onChange={(e) => setPayPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              required
            />
            <Button onClick={() => void pay()} loading={busy} variant="success" className="w-full sm:w-auto">
              Pay {fee ? formatTZS(fee) : ''}
            </Button>
            {sandboxMode && (
              <Button onClick={() => void confirmSandbox()} loading={busy} variant="secondary" className="w-full sm:w-auto">
                Confirm payment (sandbox)
              </Button>
            )}
            <p className="text-xs text-brand-400">You will receive an STK/USSD prompt on the number above.</p>
          </div>
        </Card>
      ) : (
        <Card>
          <SectionHeader title="Order your gown" subtitle="Choose your size and ceremony details" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Size" value={size} onChange={(e) => setSize(e.target.value as GownSize)} required>
              {SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <Input label="Ceremony date" type="date" value={ceremonyDate} onChange={(e) => setCeremonyDate(e.target.value)} required />
            <Select label="Pickup location" value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} required>
              {LOCATIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </Select>
            <Input label="Payment phone (M-Pesa / Tigo Pesa)" type="tel" value={payPhone} onChange={(e) => setPayPhone(e.target.value)} placeholder="07XX XXX XXX" hint="Prompt will be sent here immediately after ordering" />
            <div className="flex items-end">
              <Button onClick={() => void placeOrder()} loading={busy} variant="accent" className="w-full" disabled={!ceremonyDate}>
                Order & pay <Shirt className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}