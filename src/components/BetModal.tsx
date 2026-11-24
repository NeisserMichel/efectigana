import { useState } from 'react'
import { Modal } from './Modal'
import { useAuth } from '../lib/auth'
import { errMsg, supabase, type Draw, type Pool } from '../lib/supabase'
import { soles } from '../lib/format'

export function BetModal({ pool, draw, onClose, onRecharge }: { pool: Pool; draw: Draw; onClose: () => void; onRecharge: () => void }) {
  const { profile, refreshProfile } = useAuth()
  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const price = Number(pool.ticket_price)
  const cost = price * qty
  const balance = Number(profile?.balance ?? 0)
  const enough = balance >= cost
  const chance = ((qty / (draw.tickets + qty)) * 100).toFixed(1)

  const play = async () => {
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('place_bet', { p_pool: pool.id, p_tickets: qty })
    setBusy(false)
    if (error) return setError(errMsg(error))
    await refreshProfile()
    setDone(true)
  }

  if (done)
    return (
      <Modal title="¡Jugada registrada!" onClose={onClose}>
        <div className="success">
          <div className="big-emoji">🎟️</div>
          <p>
            Tienes <b>{qty}</b> jugada(s) nueva(s) en el <b>{pool.name}</b>.
          </p>
          <p className="muted">Se descontó {soles(cost)} de tu saldo. ¡Mucha suerte el domingo a las 8 p.m.!</p>
          <button className="btn primary block" onClick={onClose}>
            Listo
          </button>
        </div>
      </Modal>
    )

  return (
    <Modal title={`Jugar en ${pool.name}`} onClose={onClose}>
      <p className="muted">Cada jugada cuesta {soles(price)}. Mientras más jugadas tengas, más probabilidades de ganar.</p>
      <div className="qty">
        <button onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
        <input inputMode="numeric" value={qty} onChange={(e) => setQty(Math.min(1000, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)))} />
        <button onClick={() => setQty(Math.min(1000, qty + 1))}>+</button>
      </div>
      <div className="presets">
        {[1, 5, 10, 20].map((n) => (
          <button key={n} className={'chip' + (qty === n ? ' active' : '')} onClick={() => setQty(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="summary">
        <div>
          <span>Total a pagar</span>
          <b>{soles(cost)}</b>
        </div>
        <div>
          <span>Tu saldo</span>
          <b className={enough ? '' : 'neg'}>{soles(balance)}</b>
        </div>
        <div>
          <span>Probabilidad aprox.</span>
          <b>{chance}%</b>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      {enough ? (
        <button className="btn primary block" disabled={busy} onClick={play}>
          {busy ? 'Registrando…' : `Jugar ${qty} por ${soles(cost)}`}
        </button>
      ) : (
        <>
          <div className="alert warn">No tienes saldo suficiente para esta jugada.</div>
          <button className="btn gold block" onClick={onRecharge}>
            Recargar saldo
          </button>
        </>
      )}
    </Modal>
  )
}
