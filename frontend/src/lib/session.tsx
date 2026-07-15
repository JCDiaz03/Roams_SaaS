// Sesion { nombre, rol } derivada una sola vez + hasRole() + { currency, source: auto | manual }. Ref: 8.2, 13

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { CurrencyCode } from '@saas/pricing'
import { applyTheme, preferredTheme, toggleTheme as siguienteTema, type Theme } from './theme'

export type Rol = 'admin' | 'sales'

export type Session = {
  nombre: string
  rol: Rol
  currency: CurrencyCode
  currencySource: 'auto' | 'manual'
  theme: Theme
}

const PASSWORD_MOCK = '1111'

/**
 * EL UNICO SITIO DEL FRONTEND DONDE SE COMPARA "ADMIN".
 *
 * Toda la tesis del auth mock esta aqui (referencia 8.2): la deuda no depende de que el
 * auth sea falso, sino de DONDE vive la comprobacion de rol. Con la derivacion en un solo
 * punto, sustituir el mock por auth real = sustituir esta funcion. Con un
 * `if (usuario === "ADMIN")` esparcido por veinte componentes, sustituirlo significa
 * encontrarlos y tocarlos todos, y el que se olvide no falla: deja de proteger.
 *
 * Hay un test que comprueba que el literal aparece una sola vez en frontend/src.
 */
function derivarRol(usuario: string): Rol {
  return usuario.trim().toUpperCase() === 'ADMIN' ? 'admin' : 'sales'
}

type Api = {
  session: Session | null
  login: (usuario: string, password: string) => boolean
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
  const [theme, setTheme] = useState<Theme>(() => {
    const inicial = preferredTheme()
    applyTheme(inicial)
    return inicial
  })

  const login = useCallback(
    (usuario: string, password: string): boolean => {
      if (password !== PASSWORD_MOCK || usuario.trim() === '') return false

      setSession({
        nombre: usuario.trim(),
        // El rol se calcula UNA sola vez, aqui.
        rol: derivarRol(usuario),
        currency: 'EUR',
        currencySource: 'auto',
        theme,
      })
      return true
    },
    [theme],
  )

  // Cerrar sesion limpia nombre, rol y divisa: la sesion muere entera (referencia 8.2,
  // regla 2). El tema sobrevive porque es del dispositivo, no de quien entra.
  const logout = useCallback(() => setSession(null), [])

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

  const api = useMemo<Api>(
    () => ({
      session: session === null ? null : { ...session, theme },
      login,
      logout,
      // Los componentes preguntan hasRole('admin'), no comparan strings.
      hasRole: (rol) => session?.rol === rol,
      setCurrency,
      preselectCurrency,
      toggleTheme: cambiarTema,
    }),
    [session, theme, login, logout, setCurrency, preselectCurrency, cambiarTema],
  )

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>
}

export function useSession(): Api {
  const api = useContext(SessionContext)
  if (api === null) throw new Error('useSession() necesita un <SessionProvider> por encima.')
  return api
}

// RIESGO ACEPTADO Y DECLARADO (referencia 8.3): un rol comprobado solo en el frontend NO
// es seguridad. Cualquiera puede llamar a los endpoints de admin directamente. Es
// aceptable en una herramienta interna con el mock declarado; lo que no vale es CREERSE
// protegido. La contrasena hardcodeada tampoco se ofusca: ofuscarla seria fingir.
