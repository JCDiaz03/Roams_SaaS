// Los tipos de cambio, compartidos por toda la app. Ref: 9, 13.1

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { useRates, type EstadoRates } from './use-rates'

type Api = EstadoRates & { reintentar: () => void }

const RatesContext = createContext<Api | null>(null)

/**
 * Una sola peticion de tipos para toda la app.
 *
 * La topbar (badge de desactualizados + selector) y el simulador (conversion) necesitan
 * lo mismo. Con un useRates() en cada uno serian dos peticiones y, peor, dos estados que
 * pueden discrepar: el badge diciendo que hay tipos y el simulador diciendo que no.
 *
 * No sustituye a la cache de servidor ni compite con ella: aquella garantiza que todo el
 * EQUIPO ve el mismo numero (referencia 9); esta, que toda la PANTALLA lo ve.
 */
export function RatesProvider({ children }: { children: ReactNode }) {
  const rates = useRates()
  return <RatesContext.Provider value={rates}>{children}</RatesContext.Provider>
}

export function useRatesContext(): Api {
  const api = useContext(RatesContext)
  if (api === null) throw new Error('useRatesContext() necesita un <RatesProvider> por encima.')
  return api
}
