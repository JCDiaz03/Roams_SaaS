// GET /plans (activos; ?include_archived=true para admin), POST /plans, PUT /plans/{id}, DELETE /plans/{id}. Spec: 12

import type { FastifyInstance } from 'fastify'
import type { Db } from '../../infra/db'
import type { Plantilla } from './plan-template.validation'
import { listPlans } from './plans.repo'
import {
  createPlanSchema,
  listPlansSchema,
  planIdSchema,
  updatePlanSchema,
} from './plans.schemas'
import { archivar, crearPlan, versionarPlan } from './plans.service'

// SIN PROTECCION REAL, y es un riesgo aceptado y declarado (referencia 8.3): el rol solo
// se comprueba en el frontend, asi que cualquiera puede llamar a estas rutas. Aceptable en
// una herramienta interna con el auth mock declarado; lo que no vale es CREERSE protegido.
// Por eso cuelgan de /plans y no de un /admin/* que solo daria ilusion de seguridad.

export function plansRoutes({ db }: { db: Db }) {
  return async (app: FastifyInstance): Promise<void> => {
    app.get('/plans', { schema: listPlansSchema }, async (req) => {
      const { include_archived } = req.query as { include_archived: boolean }
      return { plans: listPlans(db, include_archived) }
    })

    app.post('/plans', { schema: createPlanSchema }, async (req, reply) => {
      const plan = crearPlan(db, req.body as Plantilla)
      return reply.status(201).header('Location', `/api/plans/${plan.id}`).send(plan)
    })

    // "Editar" NO modifica el plan: crea una version nueva y archiva la anterior.
    //
    // Devuelve 201 y no 200 porque es la respuesta correcta a "se ha creado un recurso
    // nuevo", y aqui eso es LITERALMENTE lo que ha pasado. El `id` del cuerpo devuelto no
    // es el `id` de la URL, y ese desajuste aparente ES la semantica de la operacion
    // (contrato-api.md 4.2).
    app.put('/plans/:id', { schema: updatePlanSchema }, async (req, reply) => {
      const { id } = req.params as { id: number }
      const nuevo = versionarPlan(db, id, req.body as Plantilla)
      return reply.status(201).header('Location', `/api/plans/${nuevo.id}`).send(nuevo)
    })

    // DELETE archiva, no borra. Es una desviacion CONSCIENTE de la semantica HTTP y es la
    // correcta aqui: el verbo describe la intencion del admin ("quitar este plan de
    // circulacion") y el sistema la cumple de la unica forma que no rompe integridad
    // referencial ni presupuestos ya enviados (contrato-api.md 4.3).
    //
    // Devuelve 200 con el plan, no 204: la UI actualiza el badge de estado con lo
    // devuelto, sin una segunda peticion.
    app.delete('/plans/:id', { schema: planIdSchema }, async (req) => {
      const { id } = req.params as { id: number }
      return archivar(db, id)
    })
  }
}
