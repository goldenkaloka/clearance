import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Info, CheckCircle2, Wallet, FileText } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { Button, Input, Select, Card, Alert, Spinner, SectionHeader } from '../../components/ui'
import { formatTZS } from '../../lib/utils'
import type { School, Programme } from '../../lib/types'

interface InitiateResult {
  success: boolean
  sandbox?: boolean
  paymentId?: string
  transaction_reference?: string
  amount?: number
  message?: string
  error?: string
}

export default function StudentApply() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [fee, setFee] = useState<number | null>(null)
  const [activeRequest, setActiveRequest] = useState<boolean | null>(null)

  const [regNumber, setRegNumber] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [programmeId, setProgrammeId] = useState('')
  const [schools, setSchools] = useState<School[]>([])
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [gradYear, setGradYear] = useState(String(new Date().getFullYear()))
  const [payPhone, setPayPhone] = useState(profile?.phone ?? '')

  const [stage, setStage] = useState<'form' | 'pay'>('form')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [requestNumber, setRequestNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sandboxMode, setSandboxMode] = useState(false)

  useEffect(() => {
    supabase.rpc('get_service_fee').then(({ data }) => setFee(Number(data)))
    supabase
      .from('schools')
      .select('*')
      .order('order')
      .then(({ data }) => setSchools((data ?? []) as School[]))
    supabase
      .from('programmes')
      .select('*')
      .order('order')
      .then(({ data }) => setProgrammes((data ?? []) as Programme[]))
    if (profile) {
      supabase
        .from('clearance_requests')
        .select('id, status')
        .eq('student_user_id', profile.id)
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .limit(1)
        .then(({ data }) => setActiveRequest((data?.length ?? 0) > 0))
    }
  }, [profile])

  if (activeRequest === true) {
    return (
      <div className="mx-auto max-w-md">
        <Card className="text-center">
          <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-500" />
          <h2 className="text-lg font-bold text-slate-900">You already have an active request</h2>
          <p className="mt-1 text-sm text-slate-500">Track its progress from your dashboard.</p>
          <Button className="mt-4 w-full" onClick={() => navigate('/student')}>Go to dashboard</Button>
        </Card>
      </div>
    )
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { data, error } = await supabase.rpc('apply_clearance', {
      p_registration_number: regNumber,
      p_programme_id: programmeId || null,
      p_school_id: schoolId || null,
      p_graduation_year: parseInt(gradYear, 10),
    })
    if (error || !data) {
      setError(error?.message ?? 'Could not create request')
      setLoading(false)
      return
    }
    setRequestId((data as { id: string }).id)
    setRequestNumber((data as { request_number: string }).request_number)
    setStage('pay')
    setLoading(false)
    await refreshProfile()
  }

  async function pay() {
    setError(null)
    setNotice(null)
    setLoading(true)
    const { data, error } = await supabase.functions.invoke<InitiateResult>('initiate-payment', {
      body: { request_id: requestId, phone: payPhone },
    })
    if (error || !data?.success) {
      setError(data?.error ?? error?.message ?? 'Payment could not be initiated')
      setLoading(false)
      return
    }
    if (data.sandbox && data.transaction_reference) {
      setSandboxMode(true)
      setNotice('Sandbox mode: simulate the gateway confirming your payment below.')
    } else {
      setNotice(data.message ?? 'Payment request sent to your phone. Complete it on your device.')
    }
    setLoading(false)
  }

  async function confirmSandbox() {
    setLoading(true)
    setError(null)
    const { data: p } = await supabase.from('payments').select('transaction_reference').eq('request_id', requestId!).limit(1)
    const ref = p?.[0]?.transaction_reference
    if (!ref) {
      setError('No pending payment found. Try initiating the payment again.')
      setLoading(false)
      return
    }
    const { error: webhookErr } = await supabase.functions.invoke('clickpesa-webhook', {
      body: { test_key: 'clearance-test-key', transaction_reference: ref, status: 'paid' },
    })
    if (webhookErr) {
      setError(webhookErr.message)
      setLoading(false)
      return
    }
    setNotice('Payment confirmed! Your request is now active.')
    setLoading(false)
    setTimeout(() => navigate('/student'), 1500)
  }

  if (activeRequest === null) return <Spinner />

  const steps = ['Details', 'Payment']

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <Card className="!p-4">
        <div className="flex items-center justify-center gap-3">
          {steps.map((s, i) => {
            const current = (stage === 'form' && i === 0) || (stage === 'pay' && i === 1)
            const done = i === 0 && stage === 'pay'
            return (
              <div key={s} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      done ? 'bg-emerald-500 text-white' : current ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className={`text-sm font-semibold ${current || done ? 'text-slate-900' : 'text-slate-400'}`}>{s}</span>
                </div>
                {i < steps.length - 1 && <div className={`h-0.5 w-8 rounded ${done ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {stage === 'form' ? (
            <>
              <Card>
                <div className="mb-4 flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-xs leading-relaxed text-brand-800">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    This is a <b>private assistance service</b>. We are not affiliated with Ardhi University, and final
                    clearance approval rests with the university offices.
                  </p>
                </div>

                {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

                <SectionHeader title="Student details" subtitle="We need these to identify you with the university offices" />
                <form onSubmit={submitForm} className="space-y-4">
                  <Input label="Registration number" value={regNumber} onChange={(e) => setRegNumber(e.target.value)} placeholder="e.g. ARU/0001/2022" required />
                  <Select
                    label="School"
                    value={schoolId}
                    onChange={(e) => {
                      setSchoolId(e.target.value)
                      setProgrammeId('')
                    }}
                    required
                  >
                    <option value="">Select your school…</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                  <Select label="Programme" value={programmeId} onChange={(e) => setProgrammeId(e.target.value)} required>
                    <option value="">Select your programme…</option>
                    {programmes
                      .filter((p) => p.school_id === schoolId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                  </Select>
                  <Input label="Graduation year" type="number" value={gradYear} onChange={(e) => setGradYear(e.target.value)} min={2000} max={2100} required />
                  <Button type="submit" loading={loading} variant="accent" className="w-full sm:w-auto">Continue to payment <FileText className="h-4 w-4" /></Button>
                </form>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <SectionHeader title="Mobile money payment" subtitle="Pay securely via M-Pesa, Tigo Pesa or Airtel Money" />
                {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
                {notice && <div className="mb-4"><Alert kind={notice.includes('confirmed') ? 'success' : 'info'}>{notice}</Alert></div>}
                <div className="space-y-4">
                  <Input
                    label="Pay with phone number (M-Pesa / Tigo Pesa / Airtel Money)"
                    type="tel"
                    value={payPhone}
                    onChange={(e) => setPayPhone(e.target.value)}
                    placeholder="07XX XXX XXX"
                    required
                  />
                  <Button onClick={() => void pay()} loading={loading} variant="success" className="w-full sm:w-auto">
                    Pay {fee ? formatTZS(fee) : ''}
                  </Button>
                  {sandboxMode && (
                    <Button onClick={() => void confirmSandbox()} loading={loading} variant="secondary" className="w-full sm:w-auto">
                      Confirm payment (sandbox)
                    </Button>
                  )}
                  <p className="text-xs text-slate-400">
                    You will receive an STK/USSD prompt on the number above. Confirm it to complete payment.
                  </p>
                </div>
              </Card>
            </>
          )}
        </div>

        {/* Fee summary sidebar */}
        <div className="space-y-4">
          <Card className="!border-0 bg-black text-[#f8f8f8]">
            <div className="mb-2 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-gold-400" />
              <h3 className="lux-label text-gold-400">Fee summary</h3>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-[#b4b4b4]">Service fee</p>
                <p className="text-2xl font-extrabold">{fee ? formatTZS(fee) : '…'}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[#b4b4b4]">
              One-time fee for the full clearance assistance, paid once by mobile money.
            </p>
          </Card>

          {stage === 'pay' && requestNumber && (
            <Card>
              <p className="text-xs text-slate-400">Your request</p>
              <p className="font-mono text-lg font-bold text-slate-900">{requestNumber}</p>
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
                <span className="text-slate-500">Service fee</span>
                <span className="font-bold text-slate-900">{fee ? formatTZS(fee) : '…'}</span>
              </div>
            </Card>
          )}

          <Card className="bg-slate-50">
            <p className="text-xs leading-relaxed text-slate-500">
              What happens next? After payment is confirmed, an agent is assigned and your clearance stages begin.
              You'll get notified at every step.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}