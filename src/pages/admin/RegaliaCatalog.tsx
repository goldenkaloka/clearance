import { useEffect, useState } from 'react'
import { ImagePlus, Pencil, UploadCloud } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Card, Button, Input, Select, Textarea, PageHeader, Alert, Spinner, EmptyState, Modal } from '../../components/ui'
import { formatTZS, regaliaLabel, REGALIA_CATEGORIES } from '../../lib/utils'
import type { RegaliaItem, RegaliaCategory, RegaliaGender } from '../../lib/types'

const GENDERS: { value: RegaliaGender; label: string }[] = [
  { value: 'unisex', label: 'Unisex' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

interface FormState {
  id: string | null
  name: string
  category: RegaliaCategory
  gender: RegaliaGender | ''
  price: string
  description: string
  image_path: string
  active: boolean
}

const emptyForm: FormState = {
  id: null,
  name: '',
  category: 'sash',
  gender: 'unisex',
  price: '',
  description: '',
  image_path: '',
  active: true,
}

export default function AdminRegaliaCatalog() {
  const [items, setItems] = useState<RegaliaItem[]>([])
  const [filter, setFilter] = useState<RegaliaCategory | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function load() {
    const { data } = await supabase.from('regalia_items').select('*').order('sort_order', { ascending: true })
    setItems((data ?? []) as RegaliaItem[])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const visible = filter === 'all' ? items : items.filter((i) => i.category === filter)

  function openNew() {
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(item: RegaliaItem) {
    setForm({
      id: item.id,
      name: item.name,
      category: item.category,
      gender: item.gender ?? 'unisex',
      price: String(item.price),
      description: item.description ?? '',
      image_path: item.image_path,
      active: item.active,
    })
    setModalOpen(true)
  }

  async function uploadImage(file: File) {
    setUploading(true)
    setMsg(null)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `catalog/${Date.now()}-${safeName}`
    const { data, error } = await supabase.storage.from('regalia-catalog').upload(path, file, { upsert: true })
    if (error) {
      setMsg({ kind: 'error', text: error.message })
      setUploading(false)
      return
    }
    const { data: url } = supabase.storage.from('regalia-catalog').getPublicUrl(data.path)
    setForm((f) => ({ ...f, image_path: url.publicUrl }))
    setUploading(false)
  }

  async function save() {
    setSaving(true)
    setMsg(null)
    if (!form.name.trim() || !form.image_path) {
      setMsg({ kind: 'error', text: 'Name and an image are required.' })
      setSaving(false)
      return
    }
    const price = parseInt(form.price, 10)
    if (isNaN(price) || price < 0) {
      setMsg({ kind: 'error', text: 'Enter a valid price.' })
      setSaving(false)
      return
    }
    const payload = {
      name: form.name.trim(),
      category: form.category,
      gender: form.gender || null,
      price,
      description: form.description.trim() || null,
      image_path: form.image_path,
      active: form.active,
    }
    const { error } = form.id
      ? await supabase.from('regalia_items').update(payload).eq('id', form.id)
      : await supabase.from('regalia_items').insert(payload)
    setSaving(false)
    if (error) {
      setMsg({ kind: 'error', text: error.message })
      return
    }
    setMsg({ kind: 'success', text: form.id ? 'Sample updated.' : 'Sample added to the catalog.' })
    setModalOpen(false)
    await load()
  }

  async function toggleActive(item: RegaliaItem) {
    const { error } = await supabase.from('regalia_items').update({ active: !item.active }).eq('id', item.id)
    if (error) setMsg({ kind: 'error', text: error.message })
    else await load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Regalia catalog"
        subtitle="Samples shown on the public category pages. Inactive samples are hidden from students."
        action={
          <Button onClick={openNew} variant="accent">
            <ImagePlus className="h-4 w-4" /> Add sample
          </Button>
        }
      />
      {msg && <div className="mb-4"><Alert kind={msg.kind}>{msg.text}</Alert></div>}

      <div className="mb-4 flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.1em] transition ${
            filter === 'all' ? 'border-black bg-black text-white' : 'border-brand-200 text-brand-500 hover:border-brand-400'
          }`}
        >
          All
        </button>
        {REGALIA_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.1em] transition ${
              filter === c ? 'border-black bg-black text-white' : 'border-brand-200 text-brand-500 hover:border-brand-400'
            }`}
          >
            {regaliaLabel(c)}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No samples" message="Add your first sample to the catalog." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((item) => (
            <Card key={item.id} className="overflow-hidden !p-0">
              <div className="relative">
                <img src={item.image_path} alt={item.name} className="aspect-[3/4] w-full object-cover" />
                {!item.active && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white">
                    Hidden
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-semibold text-brand-900">{item.name}</p>
                <p className="mt-0.5 text-xs text-brand-500">
                  {regaliaLabel(item.category)}{item.gender ? ` · ${item.gender}` : ''} · {formatTZS(item.price)}
                </p>
                <div className="mt-3 flex gap-1.5">
                  <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => openEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => void toggleActive(item)}>
                    {item.active ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? 'Edit sample' : 'Add sample'}>
        <div className="space-y-4">
          {form.image_path ? (
            <div className="flex items-center gap-4">
              <img src={form.image_path} alt="Preview" className="h-32 w-24 rounded-lg object-cover" />
              <Button variant="ghost" onClick={() => setForm((f) => ({ ...f, image_path: '' }))}>Change image</Button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-brand-200 bg-brand-50 px-4 py-8 text-center transition hover:border-black">
              <UploadCloud className={`h-7 w-7 ${uploading ? 'animate-pulse' : ''} text-brand-400`} />
              <span className="mt-2 text-sm text-brand-700">{uploading ? 'Uploading…' : 'Upload an image'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void uploadImage(file)
                  e.target.value = ''
                }}
              />
            </label>
          )}
          <Input label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Men's Graduation Suit" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as RegaliaCategory }))}>
              {REGALIA_CATEGORIES.map((c) => (
                <option key={c} value={c}>{regaliaLabel(c)}</option>
              ))}
            </Select>
            <Select label="Gender" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as RegaliaGender }))}>
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Price (TZS)" type="number" min={0} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
            <label className="flex items-end pb-1 text-sm text-brand-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="mr-2 h-4 w-4 accent-black"
              />
              Active
            </label>
          </div>
          <Textarea label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          <Button onClick={() => void save()} loading={saving} className="w-full">
            {form.id ? 'Save changes' : 'Add to catalog'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}