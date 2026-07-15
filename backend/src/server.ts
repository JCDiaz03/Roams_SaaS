// Construye la app Fastify: registro de features, error handler, auth. Spec: 2.1

import Fastify, { type FastifyInstance } from 'fastify'
import type { TaxProvider } from './domain/tax/tax-provider'
import { countriesRoutes } from './features/countries/countries.routes'
import { customersRoutes } from './features/customers/customers.routes'
import { plansRoutes } from './features/plans/plans.routes'
import { ratesRoutes } from './features/rates/rates.routes'
import type { RatesService } from './features/rates/rates.service'
import { simulationsRoutes } from './features/simulations/simulations.routes'
import type { CountriesCache } from './infra/countries.cache'
import type { Db } from './infra/db'
import { registerAuth } from './plugins/auth'
import { registerErrorHandler } from './plugins/error-handler'

export type ServerDeps = {
  db: Db
  countries: CountriesCache
  taxProvider: TaxProvider
  ratesService: RatesService
  logger?: boolean
}

/** Cuerpo maximo de peticion (referencia 7.5). Aqui no se suben ficheros. */
const BODY_LIMIT = 64 * 1024

export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({
    logger: deps.logger ?? false,
    bodyLimit: BODY_LIMIT,
    ajv: {
      customOptions: {
        allErrors: false,
        // NO SE TOCA. Fastify trae removeAdditional:true por defecto, y con eso un
        // `additionalProperties: false` NO devuelve 400: ELIMINA el campo sobrante en
        // silencio y sigue adelante.
        //
        // Eso rompe el invariante 1 justo donde mas importa: un `total_minor` en el
        // cuerpo de POST /simulations se ignoraria calladamente, y "el frontend nunca
        // envia importes" pasaria de ser algo verificable a ser una promesa. Con false,
        // el campo de mas es un 400 (contrato-api.md 1.5) y hay un test que lo fija.
        removeAdditional: false,
      },
    },
  })

  registerErrorHandler(app)
  registerAuth(app)

  // TODA ruta cuelga de /api (directrices 5). Es lo que mantiene el proxy de dev de Vite
  // en una sola regla y garantiza que ningun endpoint choque con una pantalla del SPA
  // (referencia 14.1). El prefijo se pone UNA vez, aqui: si cada feature lo escribiera,
  // la primera que se lo olvide abre el agujero sin que nadie lo note.
  const api = async (scope: FastifyInstance): Promise<void> => {
    // Las dependencias van explicitas por feature, no en un objeto-dios: asi se lee de un
    // vistazo que toca cada una. `countries` no ve la base de datos; `rates` no ve nada
    // del dominio.
    await scope.register(countriesRoutes(deps.countries))
    await scope.register(customersRoutes({ db: deps.db, countries: deps.countries }))
    await scope.register(simulationsRoutes({ db: deps.db, taxProvider: deps.taxProvider }))
    await scope.register(plansRoutes({ db: deps.db }))
    await scope.register(ratesRoutes({ ratesService: deps.ratesService }))
  }

  void app.register(api, { prefix: '/api' })

  return app
}
