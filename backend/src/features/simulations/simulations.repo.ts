// Persistencia con pricing_snapshot y tax_rate aplicado. Spec: 11.2

import type { Metric } from '@saas/pricing'
import type { Db } from '../../infra/db'

/**
 * La foto inmutable del momento (referencia 11.2). Forma exacta: modelo-datos.md 2.5.
 *
 * Regla de que entra: si al borrarlo de la base de datos el sistema no pudiera reproducir
 * el total, va dentro (tramos, tipo impositivo, divisa). Si es consultable y mutable sin
 * cambiar el pasado (el email del cliente), no.
 */
export type PricingSnapshot = {
  plan: { id: number; name: string; version: number; currency: string; pricing_model: string }
  tiers: { metric: Metric; up_to: number | null; unit_price_minor: number; sort_order: number }[]
  tax: { country: string; rate_bp: number }
}

export type SimulationRow = {
  id: number
  customer_id: number
  plan_id: number
  active_users: number
  storage_gb: number
  api_calls: number
  pricing_snapshot: string
  currency: string
  base_minor: number
  tax_rate_bp: number
  tax_minor: number
  total_minor: number
  created_at: string
}

export function insertSimulation(
  db: Db,
  datos: Omit<SimulationRow, 'id' | 'created_at' | 'pricing_snapshot'> & { snapshot: PricingSnapshot },
): SimulationRow {
  const { snapshot, ...resto } = datos

  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO simulations
         (customer_id, plan_id, active_users, storage_gb, api_calls, pricing_snapshot,
          currency, base_minor, tax_rate_bp, tax_minor, total_minor, created_at)
       VALUES
         (@customer_id, @plan_id, @active_users, @storage_gb, @api_calls, @pricing_snapshot,
          @currency, @base_minor, @tax_rate_bp, @tax_minor, @total_minor, @created_at)`,
    )
    .run({
      ...resto,
      pricing_snapshot: JSON.stringify(snapshot),
      created_at: new Date().toISOString(),
    })

  const fila = db.prepare('SELECT * FROM simulations WHERE id = ?').get(Number(lastInsertRowid)) as
    | SimulationRow
    | undefined

  if (fila === undefined) throw new Error('La simulacion recien insertada no se encuentra.')
  return fila
}

/**
 * El historial de un cliente, ordenado por fecha descendente.
 *
 * NO HACE JOIN CON plan_tiers, y es el punto entero de la feature: cada fila se explica
 * con SU snapshot, no con los tramos de hoy (referencia 11.2). Si aqui apareciera un JOIN
 * con plan_tiers, editar un plan reescribiria presupuestos ya enviados —y pasaria todos
 * los tests que no comprueben precisamente eso—.
 *
 * El indice idx_simulations_customer (customer_id, created_at DESC) sirve esta consulta:
 * igualdad mas orden es lo que un B-tree hace bien.
 */
export function listSimulationsByCustomer(db: Db, customerId: number, limit: number): SimulationRow[] {
  return db
    .prepare(
      `SELECT * FROM simulations
        WHERE customer_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?`,
    )
    .all(customerId, limit) as SimulationRow[]
}
