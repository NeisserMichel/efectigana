import { useEffect, useState, type ReactNode } from 'react'
import { App as CapApp } from '@capacitor/app'
import { APP_VERSION_CODE, APP_VERSION_NAME, fetchRemoteVersion, isIOS, isNativeApp, openExternal, type RemoteVersion } from '../lib/platform'

/**
 * Solo dentro de la APK: si en la web hay una versión más nueva,
 * bloquea la app y obliga a descargar la actualización.
 */
export function ForceUpdateGate({ children }: { children: ReactNode }) {
  const [update, setUpdate] = useState<RemoteVersion | null>(null)

  useEffect(() => {
    if (!isNativeApp) return
    const check = () =>
      fetchRemoteVersion().then((v) => {
        if (v && v.versionCode > APP_VERSION_CODE) setUpdate(v)
      })
    check()
    const sub = CapApp.addListener('resume', check)
    const t = setInterval(check, 10 * 60 * 1000)
    return () => {
      clearInterval(t)
      sub.then((s) => s.remove())
    }
  }, [])

  if (!update) return <>{children}</>

  return (
    <div className="force-update">
      <div className="fu-card">
        <img src={import.meta.env.BASE_URL + 'icon.svg'} alt="" />
        <h2>Nueva versión disponible</h2>
        <p className="fu-version">
          Tienes la versión {APP_VERSION_NAME}. Para seguir jugando debes instalar la versión <b>{update.versionName}</b>.
        </p>
        {update.notes && <p className="fu-notes">{update.notes}</p>}
        <button className="btn gold block" onClick={() => openExternal(update.apk)}>
          ⬇ Actualizar ahora
        </button>
        <ol className="fu-steps">
          <li>Se descargará el archivo <b>EfectiGana.apk</b>.</li>
          <li>Ábrelo desde la notificación o tu carpeta de Descargas.</li>
          <li>
            Toca <b>Actualizar</b>. Tu cuenta y tu saldo se mantienen.
          </li>
        </ol>
      </div>
    </div>
  )
}

/** Solo en la web (no en la APK ni en iPhone): botón para descargar la app Android */
export function DownloadAppButton({ compact = false }: { compact?: boolean }) {
  const [v, setV] = useState<RemoteVersion | null>(null)
  const [help, setHelp] = useState(false)

  useEffect(() => {
    if (isNativeApp || isIOS) return
    fetchRemoteVersion().then(setV)
  }, [])

  if (!v) return null

  return (
    <div className={'download-app' + (compact ? ' compact' : '')}>
      <a className="btn android block" href={v.apk} download="EfectiGana.apk" onClick={() => setHelp(true)}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            fill="currentColor"
            d="M17.6 9.48l1.84-3.18a.38.38 0 0 0-.66-.38l-1.86 3.22a11.4 11.4 0 0 0-9.84 0L5.22 5.92a.38.38 0 0 0-.66.38L6.4 9.48A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z"
          />
        </svg>
        Descargar app para Android
        <small>v{v.versionName}</small>
      </a>
      {help && (
        <p className="download-help">
          Cuando termine la descarga, abre <b>EfectiGana.apk</b>. Si Android lo pide, permite <b>“Instalar apps desconocidas”</b> para tu
          navegador y toca <b>Instalar</b>.
        </p>
      )}
    </div>
  )
}
