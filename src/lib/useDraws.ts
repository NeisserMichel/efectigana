import { useEffect, useState } from 'react'
import { supabase, type Draw, type Pool } from './supabase'

/** Pozos por defecto: se muestran siempre, aunque la base de datos tarde o falle */
export const DEFAULT_POOLS: Pool[] = [
  { id: 1, name: 'Pozo Bronce', ticket_price: 0.5, color: '#d97706', sort: 1 },
  { id: 2, name: 'Pozo Plata', ticket_price: 1, color: '#64748b', sort: 2 },
  { id: 3, name: 'Pozo Oro', ticket_price: 3, color: '#eab308', sort: 3 },
  { id: 4, name: 'Pozo Diamante', ticket_price: 5, color: '#0ea5e9', sort: 4 },
]

/** Próximo domingo 8:00 p.m. hora de Lima (UTC-5, sin horario de verano) */
export function nextSundayLima(from = Date.now()): string {
  const OFFSET = 5 * 3600 * 1000
  const lima = new Date(from - OFFSET) // "reloj" de Lima expresado en UTC
  const target = new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), lima.getUTCDate(), 20, 0, 0))
  target.setUTCDate(target.getUTCDate() + ((7 - lima.getUTCDay()) % 7))
  if (target.getTime() <= lima.getTime()) target.setUTCDate(target.getUTCDate() + 7)
  return new Date(target.getTime() + OFFSET).toISOString()
}

/** Pozos + sorteo abierto de cada uno, actualizado en vivo con Supabase Realtime */
export function useLiveDraws() {
  const [pools, setPools] = useState<Pool[]>(DEFAULT_POOLS)
  const [draws, setDraws] = useState<Record<number, Draw>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const load = async () => {
      const [p, d] = await Promise.all([
        supabase.from('pools').select('*').order('sort'),
        supabase.from('draws').select('*').eq('status', 'open'),
      ])
      if (!alive) return
      if (p.error || d.error) {
        console.error('[EfectiGana] No se pudieron cargar los pozos', p.error || d.error)
        setError((p.error || d.error)?.message || 'error')
      } else setError('')
      if (p.data?.length) setPools(p.data as Pool[])
      if (d.data) {
        const map: Record<number, Draw> = {}
        ;(d.data as Draw[]).forEach((x) => (map[x.pool_id] = x))
        setDraws(map)
      }
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
    const t = setInterval(load, 20000)
    return () => {
      alive = false
      clearInterval(t)
      supabase.removeChannel(ch)
    }
  }, [])

  return { pools, draws, loading, error }
}
