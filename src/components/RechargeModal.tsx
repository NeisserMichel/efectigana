import { useState } from 'react'
import { Modal } from './Modal'
import { useAuth } from '../lib/auth'
import { APP_NAME, WHATSAPP_NUMBER, errMsg, supabase } from '../lib/supabase'
import { soles } from '../lib/format'

const PRESETS = [5, 10, 20, 50, 100]

export function RechargeModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth()
  const [amount, setAmount] = useState('10')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const value = Number(amount.replace(',', '.'))
  const valid = Number.isFinite(value) && value >= 1 && value <= 1000

  const go = async () => {
    if (!profile || !valid) return
    setError('')
    setBusy(true)
    // Abrimos la ventana antes del await para que el navegador del celular no la bloquee
    const win = window.open('', '_blank')
    try {
      const { data: reqId, error } = await supabase.rpc('create_recharge_request', { p_amount: value })
      if (error) throw error
      const text =
        `Hola ${APP_NAME} 👋\n` +
        `Quiero recargar saldo en mi cuenta de la web/app *${APP_NAME}*.\n\n` +
        `• ID de registro: *${profile.code}*\n` +
        `• Monto a recargar: *${soles(value)}*\n` +
        `• Celular registrado: *+51 ${profile.phone}*\n` +
        `• Solicitud N°: *${reqId}*\n\n` +
        `Solicito autorización para realizar el pago por *Yape*. ¡Gracias!`
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
      if (win) win.location.href = url
      else window.location.href = url
      onClose()
    } catch (e) {
      win?.close()
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Recargar saldo" onClose={onClose}>
      <p className="muted">Elige o escribe cuánto deseas recargar a tu cuenta.</p>
      <div className="presets">
        {PRESETS.map((p) => (
          <button key={p} className={'chip' + (value === p ? ' active' : '')} onClick={() => setAmount(String(p))}>
            S/ {p}
          </button>
        ))}
      </div>
      <label className="amount-input">
        <span>S/</span>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} />
        <div className="stepper">
          <button onClick={() => setAmount(String(Math.max(1, (value || 0) - 1)))}>−</button>
          <button onClick={() => setAmount(String(Math.min(1000, (value || 0) + 1)))}>+</button>
        </div>
      </label>
      {!valid && <div className="alert error">El monto debe estar entre S/ 1 y S/ 1,000</div>}

      <div className="yape-box">
        <div className="yape-logo">yape</div>
        <div>
          <b>El pago se realizará por Yape</b>
          <p>
            Te llevaremos a WhatsApp con un mensaje listo. Te autorizarán el yapeo y, al confirmar tu pago, el saldo se
            acreditará en tu cuenta.
          </p>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      <button className="btn whatsapp block" disabled={!valid || busy} onClick={go}>
        {busy ? 'Abriendo WhatsApp…' : `Recargar ${valid ? soles(value) : ''} por WhatsApp`}
      </button>
    </Modal>
  )
}
