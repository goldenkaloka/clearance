import { useState } from 'react'
import { Mail, Phone, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { Card, Button, Input, Alert, SectionHeader } from '../../components/ui'

export default function AgentProfile() {
  const { profile, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (!profile) return null

  async function save() {
    setSaving(true)
    setMsg(null)
    const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', profile!.id)
    if (error) setMsg(error.message)
    else {
      await refreshProfile()
      setMsg('Saved successfully.')
    }
    setSaving(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
            {profile.full_name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{profile.full_name}</h1>
            <p className="text-sm text-slate-500">{profile.email}</p>
          </div>
        </div>
      </Card>

      {msg && <div className="mb-4"><Alert kind={msg === 'Saved successfully.' ? 'success' : 'error'}>{msg}</Alert></div>}

      <Card>
        <SectionHeader title="Contact details" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 shrink-0 text-slate-400" />
            <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 shrink-0 text-slate-400" />
            <Input label="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <Mail className="h-4 w-4 shrink-0 text-slate-400" />
            <Input label="Email" value={profile.email ?? ''} disabled />
          </div>
        </div>
        <Button onClick={() => void save()} loading={saving} className="mt-4 w-full md:w-auto">Save changes</Button>
      </Card>
    </div>
  )
}