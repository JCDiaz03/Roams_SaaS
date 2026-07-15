// Arranque: seed si no existe el .db, carga countries en memoria, listen. Spec: 2.1

import { config } from './config'
import { OpenErApiProvider } from './features/rates/rates.provider'
import { RatesService } from './features/rates/rates.service'
import { ensureDatabase } from './infra/seed'
import { StandardCountryRateProvider } from './infra/standard-country-rate.provider'
import { runStartupChecks } from './infra/startup-checks'
import { buildServer } from './server'

async function main(): Promise<void> {
  // 1. La base de datos. Si el .db no existe, se crea el esquema y se puebla: es el
  //    camino unico del README -clonar, npm install, npm run dev- sin ningun paso manual
  //    de base de datos (referencia 2.1).
  const db = ensureDatabase(config.dbPath)

  // 2. Los chequeos de integridad, ANTES de aceptar la primera peticion. Si algo no
  //    cuadra, el proceso NO arranca: un servidor que no levanta es un problema de dos
  //    minutos; uno que lleva un mes guardando identificadores sin validar es otra cosa
  //    (referencia 6.1, 7.3). El resultado ES la cache de paises: un solo recorrido.
  const countries = runStartupChecks(db)

  const app = buildServer({
    db,
    countries,
    taxProvider: new StandardCountryRateProvider(countries),
    ratesService: new RatesService(new OpenErApiProvider(config.ratesUrl)),
    logger: true,
  })

  // Cierre limpio: sin esto, un Ctrl+C deja el fichero .db con el WAL sin consolidar y
  // `npm run dev` reiniciando en bucle se pelea consigo mismo por el puerto.
  for (const senal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(senal, () => {
      void app.close().then(() => {
        db.close()
        process.exit(0)
      })
    })
  }

  await app.listen({ port: config.port, host: '127.0.0.1' })
}

main().catch((e: unknown) => {
  // El fallo ruidoso del arranque acaba aqui. Se imprime entero -es la unica copia del
  // detalle- y se sale con codigo != 0 para que nadie crea que el servidor esta vivo.
  console.error('\nEl servidor NO ha arrancado:\n')
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
