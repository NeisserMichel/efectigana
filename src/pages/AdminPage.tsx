import { useCallback, useEffect, useState } from 'react'
import { errMsg, supabase, type Draw, type Profile, type RechargeRequest, type Transaction } from '../lib/supabase'
import { fechaLima, soles } from '../lib/format'
import { Modal } from '../components/Modal'
import { useLiveDraws } from '../lib/useDraws'

type Req = RechargeRequest & { profiles: Pick<Profile, 'code' | 'phone' | 'email'> }

export default function AdminPage() {
  const [tab, setTab] = useState<'recargas' | 'usuarios' | 'sorteos'>('recargas')
  return (
    <div className="page admin">
      <h1 className="admin-title">Panel de administrador</h1>
      <div className="tabs">
        <button className={tab === 'recargas' ? 'active' : ''} onClick={() => setTab('recargas')}>
          Recargas
        </button>
        <button className={tab === 'usuarios' ? 'active' : ''} onClick={() => setTab('usuarios')}>
          Usuarios
        </button>
        <button className={tab === 'sorteos' ? 'active' : ''} onClick={() => setTab('sorteos')}>
          Sorteos
        </button>
      </div>
      {tab === 'recargas' && <Recargas />}
      {tab === 'usuarios' && <Usuarios />}
      {tab === 'sorteos' && <Sorteos />}
    </div>
  )
}

/* -------------------- SOLICITUDES DE RECARGA -------------------- */
function Recargas() {
  const [status, setStatus] = useState<'pendiente' | 'aprobada' | 'rechazada'>('pendiente')
  const [rows, setRows] = useState<Req[]>([])
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('recharge_requests')
      .select('*, profiles(code,phone,email)')
      .eq('status', status)
      .order('created_at', { ascending: status === 'pendiente' })
      .limit(100)
    setRows((data as Req[]) || [])
  }, [status])

  useEffect(() => {
    load()
    const ch = supabase
      .channel('admin-recargas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recharge_requests' }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [load])

  const resolve = async (r: Req, approve: boolean) => {
    const msg = approve
      ? `¿Confirmas que recibiste el Yape de ${soles(r.amount)} de ${r.profiles.code}? Se acreditará el saldo.`
      : `¿Rechazar la solicitud #${r.id}?`
    if (!confirm(msg)) return
    setBusy(r.id)
    setError('')
    const { error } = await supabase.rpc('admin_resolve_recharge', { p_request: r.id, p_approve: approve })
    setBusy(null)
    if (error) setError(errMsg(error))
    load()
  }

  return (
    <>
      <div className="filters">
        {(['pendiente', 'aprobada', 'rechazada'] as const).map((s) => (
          <button key={s} className={'chip' + (status === s ? ' active' : '')} onClick={() => setStatus(s)}>
            {s}
          </button>
        ))}
      </div>
      {error && <div className="alert error">{error}</div>}
      {rows.length === 0 && <p className="muted">No hay solicitudes {status}s.</p>}
      <div className="list">
        {rows.map((r) => (
          <div key={r.id} className="row">
            <div>
              <b>
                #{r.id} · {r.profiles?.code} · {soles(r.amount)}
              </b>
              <span>
                +51 {r.profiles?.phone} · {r.profiles?.email}
              </span>
              <span>{fechaLima(r.created_at)}</span>
            </div>
            {r.status === 'pendiente' ? (
              <div className="actions">
                <button className="btn primary sm" disabled={busy === r.id} onClick={() => resolve(r, true)}>
                  Aprobar
                </button>
                <button className="btn danger sm" disabled={busy === r.id} onClick={() => resolve(r, false)}>
                  Rechazar
                </button>
              </div>
            ) : (
              <span className={'badge ' + r.status}>{r.status}</span>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

/* ------------------------- USUARIOS ------------------------- */
function Usuarios() {
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<Profile[]>([])
  const [sel, setSel] = useState<Profile | null>(null)

  const load = useCallback(async () => {
    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100)
    const s = q.trim().replace(/[,()%]/g, '')
    if (s) query = query.or(`code.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`)
    const { data } = await query
    setUsers((data as Profile[]) || [])
  }, [q])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  return (
    <>
      <input className="search" placeholder="Buscar por ID (EG-1001), correo o celular…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="list">
        {users.map((u) => (
          <button key={u.id} className="row clickable" onClick={() => setSel(u)}>
            <div>
              <b>
                {u.code} {u.is_admin && <span className="badge aprobada">admin</span>} {u.is_blocked && <span className="badge rechazada">bloqueado</span>}
              </b>
              <span>
                {u.email} · +51 {u.phone}
              </span>
            </div>
            <div className="right">
              <b>{soles(u.balance)}</b>
              <span>Gestionar ›</span>
            </div>
          </button>
        ))}
      </div>
      {sel && (
        <UserModal
          user={sel}
          onClose={() => setSel(null)}
          onChanged={(u) => {
            setSel(u)
            load()
          }}
        />
      )}
    </>
  )
}

function UserModal({ user, onClose, onChanged }: { user: Profile; onClose: () => void; onChanged: (u: Profile) => void }) {
  const [mode, setMode] = useState<'descontar' | 'abonar'>('descontar')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [tx, setTx] = useState<Transaction[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const loadTx = useCallback(() => {
    supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50).then(({ data }) => setTx((data as Transaction[]) || []))
  }, [user.id])
  useEffect(loadTx, [loadTx])

  const apply = async () => {
    const v = Number(amount.replace(',', '.'))
    if (!(v > 0)) return setError('Ingresa un monto válido')
    if (!reason.trim()) return setError('Indica el motivo')
    const signed = mode === 'descontar' ? -v : v
    if (!confirm(`¿${mode === 'descontar' ? 'Descontar' : 'Abonar'} ${soles(v)} a ${user.code}?`)) return
    setBusy(true)
    setError('')
    setOk('')
    const { data, error } = await supabase.rpc('admin_adjust_balance', { p_user: user.id, p_amount: signed, p_reason: reason.trim() })
    setBusy(false)
    if (error) return setError(errMsg(error))
    setOk(`Listo. Nuevo saldo: ${soles(data as number)}`)
    setAmount('')
    setReason('')
    onChanged({ ...user, balance: data as number })
    loadTx()
  }

  const toggleBlock = async () => {
    const { error } = await supabase.rpc('admin_set_blocked', { p_user: user.id, p_blocked: !user.is_blocked })
    if (error) return setError(errMsg(error))
    onChanged({ ...user, is_blocked: !user.is_blocked })
  }

  return (
    <Modal title={`Usuario ${user.code}`} onClose={onClose}>
      <div className="user-head">
        <div>
          <span>{user.email}</span>
          <span>+51 {user.phone}</span>
          <span>Registrado: {fechaLima(user.created_at)}</span>
        </div>
        <div className="balance sm">{soles(user.balance)}</div>
      </div>

      <div className="tabs small">
        <button className={mode === 'descontar' ? 'active danger' : ''} onClick={() => setMode('descontar')}>
          Descontar saldo
        </button>
        <button className={mode === 'abonar' ? 'active' : ''} onClick={() => setMode('abonar')}>
          Abonar saldo
        </button>
      </div>
      <div className="form">
        <label>
          Monto (S/)
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0.00" />
        </label>
        {mode === 'descontar' && (
          <button className="link left" onClick={() => setAmount(String(user.balance))}>
            Descontar todo el saldo ({soles(user.balance)})
          </button>
        )}
        <label>
          Motivo
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={mode === 'descontar' ? 'Ej: Recarga fraudulenta, Yape no recibido' : 'Ej: Recarga Yape confirmada'} />
        </label>
        {error && <div className="alert error">{error}</div>}
        {ok && <div className="alert ok">{ok}</div>}
        <button className={'btn block ' + (mode === 'descontar' ? 'danger' : 'primary')} disabled={busy} onClick={apply}>
          {busy ? 'Aplicando…' : mode === 'descontar' ? 'Descontar monedas' : 'Abonar monedas'}
        </button>
        <button className="btn ghost block" onClick={toggleBlock}>
          {user.is_blocked ? 'Desbloquear cuenta' : 'Bloquear cuenta (no podrá jugar)'}
        </button>
      </div>

      <h4>Últimos movimientos</h4>
      <div className="list compact">
        {tx.map((t) => (
          <div key={t.id} className="row">
            <div>
              <b>{t.type.replace('_', ' ')}</b>
              <span>{t.description}</span>
              <span>{fechaLima(t.created_at)}</span>
            </div>
            <div className="right">
              <b className={Number(t.amount) >= 0 ? 'pos' : 'neg'}>{Number(t.amount) >= 0 ? '+' : '−'}{soles(Math.abs(Number(t.amount)))}</b>
              <span>{soles(t.balance_after)}</span>
            </div>
          </div>
        ))}
        {tx.length === 0 && <p className="muted">Sin movimientos.</p>}
      </div>
    </Modal>
  )
}

/* ------------------------- SORTEOS ------------------------- */
function Sorteos() {
  const { pools, draws } = useLiveDraws()
  const [history, setHistory] = useState<Draw[]>([])
  const [msg, setMsg] = useState('')

  const load = useCallback(() => {
    supabase.from('draws').select('*').eq('status', 'closed').order('closed_at', { ascending: false }).limit(60).then(({ data }) => setHistory((data as Draw[]) || []))
  }, [])
  useEffect(load, [load])

  const name = (id: number) => pools.find((p) => p.id === id)?.name || `Pozo ${id}`
  const totalOpen = Object.values(draws).reduce((a, d) => a + Number(d.total), 0)
  const totalComm = history.reduce((a, d) => a + Number(d.commission || 0), 0)

  const runNow = async () => {
    const { data, error } = await supabase.rpc('admin_run_due_draws')
    setMsg(error ? errMsg(error) : data ? `Se procesaron ${data} sorteo(s).` : 'No hay sorteos pendientes: el sorteo se ejecuta solo el domingo a las 8 p.m.')
    load()
  }

  return (
    <>
      <div className="kpis">
        <div>
          <span>En juego esta semana</span>
          <b>{soles(totalOpen)}</b>
        </div>
        <div>
          <span>Comisión (últimos sorteos)</span>
          <b>{soles(totalComm)}</b>
        </div>
      </div>
      <div className="list">
        {pools.map((p) => {
          const d = draws[p.id]
          return (
            <div key={p.id} className="row">
              <div>
                <b>{p.name}</b>
                <span>
                  Sorteo #{d?.id} · {d && fechaLima(d.draw_at)}
                </span>
                <span>
                  {d?.participants ?? 0} participantes · {d?.tickets ?? 0} jugadas
                </span>
              </div>
              <div className="right">
                <b>{soles(d?.total)}</b>
              </div>
            </div>
          )
        })}
      </div>
      <button className="btn ghost block" onClick={runNow}>
        Ejecutar sorteos vencidos ahora
      </button>
      {msg && <div className="alert ok">{msg}</div>}

      <h2 className="section-title">Historial</h2>
      <div className="list">
        {history.map((d) => (
          <div key={d.id} className="row">
            <div>
              <b>
                #{d.id} · {name(d.pool_id)}
              </b>
              <span>{d.closed_at && fechaLima(d.closed_at)}</span>
              <span>
                {d.winner_label ? `Ganador: ${d.winner_label} (boleto ${d.winner_ticket} de ${d.tickets})` : 'Sin participantes'}
              </span>
            </div>
            <div className="right">
              <b>{soles(d.total)}</b>
              <span>Premio {soles(d.prize)}</span>
              <span>Comisión {soles(d.commission)}</span>
            </div>
          </div>
        ))}
        {history.length === 0 && <p className="muted">Todavía no hay sorteos realizados.</p>}
      </div>
    </>
  )
}
