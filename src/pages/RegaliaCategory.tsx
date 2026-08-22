import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ContactModal from '../components/ContactModal'
import { SiteNav } from '../components/Layout'
import type { RegaliaCategory, RegaliaItem } from '../lib/types'

const VALID: RegaliaCategory[] = ['gown', 'sash', 'suit', 'shoes']

const TITLES: Record<RegaliaCategory, string> = {
  gown: 'Graduation Gowns',
  sash: 'Ceremonial Sashes',
  suit: 'Graduation Suits',
  shoes: 'Graduation Shoes',
}

const DESC: Record<RegaliaCategory, string> = {
  gown: 'Classic and modern gowns tailored for Ardhi University graduation ceremonies.',
  sash: 'Handcrafted sashes in university colours — a distinguished touch to your regalia.',
  suit: "Formal suits designed for the occasion — available in men's and women's cuts.",
  shoes: "Polished graduation shoes to complete the look — men's and women's.",
}

export default function RegaliaCategoryPage() {
  const { category } = useParams<{ category: string }>()
  const cat: RegaliaCategory = VALID.includes(category as RegaliaCategory) ? (category as RegaliaCategory) : 'gown'

  const [items, setItems] = useState<RegaliaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [contact, setContact] = useState<{ open: boolean; item?: RegaliaItem }>({ open: false })

  useEffect(() => {
    setLoading(true)
    supabase
      .from('regalia_items')
      .select('*')
      .eq('category', cat)
      .eq('active', true)
      .order('sort_order')
      .order('name')
      .then(({ data }) => {
        setItems(data ?? [])
        setLoading(false)
      })
  }, [cat])

  return (
    <div className="page-in min-h-screen bg-white font-sans text-brand-900">
      <SiteNav mode="marketing" />

      {/* header */}
      <section className="bg-brand-50">
        <div className="mx-auto max-w-7xl px-5 pt-10 pb-16 sm:px-8 sm:pt-14 sm:pb-20">
          <Link
            to="/#shop"
            className="inline-flex items-center gap-1.5 text-[0.625rem] uppercase tracking-[0.2em] text-brand-500 transition-colors hover:text-brand-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to regalia
          </Link>
          <h1 className="mt-6 text-3xl font-normal tracking-[0.02em] sm:text-4xl">{TITLES[cat]}</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-500">{DESC[cat]}</p>
          <p className="mt-3 text-xs text-brand-400">Call or WhatsApp us to order — delivery arranged before the ceremony.</p>
        </div>
      </section>

      {/* grid */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-brand-400">No items available in this category yet.</p>
            <p className="mt-1 text-xs text-brand-300">Contact us to inquire about availability.</p>
            <button
              onClick={() => setContact({ open: true })}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-black bg-black px-7 py-3 text-xs uppercase tracking-[0.2em] text-[#f8f8f8] transition-all duration-300 hover:bg-white hover:text-[#1a1a1a]"
            >
              Contact us <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => setContact({ open: true, item })}
                className="group text-left"
              >
                <div className="overflow-hidden bg-brand-50">
                  {item.image_path ? (
                    <img
                      src={item.image_path}
                      alt={item.name}
                      className="aspect-[3/4] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex aspect-[3/4] w-full items-center justify-center bg-brand-100 text-brand-300">
                      <span className="text-xs uppercase tracking-widest">No image</span>
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-sm tracking-[0.025em] text-brand-900">{item.name}</p>
                  {item.gender && (
                    <p className="mt-0.5 text-[0.625rem] uppercase tracking-[0.0625rem] text-brand-400">
                      {item.gender}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* other categories */}
      <section className="border-t border-brand-100 bg-brand-50">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <p className="text-[0.625rem] uppercase tracking-[0.0625rem] text-brand-400">Explore other categories</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {VALID.filter((c) => c !== cat).map((c) => (
              <Link
                key={c}
                to={`/regalia/${c}`}
                className="rounded-full border border-brand-200 bg-white px-5 py-2 text-xs uppercase tracking-[0.0625em] text-brand-600 transition-colors hover:border-black hover:text-brand-900"
              >
                {TITLES[c]}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <ContactModal
        open={contact.open}
        itemName={contact.item?.name}
        onClose={() => setContact({ open: false })}
      />
    </div>
  )
}