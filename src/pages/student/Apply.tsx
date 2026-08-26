import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Info,
  CheckCircle2,
  Wallet,
  FileText,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  Button,
  Input,
  Select,
  Card,
  Alert,
  Spinner,
  SectionHeader,
} from '../../components/ui'
import { formatTZS } from '../../lib/utils'
import type { School, Programme } from '../../lib/types'

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

export default function StudentApply() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [fee, setFee] = useState<number | null>(null)

  const [existingRequest, setExistingRequest] =
    useState<ExistingRequest | null>(null)

  const [checkingRequest, setCheckingRequest] =
    useState(true)

  const [regNumber, setRegNumber] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [programmeId, setProgrammeId] = useState('')

  const [schools, setSchools] = useState<School[]>([])
  const [programmes, setProgrammes] =
    useState<Programme[]>([])

  const [gradYear, setGradYear] = useState(
    String(new Date().getFullYear()),
  )

  const [payPhone, setPayPhone] = useState(
    profile?.phone ?? '',
  )

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
   * - schools
   * - programmes
   * - student's latest unfinished request
   *
   * payment_pending is NOT considered an active request.
   * It is a request that needs payment/resumption.
   */
  useEffect(() => {
    let mounted = true

    async function load() {
      setCheckingRequest(true)

      const [
        feeResult,
        schoolsResult,
        programmesResult,
      ] = await Promise.all([
        supabase.rpc('get_service_fee'),

        supabase
          .from('schools')
          .select('*')
          .order('order'),

        supabase
          .from('programmes')
          .select('*')
          .order('order'),
      ])

      if (!mounted) return

      if (feeResult.error) {
        console.error(
          'Failed to load service fee:',
          feeResult.error,
        )
      } else if (feeResult.data != null) {
        setFee(Number(feeResult.data))
      }

      if (schoolsResult.error) {
        console.error(
          'Failed to load schools:',
          schoolsResult.error,
        )
      }

      if (programmesResult.error) {
        console.error(
          'Failed to load programmes:',
          programmesResult.error,
        )
      }

      setSchools(
        (schoolsResult.data ?? []) as School[],
      )

      setProgrammes(
        (programmesResult.data ??
          []) as Programme[],
      )

      if (!profile) {
        setCheckingRequest(false)
        return
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

            setNotice(
              'A payment request already exists. You can wait for it or enter a phone number and send a new payment prompt.',
            )
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

    let active = true

    async function checkPaymentStatus() {
      const {
        data,
        error,
      } = await supabase
        .from('payments')
        .select('status')
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
        case 'processing':
          setPaymentStatus('pending')
          break

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
        void checkPaymentStatus()
      }, 3000)

    return () => {
      active = false
      window.clearInterval(
        interval,
      )
    }
  }, [requestId, stage])

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
  async function submitForm(
    e: React.FormEvent,
  ) {
    e.preventDefault()

    setError(null)
    setNotice(null)
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
      },
    )

    if (error || !data) {
      setError(
        error?.message ??
          'Could not create clearance request.',
      )

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
   *     -> 255712345678
   */
  function normalizePhone(
    value: string,
  ) {
    let phone =
      value.replace(
        /[\s-]/g,
        '',
      )

    if (
      phone.startsWith('+')
    ) {
      phone =
        phone.substring(1)
    }

    if (
      phone.startsWith('0') &&
      phone.length === 10
    ) {
      phone =
        '255' +
        phone.substring(1)
    }

    return phone
  }

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
      setError(
        'No clearance request is available for payment.',
      )
      return
    }

    const rawPhone =
      payPhone.trim()

    if (!rawPhone) {
      setError(
        'Please enter the phone number you want to use for payment.',
      )
      return
    }

    const phone =
      normalizePhone(
        rawPhone,
      )

    /*
     * Basic Tanzania mobile number
     * validation.
     */
    if (
      !/^255\d{9}$/.test(
        phone,
      )
    ) {
      setError(
        'Enter a valid Tanzania mobile number, for example 0712 345 678.',
      )
      return
    }

    setError(null)
    setNotice(null)

    /*
     * loading controls the button.
     *
     * paymentStatus does NOT disable it.
     */
    setLoading(true)

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

      if (
        error ||
        !data?.success
      ) {
        setPaymentStatus(
          'failed',
        )

        setError(
          data?.error ??
            error?.message ??
            'Payment could not be initiated.',
        )

        return
      }

      /*
       * Initiation succeeded.
       *
       * This DOES NOT mean payment succeeded.
       */
      setPaymentStatus(
        'pending',
      )

      if (
        data.sandbox &&
        data.transaction_reference
      ) {
        setSandboxMode(true)

        setNotice(
          'Sandbox payment request created. Use the sandbox confirmation button below to simulate payment completion.',
        )
      } else {
        setSandboxMode(false)

        setNotice(
          data.message ??
            'Payment request sent. Check your phone and enter your mobile-money PIN.',
        )
      }
    } catch (err) {
      console.error(
        'Payment initiation error:',
        err,
      )

      setPaymentStatus(
        'failed',
      )

      setError(
        err instanceof Error
          ? err.message
          : 'Payment could not be initiated.',
      )
    } finally {
      setLoading(false)
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
        setError(
          error.message,
        )
        return
      }

      const reference =
        data?.[0]
          ?.transaction_reference

      if (!reference) {
        setError(
          'No pending payment found. Try initiating the payment again.',
        )
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
        setError(
          webhookError.message,
        )
        return
      }

      setPaymentStatus(
        'paid',
      )

      setNotice(
        'Payment confirmed! Your request is now active.',
      )

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

      setError(
        err instanceof Error
          ? err.message
          : 'Could not confirm sandbox payment.',
      )
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

              return (
                <div
                  key={step}
                  className="flex items-center gap-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        done
                          ? 'bg-emerald-500 text-white'
                          : current
                            ? 'bg-brand-600 text-white'
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
              <div className="mb-4 flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-xs leading-relaxed text-brand-800">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />

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
              </div>

              {error && (
                <div className="mb-4">
                  <Alert kind="error">
                    {error}
                  </Alert>
                </div>
              )}

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

                <Button
                  type="submit"
                  loading={
                    loading
                  }
                  variant="accent"
                  className="w-full sm:w-auto"
                >
                  Continue to payment
                  <FileText className="h-4 w-4" />
                </Button>
              </form>
            </Card>
          ) : (
            /* PAYMENT */
            <Card>
              <SectionHeader
                title="Mobile money payment"
                subtitle="Pay securely via M-Pesa, Tigo Pesa or Airtel Money"
              />

              {error && (
                <div className="mb-4">
                  <Alert kind="error">
                    {error}
                  </Alert>
                </div>
              )}

              {notice && (
                <div className="mb-4">
                  <Alert
                    kind={
                      paymentStatus ===
                      'paid'
                        ? 'success'
                        : 'info'
                    }
                  >
                    {notice}
                  </Alert>
                </div>
              )}

              {/* SUCCESS */}
              {paymentStatus ===
              'paid' ? (
                <div className="rounded-xl bg-emerald-50 p-4 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />

                  <h3 className="mt-2 font-bold text-emerald-900">
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
                      receive the mobile-money prompt.
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
                      loading
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
                    <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                      <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" />

                      <p>
                        A payment
                        request is
                        currently
                        pending. If
                        you did not
                        receive the
                        prompt, verify
                        the phone
                        number above
                        and tap
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
                      ? 'Complete the mobile-money prompt on your phone. This page will automatically check for payment confirmation.'
                      : 'You will receive a mobile-money prompt on the number above. Confirm it with your mobile-money PIN.'}
                  </p>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* SIDEBAR */}
        <div className="space-y-4">
          <Card className="!border-0 bg-black text-[#f8f8f8]">
            <div className="mb-2 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-gold-400" />

              <h3 className="lux-label text-gold-400">
                Fee summary
              </h3>
            </div>

            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-[#b4b4b4]">
                  Service fee
                </p>

                <p className="text-2xl font-extrabold">
                  {fee
                    ? formatTZS(
                        fee,
                      )
                    : '…'}
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-[#b4b4b4]">
              One-time fee for the
              full clearance assistance,
              paid once by mobile money.
            </p>
          </Card>

          {stage === 'pay' &&
            requestNumber && (
              <Card>
                <p className="text-xs text-slate-400">
                  Your request
                </p>

                <p className="font-mono text-lg font-bold text-slate-900">
                  {
                    requestNumber
                  }
                </p>

                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
                  <span className="text-slate-500">
                    Service fee
                  </span>

                  <span className="font-bold text-slate-900">
                    {fee
                      ? formatTZS(
                          fee,
                        )
                      : '…'}
                  </span>
                </div>
              </Card>
            )}

          <Card className="bg-slate-50">
            <p className="text-xs leading-relaxed text-slate-500">
              What happens next? After
              payment is confirmed, an
              agent is assigned and your
              clearance stages begin.
              You'll get notified at every
              step.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
