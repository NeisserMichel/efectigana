import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabaseConfigured = Boolean(url && key)

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder')

export const APP_NAME = 'EfectiGana'
export const WHATSAPP_NUMBER = (import.meta.env.VITE_WHATSAPP_NUMBER as string) || '51917486188'

export type Profile = {
  id: string
  code: string
  email: string
  phone: string
  balance: number
  is_admin: boolean
  is_blocked: boolean
  created_at: string
}

export type Pool = {
  id: number
  name: string
  ticket_price: number
  color: string
  sort: number
}

export type Draw = {
  id: number
  pool_id: number
  draw_at: string
  status: 'open' | 'closed'
  total: number
  tickets: number
  participants: number
  commission: number | null
  prize: number | null
  winner_id: string | null
  winner_label: string | null
  winner_ticket: number | null
  closed_at: string | null
}

export type Transaction = {
  id: number
  user_id: string
  type: 'recarga' | 'apuesta' | 'premio' | 'descuento_admin' | 'ajuste_admin'
  amount: number
  balance_after: number
  description: string | null
  created_at: string
}

export type RechargeRequest = {
  id: number
  user_id: string
  amount: number
  status: 'pendiente' | 'aprobada' | 'rechazada'
  created_at: string
}

export function errMsg(e: unknown): string {
  const m = (e as { message?: string })?.message || String(e)
  if (m.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos'
  if (m.includes('User already registered')) return 'Este correo ya está registrado'
  if (m.includes('Email not confirmed')) return 'Confirma tu correo antes de ingresar (revisa tu bandeja)'
  if (m.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres'
  if (m.includes('profiles_phone_key')) return 'Este número de celular ya está registrado'
  if (m.includes('Database error saving new user')) return 'No se pudo crear la cuenta. Verifica tu número de celular.'
  return m
}
