import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast, extractFunctionsError } from '../context/ToastContext'

interface InitiateResult {
  success: boolean
  sandbox?: boolean
  paymentId?: string
  transaction_reference?: string
  amount?: number
  message?: string
  error?: string
}

export function usePayment() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [sandboxMode, setSandboxMode] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function initiate(body: { request_id?: string; gown_order_id?: string; phone: string }): Promise<{ success: boolean; data?: InitiateResult }> {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke<InitiateResult>('initiate-payment', { body })
      if (fnError) {
        const extracted = await extractFunctionsError(fnError)
        const msg = extracted ?? data?.error ?? 'Payment could not be initiated.'
        const friendly = msg === 'Edge Function returned a non-2xx status code' ? 'Payment could not be initiated. Try again.' : msg
        setError(friendly)
        toast.error(friendly)
        return { success: false }
      }
      if (!data?.success) {
        const msg = data?.error ?? 'Payment could not be initiated.'
        setError(msg)
        toast.error(msg)
        return { success: false }
      }
      if (data.sandbox && data.transaction_reference) {
        setSandboxMode(true)
        const m = 'Sandbox payment request created. Use the sandbox confirmation button below to simulate payment completion.'
        setNotice(m)
        toast.success(m)
      } else {
        setSandboxMode(false)
        const m = data.message ?? 'Payment request sent. Check your phone and enter your mobile-money PIN.'
        setNotice(m)
        toast.success(m)
      }
      return { success: true, data }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment could not be initiated.'
      setError(msg)
      toast.error(msg)
      return { success: false }
    } finally {
      setBusy(false)
    }
  }

  async function confirmSandbox(ref: string): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      const { error: fnError } = await supabase.functions.invoke('clickpesa-webhook', {
        body: { test_key: 'clearance-test-key', transaction_reference: ref, status: 'paid' },
      })
      if (fnError) {
        const msg = (await extractFunctionsError(fnError)) ?? fnError.message
        setError(msg)
        toast.error(msg)
        return false
      }
      const m = 'Payment confirmed!'
      setNotice(m)
      toast.success(m)
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not confirm sandbox payment.'
      setError(msg)
      toast.error(msg)
      return false
    } finally {
      setBusy(false)
    }
  }

  return { initiate, confirmSandbox, busy, sandboxMode, notice, setNotice, error, setError, setSandboxMode }
}
