import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Shirt, CreditCard, MapPin, CheckCircle2, ImagePlus, UploadCloud, Sparkles } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { Button, Input, Select, Textarea, Card, Alert, Spinner, SectionHeader, Badge, PageHeader } from '../../components/ui'
import { formatTZS, regaliaLabel, REGALIA_CATEGORIES } from '../../lib/utils'
import type { GownOrder, RegaliaItem, RegaliaCategory, RegaliaGender } from '../../lib/types'

const LOCATIONS = ['Main Campus', 'Masani Campus', 'Zanzibar Campus']
const GENDERS: { value: RegaliaGender; label: string }[] = [
  { value: 'unisex', label: 'Unisex / Prefer not to say' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

interface InitiateResult {
  success: boolean
  sandbox?: boolean
  paymentId?: string
  transaction_reference?: string
  amount?: number
  message?: string
  error?: string
}

export default function StudentRegalia() {
  const { profile } = useAuth()
  const [params] = useSearchParams()

  const [items, setItems] = useState<RegaliaItem[]>([])
  const [orders, setOrders] = useState<GownOrder[]>([])
  const [fees, setFees] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const [category, setCategory] = useState<RegaliaCategory>('gown')
  const [mode, setMode] = useState<'sample' | 'custom'>('sample')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [customDesign, setCustomDesign] = useState<string | null>(null)
  const [customNote, setCustomNote] = useState('')
  const [customName, setCustomName] = useState('')
  const [gender, setGender] = useState<RegaliaGender>('unisex')
  const [size, setSize] = useState('M')
  const [ceremonyDate, setCeremonyDate] = useState('')
  const [pickupLocation, setPickupLocation] = useState(LOCATIONS[0])

  const [order, setOrder] = useState<GownOrder | null>(null)
  const [payPhone, setPayPhone] = useState(profile?.phone ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [sandboxMode, setSandboxMode] = useState(false)

  const [requestCategory, setRequestCategory] = useState<RegaliaCategory>('sash')
  const [requestNote, setRequestNote] = useState('')
  const [requestBusy, setRequestBusy] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  useEffect(() => {
    if (!profile) return
    const load = async () => {
      const [{ data: itemsData }, feeData, { data: ordersData }] = await Promise.all([
        supabase.from('regalia_items').select('*').eq('active', true).order('sort_order', { ascending: true }),
        Promise.all(REGALIA_CATEGORIES.map((c) => supabase.rpc('get_item_fee', { p_item_type: c }))),
        supabase
          .from('gown_orders')
          .select('*, agent:profiles!gown_orders_agent_id_fkey(full_name), catalog_item:regalia_items(id, name, image_path)')
          .eq('student_user_id', profile.id)
          .order('created_at', { ascending: false }),
      ])
      setItems((itemsData ?? []) as RegaliaItem[])
      setFees(Object.fromEntries(REGALIA_CATEGORIES.map((c, i) => [c, Number(feeData[i]?.data ?? 0)])))
      setOrders((ordersData ?? []) as GownOrder[])
      setLoading(false)
    }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  useEffect(() => {
    const itemId = params.get('item')
    const reqCat = params.get('request')
    const catParam = params.get('category')
    if (catParam && (REGALIA_CATEGORIES as readonly string[]).includes(catParam)) {
      setCategory(catParam as RegaliaCategory)
    }
    if (itemId) {
      setMode('sample')
      setSelectedItemId(itemId)
      const item = items.find((i) => i.id === itemId)
      if (item) setCategory(item.category)
    }
    if (reqCat && (REGALIA_CATEGORIES as readonly string[]).includes(reqCat)) {
      setRequestCategory(reqCat as RegaliaCategory)
      setRequestSent(false)
      setTimeout(() => document.getElementById('request-samples')?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, items])

  const categoryItems = useMemo(() => items.filter((i) => i.category === category), [items, category])
  const selectedItem = items.find((i) => i.id === selectedItemId) ?? null

  const price = selectedItem ? selectedItem.price : (fees[category] ?? 0)

  function selectCategory(c: RegaliaCategory) {
    setCategory(c)
    setMode('sample')
    setSelectedItemId(null)
  }

  async function uploadDesign(file: File) {
    if (!profile) return
    setError(null)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${profile.id}/${Date.now()}-${safeName}`
    const { data, error: uploadError } = await supabase.storage.from('custom-designs').upload(path, file, { upsert: false })
    if (uploadError) {
      setError(uploadError.message)
      return
    }
    const { data: url } = supabase.storage.from('custom-designs').getPublicUrl(data.path)
    setCustomDesign(url.publicUrl)
  }

  async function placeOrder() {
    setError(null)
    setNotice(null)
    setBusy(true)
    const { data, error } = await supabase.rpc('order_regalia', {
      p_item_type: category,
      p_gender: gender,
      p_size: size,
      p_ceremony_date: ceremonyDate,
      p_pickup_location: pickupLocation,
      p_catalog_item_id: selectedItem?.id ?? null,
      p_custom_name: customName || null,
      p_custom_note: mode === 'custom' ? customNote || null : null,
      p_custom_design_url: mode === 'custom' ? customDesign : null,
    })
    setBusy(false)
    if (error || !data) {
      setError(error?.message ?? 'Could not place the order')
      return
    }
    setOrder(data as GownOrder)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function pay() {
    if (!order) return
    setError(null)
    setNotice(null)
    setBusy(true)
    const { data, error } = await supabase.functions.invoke<InitiateResult>('initiate-payment', {
      body: { gown_order_id: order.id, phone: payPhone },
    })
    if (error || !data?.success) {
      setError(data?.error ?? error?.message ?? 'Payment could not be initiated')
      setBusy(false)
      return
    }
    if (data.sandbox && data.transaction_reference) {
      setSandboxMode(true)
      setNotice('Sandbox mode: simulate the gateway confirming your payment below.')
    } else {
      setNotice(data.message ?? 'Payment request sent to your phone. Complete it on your device.')
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
      setError('No pending payment found. Try initiating the payment again.')
      setBusy(false)
      return
    }
    const { error: webhookErr } = await supabase.functions.invoke('clickpesa-webhook', {
      body: { test_key: 'clearance-test-key', transaction_reference: ref, status: 'paid' },
    })
    if (webhookErr) {
      setError(webhookErr.message)
      setBusy(false)
      return
    }
    setNotice('Payment confirmed! We will prepare your order for pickup.')
    setBusy(false)
    setSandboxMode(false)
    const { data: ordersData } = await supabase
      .from('gown_orders')
      .select('*, agent:profiles!gown_orders_agent_id_fkey(full_name), catalog_item:regalia_items(id, name, image_path)')
      .eq('student_user_id', profile!.id)
      .order('created_at', { ascending: false })
    setOrders((ordersData ?? []) as GownOrder[])
    setOrder(null)
  }

  async function sendSampleRequest() {
    if (!profile) return
    setRequestBusy(true)
    setError(null)
    const { error } = await supabase.rpc('request_regalia_samples', {
      p_category: requestCategory,
      p_note: requestNote || null,
    })
    setRequestBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setRequestSent(true)
  }

  if (loading) return <Spinner />

  const paying = order?.status === 'ordered'

  return (
    <div className="space-y-6">
      <PageHeader title="Regalia" subtitle="Order a gown, sash, suit or shoes — from a sample or with your own design" />

      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind={notice.includes('confirmed') ? 'success' : 'info'}>{notice}</Alert>}

      {/* payment card for a pending order */}
      {paying && order && (
        <Card className="!border-0 bg-black text-[#f8f8f8]">
          <div className="mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-gold-400" />
            <h3 className="text-sm font-semibold">Payment for your {regaliaLabel(order.item_type)}</h3>
          </div>
          <div className="mb-4 flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm">
            <span>
              {order.item_type} {order.custom_name ? `· "${order.custom_name}"` : ''} · Size {order.size}
            </span>
            <span className="font-bold">{formatTZS(order.price)}</span>
          </div>
          <div className="space-y-4">
            <Input
              label="Pay with phone number (M-Pesa / Tigo Pesa / Airtel Money)"
              type="tel"
              value={payPhone}
              onChange={(e) => setPayPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              className="!border-white/20 !bg-white/5 !text-white placeholder:!text-white/40"
            />
            <Button onClick={() => void pay()} loading={busy} variant="success" className="w-full sm:w-auto">
              Pay {formatTZS(order.price)}
            </Button>
            {sandboxMode && (
              <Button onClick={() => void confirmSandbox()} loading={busy} variant="secondary" className="w-full sm:w-auto">
                Confirm payment (sandbox)
              </Button>
            )}
            <p className="text-xs text-[#b4b4b4]">You will receive an STK/USSD prompt on the number above.</p>
          </div>
        </Card>
      )}

      {/* order form */}
      {!order && (
        <Card>
          <SectionHeader title="Order regalia" subtitle="Choose a sample or send your own design, then personalise it" />

          {/* category tabs */}
          <div className="mb-5 flex flex-wrap gap-1.5 rounded-full border border-brand-100 p-1">
            {REGALIA_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => selectCategory(c)}
                className={`flex-1 whitespace-nowrap rounded-full px-4 py-2 text-sm tracking-[0.025em] transition-all ${
                  category === c ? 'bg-black text-white' : 'text-brand-500 hover:text-brand-900'
                }`}
              >
                {regaliaLabel(c)}
              </button>
            ))}
          </div>

          {/* sample vs custom toggle */}
          <div className="mb-5 flex gap-2">
            <button
              onClick={() => { setMode('sample'); setSelectedItemId(null) }}
              className={`rounded-full border px-5 py-2 text-xs uppercase tracking-[0.2em] transition ${
                mode === 'sample' ? 'border-black bg-black text-white' : 'border-brand-200 text-brand-500 hover:border-brand-400'
              }`}
            >
              Choose a sample
            </button>
            <button
              onClick={() => { setMode('custom'); setSelectedItemId(null) }}
              className={`rounded-full border px-5 py-2 text-xs uppercase tracking-[0.2em] transition ${
                mode === 'custom' ? 'border-black bg-black text-white' : 'border-brand-200 text-brand-500 hover:border-brand-400'
              }`}
            >
              Send my own design
            </button>
          </div>

          {mode === 'sample' ? (
            categoryItems.length === 0 ? (
              <p className="rounded-xl bg-brand-50 p-5 text-sm text-brand-500">
                No {regaliaLabel(category).toLowerCase()} samples yet — switch to "Send my own design".
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {categoryItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className={`group overflow-hidden rounded-xl border text-left transition ${
                      selectedItemId === item.id ? 'border-black ring-1 ring-black' : 'border-brand-100 hover:border-brand-300'
                    }`}
                  >
                    <div className="overflow-hidden bg-brand-50">
                      <img
                        src={item.image_path}
                        alt={item.name}
                        className="aspect-[3/4] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-medium text-brand-900">{item.name}</p>
                      <p className="mt-0.5 text-xs text-brand-500">{formatTZS(item.price)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50 p-6">
              <p className="lux-label text-brand-500">Your custom design</p>
              {customDesign ? (
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <img src={customDesign} alt="Custom design" className="h-36 w-28 rounded-lg object-cover" />
                  <div className="space-y-2">
                    <p className="text-sm text-brand-700">Design uploaded. Agents will see it with your order.</p>
                    <Button variant="ghost" onClick={() => setCustomDesign(null)}>Remove</Button>
                  </div>
                </div>
              ) : (
                <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-brand-200 bg-white px-6 py-10 text-center transition hover:border-black">
                  <UploadCloud className="h-8 w-8 text-brand-400" />
                  <span className="mt-3 text-sm font-medium text-brand-800">Upload a design photo</span>
                  <span className="mt-1 text-xs text-brand-500">or send us a description below and we'll show you samples</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void uploadDesign(file)
                      e.target.value = ''
                    }}
                  />
                </label>
              )}
              <div className="mt-4">
                <Textarea
                  label="Design notes / description"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="e.g. navy suit with gold buttons, matching sash…"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* personalisation */}
          <div className="mt-6 border-t border-brand-100 pt-5">
            <p className="lux-label mb-4 text-brand-500">Personalise</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Name / text to add (embroidery, sash or initials)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Golden Kaloka"
              />
              <Select label="Gender fit" value={gender} onChange={(e) => setGender(e.target.value as RegaliaGender)}>
                {GENDERS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </Select>
              <Input
                label="Size (S, M, L, XL, XXL or your measurement)"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="e.g. M"
              />
              <Input label="Ceremony date" type="date" value={ceremonyDate} onChange={(e) => setCeremonyDate(e.target.value)} required />
              <Select label="Pickup location" value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)}>
                {LOCATIONS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-brand-100 pt-5">
            <div>
              <p className="text-xs text-brand-400">
                {selectedItem ? selectedItem.name : `${regaliaLabel(category)} — ${mode === 'custom' ? 'custom design' : 'default fee'}`}
              </p>
              <p className="text-2xl font-bold text-brand-900">{formatTZS(price)}</p>
            </div>
            <Button onClick={() => void placeOrder()} loading={busy} disabled={!ceremonyDate} variant="accent" className="w-full sm:w-auto">
              <Shirt className="h-4 w-4" /> Place order
            </Button>
          </div>
        </Card>
      )}

      {/* my orders */}
      <div className="space-y-3">
        <SectionHeader title="My regalia orders" />
        {orders.length === 0 ? (
          <Card className="text-center text-sm text-brand-400">No regalia orders yet.</Card>
        ) : (
          orders.map((o) => (
            <Card key={o.id} className="flex flex-wrap items-center gap-4">
              {o.custom_design_url || o.catalog_item?.image_path ? (
                <img
                  src={o.custom_design_url ?? o.catalog_item!.image_path}
                  alt={o.item_type}
                  className="h-16 w-14 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-16 w-14 items-center justify-center rounded-lg bg-brand-50">
                  <Shirt className="h-6 w-6 text-gold-500" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-brand-900">{regaliaLabel(o.item_type)}</p>
                  {o.custom_name && <span className="text-sm text-gold-600">"{o.custom_name}"</span>}
                  <Badge status={o.status} />
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-brand-500">
                  {o.gender ? `${o.gender} · ` : ''}Size {o.size} · {o.ceremony_date} · {o.pickup_location}
                </p>
                {(o.custom_note || o.catalog_item?.name) && (
                  <p className="mt-0.5 text-xs text-brand-400">
                    {o.catalog_item?.name ?? ''}{o.custom_note ? ` — ${o.custom_note}` : ''}
                  </p>
                )}
                {o.agent?.full_name && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-brand-500">
                    <Shirt className="h-3.5 w-3.5" /> Prepared by: {o.agent.full_name}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-bold text-brand-900">{formatTZS(o.price)}</p>
                {o.status === 'ready_for_pickup' && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-gold-700">
                    <MapPin className="h-3.5 w-3.5" /> Ready at {o.pickup_location}
                  </p>
                )}
                {o.status === 'collected' && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Collected
                  </p>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* request more samples */}
      <div id="request-samples" className="scroll-mt-24">
        <Card>
        <div className="flex items-center gap-2">
          <ImagePlus className="h-5 w-5 text-gold-600" />
          <h3 className="text-base font-semibold text-brand-900">Request a different sample</h3>
        </div>
        <p className="mt-1 text-sm text-brand-500">
          Tell us what you have in mind — our team will get back to you with more options.
        </p>
        {requestSent ? (
          <Alert kind="success">Request sent. The team has been notified and will reach out with more samples.</Alert>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr_auto]">
            <Select label="Category" value={requestCategory} onChange={(e) => setRequestCategory(e.target.value as RegaliaCategory)}>
              {REGALIA_CATEGORIES.map((c) => (
                <option key={c} value={c}>{regaliaLabel(c)}</option>
              ))}
            </Select>
            <Input
              label="What are you looking for?"
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
              placeholder="e.g. burgundy sash with gold embroidery, slim-fit navy suit…"
            />
            <div className="flex items-end">
              <Button onClick={() => void sendSampleRequest()} loading={requestBusy} disabled={!requestNote.trim()} className="w-full">
                <Sparkles className="h-4 w-4" /> Send request
              </Button>
            </div>
          </div>
        )}
        </Card>
      </div>
    </div>
  )
}