import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export const USERNAME_RE = /^[A-Za-z0-9_.]{3,20}$/

export type UsernameState = 'empty' | 'invalid' | 'checking' | 'taken' | 'ok'

/** Campo de nombre de usuario con verificación en vivo de disponibilidad */
export function UsernameField({ value, onChange, onState }: { value: string; onChange: (v: string) => void; onState: (s: UsernameState) => void }) {
  const [state, setState] = useState<UsernameState>('empty')

  useEffect(() => {
    const v = value.trim()
    let next: UsernameState
    if (!v) next = 'empty'
    else if (!USERNAME_RE.test(v)) next = 'invalid'
    else next = 'checking'
    setState(next)
    onState(next)
    if (next !== 'checking') return
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('username_available', { p_username: v })
      const s: UsernameState = error ? 'ok' : data ? 'ok' : 'taken'
      setState(s)
      onState(s)
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <label>
      Nombre de usuario
      <div className="user-input">
        <span>@</span>
        <input
          required
          maxLength={20}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^A-Za-z0-9_.]/g, ''))}
          placeholder="ej: juan_lima"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
        />
      </div>
      <small className={'hint ' + state}>
        {state === 'empty' && 'De 3 a 20 caracteres: letras, números, punto o guion bajo. No se podrá cambiar.'}
        {state === 'invalid' && 'Usa de 3 a 20 caracteres: letras, números, punto o guion bajo.'}
        {state === 'checking' && 'Verificando disponibilidad…'}
        {state === 'taken' && '✗ Ese nombre ya está en uso, elige otro.'}
        {state === 'ok' && '✓ ¡Disponible! Recuerda que no se podrá cambiar.'}
      </small>
    </label>
  )
}
