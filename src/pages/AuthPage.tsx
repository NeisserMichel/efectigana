import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, errMsg } from '../lib/supabase'
import { Logo } from '../components/Logo'
import { DownloadAppButton } from '../components/AppUpdate'
import { PasswordInput } from '../components/PasswordInput'
import { UsernameField, type UsernameState } from '../components/UsernameField'
import { CountdownCard, PoolGrid } from '../components/Pools'
import { useLiveDraws } from '../lib/useDraws'
import { isNativeApp, WEB_URL } from '../lib/platform'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [uState, setUState] = useState<UsernameState>('empty')
  const [accept, setAccept] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const nav = useNavigate()
  const { pools, draws, error: liveError } = useLiveDraws()
  const formRef = useRef<HTMLDivElement>(null)

  const goToForm = (m: 'login' | 'register') => {
    setMode(m)
    setError('')
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

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
        const user = username.trim()
        const cel = phone.replace(/\D/g, '')
        if (uState === 'invalid' || uState === 'empty') throw new Error('Elige un nombre de usuario válido (3 a 20 caracteres)')
        if (uState === 'taken') throw new Error('Ese nombre de usuario ya está en uso, elige otro')
        if (!/^9\d{8}$/.test(cel)) throw new Error('Ingresa un celular válido de 9 dígitos que empiece con 9')
        if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres')
        if (password !== password2) throw new Error('Las contraseñas no coinciden')
        if (!accept) throw new Error('Debes confirmar que eres mayor de 18 años y aceptar los términos')
        const [{ data: freeUser }, { data: freePhone }] = await Promise.all([
          supabase.rpc('username_available', { p_username: user }),
          supabase.rpc('phone_available', { p_phone: cel }),
        ])
        if (freeUser === false) throw new Error('Ese nombre de usuario ya está en uso, elige otro')
        if (freePhone === false) throw new Error('Este número de celular ya está registrado')
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { phone: cel, username: user }, emailRedirectTo: isNativeApp ? WEB_URL : window.location.origin + import.meta.env.BASE_URL },
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
    <div className="landing">
      <header className="landing-top">
        <Logo />
        <div className="top-right">
          <button className="btn ghost sm" onClick={() => goToForm('login')}>
            Ingresar
          </button>
          <button className="btn gold sm" onClick={() => goToForm('register')}>
            Registrarme
          </button>
        </div>
      </header>

      <div className="landing-grid">
        <section className="landing-live">
          <h1 className="hero">
            Juega desde <span>S/ 0.50</span> y gana el pozo cada domingo a las 8 p.m.
          </h1>
          <DownloadAppButton compact />
          <CountdownCard draws={draws} />
          <h2 className="section-title">Pozos de esta semana</h2>
          {liveError && <div className="alert error">No se pudo conectar con el servidor para cargar los montos.</div>}
          <PoolGrid pools={pools} draws={draws} onPlay={() => goToForm('register')} playLabel="Regístrate para jugar" />
        </section>

        <div className="auth-card" ref={formRef}>
          <div className="tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} type="button">
              Ingresar
            </button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')} type="button">
              Registrarme
            </button>
          </div>

          <form onSubmit={submit} className="form">
            {mode === 'register' && <UsernameField value={username} onChange={setUsername} onState={setUState} />}
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
              <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </label>
            {mode === 'register' && (
              <>
                <label>
                  Repite la contraseña
                  <PasswordInput required value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
                  {password2 && password !== password2 && <small className="hint taken">Las contraseñas no coinciden</small>}
                </label>
                <label className="check">
                  <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
                  <span>Soy mayor de 18 años y acepto los términos y condiciones de EfectiGana.</span>
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
                  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                    redirectTo: (isNativeApp ? WEB_URL : window.location.origin + import.meta.env.BASE_URL) + 'nueva-clave',
                  })
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
    </div>
  )
}
