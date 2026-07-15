// Lectura desde el Map en memoria. Spec: 6.1

import { PASS_THROUGH, validatorFor } from '../../domain/tax-id/registry'
import type { CountriesCache } from '../../infra/countries.cache'

export type CountryView = {
  code: string
  name: string
  display_currency: string
  fiscal_id: { validated: boolean; hint: string }
}

/**
 * Los paises tal y como los ve el desplegable del alta.
 *
 * CERO consultas a SQLite: sale de la cache de arranque (referencia 6.1). La tabla es
 * minuscula y de solo lectura en v1.
 *
 * El `hint` y `validated` los aporta EL VALIDADOR, no la tabla. Es la misma resolucion
 * que usa el alta (`validatorFor`), y por eso el hint que ve el usuario y la validacion
 * que sufre no pueden desincronizarse. Es tambien lo que hace que el frontend nunca
 * compare un codigo de pais (contrato-api.md 3.1).
 */
export function listCountries(countries: CountriesCache): CountryView[] {
  return [...countries.values()]
    .map((pais) => {
      const validador = pais.scheme === null ? PASS_THROUGH : validatorFor(pais.scheme)

      return {
        code: pais.code,
        name: pais.name,
        display_currency: pais.displayCurrency,
        fiscal_id: { validated: validador.validates, hint: validador.hint },
      }
    })
    // Alfabetico con locale espanol: 'Á' ordena junto a 'A' y 'España' cae antes que
    // 'Estados Unidos'. Un sort() a secas ordena por punto de codigo y manda los
    // acentuados al final. El desplegable lleva busqueda, asi que un orden "util" que
    // nadie pueda predecir seria peor que uno alfabetico (spec 02, seccion 6).
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}
