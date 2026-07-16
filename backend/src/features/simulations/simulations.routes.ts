// POST /simulations, GET /customers/{id}/simulations. Spec: 12

import type { FastifyInstance } from 'fastify'
import type { TaxProvider } from '../../domain/tax/tax-provider'
import type { Db } from '../../infra/db'
import { countSimulationsByCustomer } from './simulations.repo'
import { historySchema, postSimulationSchema } from './simulations.schemas'
import { crearSimulacion, historialDe, type EntradasSimulacion } from './simulations.service'

type Deps = { db: Db; taxProvider: TaxProvider }

export function simulationsRoutes({ db, taxProvider }: Deps) {
  return async (app: FastifyInstance): Promise<void> => {
    app.post('/simulations', { schema: postSimulationSchema }, async (req, reply) => {
      const sim = crearSimulacion(db, taxProvider, req.body as EntradasSimulacion)
      return reply.status(201).header('Location', `/api/simulations/${sim.id}`).send(sim)
    })

    // El historial cuelga del cliente, no de /simulations: es una coleccion suya. Vive en
    // esta feature y no en customers/ porque lo que devuelve es una simulacion, y quien
    // toque el formato de la simulacion tiene que ver los dos sitios a la vez.
    app.get('/customers/:id/simulations', { schema: historySchema }, async (req) => {
      const { id } = req.params as { id: number }
      const { limit } = req.query as { limit: number }

      const simulations = historialDe(db, id, limit)

      // Mismo tipo de elemento que la respuesta del POST, a proposito: la card del
      // historial y la recien guardada son el MISMO componente, y una divergencia de
      // forma aqui se paga en el frontend con dos mapeos que mantener sincronizados.
      // El total es el de la COLECCION, no el de la pagina.
      return { simulations, total: countSimulationsByCustomer(db, id) }
    })
  }
}
