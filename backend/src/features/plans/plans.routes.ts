// GET /plans (activos; ?include_archived=true para admin), POST /plans, PUT /plans/{id}, DELETE /plans/{id}. Spec: 12

import type { FastifyInstance } from 'fastify'
import type { Db } from '../../infra/db'
import { AppError } from '../../plugins/error-handler'
import type { Plantilla } from './plan-template.validation'
import { listPlans } from './plans.repo'
import {
  createPlanSchema,
  deletePlanSchema,
  listPlansSchema,
  updatePlanSchema,
} from './plans.schemas'
import { archivar, crearPlan, versionarPlan } from './plans.service'

// PROTEGIDAS DE VERDAD desde la spec 07: las mutaciones declaran `requiereRol: 'admin'`
// en su config -visible en code review, como el esquema- y el hook de auth las corta con
// un 403. El gating del frontend sigue existiendo, pero ahora es UX sobre una
// autorizacion real, no en vez de ella. Siguen colgando de /plans y no de /admin/*
// porque el recurso es el mismo; lo que cambia es quien puede escribirlo.

export function plansRoutes({ db }: { db: Db }) {
  return async (app: FastifyInstance): Promise<void> => {
    app.get('/plans', { schema: listPlansSchema }, async (req) => {
      const { include_archived } = req.query as { include_archived: boolean }

      // El parametro depende del ROL, no la ruta entera: el listado de activos alimenta
      // el alta (cualquier comercial); los archivados son del panel de admin (spec 07, 5.3).
      if (include_archived && req.identity?.rol !== 'admin') {
        throw new AppError(403, 'AUTH_FORBIDDEN', 'Solo administración puede ver los planes archivados.')
      }

      return { plans: listPlans(db, include_archived) }
    })

    app.post('/plans', { schema: createPlanSchema, config: { requiereRol: 'admin' } }, async (req, reply) => {
      const plan = crearPlan(db, req.body as Plantilla)
      return reply.status(201).header('Location', `/api/plans/${plan.id}`).send(plan)
    })

    // "Editar" NO modifica el plan: crea una version nueva y archiva la anterior.
    //
    // Devuelve 201 y no 200 porque es la respuesta correcta a "se ha creado un recurso
    // nuevo", y aqui eso es LITERALMENTE lo que ha pasado. El `id` del cuerpo devuelto no
    // es el `id` de la URL, y ese desajuste aparente ES la semantica de la operacion
    // (contrato-api.md 4.2).
    app.put('/plans/:id', { schema: updatePlanSchema, config: { requiereRol: 'admin' } }, async (req, reply) => {
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
    app.delete('/plans/:id', { schema: deletePlanSchema, config: { requiereRol: 'admin' } }, async (req) => {
      const { id } = req.params as { id: number }
      return archivar(db, id)
    })
  }
}
