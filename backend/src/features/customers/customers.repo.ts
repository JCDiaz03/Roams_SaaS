// Sentencias preparadas; LIKE con escape de % y _. Spec: 14.2

import type { Metric, Tier } from '@saas/pricing'
import type { Db } from '../../infra/db'

export type CustomerRow = {
  id: number
  company_name: string
  fiscal_id: string
  fiscal_id_type: string
  email: string
  country: string
  plan_id: number
  base_users: number | null
  base_storage_gb: number | null
  base_api_calls: number | null
  created_at: string
}

/** Los tres valores base, y SOLO ellos: es todo lo que el PATCH puede tocar (spec 09, 3.2). */
export type ValoresBase = {
  base_users?: number | null | undefined
  base_storage_gb?: number | null | undefined
  base_api_calls?: number | null | undefined
}

export type CustomerListItem = {
  id: number
  company_name: string
  fiscal_id: string
  fiscal_id_type: string
  country: string
  plan: { id: number; name: string; version: number }
  simulation_count: number
}

export type PlanWithTiers = {
  id: number
  name: string
  version: number
  description: string | null
  currency: string
  pricing_model: string
  active: boolean
  tiers: Tier[]
}

/**
 * Escapa los comodines del LIKE.
 *
 * Las sentencias preparadas cierran la inyeccion SQL, pero NO impiden que el contenido
 * del parametro se interprete como comodin. Si el comercial busca "50%", el % interior
 * hace de comodin y la busqueda devuelve cualquier cosa que empiece por 50. No es un
 * agujero de seguridad: es un buscador que miente.
 *
 * La barra invertida se escapa PRIMERO, o "\" se convierte en "\\" y luego cada "\" nuevo
 * vuelve a escaparse. El [\\%_] en un solo replace lo resuelve de una pasada; dos
 * replace encadenados no.
 */
export function escapeLike(termino: string): string {
  return termino.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export function insertCustomer(
  db: Db,
  datos: {
    company_name: string
    fiscal_id: string
    fiscal_id_type: string
    email: string
    country: string
    plan_id: number
    base_users?: number | null | undefined
    base_storage_gb?: number | null | undefined
    base_api_calls?: number | null | undefined
  },
): CustomerRow {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO customers (company_name, fiscal_id, fiscal_id_type, email, country, plan_id,
                              base_users, base_storage_gb, base_api_calls, created_at)
       VALUES (@company_name, @fiscal_id, @fiscal_id_type, @email, @country, @plan_id,
               @base_users, @base_storage_gb, @base_api_calls, @created_at)`,
    )
    .run({
      ...datos,
      base_users: datos.base_users ?? null,
      base_storage_gb: datos.base_storage_gb ?? null,
      base_api_calls: datos.base_api_calls ?? null,
      created_at: new Date().toISOString(),
    })

  const fila = findCustomerById(db, Number(lastInsertRowid))
  if (fila === undefined) throw new Error('El cliente recien insertado no se encuentra.')
  return fila
}

/**
 * Actualiza SOLO los valores base presentes en `cambios` (ausente = no tocar;
 * null = borrar). El SET se construye desde una lista blanca fija de tres columnas,
 * JAMAS desde las claves del objeto: aunque el esquema ya rechaza campos ajenos, un SQL
 * compuesto desde entrada externa es una frontera que no se cruza (referencia 14.2).
 */
export function updateCustomerBases(db: Db, id: number, cambios: ValoresBase): CustomerRow | undefined {
  const COLUMNAS = ['base_users', 'base_storage_gb', 'base_api_calls'] as const

  const presentes = COLUMNAS.filter((c) => cambios[c] !== undefined)
  if (presentes.length > 0) {
    const set = presentes.map((c) => `${c} = @${c}`).join(', ')
    const valores: Record<string, number | null> = { id }
    for (const c of presentes) valores[c] = cambios[c] ?? null

    db.prepare(`UPDATE customers SET ${set} WHERE id = @id`).run(valores)
  }

  return findCustomerById(db, id)
}

export function findCustomerById(db: Db, id: number): CustomerRow | undefined {
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as CustomerRow | undefined
}

export function findCustomerByFiscalId(db: Db, fiscalId: string): CustomerRow | undefined {
  return db.prepare('SELECT * FROM customers WHERE fiscal_id = ?').get(fiscalId) as
    | CustomerRow
    | undefined
}

/**
 * El buscador: por nombre de empresa O por identificador fiscal, en una sola consulta.
 *
 * Dos cosas que no se ven y son la feature:
 *
 *  * `ESCAPE '\'` es OBLIGATORIO. SQLite NO tiene caracter de escape por defecto en LIKE:
 *    sin declararlo, la barra invertida es un caracter literal mas y escapeLike() no
 *    escapa nada. Es el error silencioso de aqui: el codigo PARECE correcto.
 *  * `upper()` en los dos lados: el LIKE de SQLite es insensible a mayusculas SOLO para
 *    ASCII, asi que sin esto "nébula" no encuentra "Nébula". Limite aceptado: upper()
 *    tampoco toca los acentuados, asi que "nebula" (sin tilde) sigue sin encontrarlo. La
 *    respuesta a escala es FTS5, que resolveria tildes Y scan de una vez (spec 03, 2.3).
 *
 * Rendimiento, con honestidad: LIKE '%x%' NO usa indice -un comodin inicial impide el
 * descenso por el B-tree- y habra table scan. A esta escala es submilisegundo. Lo que no
 * se hace es fingir que otro indice lo arregla.
 */
export function searchCustomers(db: Db, termino: string | undefined, limit: number): CustomerListItem[] {
  const base = `
    SELECT c.id, c.company_name, c.fiscal_id, c.fiscal_id_type, c.country,
           p.id AS plan_id, p.name AS plan_name, p.version AS plan_version,
           (SELECT COUNT(*) FROM simulations s WHERE s.customer_id = c.id) AS simulation_count
      FROM customers c
      JOIN plans p ON p.id = c.plan_id`

  const recortado = termino?.trim() ?? ''

  const filas = (
    recortado === ''
      ? db.prepare(`${base} ORDER BY c.created_at DESC, c.id DESC LIMIT ?`).all(limit)
      : db
          .prepare(
            `${base}
              WHERE upper(c.company_name) LIKE upper(@patron) ESCAPE '\\'
                 OR upper(c.fiscal_id)    LIKE upper(@patron) ESCAPE '\\'
              ORDER BY c.created_at DESC, c.id DESC
              LIMIT @limit`,
          )
          .all({ patron: `%${escapeLike(recortado)}%`, limit })
  ) as {
    id: number
    company_name: string
    fiscal_id: string
    fiscal_id_type: string
    country: string
    plan_id: number
    plan_name: string
    plan_version: number
    simulation_count: number
  }[]

  return filas.map((f) => ({
    id: f.id,
    company_name: f.company_name,
    fiscal_id: f.fiscal_id,
    fiscal_id_type: f.fiscal_id_type,
    country: f.country,
    plan: { id: f.plan_id, name: f.plan_name, version: f.plan_version },
    simulation_count: f.simulation_count,
  }))
}

/**
 * Cuantos clientes COINCIDEN, sin el LIMIT: es lo que hace que el `total` de la
 * respuesta diga el tamaño de la coleccion y no el de la pagina. Con 300 coincidencias
 * y limit=20, un total de 20 seria un contador mintiendo con nombre de verdad.
 */
export function countCustomers(db: Db, termino: string | undefined): number {
  const recortado = termino?.trim() ?? ''

  if (recortado === '') {
    return (db.prepare('SELECT COUNT(*) AS n FROM customers').get() as { n: number }).n
  }

  return (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM customers c
          WHERE upper(c.company_name) LIKE upper(@patron) ESCAPE '\\'
             OR upper(c.fiscal_id)    LIKE upper(@patron) ESCAPE '\\'`,
      )
      .get({ patron: `%${escapeLike(recortado)}%` }) as { n: number }
  ).n
}

/**
 * El plan de un cliente CON SUS TRAMOS, este activo o archivado.
 *
 * El `active` NO se filtra, y es el punto entero: un cliente antiguo apunta a una version
 * archivada, y eso es el caso normal, no una excepcion (referencia 5.5). Si aqui apareciera
 * un `WHERE active = 1`, Fjord Systems dejaria de poder simular.
 */
export function findPlanWithTiers(db: Db, planId: number): PlanWithTiers | undefined {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId) as
    | {
        id: number
        name: string
        version: number
        description: string | null
        currency: string
        pricing_model: string
        active: number
      }
    | undefined

  if (plan === undefined) return undefined

  const tiers = db
    .prepare(
      `SELECT metric, up_to, unit_price_minor, sort_order
         FROM plan_tiers WHERE plan_id = ? ORDER BY metric, sort_order`,
    )
    .all(planId) as { metric: Metric; up_to: number | null; unit_price_minor: number; sort_order: number }[]

  return {
    id: plan.id,
    name: plan.name,
    version: plan.version,
    description: plan.description,
    currency: plan.currency,
    pricing_model: plan.pricing_model,
    active: plan.active === 1,
    tiers,
  }
}
