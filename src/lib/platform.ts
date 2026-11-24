import { Capacitor } from '@capacitor/core'

/** true cuando corre dentro de la APK de Android */
export const isNativeApp = Capacitor.isNativePlatform()

/** Dirección pública de la web (donde también se aloja la APK) */
export const WEB_URL = ((import.meta.env.VITE_PUBLIC_WEB_URL as string) || 'https://neissermichel.github.io/efectigana/').replace(/\/?$/, '/')

/** Versión con la que se compiló esta app (viene de app-version.json) */
export const APP_VERSION_CODE: number = __APP_VERSION_CODE__
export const APP_VERSION_NAME: string = __APP_VERSION_NAME__

export type RemoteVersion = { versionCode: number; versionName: string; notes?: string; apk: string }

/** Lee la última versión publicada de la APK. Devuelve null si aún no hay APK. */
export async function fetchRemoteVersion(): Promise<RemoteVersion | null> {
  try {
    const base = isNativeApp ? WEB_URL : window.location.origin + import.meta.env.BASE_URL
    const res = await fetch(base + 'version.json?t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return null
    const v = await res.json()
    if (!v?.versionCode || !v?.apk) return null
    return { ...v, apk: new URL(v.apk, base).toString() }
  } catch {
    return null
  }
}

/** Abre una URL fuera de la app (navegador, WhatsApp, descarga de APK) */
export function openExternal(url: string) {
  if (isNativeApp) window.location.href = url // Capacitor la abre en el sistema
  else window.open(url, '_blank', 'noopener')
}

export const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
