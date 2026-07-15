// Consumo de GET /rates + estado de tipos desactualizados. Ref: 9, 13.1

import { useCallback, useEffect, useState } from 'react'
import { api, type Rates } from './api-client'

export type EstadoRates =
  | { estado: 'cargando' }
  /** `stale` = vienen de fallback: la UI DEBE pintar el badge ambar con `as_of`. */
  | { estado: 'listo'; rates: Rates }
  /** Ni tipos ni cache: el selector se deshabilita y todo se ve en su divisa real. */
  | { estado: 'error' }

/**
 * Los tipos de cambio, una vez por sesion de pantalla.
 *
 * No hay reintento automatico ni refresco: la cache de servidor ya garantiza que todo el
 * equipo ve el mismo numero a la misma hora (referencia 9), y los tipos cambian una vez
 * al dia. Un reintento en bucle aqui solo martillearia al backend.
 */
export function useRates(): EstadoRates & { reintentar: () => void } {
  const [estado, setEstado] = useState<EstadoRates>({ estado: 'cargando' })

  const cargar = useCallback(() => {
    let cancelado = false
    setEstado({ estado: 'cargando' })

    api
      .rates()
      .then((rates) => {
        if (!cancelado) setEstado({ estado: 'listo', rates })
      })
      .catch(() => {
        // Un 503 RATES_UNAVAILABLE y una caida de red se tratan igual: no hay tipos. La
        // diferencia no le sirve de nada al comercial, y los importes de FACTURACION
        // siguen siendo correctos porque no dependen de esta API (referencia 4.1).
        if (!cancelado) setEstado({ estado: 'error' })
      })

    return () => {
      cancelado = true
    }
  }, [])

  useEffect(() => cargar(), [cargar])

  return { ...estado, reintentar: cargar }
}
