import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useLiveDraws } from '../lib/useDraws'
import { supabase, type Draw, type Pool } from '../lib/supabase'
import { countdown, fechaLima, pad, soles } from '../lib/format'
import { BetModal } from '../components/BetModal'
import { RechargeModal } from '../components/RechargeModal'
import { DownloadAppButton } from '../components/AppUpdate'

function useNow() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function HomePage() {
  const { profile, session } = useAuth()
  const { pools, draws, loading } = useLiveDraws()
  const now = useNow()
  const [bet, setBet] = useState<{ pool: Pool; draw: Draw } | null>(null)
  const [recharge, setRecharge] = useState(false)
  const [mine, setMine] = useState<Record<number, number>>({})
  const [winners, setWinners] = useState<(Draw & { pools: { name: string } })[]>([])

  const openIds = useMemo(() => Object.values(draws).map((d) => d.id).sort().join(','), [draws])

  // Mis jugadas en los sorteos abiertos
  useEffect(() => {
    if (!session || !openIds) return
    supabase
      .from('entries')
      .select('draw_id,tickets')
      .eq('user_id', session.user.id)
      .in('draw_id', openIds.split(',').map(Number))
      .then(({ data }) => {
        const m: Record<number, number> = {}
        ;(data || []).forEach((e) => (m[e.draw_id] = (m[e.draw_id] || 0) + e.tickets))
        setMine(m)
      })
  }, [session, openIds, bet])

  useEffect(() => {
    supabase
      .from('draws')
      .select('*, pools(name)')
      .eq('status', 'closed')
      .not('winner_label', 'is', null)
      .order('closed_at', { ascending: false })
      .limit(8)
      .then(({ data }) => setWinners((data as never) || []))
  }, [openIds])

  const nextDraw = Object.values(draws)[0]?.draw_at
  const cd = nextDraw ? countdown(nextDraw, now) : null
  const totalAll = Object.values(draws).reduce((a, d) => a + Number(d.total), 0)

  return (
    <div className="page">
      <DownloadAppButton compact />
      <section className="balance-card">
        <div>
          <span className="label">Tu saldo</span>
          <div className="balance">{soles(profile?.balance)}</div>
          <span className="code">ID: {profile?.code}</span>
        </div>
        <button className="btn gold" onClick={() => setRecharge(true)}>
          + Recargar
        </button>
      </section>

      <section className="countdown-card">
        <div className="cd-title">
          <span className="live-dot" /> Próximo sorteo {nextDraw && <small>· {fechaLima(nextDraw)}</small>}
        </div>
        {cd && (
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
        )}
        {cd?.done && <p className="muted center">Sorteando… los resultados aparecerán en unos instantes.</p>}
        <p className="cd-total">
          Recaudado en todos los pozos: <b>{soles(totalAll)}</b>
        </p>
      </section>

      <h2 className="section-title">Pozos de esta semana</h2>
      {loading && <p className="muted">Cargando pozos…</p>}
      <div className="pools">
        {pools.map((p) => {
          const d = draws[p.id]
          const my = d ? mine[d.id] || 0 : 0
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
              <div className="stats">
                <div>
                  <b>{d?.participants ?? 0}</b>
                  <span>participantes</span>
                </div>
                <div>
                  <b>{d?.tickets ?? 0}</b>
                  <span>jugadas</span>
                </div>
                <div>
                  <b>{my}</b>
                  <span>mis jugadas</span>
                </div>
              </div>
              <button className="btn primary block" disabled={!d || cd?.done} onClick={() => d && setBet({ pool: p, draw: d })}>
                Jugar en este pozo
              </button>
            </article>
          )
        })}
      </div>

      <section className="how">
        <h2 className="section-title">¿Cómo funciona?</h2>
        <ol>
          <li>
            <b>Recarga</b> saldo con Yape desde el botón “Recargar”.
          </li>
          <li>
            <b>Elige</b> uno o varios pozos y cuántas jugadas quieres. El monto se descuenta de tu saldo.
          </li>
          <li>
            Cada <b>domingo a las 8:00 p.m.</b> se sortea un ganador por pozo entre quienes participaron.
          </li>
          <li>
            El <b>premio</b> (90% de lo recaudado) se suma automáticamente a tu saldo.
          </li>
        </ol>
      </section>

      {winners.length > 0 && (
        <section>
          <h2 className="section-title">Últimos ganadores 🏆</h2>
          <div className="winners">
            {winners.map((w) => (
              <div key={w.id} className="winner">
                <div>
                  <b>{w.winner_label}</b>
                  <span>
                    {w.pools?.name} · {w.closed_at && fechaLima(w.closed_at)}
                  </span>
                </div>
                <b className="pos">{soles(w.prize)}</b>
              </div>
            ))}
          </div>
        </section>
      )}

      {bet && (
        <BetModal
          pool={bet.pool}
          draw={draws[bet.pool.id] || bet.draw}
          onClose={() => setBet(null)}
          onRecharge={() => {
            setBet(null)
            setRecharge(true)
          }}
        />
      )}
      {recharge && <RechargeModal onClose={() => setRecharge(false)} />}
    </div>
  )
}
