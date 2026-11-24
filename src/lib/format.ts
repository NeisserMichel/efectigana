export const soles = (n: number | string | null | undefined) =>
  'S/ ' + Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fechaLima = (iso: string) =>
  new Date(iso).toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

export function countdown(target: string, now: number) {
  let s = Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000))
  const d = Math.floor(s / 86400)
  s -= d * 86400
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  s -= m * 60
  return { d, h, m, s, done: d + h + m + s === 0 }
}

export const pad = (n: number) => String(n).padStart(2, '0')
