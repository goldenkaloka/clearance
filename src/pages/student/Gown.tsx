import { useEffect, useState } from 'react'
import { Shirt, MapPin, CheckCircle2, FileText, UploadCloud, CreditCard } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast, extractFunctionsError } from '../../context/ToastContext'
import { Button, Input, Select, Card, Alert, Spinner, SectionHeader, Badge, PageHeader } from '../../components/ui'
import { formatTZS, normalizeTzPhone, isValidTzPhone, friendlyDbError, friendlyPaymentError } from '../../lib/utils'
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

const SIZES: { value: GownSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
]
const LOCATIONS = ['Main Campus', 'Masani Campus', 'Zanzibar Campus']

export default function StudentGown() {
  const { profile } = useAuth()
  const toast = useToast()

  const [fee, setFee] = useState<number | null>(null)
  const [order, setOrder] = useState<GownOrder | null>(null)
  const [loading, setLoading] = useState(true)

  const [size, setSize] = useState<GownSize>('medium')
  const [pickupLocation, setPickupLocation] = useState(LOCATIONS[0])
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [payPhone, setPayPhone] = useState(profile?.phone ?? '')

  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [sandboxMode, setSandboxMode] = useState(false)

  async function load() {
    if (!profile) return
    const [{ data: feeData }, { data: orders }] = await Promise.all([
      supabase.rpc('get_gown_fee'),
      supabase.from('gown_orders').select('*, agent:profiles!gown_orders_agent_id_fkey(full_name)').eq('student_user_id', profile.id).order('created_at', { ascending: false }).limit(1),
    ])
    setFee(Number(feeData ?? 10000))
    setOrder((orders?.[0] as GownOrder | undefined) ?? null)
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  useEffect(() => {
    if (profile?.phone && !payPhone) setPayPhone(profile.phone)
  }, [profile?.phone, payPhone])

  async function uploadReceipt(file: File): Promise<string | null> {
    if (file.type !== 'application/pdf') {
      const msg = 'Receipt must be a PDF file.'
      setError(msg)
      toast.error(msg)
      return null
    }
    if (file.size > 8 * 1024 * 1024) {
      const msg = 'PDF too large. Max 8MB.'
      setError(msg)
      toast.error(msg)
      return null
    }
    setUploading(true)
    setError(null)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${profile!.id}/gown-${Date.now()}-${safeName}`
    const { error: upErr } = await supabase.storage.from('student-documents').upload(path, file, { contentType: 'application/pdf', upsert: true })
    if (upErr) {
      const msg = `Upload failed: ${upErr.message}`
      setError(msg)
      toast.error(msg)
      setUploading(false)
      return null
    }
    const { data: urlData } = supabase.storage.from('student-documents').getPublicUrl(path)
    const url = urlData.publicUrl
    setReceiptUrl(url)
    setUploading(false)
    return url
  }

  async function placeOrder() {
    setError(null)
    let url = receiptUrl
    if (receiptFile && !url) {
      url = await uploadReceipt(receiptFile)
      if (!url) return
    }
    if (!url) {
      const msg = 'Upload your PDF receipt from the ARU control number.'
      setError(msg)
      toast.error(msg)
      return
    }
    setBusy(true)
    const { data, error } = await supabase.rpc('order_gown', {
      p_size: size,
      p_ceremony_date: null,
      p_pickup_location: pickupLocation,
      p_receipt_url: url,
    })
    if (error || !data) {
      const msg = error ? friendlyDbError(error, 'Could not place the gown order') : 'Could not place the gown order'
      setError(msg)
      toast.error(msg)
      setBusy(false)
      return
    }
    setOrder(data as GownOrder)
    const m = 'Receipt submitted. Now pay TZS 10,000 service fee to confirm your gown.'
    setNotice(m)
    toast.success(m)
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
      const friendly = friendlyPaymentError(extracted ?? data?.error, 'Payment could not be initiated. Try again.')
      setError(friendly)
      toast.error(friendly)
      setBusy(false)
      return
    }
    if (!data?.success) {
      const msg = friendlyPaymentError(data?.error, 'Payment could not be initiated.')
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
      <PageHeader title="Graduation gown" subtitle="Upload ARU control-number receipt, then pay TZS 10,000 service fee in-app" />

      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind={notice.includes('confirmed') || notice.includes('submitted') ? 'success' : 'info'}>{notice}</Alert>}

      <Card className="bg-white border-brand-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white"><Shirt className="h-5 w-5" /></span>
            <div>
              <h3 className="lux-label text-brand-500">Service fee</h3>
              <p className="text-2xl font-extrabold text-black">{fee ? formatTZS(fee) : '…'}</p>
            </div>
          </div>
          <p className="max-w-xs text-xs leading-relaxed text-brand-500">
            ARU control-number payment gives you the gown. Our TZS 10,000 fee is paid here after uploading the PDF receipt.
          </p>
        </div>
      </Card>

      {settled ? (
        <Card>
          <SectionHeader title="Your gown application" />
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
                <p className="text-lg font-semibold capitalize text-brand-900">{order!.size}</p>
                <Badge status={order!.status} />
              </div>
              <p className="flex items-center gap-1.5 text-sm text-brand-500">
                <MapPin className="h-3.5 w-3.5" /> Pickup: {order!.pickup_location}
              </p>
              {order!.receipt_url && (
                <a href={order!.receipt_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand-700 underline">
                  <FileText className="h-3.5 w-3.5" /> View PDF receipt
                </a>
              )}
              {order!.agent?.full_name && (
                <p className="flex items-center gap-1.5 text-sm text-brand-500">
                  <Shirt className="h-3.5 w-3.5" /> Prepared by: {order!.agent.full_name}
                </p>
              )}
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-brand-400">Service fee</p>
              <p className="font-bold text-brand-900">{formatTZS(order!.price)}</p>
            </div>
          </div>
          {order!.status === 'paid' && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">Payment verified — gown will be prepared.</p>}
          {order!.status === 'ready_for_pickup' && (
            <p className="mt-4 rounded-xl bg-gold-50 p-3 text-sm text-gold-700">Your gown is ready for pickup at {order!.pickup_location}. Bring a valid ID.</p>
          )}
          {order!.status === 'collected' && (
            <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">Gown collected. Congratulations, graduate!</p>
          )}
        </Card>
      ) : paying ? (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-brand-600" />
            <h3 className="text-sm font-semibold text-brand-900">Pay service fee — {fee ? formatTZS(fee) : 'TZS 10,000'}</h3>
          </div>
          <div className="mb-4 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 text-sm">
            <span className="text-brand-600">Size {order!.size} gown + receipt verified</span>
            <span className="font-bold text-brand-900">{formatTZS(order!.price)}</span>
          </div>
          <div className="mb-4">
            <Alert kind="warning">
              Make sure you have at least {formatTZS(order!.price + 2500)} in your wallet — your network adds its own service and government charges on top of the {formatTZS(order!.price)} fee.
            </Alert>
          </div>
          {order!.receipt_url && (
            <a href={order!.receipt_url} target="_blank" rel="noreferrer" className="mb-4 inline-flex items-center gap-1 text-sm text-brand-600 underline">
              <FileText className="h-4 w-4" /> View uploaded receipt
            </a>
          )}
          <div className="space-y-4">
            <Input label="Pay with phone number (M-Pesa / Tigo Pesa / Airtel Money)" type="tel" value={payPhone} onChange={(e) => setPayPhone(e.target.value)} placeholder="07XX XXX XXX" required />
            <Button onClick={() => void pay()} loading={busy} variant="success" className="w-full sm:w-auto">
              Pay {fee ? formatTZS(fee) : ''}
            </Button>
            {sandboxMode && (
              <Button onClick={() => void confirmSandbox()} loading={busy} variant="secondary" className="w-full sm:w-auto">
                Confirm payment (sandbox)
              </Button>
            )}
            <p className="text-xs text-brand-400">You will receive an STK/USSD prompt on the number above. This 10k is our service fee; ARU receipt already uploaded.</p>
          </div>
        </Card>
      ) : (
        <Card>
          <SectionHeader title="Apply for gown" subtitle="Select size, pickup, and upload PDF receipt from ARU control number" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Size" value={size} onChange={(e) => setSize(e.target.value as GownSize)} required>
              {SIZES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
            <Select label="Pickup location" value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} required>
              {LOCATIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </Select>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-normal text-brand-800">PDF receipt (ARU control number) *</label>
              <label className={`flex cursor-pointer items-center gap-3 rounded border px-3 py-3 text-sm ${receiptUrl ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-brand-200 bg-white text-brand-600 hover:border-brand-900'}`}>
                <UploadCloud className={`h-5 w-5 ${uploading ? 'animate-pulse' : ''}`} />
                <span className="truncate">{receiptFile ? receiptFile.name : receiptUrl ? 'PDF uploaded — click to change' : 'Choose PDF file'}</span>
                <input type="file" accept="application/pdf" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    setReceiptFile(f)
                    await uploadReceipt(f)
                  }
                  e.target.value = ''
                }} />
              </label>
              <p className="mt-1 text-xs text-brand-400">Only PDF, max 8MB</p>
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button onClick={() => void placeOrder()} loading={busy || uploading} variant="accent" className="w-full" disabled={!receiptUrl && !receiptFile}>
                Submit application <Shirt className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-brand-400">After submitting you will be redirected to pay TZS 10,000 here in the app.</p>
        </Card>
      )}
    </div>
  )
}
