import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowUpRight, GraduationCap, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SiteNav } from '../components/Layout'
import ContactModal from '../components/ContactModal'
import { formatTZS, regaliaCategoryLabel, regaliaLabel } from '../lib/utils'
import type { RegaliaCategory, RegaliaItem } from '../lib/types'

const VALID: RegaliaCategory[] = ['gown', 'sash', 'suit', 'shoes']

export default function RegaliaCategoryPage() {
  const { category } = useParams<{ category: string }>()

  const [items, setItems] = useState<RegaliaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [contact, setContact] = useState<{ open: boolean; item?: RegaliaItem }>({ open: false })

  const cat: RegaliaCategory = VALID.includes(category as RegaliaCategory) ? (category as RegaliaCategory) : 'gown'

  useEffect(() => {
    setLoading(true)
    supabase
      .from('regalia_items')
      .select('*')
      .eq('category', cat)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setItems((data ?? []) as RegaliaItem[])
        setLoading(false)
      })
  }, [cat])

  const label = 'text-[0.625rem] uppercase tracking-[0.0625rem] text-brand-500'

  return (
    <div className="min-h-screen bg-white font-sans text-brand-900">
      {/* top bar */}
      <SiteNav
        mode="marketing"
        left={
          <>
            <Link to="/" className="text-[0.625rem] uppercase tracking-[0.0625rem] text-brand-500 transition-colors hover:text-brand-900">
              Home
            </Link>
            <span className="hidden text-[0.625rem] uppercase tracking-[0.0625rem] text-brand-900 sm:block">
              {regaliaCategoryLabel(cat)}
            </span>
          </>
        }
      />

      {/* category strip */}
      <section className="border-b border-brand-100 bg-brand-50">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <p className={label}>Regalia · {cat}</p>
          <h1 className="mt-3 text-4xl font-normal tracking-[0.02em] sm:text-5xl">{regaliaCategoryLabel(cat)}</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-500">
            {items.length} sample{items.length === 1 ? '' : 's'} to choose from. Found one you like? Call or WhatsApp us
            and we'll confirm the price, size and delivery.
          </p>
          <button
            onClick={() => setContact({ open: true })}
            className="mt-6 inline-flex items-center gap-2 border-b border-brand-900 pb-1 text-xs uppercase tracking-[0.2em] text-brand-900 transition-colors hover:border-gold-600 hover:text-gold-600"
          >
            <Phone className="h-4 w-4" /> Can't find what you need? Contact us
          </button>
        </div>
      </section>

      {/* items */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
          {loading ? (
            <p className="py-20 text-center text-sm text-brand-400">Loading samples…</p>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50 p-16 text-center">
              <p className="text-sm font-medium text-brand-800">No {regaliaLabel(cat)} samples yet</p>
              <p className="mt-1 text-sm text-brand-500">Contact us and we'll show you what we have available.</p>
              <button
                onClick={() => setContact({ open: true })}
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-black bg-black px-7 py-3 text-xs uppercase tracking-[0.2em] text-[#f8f8f8] transition-all duration-300 hover:bg-white hover:text-[#1a1a1a]"
              >
                <Phone className="h-4 w-4" /> Contact us
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => (
                <div key={item.id} className="group">
                  <div className="relative overflow-hidden bg-brand-50">
                    <img
                      src={item.image_path}
                      alt={item.name}
                      className="aspect-[3/4] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                    {item.gender && item.gender !== 'unisex' && (
                      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[0.625rem] uppercase tracking-[0.0625rem] text-brand-700">
                        {item.gender}
                      </span>
                    )}
                  </div>
                  <div className="mt-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm tracking-[0.025em] text-brand-900">{item.name}</p>
                      <p className="shrink-0 text-sm font-medium text-brand-500">{formatTZS(item.price)}</p>
                    </div>
                    {item.description && <p className="mt-1 text-xs leading-relaxed text-brand-400">{item.description}</p>}
                    <button
                      onClick={() => setContact({ open: true, item })}
                      className="mt-3 inline-flex items-center gap-1.5 border-b border-brand-900 pb-0.5 text-[0.625rem] uppercase tracking-[0.2em] text-brand-900 transition-colors hover:border-gold-600 hover:text-gold-600"
                    >
                      Contact us <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-brand-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-5 py-12 sm:flex-row sm:justify-between sm:px-8">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-gold-600" />
            <span className="lv-logo text-lg text-brand-900">Finalists</span>
          </div>
          <div className="flex gap-8">
            {VALID.map((c) => (
              <Link key={c} to={`/regalia/${c}`} className="text-xs text-brand-500 transition-colors hover:text-brand-900">
                {regaliaCategoryLabel(c)}
              </Link>
            ))}
          </div>
          <p className="text-[0.625rem] uppercase tracking-[0.0625rem] text-brand-300">
            © {new Date().getFullYear()} Finalists · Ardhi University
          </p>
        </div>
      </footer>

      <ContactModal open={contact.open} itemName={contact.item?.name} onClose={() => setContact({ open: false })} />
    </div>
  )
}