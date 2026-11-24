import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Profile } from './supabase'

type AuthCtx = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) return setProfile(null)
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setProfile(data as Profile | null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadProfile(data.session?.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setTimeout(() => loadProfile(s?.user.id), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  // Saldo en vivo: se actualiza solo cuando el admin recarga/descuenta o al ganar
  useEffect(() => {
    const uid = session?.user.id
    if (!uid) return
    const ch = supabase
      .channel('perfil-' + uid)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` }, (p) =>
        setProfile(p.new as Profile),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [session?.user.id])

  const value: AuthCtx = {
    session,
    profile,
    loading,
    refreshProfile: () => loadProfile(session?.user.id),
    signOut: async () => {
      await supabase.auth.signOut()
      setProfile(null)
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
