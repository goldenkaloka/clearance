import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Card, Button, Input, PageHeader, Spinner, Alert, Modal } from '../../components/ui'
import type { Stage } from '../../lib/types'

export default function AdminStages() {
  const [stages, setStages] = useState<Stage[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [order, setOrder] = useState('')

  async function load() {
    const { data } = await supabase.from('clearance_stages').select('*').order('order', { ascending: true })
    setStages((data ?? []) as Stage[])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  if (loading) return <Spinner />

  async function toggle(stage: Stage) {
    setMsg(null)
    const { error } = await supabase.from('clearance_stages').update({ active: !stage.active }).eq('id', stage.id)
    if (error) setMsg(error.message)
    else await load()
  }

  async function add() {
    if (!name || !order) return
    setMsg(null)
    const { error } = await supabase.from('clearance_stages').insert({
      name,
      description: description || null,
      order: parseInt(order, 10),
      active: true,
    })
    if (error) setMsg(error.message)
    else {
      setName('')
      setDescription('')
      setOrder('')
      setShowAdd(false)
      await load()
    }
  }

  return (
    <div>
      <PageHeader
        title="Clearance stages"
        subtitle="These stages are created for every new request"
        action={<Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add stage</Button>}
      />
      {msg && <div className="mb-4"><Alert kind="error">{msg}</Alert></div>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {stages.map((s) => (
          <Card key={s.id} className="flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{s.order}</span>
                <p className="font-semibold text-slate-800">{s.name}</p>
              </div>
              {s.description && <p className="mt-2 text-xs leading-relaxed text-slate-500">{s.description}</p>}
            </div>
            <button
              onClick={() => void toggle(s)}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition ${
                s.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {s.active ? 'Active' : 'Inactive'}
              <span className={`relative h-5 w-9 rounded-full transition ${s.active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${s.active ? 'left-4' : 'left-0.5'}`} />
              </span>
            </button>
          </Card>
        ))}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add stage">
        <div className="space-y-4">
          <Input label="Stage name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Transport" />
          <Input label="Order" type="number" value={order} onChange={(e) => setOrder(e.target.value)} placeholder="e.g. 9" />
          <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" />
          <Button onClick={() => void add()} className="w-full">Add stage</Button>
        </div>
      </Modal>
    </div>
  )
}