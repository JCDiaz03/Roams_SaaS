// GET /plans (activos; ?include_archived=true para admin), POST /plans, PUT /plans/{id}, DELETE /plans/{id}. Spec: 12
//
// Estado: (parcial). En Fase 1 solo existe el GET, que es lo que necesitan el alta y el
// panel de admin para listar. POST/PUT/DELETE son Fase 2 (roadmap 4) y no se abren hasta
// que el gate de Fase 1 este en verde.

import type { FastifyInstance } from 'fastify'
import type { Db } from '../../infra/db'
import { listPlans } from './plans.repo'
import { listPlansSchema } from './plans.schemas'

export function plansRoutes({ db }: { db: Db }) {
  return async (app: FastifyInstance): Promise<void> => {
    app.get('/plans', { schema: listPlansSchema }, async (req) => {
      const { include_archived } = req.query as { include_archived: boolean }
      return { plans: listPlans(db, include_archived) }
    })
  }
}
