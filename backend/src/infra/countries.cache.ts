// Map de paises cargado al arrancar, cada uno con su tipo vigente resuelto (mayor vigente_desde <= hoy). Spec: 6.1, 6.2

import { isCurrencyCode, type CurrencyCode } from '@saas/pricing'
import { hasValidator, registeredSchemes } from '../domain/tax-id/registry'
import type { Db } from './db'

export type CachedCountry = {
  code: string
  name: string
  /** Clave del registro de validadores; null = PassThrough. */
  scheme: string | null
  /** SOLO presentacion: preselecciona el desplegable. Jamas afecta a la facturacion. */
  displayCurrency: CurrencyCode
  /** El tipo VIGENTE hoy, ya resuelto. Puntos basicos. */
  rateBp: number
}

export type CountriesCache = ReadonlyMap<string, CachedCountry>

type Fila = {
  code: string
  name: string
  tax_id_scheme: string | null
  display_currency: string
  rate_bp: number | null
}

/**
 * Carga los paises en memoria, cada uno con su tipo vigente YA resuelto, y de paso
 * ejecuta los chequeos de integridad del arranque (modelo-datos.md 4).
 *
 * Es UN solo recorrido, no dos. El resultado de los chequeos ES la cache: si se
 * construye entera, el sistema esta integro. Separarlos significaria recorrer `countries`
 * dos veces para responder a la misma pregunta.
 *
 * Rendimiento (no-problema, explicito): la tabla es minuscula -diez paises, y con los
 * ~200 del mundo serian unos KB- y de solo lectura en v1. Validacion y calculo hacen
 * lookups O(1) sin tocar SQLite por peticion.
 *
 * SUPUESTO DECLARADO: en v1 los tipos solo cambian via seed/redeploy (no hay panel de
 * impuestos), asi que cache-hasta-reinicio es correcta. El dia que exista ese panel, la
 * escritura debe invalidar la cache (referencia 6.1).
 */
export function loadCountriesCache(db: Db): CountriesCache {
  // La regla de vigencia (referencia 6.2) escrita una vez: la fila vigente es la de mayor
  // vigente_desde <= hoy. El <= date('now') no es cosmetico: una fila con fecha futura es
  // legitima -un tipo anunciado y no aplicable aun- y NO debe aplicarse.
  const filas = db
    .prepare(
      `SELECT c.code, c.name, c.tax_id_scheme, c.display_currency,
              (SELECT r.rate_bp FROM tax_rates r
                WHERE r.country = c.code AND r.vigente_desde <= date('now')
                ORDER BY r.vigente_desde DESC LIMIT 1) AS rate_bp
         FROM countries c
        ORDER BY c.name`,
    )
    .all() as Fila[]

  if (filas.length === 0) {
    throw new Error(
      'No hay ningun pais en `countries`. Sin cobertura fiscal no se puede dar de alta a ' +
        'nadie: la base de datos esta a medias o el seed no llego a correr.',
    )
  }

  const cache = new Map<string, CachedCountry>()

  for (const fila of filas) {
    // --- Chequeo 1: todo tax_id_scheme no nulo existe en el registro (referencia 7.3).
    if (fila.tax_id_scheme !== null && !hasValidator(fila.tax_id_scheme)) {
      throw new Error(
        `Integridad dato<->codigo: el pais ${fila.code} declara el esquema fiscal ` +
          `"${fila.tax_id_scheme}", que no esta en el registro de validadores ` +
          `(registrados: ${registeredSchemes().join(', ') || 'ninguno'}). ` +
          'Anade su TaxIdValidator o pon la columna a NULL. Arrancar igual daria de alta ' +
          'clientes SIN VALIDAR marcados como "unvalidated", y nadie se enteraria.',
      )
    }

    // --- Chequeo 2: todo pais tiene tipo vigente (referencia 6.1).
    if (fila.rate_bp === null) {
      throw new Error(
        `Integridad: el pais ${fila.code} no tiene ningun tipo impositivo vigente en ` +
          '`tax_rates` (con vigente_desde <= hoy). Sin esto, "cliente sin impuesto ' +
          'calculable es inexpresable" seria solo una frase: el alta lo aceptaria y el ' +
          'calculo reventaria despues. Ojo a las filas con fecha FUTURA: no cuentan.',
      )
    }

    // --- Chequeo 3 (la mitad de countries): la divisa de presentacion existe en el enum.
    if (!isCurrencyCode(fila.display_currency)) {
      throw new Error(
        `Integridad dato<->codigo: el pais ${fila.code} declara la divisa de ` +
          `presentacion "${fila.display_currency}", que no esta en el enum Currency de ` +
          '@saas/pricing. El desplegable la ofreceria y no habria como formatearla.',
      )
    }

    cache.set(fila.code, {
      code: fila.code,
      name: fila.name,
      scheme: fila.tax_id_scheme,
      displayCurrency: fila.display_currency,
      rateBp: fila.rate_bp,
    })
  }

  return cache
}
