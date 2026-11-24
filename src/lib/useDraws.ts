import { useEffect, useState } from 'react'
import { supabase, type Draw, type Pool } from './supabase'

/** Pozos + sorteo abierto de cada uno, actualizado en vivo con Supabase Realtime */
export function useLiveDraws() {
  const [pools, setPools] = useState<Pool[]>([])
  const [draws, setDraws] = useState<Record<number, Draw>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const load = async () => {
      const [{ data: p }, { data: d }] = await Promise.all([
        supabase.from('pools').select('*').order('sort'),
        supabase.from('draws').select('*').eq('status', 'open'),
      ])
      if (!alive) return
      setPools((p as Pool[]) || [])
      const map: Record<number, Draw> = {}
      ;((d as Draw[]) || []).forEach((x) => (map[x.pool_id] = x))
      setDraws(map)
      setLoading(false)
    }
    load()

    const ch = supabase
      .channel('pozos-en-vivo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draws' }, (payload) => {
        const row = payload.new as Draw
        if (!row?.pool_id) return
        setDraws((prev) => {
          if (row.status === 'open') return { ...prev, [row.pool_id]: row }
          if (prev[row.pool_id]?.id === row.id) {
            const next = { ...prev }
            delete next[row.pool_id]
            return next
          }
          return prev
        })
      })
      .subscribe()

    // respaldo por si el realtime se corta
    const t = setInterval(load, 30000)
    return () => {
      alive = false
      clearInterval(t)
      supabase.removeChannel(ch)
    }
  }, [])

  return { pools, draws, loading }
}
