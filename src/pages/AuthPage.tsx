import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, errMsg } from '../lib/supabase'
import { Logo } from '../components/Logo'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [phone, setPhone] = useState('')
  const [accept, setAccept] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const nav = useNavigate()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        nav('/')
      } else {
        const cel = phone.replace(/\D/g, '')
        if (!/^9\d{8}$/.test(cel)) throw new Error('Ingresa un celular válido de 9 dígitos que empiece con 9')
        if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres')
        if (password !== password2) throw new Error('Las contraseñas no coinciden')
        if (!accept) throw new Error('Debes confirmar que eres mayor de 18 años y aceptar los términos')
        const { data: free } = await supabase.rpc('phone_available', { p_phone: cel })
        if (free === false) throw new Error('Este número de celular ya está registrado')
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { phone: cel }, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
        })
        if (error) throw error
        if (data.session) nav('/')
        else {
          setInfo('¡Cuenta creada! Te enviamos un correo para confirmar tu cuenta. Luego inicia sesión.')
          setMode('login')
        }
      }
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Logo big />
        <p className="tagline">Recarga, juega y gana cada domingo a las 8 p.m.</p>

        <div className="tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} type="button">
            Ingresar
          </button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')} type="button">
            Registrarme
          </button>
        </div>

        <form onSubmit={submit} className="form">
          <label>
            Correo electrónico
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@gmail.com" autoComplete="email" />
          </label>
          {mode === 'register' && (
            <label>
              Número de celular
              <div className="phone-input">
                <span>+51</span>
                <input inputMode="numeric" required maxLength={9} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="9XXXXXXXX" autoComplete="tel-national" />
              </div>
            </label>
          )}
          <label>
            Contraseña
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </label>
          {mode === 'register' && (
            <>
              <label>
                Repite la contraseña
                <input type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
              </label>
              <label className="check">
                <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
                <span>Soy mayor de 18 años y acepto los términos y condiciones de {`EfectiGana`}.</span>
              </label>
            </>
          )}
          {error && <div className="alert error">{error}</div>}
          {info && <div className="alert ok">{info}</div>}
          <button className="btn primary block" disabled={busy}>
            {busy ? 'Procesando…' : mode === 'login' ? 'Ingresar' : 'Crear mi cuenta'}
          </button>
          {mode === 'login' && (
            <button
              type="button"
              className="link"
              onClick={async () => {
                if (!email) return setError('Escribe tu correo para recuperar la contraseña')
                const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + import.meta.env.BASE_URL + 'nueva-clave' })
                if (error) setError(errMsg(error))
                else setInfo('Te enviamos un correo para restablecer tu contraseña.')
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
