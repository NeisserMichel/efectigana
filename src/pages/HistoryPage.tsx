import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase, type RechargeRequest, type Transaction } from '../lib/supabase'
import { fechaLima, soles } from '../lib/format'

const LABEL: Record<Transaction['type'], string> = {
  recarga: 'Recarga',
  apuesta: 'Jugada',
  premio: 'Premio',
  descuento_admin: 'Descuento',
  ajuste_admin: 'Abono',
}

export default function HistoryPage() {
  const { session, profile } = useAuth()
  const [tx, setTx] = useState<Transaction[]>([])
  const [reqs, setReqs] = useState<RechargeRequest[]>([])

  useEffect(() => {
    if (!session) return
    const uid = session.user.id
    supabase.from('transactions').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(200).then(({ data }) => setTx((data as Transaction[]) || []))
    supabase.from('recharge_requests').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(20).then(({ data }) => setReqs((data as RechargeRequest[]) || []))
  }, [session, profile?.balance])

  return (
    <div className="page">
      <h2 className="section-title">Mis solicitudes de recarga</h2>
      {reqs.length === 0 ? (
        <p className="muted">Aún no tienes solicitudes.</p>
      ) : (
        <div className="list">
          {reqs.map((r) => (
            <div key={r.id} className="row">
              <div>
                <b>Solicitud #{r.id}</b>
                <span>{fechaLima(r.created_at)}</span>
              </div>
              <div className="right">
                <b>{soles(r.amount)}</b>
                <span className={'badge ' + r.status}>{r.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="section-title">Movimientos</h2>
      {tx.length === 0 ? (
        <p className="muted">Aún no tienes movimientos.</p>
      ) : (
        <div className="list">
          {tx.map((t) => (
            <div key={t.id} className="row">
              <div>
                <b>
                  {LABEL[t.type]} {t.type === 'premio' && '🏆'}
                </b>
                <span>{t.description}</span>
                <span>{fechaLima(t.created_at)}</span>
              </div>
              <div className="right">
                <b className={Number(t.amount) >= 0 ? 'pos' : 'neg'}>
                  {Number(t.amount) >= 0 ? '+' : '−'}
                  {soles(Math.abs(Number(t.amount)))}
                </b>
                <span>Saldo: {soles(t.balance_after)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
