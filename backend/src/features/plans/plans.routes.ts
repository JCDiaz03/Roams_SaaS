// GET /plans (activos; ?include_archived=true para admin), POST /plans, PUT /plans/{id}, DELETE /plans/{id}. Spec: 12

import type { FastifyInstance } from 'fastify'
import type { Db } from '../../infra/db'
import { AppError } from '../../plugins/error-handler'
import type { Plantilla } from './plan-template.validation'
import { findPlanById, listPlans } from './plans.repo'
import {
  createPlanSchema,
  deletePlanSchema,
  getPlanSchema,
  listPlansSchema,
  updatePlanSchema,
} from './plans.schemas'
import { archivarOEliminar, crearPlan, versionarPlan } from './plans.service'

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

    // Detalle de un plan, ARCHIVADO INCLUIDO y sin rol (spec 08, 2): lo que exige admin
    // es el listado de archivados, no un plan concreto — ese ya viaja entero embebido en
    // la ficha de cualquier cliente antiguo. Endurecer esto con rol romperia el enlace
    // desde la ficha de Fjord sin proteger nada que no viaje ya.
    app.get('/plans/:id', { schema: getPlanSchema }, async (req) => {
      const { id } = req.params as { id: number }

      const plan = findPlanById(db, id)
      if (plan === undefined) {
        // 404 y no 422: aqui el plan ES el recurso de la URL (contrato-api.md 5).
        throw new AppError(404, 'PLAN_NOT_FOUND', 'Ese plan no existe.')
      }
      return plan
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

    // DELETE archiva... salvo el plan JAMAS USADO, que se elimina de verdad (ADR 0013):
    // cero clientes y cero simulaciones = nada que proteger, y conservar el plan que un
    // admin creo por error solo acumula ruido. Para el usado, la regla de siempre: el
    // verbo describe la intencion ("quitar de circulacion") y el sistema la cumple sin
    // romper integridad ni presupuestos enviados (contrato-api.md 4.3). La condicion la
    // decide EL SERVIDOR: la pantalla no sabe quien usa que.
    //
    // Devuelve 200 con el plan + `removed`, no 204: la UI actualiza el badge (o quita la
    // fila) con lo devuelto, sin una segunda peticion.
    app.delete('/plans/:id', { schema: deletePlanSchema, config: { requiereRol: 'admin' } }, async (req) => {
      const { id } = req.params as { id: number }
      return archivarOEliminar(db, id)
    })
  }
}
