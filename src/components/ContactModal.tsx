import { useEffect, useState } from 'react'
import { Phone, MessageCircle, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { normalizeWhatsApp } from '../lib/utils'

const DEFAULT_PHONE = '+255 616622485'

export default function ContactModal({ open, itemName, onClose }: { open: boolean; itemName?: string; onClose: () => void }) {
  const [phone, setPhone] = useState(DEFAULT_PHONE)

  useEffect(() => {
    if (!open) return
    supabase.rpc('get_contact_phone').then(({ data }) => {
      if (typeof data === 'string' && data.trim()) setPhone(data.trim())
    })
  }, [open])

  if (!open) return null

  const wa = normalizeWhatsApp(phone)
  const tel = phone.replace(/\s+/g, '')

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-brand-100 bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-6">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-brand-300 transition-colors hover:bg-brand-50 hover:text-brand-900"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <p className="lux-label text-brand-500">Contact us</p>
        <h3 className="mt-2 text-xl font-normal tracking-[0.02em] text-brand-900">
          {itemName ? `"${itemName}"` : 'Request a sample'}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-brand-500">
          {itemName
            ? `Call or WhatsApp us about this item — we'll confirm the price, size and delivery for you.`
            : `Tell us what you have in mind — call or WhatsApp us and we'll show you more options.`}
        </p>

        <p className="mt-6 text-center text-2xl font-semibold tracking-[0.02em] text-brand-900">{phone}</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <a
            href={`tel:${tel}`}
            className="flex items-center justify-center gap-2 rounded-full border border-black bg-black px-5 py-3 text-xs uppercase tracking-[0.2em] text-[#f8f8f8] transition-all duration-300 hover:bg-white hover:text-[#1a1a1a]"
          >
            <Phone className="h-4 w-4" /> Call now
          </a>
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-full border border-black bg-black px-5 py-3 text-xs uppercase tracking-[0.2em] text-[#f8f8f8] transition-all duration-300 hover:bg-white hover:text-[#1a1a1a]"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}