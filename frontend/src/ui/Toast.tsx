// Confirmacion de guardado y error no bloqueante. Diseno: 3

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import styles from './Toast.module.css'
import { IconCheck, IconWarning } from './icons'

type Tone = 'ok' | 'error'
type Toast = { id: number; msg: string; tone: Tone }

type Api = {
  /** Confirmacion de una accion que ha ido bien ("Simulacion guardada"). */
  showOk: (msg: string) => void
  /** Error NO bloqueante. Un error de validacion va junto al campo, no aqui (13.1). */
  showError: (msg: string) => void
}

const ToastContext = createContext<Api | null>(null)

const DURACION_MS = 2600

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const siguienteId = useRef(0)

  const show = useCallback((msg: string, tone: Tone) => {
    const id = siguienteId.current
    siguienteId.current += 1

    setToasts((previos) => [...previos, { id, msg, tone }])
    // Cada toast se lleva su propio temporizador y se borra por id. El prototipo guarda
    // un unico timeout y lo pisa: con dos toasts seguidos, el segundo mata al primero.
    setTimeout(() => setToasts((previos) => previos.filter((t) => t.id !== id)), DURACION_MS)
  }, [])

  const api = useMemo<Api>(
    () => ({
      showOk: (msg) => show(msg, 'ok'),
      showError: (msg) => show(msg, 'error'),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* aria-live polite: se anuncia cuando quien escucha termine lo que estaba
          leyendo. `assertive` interrumpiria, y un "guardado" no es una urgencia. */}
      <div className={styles.wrap} role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={[styles.toast, t.tone === 'error' ? styles.error : ''].join(' ')}>
            <span aria-hidden="true">{t.tone === 'ok' ? <IconCheck /> : <IconWarning />}</span>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): Api {
  const api = useContext(ToastContext)
  if (api === null) throw new Error('useToast() necesita un <ToastProvider> por encima.')
  return api
}
