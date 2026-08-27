import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { School, Programme } from '../lib/types'

let cachedSchools: School[] | null = null
let cachedProgrammes: Programme[] | null = null
let inflight: Promise<void> | null = null

async function ensureLoaded(): Promise<void> {
  if (cachedSchools && cachedProgrammes) return
  if (inflight) return inflight
  inflight = Promise.all([
    supabase.from('schools').select('*').order('order'),
    supabase.from('programmes').select('*').order('order'),
  ]).then(([s, p]) => {
    cachedSchools = (s.data ?? []) as School[]
    cachedProgrammes = (p.data ?? []) as Programme[]
  })
  await inflight
  inflight = null
}

export function useSchools() {
  const [schools, setSchools] = useState<School[]>(cachedSchools ?? [])
  const [programmes, setProgrammes] = useState<Programme[]>(cachedProgrammes ?? [])
  const [loading, setLoading] = useState(!cachedSchools)

  useEffect(() => {
    let cancelled = false
    void ensureLoaded().then(() => {
      if (cancelled) return
      setSchools(cachedSchools ?? [])
      setProgrammes(cachedProgrammes ?? [])
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { schools, programmes, loading }
}
