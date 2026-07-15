// Versionado y archivado; nunca borrado fisico. Spec: 5.5

import type { Metric } from '@saas/pricing'
import type { Db } from '../../infra/db'
import type { PlanWithTiers } from '../customers/customers.repo'

type FilaPlan = {
  id: number
  name: string
  version: number
  description: string | null
  currency: string
  pricing_model: string
  active: number
}

/**
 * Los planes con sus tramos.
 *
 * `includeArchived` es un PARAMETRO y no un endpoint aparte porque el gating por rol es
 * UX declarada, no seguridad (referencia 8.3): un `/admin/plans` sin auth real solo daria
 * ilusion de proteccion. Por defecto, solo activos: es lo que alimenta el selector del
 * alta, donde un plan archivado no debe aparecer.
 *
 * Una sola consulta de tramos para todos los planes, no una por plan: son cuatro filas
 * hoy, pero el N+1 se escribe igual de facil y se paga cuando ya no lo son.
 */
export function listPlans(db: Db, includeArchived: boolean): PlanWithTiers[] {
  // Sin ORDER BY en SQL a proposito: la colacion por defecto de SQLite es BINARY y ordena
  // por bytes, asi que "Plan Ágora" caeria DESPUES de "Bitácora" y "Cúspide" (la Á es
  // 0xC3 y la B es 0x42). El orden alfabetico de verdad necesita locale, y eso SQLite no
  // lo trae sin ICU. Se ordena abajo, en JS, igual que la lista de paises.
  const planes = db
    .prepare(`SELECT * FROM plans ${includeArchived ? '' : 'WHERE active = 1'}`)
    .all() as FilaPlan[]

  if (planes.length === 0) return []

  const tramos = db
    .prepare(
      `SELECT plan_id, metric, up_to, unit_price_minor, sort_order
         FROM plan_tiers
        WHERE plan_id IN (${planes.map(() => '?').join(',')})
        ORDER BY metric, sort_order`,
    )
    .all(...planes.map((p) => p.id)) as {
    plan_id: number
    metric: Metric
    up_to: number | null
    unit_price_minor: number
    sort_order: number
  }[]

  const porPlan = new Map<number, PlanWithTiers['tiers']>()
  for (const t of tramos) {
    const lista = porPlan.get(t.plan_id) ?? []
    lista.push({
      metric: t.metric,
      up_to: t.up_to,
      unit_price_minor: t.unit_price_minor,
      sort_order: t.sort_order,
    })
    porPlan.set(t.plan_id, lista)
  }

  return planes
    .map((p) => ({
      id: p.id,
      name: p.name,
      version: p.version,
      description: p.description,
      currency: p.currency,
      pricing_model: p.pricing_model,
      active: p.active === 1,
      tiers: porPlan.get(p.id) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es') || a.version - b.version)
}
