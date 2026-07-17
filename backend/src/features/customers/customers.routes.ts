// POST /customers, GET /customers?search=, GET /customers/{id}, PATCH /customers/{id}. Spec: 12

import type { FastifyInstance } from 'fastify'
import type { CountriesCache } from '../../infra/countries.cache'
import type { Db } from '../../infra/db'
import { countCustomers, findPlanWithTiers, searchCustomers, type ValoresBase } from './customers.repo'
import {
  customerIdSchema,
  patchCustomerBasesSchema,
  postCustomerSchema,
  searchCustomersSchema,
} from './customers.schemas'
import {
  crearCliente,
  editarValoresBase,
  obtenerClienteOFallar,
  type AltaCliente,
} from './customers.service'

type Deps = { db: Db; countries: CountriesCache }

export function customersRoutes({ db, countries }: Deps) {
  return async (app: FastifyInstance): Promise<void> => {
    // --- Alta -------------------------------------------------------------------------
    app.post('/customers', { schema: postCustomerSchema }, async (req, reply) => {
      const cliente = crearCliente(db, countries, req.body as AltaCliente)

      // Devuelve el fiscal_id NORMALIZADO: el comercial escribio "b-1234 5674" y debe ver
      // en pantalla lo que quedo guardado (referencia 7.4).
      return reply.status(201).header('Location', `/api/customers/${cliente.id}`).send(cliente)
    })

    // --- Buscador ---------------------------------------------------------------------
    app.get('/customers', { schema: searchCustomersSchema }, async (req) => {
      const { search, limit } = req.query as { search?: string; limit: number }
      const customers = searchCustomers(db, search, limit)

      // Sin resultados es 200 con lista vacia, NO un 404: la coleccion existe, esta
      // vacia. Vacio y error son dos pantallas distintas (referencia 13.1). El total es
      // el de la COLECCION (COUNT sin LIMIT), no el de la pagina devuelta.
      return { customers, total: countCustomers(db, search) }
    })

    // --- Detalle ----------------------------------------------------------------------
    //
    // Es la peticion que hace posible el preview local (referencia 10): trae en UNA sola
    // llamada todo lo que quote() necesita en el navegador.
    app.get('/customers/:id', { schema: customerIdSchema }, async (req) => {
      const { id } = req.params as { id: number }
      const cliente = obtenerClienteOFallar(db, id)

      const plan = findPlanWithTiers(db, cliente.plan_id)
      if (plan === undefined) {
        // Inalcanzable: plan_id es FK con ON DELETE RESTRICT y no hay borrado fisico.
        throw new Error(`El cliente ${id} apunta al plan ${cliente.plan_id}, que no existe.`)
      }

      // El pais SIEMPRE esta: es FK contra countries y la cache se construye de ahi.
      const pais = countries.get(cliente.country)
      if (pais === undefined) {
        throw new Error(`El cliente ${id} es del pais ${cliente.country}, que no esta en la cache.`)
      }

      return {
        id: cliente.id,
        company_name: cliente.company_name,
        fiscal_id: cliente.fiscal_id,
        fiscal_id_type: cliente.fiscal_id_type,
        email: cliente.email,
        // El pais se expande a objeto aqui (y es un string en el listado): el detalle
        // necesita el nombre y la divisa de presentacion para preseleccionar el selector.
        country: { code: pais.code, name: pais.name, display_currency: pais.displayCurrency },
        // Sin esto el preview no puede pintar el impuesto y habria que pedirlo aparte.
        tax_rate_bp: pais.rateBp,
        // La ficha y el simulador parametrizado los necesitan; el listado no los lleva.
        base_users: cliente.base_users,
        base_storage_gb: cliente.base_storage_gb,
        base_api_calls: cliente.base_api_calls,
        // El plan va embebido CON SUS TRAMOS aunque este archivado: es el caso normal de
        // un cliente antiguo, no una excepcion (referencia 5.5). La UI lo traduce a
        // "Mantiene su tarifa contratada", sin jerga de versionado.
        plan,
        created_at: cliente.created_at,
      }
    })

    // --- Valores base -----------------------------------------------------------------
    //
    // Edicion acotada a los tres valores base (spec 09, 3.2): los datos fiscales siguen
    // sin poderse tocar por la API, y el additionalProperties del esquema lo hace
    // verificable. Sesion obligatoria (hook global), sin rol: es dato de trabajo del
    // comercial, no de administracion.
    app.patch('/customers/:id', { schema: patchCustomerBasesSchema }, async (req) => {
      const { id } = req.params as { id: number }
      return editarValoresBase(db, id, req.body as ValoresBase)
    })
  }
}
