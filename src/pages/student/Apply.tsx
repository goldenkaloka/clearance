import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Info,
  CheckCircle2,
  Wallet,
  FileText,
  RefreshCw,
  AlertTriangle,
  Loader2,
  ListChecks,
  Smartphone,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast, extractFunctionsError } from '../../context/ToastContext'
import {
  Button,
  Input,
  Select,
  Card,
  Spinner,
  SectionHeader,
} from '../../components/ui'
import { formatTZS, normalizeTzPhone, isValidTzPhone, friendlyDbError, friendlyPaymentError, clearanceFeeBreakdown } from '../../lib/utils'
import { useSchools } from '../../hooks/useSchools'

interface ExistingRequest {
  id: string
  status: string
  request_number: string
}

interface InitiatePaymentResult {
  success: boolean
  sandbox?: boolean
  paymentId?: string
  transaction_reference?: string
  amount?: number
  message?: string
  error?: string
}

type PaymentStatus =
  | 'idle'
  | 'pending'
  | 'paid'
  | 'failed'

/*
 * Unified status feed: every message, warning and notice on this page
 * renders through FeedItem so feedback is always visible, consistently
 * styled, and slides in with an animation. Parent components pass a `key`
 * so each new message replays the entry animation.
 */
type FeedKind = 'info' | 'warning' | 'error' | 'success'

const FEED_STYLES: Record<FeedKind, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
}

const FEED_ICONS = {
  info: Info,
  warning: AlertTriangle,
  error: AlertTriangle,
  success: CheckCircle2,
}

function FeedItem({ kind, children }: { kind: FeedKind; children: ReactNode }) {
  const Icon = FEED_ICONS[kind]
  return (
    <div className={`msg-in flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-relaxed ${FEED_STYLES[kind]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  )
}

function StatusPill({ status }: { status: PaymentStatus }) {
  if (status === 'paid') {
    return (
      <span className="pop-in inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5" /> Paid
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="pop-in inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
        <AlertTriangle className="h-3.5 w-3.5" /> Failed
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
        <span className="relative flex h-2 w-2">
          <span className="dot-ping absolute inline-flex h-full w-full rounded-full bg-amber-500" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
        Waiting for confirmation
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
      Ready to pay
    </span>
  )
}

function WaitingBar() {
  return (
    <div className="msg-in overflow-hidden rounded-xl border border-brand-200 bg-white">
      <div className="flex items-center gap-2.5 px-3.5 pt-3 text-sm text-brand-800">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gold-600" />
        <p>Confirm the prompt on your phone — we check for confirmation automatically.</p>
      </div>
      <div className="px-3.5 pb-3 pt-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-brand-100">
          <div className="shimmer-bar h-full w-2/5 rounded-full bg-gold-500" />
        </div>
      </div>
    </div>
  )
}

function SuccessCheck() {
  return (
    <span className="relative mx-auto flex h-20 w-20 items-center justify-center">
      <span className="ring-expand absolute inset-0 rounded-full bg-emerald-200" />
      <span className="ring-expand-delay absolute inset-0 rounded-full bg-emerald-200" />
      <span className="pop-in relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500">
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-white" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path className="check-draw" d="M4 12.5l5 5L20 6.5" />
        </svg>
      </span>
    </span>
  )
}

export default function StudentApply() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [fee, setFee] = useState<number | null>(null)

  const [existingRequest, setExistingRequest] =
    useState<ExistingRequest | null>(null)

  const [checkingRequest, setCheckingRequest] =
    useState(true)

  const [regNumber, setRegNumber] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [programmeId, setProgrammeId] = useState('')

  const { schools, programmes } = useSchools()

  const [gradYear, setGradYear] = useState(
    String(new Date().getFullYear()),
  )

  const [payPhone, setPayPhone] = useState(
    profile?.phone ?? '',
  )

  const [passportFile, setPassportFile] = useState<File | null>(null)
  const [passportUrl, setPassportUrl] = useState<string | null>(null)
  const [uploadingPassport, setUploadingPassport] = useState(false)

  const [stage, setStage] = useState<'form' | 'pay'>(
    'form',
  )

  const [requestId, setRequestId] =
    useState<string | null>(null)

  const [requestNumber, setRequestNumber] =
    useState('')

  const [paymentStatus, setPaymentStatus] =
    useState<PaymentStatus>('idle')

  const [error, setError] =
    useState<string | null>(null)

  const [notice, setNotice] =
    useState<string | null>(null)

  const [loading, setLoading] = useState(false)

  /*
   * Dedicated Pay-button state: tapping Pay must never freeze the
   * rest of the page. `loading` stays for the form/sandbox actions.
   */
  const [paying, setPaying] = useState(false)

  const [sandboxMode, setSandboxMode] =
    useState(false)

  /*
   * Keep the phone field synchronized with the
   * authenticated profile when the profile loads.
   */
  useEffect(() => {
    if (profile?.phone && !payPhone) {
      setPayPhone(profile.phone)
    }
  }, [profile?.phone])

  /*
   * Load:
   * - service fee
   * - student's academic profile (single-source)
   * - student's latest unfinished request
   *
   * payment_pending is NOT considered an active request.
   * It is a request that needs payment/resumption.
   */
  useEffect(() => {
    let mounted = true

    async function load() {
      setCheckingRequest(true)

      const feeResult = await supabase.rpc('get_service_fee')

      if (!mounted) return

      if (feeResult.error) {
        console.error('Failed to load service fee:', feeResult.error)
      } else if (feeResult.data != null) {
        setFee(Number(feeResult.data))
      }

      if (!profile) {
        setCheckingRequest(false)
        return
      }

      // single-source: prefill academic fields from student_profiles so Apply doesn't re-ask
      const { data: sp } = await supabase.from('student_profiles').select('*').eq('user_id', profile.id).maybeSingle()
      if (mounted && sp) {
        if (sp.registration_number) setRegNumber(sp.registration_number)
        if (sp.school_id) setSchoolId(sp.school_id)
        if (sp.programme_id) setProgrammeId(sp.programme_id)
        if (sp.graduation_year) setGradYear(String(sp.graduation_year))
      }

      const { data, error } = await supabase
        .from('clearance_requests')
        .select(
          'id, status, request_number',
        )
        .eq(
          'student_user_id',
          profile.id,
        )
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .order('created_at', {
          ascending: false,
        })
        .limit(1)
        .maybeSingle()

      if (!mounted) return

      if (error) {
        console.error(
          'Failed to check existing request:',
          error,
        )

        setCheckingRequest(false)
        return
      }

      if (data) {
        const request =
          data as ExistingRequest

        setExistingRequest(request)

        /*
         * Existing request waiting for payment.
         *
         * Resume directly at payment instead of
         * showing "You already have an active request".
         */
        if (
          request.status ===
          'payment_pending'
        ) {
          setRequestId(request.id)
          setRequestNumber(
            request.request_number,
          )
          setStage('pay')

          /*
           * Look for the latest payment.
           *
           * IMPORTANT:
           * A pending payment does NOT disable
           * the payment button.
           */
          const {
            data: payment,
            error: paymentError,
          } = await supabase
            .from('payments')
            .select('status')
            .eq(
              'request_id',
              request.id,
            )
            .eq(
              'kind',
              'service_fee',
            )
            .order('created_at', {
              ascending: false,
            })
            .limit(1)
            .maybeSingle()

          if (!mounted) return

          if (paymentError) {
            console.error(
              'Failed to check payment:',
              paymentError,
            )
          }

          if (
            payment?.status ===
            'paid'
          ) {
            setPaymentStatus('paid')

            setNotice(
              'Payment confirmed! Your request is now active.',
            )
          } else if (
            payment?.status ===
              'pending' ||
            payment?.status ===
              'processing'
          ) {
            /*
             * Keep the status as pending for
             * information purposes, but the Pay
             * button remains enabled.
             */
            setPaymentStatus('pending')
          } else if (
            payment?.status ===
              'failed' ||
            payment?.status ===
              'cancelled' ||
            payment?.status ===
              'expired'
          ) {
            setPaymentStatus('failed')

            setNotice(
              'The previous payment attempt was not completed. Enter the phone number and try again.',
            )
          }
        }
      }

      setCheckingRequest(false)
    }

    void load()

    return () => {
      mounted = false
    }
  }, [profile])

  /*
   * Poll the latest payment status.
   *
   * This does NOT initiate payments.
   * It only watches for the backend/webhook
   * to mark the payment as paid.
   */
  useEffect(() => {
    if (
      !requestId ||
      stage !== 'pay'
    ) {
      return
    }

    /*
     * Terminal states freeze everything: no more polling, no more
     * motion. A fresh tap on Pay flips back to pending and restarts
     * the loop below via the paymentStatus dependency.
     */
    if (
      paymentStatus === 'paid' ||
      paymentStatus === 'failed'
    ) {
      return
    }

    let active = true
    let attempts = 0

    async function checkPaymentStatus() {
      const {
        data,
        error,
      } = await supabase
        .from('payments')
        .select('id, status')
        .eq(
          'request_id',
          requestId,
        )
        .eq(
          'kind',
          'service_fee',
        )
        .order('created_at', {
          ascending: false,
        })
        .limit(1)
        .maybeSingle()

      if (!active) return

      if (error) {
        console.error(
          'Failed to check payment status:',
          error,
        )
        return
      }

      if (!data) return

      switch (data.status) {
        case 'paid':
          setPaymentStatus('paid')

          setNotice(
            'Payment confirmed! Your request is now active.',
          )
          break

        case 'pending':
          setPaymentStatus('pending')
          break

        case 'processing': {
          setPaymentStatus('pending')

          /*
           * A payment that is 'processing' has been pushed
           * to ClickPesa. The provider does not reliably
           * deliver its webhook, so reconcile directly with
           * ClickPesa's query API instead of waiting forever.
           */
          const {
            data: sync,
          } = await supabase.functions.invoke<{
            status?: string
          }>('payment-status', {
            body: {
              payment_id: data.id,
            },
          })

          if (!active) return

          if (
            sync?.status === 'paid'
          ) {
            setPaymentStatus('paid')

            setNotice(
              'Payment confirmed! Your request is now active.',
            )
          } else if (
            sync?.status === 'failed'
          ) {
            setPaymentStatus('failed')

            setNotice(
              'The payment was not completed. You can try again with the phone number below.',
            )
          }
          break
        }

        case 'failed':
        case 'cancelled':
        case 'expired':
          setPaymentStatus('failed')

          setNotice(
            'The payment was not completed. You can try again with the phone number below.',
          )
          break

        default:
          break
      }
    }

    void checkPaymentStatus()

    const interval =
      window.setInterval(() => {
        attempts += 1
        /*
         * ~2 minutes with no confirmation: the USSD prompt has
         * expired on the phone. Stop polling and settle the UI
         * into failed (local state only — the DB row is untouched,
         * so a late webhook success still lands correctly).
         */
        if (attempts >= 40) {
          window.clearInterval(interval)
          if (!active) return
          setPaymentStatus('failed')
          setNotice(
            'No confirmation received — the prompt likely expired. Send a new payment prompt to try again.',
          )
          return
        }
        void checkPaymentStatus()
      }, 3000)

    return () => {
      active = false
      window.clearInterval(
        interval,
      )
    }
  }, [requestId, stage, paymentStatus])

  if (checkingRequest) {
    return <Spinner />
  }

  /*
   * IMPORTANT:
   *
   * Only a genuinely active request blocks
   * the student from creating another one.
   *
   * payment_pending is NOT blocked because
   * the student needs to be able to complete
   * payment.
   */
  if (
    existingRequest &&
    existingRequest.status !==
      'payment_pending'
  ) {
    return (
      <div className="mx-auto max-w-md">
        <Card className="text-center">
          <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-500" />

          <h2 className="text-lg font-bold text-slate-900">
            You already have an active request
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Track its progress from your dashboard.
          </p>

          <Button
            className="mt-4 w-full"
            onClick={() =>
              navigate('/student')
            }
          >
            Go to dashboard
          </Button>
        </Card>
      </div>
    )
  }

  /*
   * Create clearance request.
   */
  async function uploadPassportNow(file: File): Promise<string | null> {
    if (!file.type.startsWith('image/')) {
      const m = 'Passport photo must be an image (JPG/PNG).'
      setError(m)
      toast.error(m)
      return null
    }
    if (file.size > 5 * 1024 * 1024) {
      const m = 'Image too large. Max 5MB.'
      setError(m)
      toast.error(m)
      return null
    }
    setUploadingPassport(true)
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${profile!.id}/passport-${Date.now()}-${safe}`
    const { error: upErr } = await supabase.storage.from('student-documents').upload(path, file, { contentType: file.type, upsert: true })
    if (upErr) {
      const m = `Upload failed: ${upErr.message}`
      setError(m)
      toast.error(m)
      setUploadingPassport(false)
      return null
    }
    const { data: urlData } = supabase.storage.from('student-documents').getPublicUrl(path)
    setPassportUrl(urlData.publicUrl)
    setUploadingPassport(false)
    return urlData.publicUrl
  }

  async function submitForm(
    e: React.FormEvent,
  ) {
    e.preventDefault()

    setError(null)
    setNotice(null)

    // ensure passport
    let url = passportUrl
    if (passportFile && !url) {
      url = await uploadPassportNow(passportFile)
      if (!url) return
    }
    if (!url) {
      const m = 'Passport size photo is required.'
      setError(m)
      toast.error(m)
      return
    }

    setLoading(true)

    const {
      data,
      error,
    } = await supabase.rpc(
      'apply_clearance',
      {
        p_registration_number:
          regNumber.trim(),
        p_programme_id:
          programmeId || null,
        p_school_id:
          schoolId || null,
        p_graduation_year:
          parseInt(
            gradYear,
            10,
          ),
        p_passport_photo_url: url,
      },
    )

    if (error || !data) {
      const msg = error
        ? friendlyDbError(error, 'Could not create clearance request.')
        : 'Could not create clearance request.'
      setError(msg)
      toast.error(msg)

      setLoading(false)
      return
    }

    const request =
      data as {
        id: string
        request_number: string
      }

    setRequestId(request.id)

    setRequestNumber(
      request.request_number,
    )

    setExistingRequest({
      id: request.id,
      request_number:
        request.request_number,
      status: 'payment_pending',
    })

    /*
     * New request has not had a payment
     * initiated yet.
     */
    setPaymentStatus('idle')
    setSandboxMode(false)

    setStage('pay')

    setLoading(false)

    await refreshProfile()
  }

  /*
   * Normalize Tanzania phone numbers.
   *
   * 0712345678
   *     -> 255712345678
   *
   * +255712345678
   *     -> 255712345678
   *
   * 255712345678
   *     -> 255712345678 (now centralized in lib/utils: normalizeTzPhone)
   */

  /*
   * Initiate mobile-money payment.
   *
   * IMPORTANT:
   *
   * This function ALWAYS requires a phone
   * before calling the Edge Function.
   *
   * A pending payment does NOT prevent
   * another initiation attempt.
   */
   async function pay() {
    if (!requestId) {
      const msg = 'No clearance request is available for payment.'
      setError(msg)
      toast.error(msg)
      return
    }

    const rawPhone =
      payPhone.trim()

    if (!rawPhone) {
      const msg = 'Please enter the phone number you want to use for payment.'
      setError(msg)
      toast.error(msg)
      return
    }

    const phone = normalizeTzPhone(rawPhone)

    if (!isValidTzPhone(phone)) {
      const msg = 'Enter a valid Tanzania mobile number, for example 0712 345 678.'
      setError(msg)
      toast.error(msg)
      return
    }

    setError(null)

    /*
     * Instant feedback: the initiate call can take several seconds
     * (ClickPesa round-trips), so say something immediately instead
     * of leaving a dead page. Replaced by the real result below.
     */
    setNotice(`Sending payment prompt to ${rawPhone}…`)

    /*
     * paying controls only the Pay button.
     *
     * paymentStatus does NOT disable it.
     */
    setPaying(true)

    try {
      const {
        data,
        error,
      } =
        await supabase.functions.invoke<InitiatePaymentResult>(
          'initiate-payment',
          {
            body: {
              request_id:
                requestId,
              phone,
            },
          },
        )

      if (error) {
        const extracted = await extractFunctionsError(error)
        const friendly = friendlyPaymentError(
          extracted ?? data?.error,
          'Payment could not be initiated. Try again.',
        )
        setPaymentStatus('failed')
        setError(friendly)
        toast.error(friendly)
        return
      }

      if (!data?.success) {
        const msg = friendlyPaymentError(data?.error, 'Payment could not be initiated.')
        setPaymentStatus('failed')
        setError(msg)
        toast.error(msg)
        return
      }

      /*
       * Initiation succeeded.
       *
       * This DOES NOT mean payment succeeded.
       */
      setPaymentStatus('pending')

      if (
        data.sandbox &&
        data.transaction_reference
      ) {
        setSandboxMode(true)
        const m =
          'Sandbox payment request created. Use the sandbox confirmation button below to simulate payment completion.'
        setNotice(m)
        toast.success(m)
      } else {
        setSandboxMode(false)
        const m =
          data.message ??
          'Payment request sent. Check your phone and enter your mobile-money PIN.'
        setNotice(m)
        toast.success(m)
      }
    } catch (err) {
      console.error(
        'Payment initiation error:',
        err,
      )

      const msg = friendlyPaymentError(
        err instanceof Error ? err.message : '',
        'Payment could not be initiated.',
      )
      setPaymentStatus('failed')
      setError(msg)
      toast.error(msg)
    } finally {
      setPaying(false)
    }
  }

  /*
   * Sandbox-only helper.
   */
  async function confirmSandbox() {
    if (!requestId) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const {
        data,
        error,
      } = await supabase
        .from('payments')
        .select(
          'transaction_reference',
        )
        .eq(
          'request_id',
          requestId,
        )
        .eq(
          'kind',
          'service_fee',
        )
        .order('created_at', {
          ascending: false,
        })
        .limit(1)

      if (error) {
        setError(error.message)
        toast.error(error.message)
        return
      }

      const reference =
        data?.[0]
          ?.transaction_reference

      if (!reference) {
        const msg = 'No pending payment found. Try initiating the payment again.'
        setError(msg)
        toast.error(msg)
        return
      }

      const {
        error: webhookError,
      } =
        await supabase.functions.invoke(
          'clickpesa-webhook',
          {
            body: {
              test_key:
                'clearance-test-key',
              transaction_reference:
                reference,
              status: 'paid',
            },
          },
        )

      if (webhookError) {
        const msg =
          (await extractFunctionsError(webhookError)) ??
          webhookError.message
        setError(msg)
        toast.error(msg)
        return
      }

      setPaymentStatus('paid')
      const msg = 'Payment confirmed! Your request is now active.'
      setNotice(msg)
      toast.success(msg)

      window.setTimeout(
        () => {
          navigate(
            '/student',
          )
        },
        1500,
      )
    } catch (err) {
      console.error(
        'Sandbox confirmation error:',
        err,
      )

      const msg =
        err instanceof Error
          ? err.message
          : 'Could not confirm sandbox payment.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    'Details',
    'Payment',
  ]

  return (
    <div className="space-y-4">
      {/* Progress */}
      <Card className="!p-4">
        <div className="flex items-center justify-center gap-3">
          {steps.map(
            (
              step,
              index,
            ) => {
              const current =
                (stage ===
                  'form' &&
                  index === 0) ||
                (stage ===
                  'pay' &&
                  index === 1)

              const done =
                index === 0 &&
                stage === 'pay'

              /*
               * Terminal payment states (paid / failed) freeze all
               * looping animations: nothing left to wait for, so the
               * step indicator stays highlighted but stops glowing.
               */
              const settled =
                paymentStatus === 'paid' ||
                paymentStatus === 'failed'

              return (
                <div
                  key={step}
                  className="flex items-center gap-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                        done
                          ? 'bg-emerald-500 text-white'
                          : current
                            ? `bg-brand-600 text-white${settled ? '' : ' step-current'}`
                            : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        index + 1
                      )}
                    </span>

                    <span
                      className={`text-sm font-semibold ${
                        current ||
                        done
                          ? 'text-slate-900'
                          : 'text-slate-400'
                      }`}
                    >
                      {step}
                    </span>
                  </div>

                  {index <
                    steps.length -
                      1 && (
                    <div
                      className={`h-0.5 w-8 rounded ${
                        done
                          ? 'bg-emerald-500'
                          : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>
              )
            },
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* DETAILS */}
          {stage ===
          'form' ? (
            <Card>
              <div className="mb-4 space-y-2.5">
                <FeedItem key="private-service" kind="info">
                  <p>
                    This is a{' '}
                    <b>
                      private assistance service
                    </b>
                    . We are not affiliated
                    with Ardhi University,
                    and final clearance
                    approval rests with the
                    university offices.
                  </p>
                </FeedItem>

                {error && (
                  <FeedItem key={error} kind="error">
                    {error}
                  </FeedItem>
                )}
              </div>

              <SectionHeader
                title="Student details"
                subtitle="We need these to identify you with the university offices"
              />

              <form
                onSubmit={
                  submitForm
                }
                className="space-y-4"
              >
                <Input
                  label="Registration number"
                  value={
                    regNumber
                  }
                  onChange={(
                    e,
                  ) =>
                    setRegNumber(
                      e.target
                        .value,
                    )
                  }
                  placeholder="e.g. ARU/0001/2022"
                  required
                />

                <Select
                  label="School"
                  value={
                    schoolId
                  }
                  onChange={(
                    e,
                  ) => {
                    setSchoolId(
                      e.target
                        .value,
                    )
                    setProgrammeId(
                      '',
                    )
                  }}
                  required
                >
                  <option value="">
                    Select your school…
                  </option>

                  {schools.map(
                    (
                      school,
                    ) => (
                      <option
                        key={
                          school.id
                        }
                        value={
                          school.id
                        }
                      >
                        {
                          school.name
                        }
                      </option>
                    ),
                  )}
                </Select>

                <Select
                  label="Programme"
                  value={
                    programmeId
                  }
                  onChange={(
                    e,
                  ) =>
                    setProgrammeId(
                      e.target
                        .value,
                    )
                  }
                  required
                >
                  <option value="">
                    Select your programme…
                  </option>

                  {programmes
                    .filter(
                      (
                        programme,
                      ) =>
                        programme.school_id ===
                        schoolId,
                    )
                    .map(
                      (
                        programme,
                      ) => (
                        <option
                          key={
                            programme.id
                          }
                          value={
                            programme.id
                          }
                        >
                          {
                            programme.name
                          }
                        </option>
                      ),
                    )}
                </Select>

                <Input
                  label="Graduation year"
                  type="number"
                  value={
                    gradYear
                  }
                  onChange={(
                    e,
                  ) =>
                    setGradYear(
                      e.target
                        .value,
                    )
                  }
                  min={2000}
                  max={2100}
                  required
                />

                <div>
                  <label className="mb-1.5 block text-sm font-normal text-brand-800">Passport size photo *</label>
                  {passportUrl ? (
                    <div className="flex items-center gap-4 rounded border border-emerald-200 bg-emerald-50 p-3">
                      <img src={passportUrl} alt="Passport preview" className="h-16 w-16 rounded object-cover" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-emerald-700">Photo uploaded</p>
                        <button type="button" onClick={() => { setPassportUrl(null); setPassportFile(null) }} className="text-xs text-brand-600 underline">Change</button>
                      </div>
                    </div>
                  ) : (
                    <label className={`flex cursor-pointer items-center gap-3 rounded border px-3 py-3 text-sm ${uploadingPassport ? 'border-brand-200 bg-brand-50' : 'border-brand-200 bg-white hover:border-brand-900'}`}>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-600">📷</span>
                      <span className="flex-1 truncate">{passportFile ? passportFile.name : 'Choose JPG/PNG, max 5MB'}</span>
                      <input type="file" accept="image/jpeg,image/png,image/jpg" className="hidden" onChange={async (e) => {
                        const f = e.target.files?.[0]
                        if (f) {
                          setPassportFile(f)
                          setError(null)
                          await uploadPassportNow(f)
                        }
                        e.target.value = ''
                      }} />
                    </label>
                  )}
                </div>

                <Button
                  type="submit"
                  loading={
                    loading || uploadingPassport
                  }
                  variant="accent"
                  className="w-full sm:w-auto"
                >
                  Continue to payment{fee ? ` — ${formatTZS(fee)}` : ''} <FileText className="h-4 w-4" />
                </Button>
              </form>
            </Card>
          ) : (
            /* PAYMENT */
            <Card>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <SectionHeader
                    title="Mobile money payment"
                    subtitle={`Pay ${fee ? formatTZS(fee) : ''} via mobile money`}
                  />
                </div>
                <StatusPill status={paymentStatus} />
              </div>

              {requestNumber && (
                <div className="msg-in mb-4 flex items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-2.5 text-sm">
                  <span className="text-brand-500">Your request</span>
                  <span className="font-mono font-bold text-brand-900">{requestNumber}</span>
                </div>
              )}

              <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm">
                <div className="mb-2 flex items-center gap-2 font-medium text-brand-700">
                  <Wallet className="h-4 w-4" /> Fee breakdown
                </div>
                <dl className="space-y-1.5">
                  {fee !== null &&
                    clearanceFeeBreakdown(fee).map((line) => (
                      <div key={line.label} className="flex items-center justify-between gap-3">
                        <dt className="text-slate-600">{line.label}</dt>
                        <dd className="font-semibold text-slate-900">{formatTZS(line.amount)}</dd>
                      </div>
                    ))}
                </dl>
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-brand-100 pt-2">
                  <span className="font-semibold text-brand-700">Total</span>
                  <span className="text-lg font-extrabold text-brand-900">{fee ? formatTZS(fee) : '…'}</span>
                </div>
              </div>
              <div className="mb-4 overflow-hidden rounded-xl border border-brand-100">
                <div className="flex items-center gap-2 border-b border-brand-100 bg-brand-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-brand-500">
                  <ListChecks className="h-4 w-4" /> Before you pay
                </div>
                <ul className="space-y-2.5 px-4 py-3 text-sm leading-relaxed text-slate-600">
                  <li className="flex items-start gap-2 rounded-lg bg-rose-50 px-2.5 py-2 text-rose-800">
                    <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    <span>
                      <b>M-Pesa is not available.</b>
                    </span>
                  </li>
                  {fee !== null && (
                    <li className="flex items-start gap-2">
                      <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                      <span>
                        hakikisha una kiasi kisichopungua <b className="text-yellow-800 ">{formatTZS(fee + 1500)}</b> kwa ajili ya makato.
                      </span>
                    </li>
                  )}
                </ul>
              </div>

              {error && (
                <div className="mb-4 space-y-2.5">
                  <FeedItem key={error} kind="error">
                    {error}
                  </FeedItem>
                </div>
              )}

              {notice && paymentStatus !== 'paid' && (
                <div className="mb-4 space-y-2.5">
                  <FeedItem key={notice} kind={paymentStatus === 'failed' ? 'error' : 'info'}>
                    {notice}
                  </FeedItem>
                </div>
              )}

              {paymentStatus === 'pending' && (
                <div className="mb-4">
                  <WaitingBar />
                </div>
              )}

              {/* SUCCESS */}
              {paymentStatus ===
              'paid' ? (
                <div className="pop-in rounded-2xl bg-emerald-50 p-6 text-center">
                  <SuccessCheck />

                  <h3 className="mt-3 font-bold text-emerald-900">
                    Payment successful
                  </h3>

                  <p className="mt-1 text-sm text-emerald-700">
                    Your clearance
                    request has
                    been activated.
                  </p>

                  <Button
                    className="mt-4 w-full"
                    onClick={() =>
                      navigate(
                        '/student',
                      )
                    }
                  >
                    Go to dashboard
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Input
                      label="Pay with phone number"
                      type="tel"
                      value={
                        payPhone
                      }
                      onChange={(
                        e,
                      ) => {
                        setPayPhone(
                          e.target
                            .value,
                        )

                        /*
                         * If the student changes
                         * the phone, don't leave
                         * the UI looking like the
                         * old payment is tied to
                         * this new number.
                         */
                        if (
                          paymentStatus ===
                          'pending'
                        ) {
                          setNotice(
                            'Phone number changed. You can send a new payment prompt using this number.',
                          )
                        }
                      }}
                      placeholder="07XX XXX XXX"
                      required
                    />

                    <p className="mt-1 text-xs text-slate-400">
                      Enter the number that should
                      receive the USSD prompt.
                    </p>
                  </div>

                  {/* 
                   * IMPORTANT:
                   *
                   * DO NOT use:
                   *
                   * disabled={
                   *   paymentStatus === 'pending'
                   * }
                   *
                   * A pending payment must not lock
                   * the student out of the payment flow.
                   */}
                  <Button
                    onClick={() =>
                      void pay()
                    }
                    loading={
                      paying
                    }
                    variant="success"
                    className="w-full sm:w-auto"
                  >
                    {paymentStatus ===
                    'pending'
                      ? 'Send payment prompt again'
                      : `Pay ${
                          fee
                            ? formatTZS(
                                fee,
                              )
                            : ''
                        }`}
                  </Button>

                  {paymentStatus ===
                    'pending' && (
                    <div className="msg-in flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                      <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />

                      <p>
                        No prompt yet?
                        Verify the
                        number above,
                        then tap
                        <b>
                          {' '}
                          Send payment
                          prompt again
                        </b>
                        .
                      </p>
                    </div>
                  )}

                  {sandboxMode && (
                    <Button
                      onClick={() =>
                        void confirmSandbox()
                      }
                      loading={
                        loading
                      }
                      variant="secondary"
                      className="w-full sm:w-auto"
                    >
                      Confirm payment
                      (sandbox)
                    </Button>
                  )}

                  <p className="text-xs text-slate-400">
                    {paymentStatus ===
                    'pending'
                      ? 'USSD prompt is send in your mobile number'
                      : 'You will receive a mobile-money prompt on the number above. Confirm it with your mobile-money PIN.'}
                  </p>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* SIDEBAR */}
        <div className="space-y-4">
          <Card className="bg-white border-brand-100">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white"><Wallet className="h-5 w-5" /></span>

              <h3 className="lux-label text-brand-500">
                Fee summary
              </h3>
            </div>

            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-brand-500">
                  Total payable
                </p>

                <p className="text-2xl font-extrabold text-black">
                  {fee
                    ? formatTZS(
                        fee,
                      )
                    : '…'}
                </p>
              </div>
            </div>

            {fee !== null && (
              <dl className="mt-3 space-y-1.5 text-xs text-brand-500">
                {clearanceFeeBreakdown(fee).map((line) => (
                  <div key={line.label} className="flex items-center justify-between gap-3">
                    <dt>{line.label}</dt>
                    <dd className="font-medium text-brand-700">{formatTZS(line.amount)}</dd>
                  </div>
                ))}
              </dl>
            )}

            <p className="mt-3 text-xs leading-relaxed text-brand-500">
              One-time fee for the
              full clearance assistance,
              paid once by mobile money.
            </p>
          </Card>

        </div>
      </div>
    </div>
  )
}
