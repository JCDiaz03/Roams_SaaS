// Implementacion de TaxProvider: lee el tipo vigente del Map de paises, no de SQLite. Spec: 6.2, 6.1

import type { TaxProvider } from '../domain/tax/tax-provider'
import type { CountriesCache } from './countries.cache'

/**
 * El tipo ESTANDAR del pais del cliente. La implementacion de hoy del puerto TaxProvider.
 *
 * Vive en infra/ y no en domain/ porque toca datos: el puerto es puro, esto lee de la
 * cache de arranque. Sin IO por peticion (referencia 6.2).
 *
 * Manana un VIESProvider con reverse charge intracomunitario se enchufa en su lugar sin
 * tocar el motor, que es toda la razon de que el puerto exista.
 */
export class StandardCountryRateProvider implements TaxProvider {
  constructor(private readonly countries: CountriesCache) {}

  rateBpFor(countryCode: string): number {
    const pais = this.countries.get(countryCode)

    if (pais === undefined) {
      // Inalcanzable si el alta hace su trabajo: un cliente de un pais sin fila en
      // `countries` no se puede dar de alta (referencia 7.3). Lanza en vez de devolver 0
      // porque un 0 aqui seria una factura sin IVA que nadie notaria.
      throw new Error(
        `No hay tipo impositivo para el pais "${countryCode}": no esta en la cache de ` +
          'paises. Un cliente de un pais no soportado no deberia existir.',
      )
    }

    return pais.rateBp
  }
}
