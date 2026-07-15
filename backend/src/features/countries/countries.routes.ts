// GET /countries: codigo, nombre, display_currency y fiscal_id { validated, hint } ya resuelto. Spec: 6.1, 7.2, 12

import type { FastifyInstance } from 'fastify'
import type { CountriesCache } from '../../infra/countries.cache'
import { listCountries } from './countries.repo'

/**
 * Alimenta el desplegable del alta y el hint fiscal.
 *
 * Sin parametros, y es a proposito: no hay nada que filtrar en diez filas, y una ruta sin
 * entrada es una ruta sin superficie de ataque.
 */
export function countriesRoutes(countries: CountriesCache) {
  return async (app: FastifyInstance): Promise<void> => {
    app.get('/countries', async () => ({ countries: listCountries(countries) }))
  }
}
