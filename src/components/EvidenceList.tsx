import { Paperclip } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Evidence } from '../lib/types'

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|heic|avif)$/i

function isImage(name: string) {
  return IMAGE_EXT.test(name.toLowerCase())
}

export default function EvidenceList({ items }: { items: Evidence[] }) {
  if (items.length === 0) return null

  return (
    <div className="space-y-2">
      {items.map((e) => {
        const url = supabase.storage.from('evidence').getPublicUrl(e.file_path).data.publicUrl
        return isImage(e.file_name) ? (
          <div key={e.id} className="overflow-hidden rounded-lg border border-brand-100 bg-brand-50">
            <a href={url} target="_blank" rel="noreferrer" title="Open full image">
              <img src={url} alt={e.file_name} className="aspect-[4/3] w-full object-cover transition hover:opacity-90" loading="lazy" />
            </a>
            <div className="flex items-center justify-between gap-2 border-t border-brand-100 bg-white px-3 py-2">
              <span className="truncate text-xs text-brand-700">{e.file_name}</span>
              <a href={url} target="_blank" rel="noreferrer" className="link-underline shrink-0 text-xs text-brand-800">
                View
              </a>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2">
            <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-brand-700">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-brand-300" />
              <span className="truncate">{e.file_name}</span>
            </span>
            <a href={url} target="_blank" rel="noreferrer" className="link-underline shrink-0 text-xs text-brand-800">
              View
            </a>
          </div>
        )
      })}
    </div>
  )
}