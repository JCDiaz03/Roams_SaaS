// GET /countries: codigo, nombre, display_currency y fiscal_id { validated, hint } ya resuelto. Spec: 6.1, 7.2, 12

import type { FastifyInstance } from 'fastify'
import type { CountriesCache } from '../../infra/countries.cache'
import { listCountries } from './countries.repo'
import { listCountriesSchema } from './countries.schemas'

/**
 * Alimenta el desplegable del alta y el hint fiscal.
 *
 * Sin parametros, y es a proposito: no hay nada que filtrar en diez filas, y una ruta sin
 * entrada es una ruta sin superficie de ataque.
 */
export function countriesRoutes(countries: CountriesCache) {
  return async (app: FastifyInstance): Promise<void> => {
    // La vista se calcula UNA vez, aqui: la cache de paises no cambia en caliente
    // (supuesto declarado en referencia 6.1), asi que mapear y ordenar por peticion
    // seria trabajo repetido. El dia que exista un panel de impuestos, esto se invalida
    // junto con la cache.
    const vista = listCountries(countries)

    app.get('/countries', { schema: listCountriesSchema }, async () => ({ countries: vista }))
  }
}
