import { useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { errMsg, supabase, supabaseConfigured } from './lib/supabase'
import { soles } from './lib/format'
import { Logo } from './components/Logo'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import HistoryPage from './pages/HistoryPage'
import AdminPage from './pages/AdminPage'

function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const nav = useNavigate()
  return (
    <div className="app">
      <header className="topbar">
        <Logo />
        <div className="top-right">
          <span className="pill">{soles(profile?.balance)}</span>
          <button
            className="btn ghost sm"
            onClick={async () => {
              await signOut()
              nav('/ingresar')
            }}
          >
            Salir
          </button>
        </div>
      </header>
      <main>{children}</main>
      <nav className="bottom-nav">
        <NavLink to="/" end>
          <span>🎰</span>Pozos
        </NavLink>
        <NavLink to="/movimientos">
          <span>📄</span>Movimientos
        </NavLink>
        {profile?.is_admin && (
          <NavLink to="/admin">
            <span>🛠️</span>Admin
          </NavLink>
        )}
      </nav>
    </div>
  )
}

function Private({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <div className="splash">Cargando…</div>
  if (!session) return <Navigate to="/ingresar" replace />
  if (admin && !profile?.is_admin) return <Navigate to="/" replace />
  return <Layout>{children}</Layout>
}

function NewPassword() {
  const [p, setP] = useState('')
  const [msg, setMsg] = useState('')
  const nav = useNavigate()
  return (
    <div className="auth-wrap">
      <div className="auth-card form">
        <Logo big />
        <label>
          Nueva contraseña
          <input type="password" value={p} onChange={(e) => setP(e.target.value)} />
        </label>
        {msg && <div className="alert error">{msg}</div>}
        <button
          className="btn primary block"
          onClick={async () => {
            const { error } = await supabase.auth.updateUser({ password: p })
            if (error) setMsg(errMsg(error))
            else nav('/')
          }}
        >
          Guardar
        </button>
      </div>
    </div>
  )
}

function NotConfigured() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Logo big />
        <div className="alert warn">
          Falta configurar Supabase. Crea el archivo <code>.env</code> con <code>VITE_SUPABASE_URL</code> y{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> (revisa el README).
        </div>
      </div>
    </div>
  )
}

export default function App() {
  if (!supabaseConfigured) return <NotConfigured />
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/ingresar" element={<LoginGate />} />
          <Route path="/nueva-clave" element={<NewPassword />} />
          <Route path="/" element={<Private><HomePage /></Private>} />
          <Route path="/movimientos" element={<Private><HistoryPage /></Private>} />
          <Route path="/admin" element={<Private admin><AdminPage /></Private>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

function LoginGate() {
  const { session, loading } = useAuth()
  if (loading) return <div className="splash">Cargando…</div>
  if (session) return <Navigate to="/" replace />
  return <AuthPage />
}
