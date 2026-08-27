import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'

export function useGownStatus(onSuccess?: () => void | Promise<void>) {
  const toast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function updateStatus(orderId: string, status: 'ready_for_pickup' | 'collected') {
    setBusyId(orderId)
    const fn = status === 'ready_for_pickup' ? 'mark_gown_ready' : 'mark_gown_collected'
    const { error } = await supabase.rpc(fn, { p_order_id: orderId })
    setBusyId(null)
    if (error) {
      toast.error(error.message)
      return false
    }
    toast.success(status === 'ready_for_pickup' ? 'Gown marked ready for pickup.' : 'Gown marked collected.')
    await onSuccess?.()
    return true
  }

  async function assignAgent(orderId: string, agentId: string) {
    setBusyId(orderId)
    const { error } = await supabase.rpc('assign_gown_agent', { p_order_id: orderId, p_agent_id: agentId })
    setBusyId(null)
    if (error) {
      toast.error(error.message)
      return false
    }
    toast.success('Agent assigned.')
    await onSuccess?.()
    return true
  }

  return { busyId, updateStatus, assignAgent }
}
