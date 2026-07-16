// Sesion { nombre, rol } contada por el SERVIDOR + hasRole() + { currency, source: auto | manual }. Spec: 07-autenticacion.md 6

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { CurrencyCode } from '@saas/pricing'
import { api, ApiError, onSesionCaducada } from './api-client'
import { applyTheme, preferredTheme, toggleTheme as siguienteTema, type Theme } from './theme'

export type Rol = 'admin' | 'sales'

export type Session = {
  nombre: string
  rol: Rol
  currency: CurrencyCode
  currencySource: 'auto' | 'manual'
  theme: Theme
}

/**
 * EL ROL YA NO SE DERIVA AQUI: lo cuenta el servidor (POST /auth/login), que es quien lo
 * aplica de verdad con 401/403. El literal "ADMIN" desaparecio de frontend/src -hay un
 * test que comprueba que son CERO apariciones- y vive en el MockIdentityProvider del
 * backend, con su propio guardian. Los componentes siguen preguntando hasRole('admin'):
 * la costura del ADR 0007 hizo su trabajo -sustituir el mock fue tocar UN modulo- y
 * sigue en pie para cuando el IdentityProvider apunte al sistema real (ADR 0009).
 */
type Api = {
  session: Session | null
  /** true mientras GET /auth/session decide si hay alguien (rehidratacion tras F5). */
  restaurando: boolean
  /** null = dentro. Un string = el mensaje de error que ve quien teclea. */
  login: (usuario: string, password: string) => Promise<string | null>
  logout: () => void
  hasRole: (rol: Rol) => boolean
  /** La elige el comercial a mano: a partir de aqui, `source` es 'manual' para siempre. */
  setCurrency: (currency: CurrencyCode) => void
  /** Preselecciona por pais. NO hace nada si el comercial ya eligio a mano. */
  preselectCurrency: (currency: CurrencyCode) => void
  toggleTheme: () => void
}

const SessionContext = createContext<Api | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [restaurando, setRestaurando] = useState(true)
  const [theme, setTheme] = useState<Theme>(() => {
    const inicial = preferredTheme()
    applyTheme(inicial)
    return inicial
  })

  /** La sesion local desde lo que dijo el servidor. Divisa y tema son del CLIENTE. */
  const sesionDe = useCallback(
    (s: { nombre: string; rol: Rol }): Session => ({
      nombre: s.nombre,
      rol: s.rol,
      currency: 'EUR',
      currencySource: 'auto',
      theme,
    }),
    [theme],
  )

  // Rehidratacion tras F5: el navegador conserva la cookie, asi que se pregunta "quien
  // soy" una vez al arrancar. El 401 aqui significa "nadie", no un error.
  useEffect(() => {
    let cancelado = false

    api.auth
      .session()
      .then((s) => {
        if (!cancelado) setSession(sesionDe(s))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setRestaurando(false)
      })

    return () => {
      cancelado = true
    }
    // Solo al montar: la rehidratacion es una pregunta unica, no una suscripcion.
  }, [])

  // Un 401 AUTH_REQUIRED en CUALQUIER llamada = la sesion del servidor murio (caducidad
  // de 12 h, reinicio, logout en otra pestaña): la local se limpia y la app vuelve al
  // login, en vez de dejar cada pantalla lidiando con un error criptico.
  useEffect(() => {
    onSesionCaducada(() => setSession(null))
  }, [])

  const login = useCallback(
    async (usuario: string, password: string): Promise<string | null> => {
      try {
        const s = await api.auth.login(usuario, password)
        setSession(sesionDe(s))
        return null
      } catch (e) {
        // El mensaje del backend es texto de producto (mensaje UNICO usuario/contraseña,
        // o el del rate limit); la caida de red tiene el suyo propio.
        return e instanceof ApiError ? e.message : 'No hemos podido conectar. Inténtalo de nuevo.'
      }
    },
    [sesionDe],
  )

  // Cerrar sesion revoca EN EL SERVIDOR (la cookie deja de valer al instante) y limpia
  // la local sin esperar la respuesta: quien pulsa "salir" sale, con red o sin ella.
  // El tema sobrevive porque es del dispositivo, no de quien entra.
  const logout = useCallback(() => {
    void api.auth.logout().catch(() => {})
    setSession(null)
  }, [])

  const setCurrency = useCallback((currency: CurrencyCode) => {
    setSession((s) => (s === null ? s : { ...s, currency, currencySource: 'manual' }))
  }, [])

  const preselectCurrency = useCallback((currency: CurrencyCode) => {
    setSession((s) => {
      if (s === null) return s
      // LA ELECCION MANUAL MANDA (referencia 13). Una vez 'manual', nada la vuelve a
      // cambiar en toda la sesion, ni al navegar entre clientes: un selector que se mueve
      // solo despues de que el usuario lo haya tocado es un selector roto, y el comercial
      // que estaba comparando en USD pierde el hilo al abrir la ficha siguiente.
      if (s.currencySource === 'manual' || s.currency === currency) return s
      return { ...s, currency }
    })
  }, [])

  const cambiarTema = useCallback(() => {
    setTheme((actual) => {
      const proximo = siguienteTema(actual)
      applyTheme(proximo)
      setSession((s) => (s === null ? s : { ...s, theme: proximo }))
      return proximo
    })
  }, [])

  const api_ = useMemo<Api>(
    () => ({
      session: session === null ? null : { ...session, theme },
      restaurando,
      login,
      logout,
      // Los componentes preguntan hasRole('admin'), no comparan strings.
      hasRole: (rol) => session?.rol === rol,
      setCurrency,
      preselectCurrency,
      toggleTheme: cambiarTema,
    }),
    [session, restaurando, theme, login, logout, setCurrency, preselectCurrency, cambiarTema],
  )

  return <SessionContext.Provider value={api_}>{children}</SessionContext.Provider>
}

export function useSession(): Api {
  const api = useContext(SessionContext)
  if (api === null) throw new Error('useSession() necesita un <SessionProvider> por encima.')
  return api
}

// El gating visual por rol sigue siendo del frontend (que pantallas se pintan), pero
// desde la spec 07 es UX SOBRE una autorizacion real: los endpoints de admin devuelven
// 403 en el backend. La credencial de demostracion (1111) sigue siendo publica y
// declarada; lo que ya no es de mentira es la sesion.
