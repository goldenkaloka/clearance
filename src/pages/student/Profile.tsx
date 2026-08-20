import { useEffect, useState } from 'react'
import { Mail, Phone, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { StudentProfile, School, Programme } from '../../lib/types'
import { Card, Button, Input, Select, Alert, SectionHeader } from '../../components/ui'
import { Spinner } from '../../components/ui'

export default function StudentProfile() {
  const { profile, refreshProfile } = useAuth()
  const [loaded, setLoaded] = useState(false)
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [regNumber, setRegNumber] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [programmeId, setProgrammeId] = useState('')
  const [schools, setSchools] = useState<School[]>([])
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [gradYear, setGradYear] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name)
    setPhone(profile.phone ?? '')
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
    supabase
      .from('student_profiles')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        const s = data as StudentProfile | null
        setRegNumber(s?.registration_number ?? '')
        setSchoolId(s?.school_id ?? '')
        setProgrammeId(s?.programme_id ?? '')
        setGradYear(s?.graduation_year ? String(s.graduation_year) : '')
        setLoaded(true)
      })
  }, [profile])

  if (!profile || !loaded) return <Spinner />

  async function save() {
    setSaving(true)
    setMsg(null)
    const { error: pErr } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', profile!.id)
    if (pErr) {
      setMsg(pErr.message)
      setSaving(false)
      return
    }
    const { error: sErr } = await supabase.rpc('upsert_student_profile', {
      p_user_id: profile!.id,
      p_registration_number: regNumber || null,
      p_graduation_year: gradYear ? parseInt(gradYear, 10) : null,
      p_school_id: schoolId || null,
      p_programme_id: programmeId || null,
    })
    if (sErr) {
      setMsg(sErr.message)
      setSaving(false)
      return
    }
    await refreshProfile()
    setMsg('Saved successfully.')
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <SectionHeader title="Contact details" />
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 shrink-0 text-slate-400" />
              <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 shrink-0 text-slate-400" />
              <Input label="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 shrink-0 text-slate-400" />
              <Input label="Email" value={profile.email ?? ''} disabled />
            </div>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Academic details" />
          <div className="space-y-4">
            <Input label="Registration number" value={regNumber} onChange={(e) => setRegNumber(e.target.value)} />
            <Select
              label="School"
              value={schoolId}
              onChange={(e) => {
                setSchoolId(e.target.value)
                setProgrammeId('')
              }}
            >
              <option value="">Select your school…</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <Select label="Programme" value={programmeId} onChange={(e) => setProgrammeId(e.target.value)}>
              <option value="">Select your programme…</option>
              {programmes
                .filter((p) => p.school_id === schoolId)
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </Select>
            <Input label="Graduation year" type="number" value={gradYear} onChange={(e) => setGradYear(e.target.value)} min={2000} max={2100} />
          </div>
        </Card>
      </div>

      <Button onClick={() => void save()} loading={saving} className="w-full md:w-auto">Save changes</Button>
    </div>
  )
}