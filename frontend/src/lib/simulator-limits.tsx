// Limites visuales de los sliders del simulador, ajustables en /ajustes. Spec: 10
//
// Son PRESENTACION, no negocio: acotan hasta donde llega el arrastre para que una
// empresa que trabaja con 2-20 GB no tenga que apuntar fino sobre una ranura de 3000.
// El tope real de lo que se puede simular sigue siendo el del esquema del backend
// (simulations.schemas.ts, TOPES), que no se toca desde aqui.

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Metric } from '@saas/pricing'

// ============================================================================
// LOS TOPES DEL AJUSTE — el sitio para cambiarlos a mano si hicieran falta otros:
//
//  * LIMITE_MINIMO: por debajo, el slider no sirve ni para el caso pequeño. Pedidos
//    por producto: 70 usuarios, 100 GB, 1.000 llamadas.
//  * LIMITE_MAXIMO: los MISMOS topes anti-DoS del backend (TOPES de
//    backend/src/features/simulations/simulations.schemas.ts). Subirlos aqui sin
//    subirlos alli solo produciria 400 al guardar.
//  * LIMITE_POR_DEFECTO: el maximo visual de siempre (lo consume tambien META de
//    MetricSliderCard). Es lo que hay hasta que alguien lo ajusta en /ajustes.
// ============================================================================
export const LIMITE_MINIMO: Record<Metric, number> = {
  users: 70,
  storage_gb: 100,
  api_calls: 1_000,
}

export const LIMITE_MAXIMO: Record<Metric, number> = {
  users: 1_000_000,
  storage_gb: 10_000_000,
  api_calls: 1_000_000_000,
}

export const LIMITE_POR_DEFECTO: Record<Metric, number> = {
  users: 200,
  storage_gb: 3_000,
  api_calls: 200_000,
}

/** Acota un limite tecleado a [minimo, maximo]: ni negativos, ni un maximo absurdo. */
export function clampLimite(metric: Metric, valor: number): number {
  const entero = Math.trunc(valor)
  return Math.min(LIMITE_MAXIMO[metric], Math.max(LIMITE_MINIMO[metric], entero))
}

type Api = {
  /** El maximo visual vigente de cada slider. */
  limites: Record<Metric, number>
  /** Fija un limite, ya acotado por clampLimite. */
  setLimite: (metric: Metric, valor: number) => void
  restaurar: () => void
}

const LimitsContext = createContext<Api | null>(null)

/**
 * Estado de la sesion de trabajo, como la divisa o el tema: no se persiste en el
 * backend ni en localStorage — son preferencias del rato, y el dia que haya usuarios
 * de verdad seran del usuario, no del navegador (misma nota que lib/theme.ts).
 */
export function SimulatorLimitsProvider({ children }: { children: ReactNode }) {
  const [limites, setLimites] = useState<Record<Metric, number>>(LIMITE_POR_DEFECTO)

  const setLimite = useCallback((metric: Metric, valor: number) => {
    setLimites((l) => ({ ...l, [metric]: clampLimite(metric, valor) }))
  }, [])

  const restaurar = useCallback(() => setLimites(LIMITE_POR_DEFECTO), [])

  const api = useMemo<Api>(() => ({ limites, setLimite, restaurar }), [limites, setLimite, restaurar])

  return <LimitsContext.Provider value={api}>{children}</LimitsContext.Provider>
}

export function useSimulatorLimits(): Api {
  const api = useContext(LimitsContext)
  if (api === null) {
    throw new Error('useSimulatorLimits() necesita un <SimulatorLimitsProvider> por encima.')
  }
  return api
}
