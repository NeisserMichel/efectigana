import { useEffect, useState } from 'react'
import { supabase, type Draw, type Pool } from '../lib/supabase'
import { countdown, fechaLima, pad, soles } from '../lib/format'
import { Modal } from './Modal'
import { nextSundayLima } from '../lib/useDraws'

export function PeopleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="7.5" r="3.5" />
      <path d="M2 19.5c0-3.6 3.1-6 7-6s7 2.4 7 6v.5H2z" />
      <circle cx="17" cy="8.5" r="2.8" opacity=".7" />
      <path d="M16.4 13.6c3.2.2 5.6 2.2 5.6 5.4v1h-4.4v-.5c0-2.4-.5-4.3-1.2-5.9z" opacity=".7" />
    </svg>
  )
}

export function useNow() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

/** Cuenta regresiva hasta el próximo domingo 8 p.m. + total recaudado */
export function CountdownCard({ draws }: { draws: Record<number, Draw> }) {
  const now = useNow()
  const nextDraw = Object.values(draws)[0]?.draw_at || nextSundayLima(now)
  const cd = countdown(nextDraw, now)
  const totalAll = Object.values(draws).reduce((a, d) => a + Number(d.total), 0)
  return (
    <section className="countdown-card">
      <div className="cd-title">
        <span className="live-dot" /> Próximo sorteo <small>· {fechaLima(nextDraw)}</small>
      </div>
      <div className="cd">
        {[
          ['días', cd.d],
          ['horas', cd.h],
          ['min', cd.m],
          ['seg', cd.s],
        ].map(([l, v]) => (
          <div key={l as string}>
            <b>{pad(v as number)}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>
      {cd.done && <p className="muted center">Sorteando… los resultados aparecerán en unos instantes.</p>}
      <p className="cd-total">
        Recaudado en todos los pozos: <b>{soles(totalAll)}</b>
      </p>
    </section>
  )
}

/** Las 4 tarjetas de pozos con monto en vivo */
export function PoolGrid({
  pools,
  draws,
  mine,
  onPlay,
  playLabel = 'Jugar en este pozo',
}: {
  pools: Pool[]
  draws: Record<number, Draw>
  mine?: Record<number, number>
  onPlay: (pool: Pool, draw?: Draw) => void
  playLabel?: string
}) {
  const now = useNow()
  const [list, setList] = useState<Pool | null>(null)
  return (
    <>
      <div className="pools">
        {pools.map((p) => {
          const d = draws[p.id]
          const closed = !!d && new Date(d.draw_at).getTime() <= now
          return (
            <article key={p.id} className="pool" style={{ ['--c' as string]: p.color }}>
              <header>
                <span className="pool-name">{p.name}</span>
                <span className="price">{soles(p.ticket_price)} / jugada</span>
              </header>
              <div className="pot">
                <span className="live">EN VIVO</span>
                <b>{soles(d?.total)}</b>
                <small>recaudado</small>
              </div>
              <div className={'stats' + (mine ? '' : ' two')}>
                <div>
                  <b>{d?.participants ?? 0}</b>
                  <span>participantes</span>
                </div>
                <div>
                  <b>{d?.tickets ?? 0}</b>
                  <span>jugadas</span>
                </div>
                {mine && (
                  <div>
                    <b>{d ? mine[d.id] || 0 : 0}</b>
                    <span>mis jugadas</span>
                  </div>
                )}
              </div>
              <button className="btn people block" onClick={() => setList(p)}>
                <PeopleIcon size={22} />
                Participantes
                <span className="people-count">{d?.participants ?? 0}</span>
              </button>
              <button className="btn primary block" disabled={closed || (!d && !!mine)} onClick={() => onPlay(p, d)}>
                {playLabel}
              </button>
            </article>
          )
        })}
      </div>
      {list && <ParticipantsModal pool={list} draw={draws[list.id]} onClose={() => setList(null)} />}
    </>
  )
}

type Participant = { username: string; tickets: number; last_play: string }

/** Lista de nombres de usuario que participan en el pozo (se actualiza en vivo) */
export function ParticipantsModal({ pool, draw, onClose }: { pool: Pool; draw?: Draw; onClose: () => void }) {
  const [rows, setRows] = useState<Participant[] | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    supabase.rpc('pool_participants', { p_pool: pool.id }).then(({ data }) => setRows((data as Participant[]) || []))
  }, [pool.id, draw?.tickets])

  const filtered = (rows || []).filter((r) => r.username.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <Modal title={`👥 Participantes · ${pool.name}`} onClose={onClose}>
      <div className="part-head" style={{ ['--c' as string]: pool.color }}>
        <div>
          <b>{soles(draw?.total)}</b>
          <span>recaudado</span>
        </div>
        <div>
          <b>{draw?.participants ?? 0}</b>
          <span>participantes</span>
        </div>
        <div>
          <b>{draw?.tickets ?? 0}</b>
          <span>jugadas</span>
        </div>
      </div>
      {(rows?.length ?? 0) > 8 && <input className="search" placeholder="Buscar nombre de usuario…" value={q} onChange={(e) => setQ(e.target.value)} />}
      {rows === null && <p className="muted">Cargando…</p>}
      {rows?.length === 0 && <p className="muted center">Aún no hay participantes en este pozo. ¡Sé el primero!</p>}
      <div className="part-list">
        {filtered.map((r, i) => (
          <div key={r.username} className="part-row">
            <span className="part-pos">{i + 1}</span>
            <span className="part-avatar" style={{ background: avatarColor(r.username) }}>
              {r.username.slice(0, 1).toUpperCase()}
            </span>
            <span className="part-name">@{r.username}</span>
            <span className="part-tk">
              {r.tickets} jugada{Number(r.tickets) === 1 ? '' : 's'}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

const AVATAR_COLORS = ['#12a150', '#0ea5e9', '#d97706', '#a855f7', '#ef4444', '#14b8a6', '#eab308', '#6366f1']
function avatarColor(name: string) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
