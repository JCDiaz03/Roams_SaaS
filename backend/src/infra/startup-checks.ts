// Chequeo doble: esquema sin validador registrado o pais sin tipo vigente = fallo ruidoso. Spec: 7.3

import { isCurrencyCode } from '@saas/pricing'
import { loadCountriesCache, type CountriesCache } from './countries.cache'
import type { Db } from './db'

/**
 * Todo lo que se comprueba ANTES de aceptar la primera peticion. Falla RUIDOSAMENTE.
 *
 * No son tests: es codigo de produccion, porque protegen de una deriva dato<->codigo que
 * puede aparecer con cualquier seed futuro, y esa deriva es silenciosa por naturaleza.
 * Convierten los "inexpresables" del diseno en garantias en vez de en afirmaciones
 * (referencia 6.1, 7.3).
 *
 * La regla: si algo puede degradar en SILENCIO, se comprueba aqui y se aborta. Un
 * servidor que no arranca es un problema de dos minutos; un servidor que lleva un mes
 * guardando identificadores sin validar es otra cosa.
 *
 * Devuelve la cache porque los chequeos 1 y 2 SON su construccion: un solo recorrido de
 * `countries` (modelo-datos.md 4).
 */
export function runStartupChecks(db: Db): CountriesCache {
  const countries = loadCountriesCache(db)
  assertPlanCurrencies(db)
  return countries
}

/**
 * Chequeo 3 (la mitad de plans): toda divisa de facturacion existe en el enum Currency.
 *
 * La otra mitad -el display_currency de countries- va dentro de loadCountriesCache,
 * porque alli ya se recorre la tabla.
 *
 * Por que no es un CHECK del DDL: el universo de divisas vive en el codigo, no en la
 * base de datos (referencia 4.3). Un CHECK con la lista cerrada obligaria a migrar para
 * anadir una divisa, que es justo lo que el diseno evita.
 */
function assertPlanCurrencies(db: Db): void {
  const filas = db.prepare('SELECT DISTINCT currency FROM plans').all() as { currency: string }[]

  for (const { currency } of filas) {
    if (!isCurrencyCode(currency)) {
      throw new Error(
        `Integridad dato<->codigo: hay planes con divisa de facturacion "${currency}", ` +
          'que no esta en el enum Currency de @saas/pricing. Sin minor_unit no hay como ' +
          'formatear sus importes ni saber cuantos decimales tiene.',
      )
    }
  }
}
