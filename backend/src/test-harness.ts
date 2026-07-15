// Arnes de los tests de integracion: una app real contra una base EN MEMORIA. Spec: 15
//
// Por que en memoria (`:memory:`) y no un .db temporal: cada test arranca con la base
// sembrada y limpia, no hay ficheros que borrar, y una suite entera tarda menos que un
// solo fsync. El esquema y el seed son LOS MISMOS que en produccion -no hay fixtures
// paralelos-, asi que un test que pasa aqui prueba el camino que corre de verdad.
//
// Se usa app.inject() de Fastify: no abre un puerto, no hay red, y aun asi recorre el
// ciclo completo -esquema JSON, hooks, error handler, serializacion-. Es integracion de
// verdad, no llamar al servicio a mano.

import type { FastifyInstance } from 'fastify'
import { RatesService } from './features/rates/rates.service'
import type { RatesPayload, RatesProvider } from './features/rates/rates.provider'
import { openDb, type Db } from './infra/db'
import { migrate } from './infra/migrate'
import { seed } from './infra/seed'
import { StandardCountryRateProvider } from './infra/standard-country-rate.provider'
import { runStartupChecks } from './infra/startup-checks'
import { buildServer } from './server'

/** Un RatesProvider de mentira, para no tocar la red en los tests. */
export class FakeRatesProvider implements RatesProvider {
  llamadas = 0
  respuesta: RatesPayload | Error = {
    rates: { EUR: 1, USD: 1.0842, GBP: 0.8531, CHF: 0.9412, JPY: 168.35 },
    asOf: new Date().toISOString(),
    nextUpdate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  }
  /** Retardo artificial, para probar la peticion compartida en vuelo. */
  retardoMs = 0

  async fetchRates(): Promise<RatesPayload> {
    this.llamadas += 1
    if (this.retardoMs > 0) await new Promise((r) => setTimeout(r, this.retardoMs))
    if (this.respuesta instanceof Error) throw this.respuesta
    return this.respuesta
  }
}

export type Harness = {
  app: FastifyInstance
  db: Db
  rates: FakeRatesProvider
  close: () => Promise<void>
}

export function crearHarness(): Harness {
  const db = openDb(':memory:')
  migrate(db)
  seed(db)

  const countries = runStartupChecks(db)
  const rates = new FakeRatesProvider()

  const app = buildServer({
    db,
    countries,
    taxProvider: new StandardCountryRateProvider(countries),
    ratesService: new RatesService(rates),
  })

  return {
    app,
    db,
    rates,
    close: async () => {
      await app.close()
      db.close()
    },
  }
}

/** El id de un plan sembrado, por nombre y version. Los tests no adivinan ids. */
export function planId(db: Db, name: string, version: number): number {
  const fila = db.prepare('SELECT id FROM plans WHERE name = ? AND version = ?').get(name, version) as
    | { id: number }
    | undefined

  if (fila === undefined) throw new Error(`El seed no trae "${name}" v${version}`)
  return fila.id
}

/** El id de un cliente sembrado, por nombre. */
export function customerId(db: Db, companyName: string): number {
  const fila = db.prepare('SELECT id FROM customers WHERE company_name = ?').get(companyName) as
    | { id: number }
    | undefined

  if (fila === undefined) throw new Error(`El seed no trae al cliente "${companyName}"`)
  return fila.id
}
