import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { errMsg, supabase } from '../lib/supabase'
import { UsernameField, type UsernameState } from './UsernameField'

/** Usuarios registrados antes de existir el nombre de usuario: lo eligen una sola vez */
export function UsernameGate() {
  const { profile, refreshProfile } = useAuth()
  const [value, setValue] = useState('')
  const [state, setState] = useState<UsernameState>('empty')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!profile || profile.username) return null

  const save = async () => {
    if (state !== 'ok') return
    if (!confirm(`¿Confirmas @${value.trim()} como tu nombre de usuario? No podrás cambiarlo después.`)) return
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('set_my_username', { p_username: value.trim() })
    setBusy(false)
    if (error) return setError(errMsg(error))
    await refreshProfile()
  }

  return (
    <div className="modal-bg">
      <div className="modal" role="dialog" aria-modal="true">
        <h3 style={{ margin: 0 }}>Elige tu nombre de usuario</h3>
        <p className="muted" style={{ margin: 0 }}>
          Así te verán los demás en la lista de participantes y si sales ganador. Es único y no se podrá cambiar.
        </p>
        <div className="form">
          <UsernameField value={value} onChange={setValue} onState={setState} />
          {error && <div className="alert error">{error}</div>}
          <button className="btn primary block" disabled={state !== 'ok' || busy} onClick={save}>
            {busy ? 'Guardando…' : 'Guardar nombre de usuario'}
          </button>
        </div>
      </div>
    </div>
  )
}
