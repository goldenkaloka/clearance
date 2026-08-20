import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Role } from '../lib/types'

const ROLES: Role[] = ['student', 'agent', 'admin']

export default function RoleMenu({
  userId,
  role,
  onChanged,
}: {
  userId: string
  role: Role
  onChanged?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function change(next: Role) {
    if (next === role) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('update_user_role', { p_user_id: userId, p_role: next })
    if (err) setError(err.message)
    else onChanged?.()
    setBusy(false)
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={role}
        disabled={busy}
        onChange={(e) => void change(e.target.value as Role)}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium capitalize text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {error && <span className="text-[11px] text-rose-600">{error}</span>}
    </div>
  )
}