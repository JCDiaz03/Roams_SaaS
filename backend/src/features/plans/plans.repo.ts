// Versionado y archivado; nunca borrado fisico. Spec: 5.5

import type { Metric } from '@saas/pricing'
import type { Db } from '../../infra/db'
import { findPlanWithTiers, type PlanWithTiers } from '../customers/customers.repo'
import type { Plantilla } from './plan-template.validation'

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
 * `includeArchived` es un PARAMETRO y no un endpoint aparte porque el recurso es el
 * mismo; desde la spec 07 el parametro exige rol admin DE VERDAD (403 en la ruta), asi
 * que la separacion /admin/* seguiria sin aportar nada. Por defecto, solo activos: es lo
 * que alimenta el selector del alta, donde un plan archivado no debe aparecer.
 *
 * Una sola consulta de tramos para todos los planes, no una por plan: son cuatro filas
 * hoy, pero el N+1 se escribe igual de facil y se paga cuando ya no lo son.
 */
export function listPlans(db: Db, includeArchived: boolean): PlanWithTiers[] {
  // Sin ORDER BY en SQL a proposito: la colacion por defecto de SQLite es BINARY y ordena
  // por bytes, asi que un nombre con acento ("Plan Ágora") caeria DESPUES de
  // "Almacenamiento" y "Demo" (la Á es 0xC3 y la A es 0x41). El orden alfabetico de
  // verdad necesita locale, y eso SQLite no lo trae sin ICU. Se ordena abajo, en JS,
  // igual que la lista de paises.
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

/** Un plan concreto con sus tramos, activo o archivado. */
export function findPlanById(db: Db, id: number): PlanWithTiers | undefined {
  return findPlanWithTiers(db, id)
}

/**
 * ¿Hay ya un plan ACTIVO con ese nombre?
 *
 * Solo entre los activos: si mirara tambien los archivados, archivar un plan quemaria su
 * nombre para siempre.
 */
export function nombreActivoOcupado(db: Db, name: string): boolean {
  const fila = db.prepare('SELECT 1 FROM plans WHERE name = ? AND active = 1').get(name)
  return fila !== undefined
}

/** La siguiente version de un nombre. Cuenta TODAS, archivadas incluidas. */
export function siguienteVersion(db: Db, name: string): number {
  const { maxima } = db.prepare('SELECT MAX(version) AS maxima FROM plans WHERE name = ?').get(name) as {
    maxima: number | null
  }
  return (maxima ?? 0) + 1
}

/**
 * Inserta un plan con sus tramos.
 *
 * El `sort_order` NO viene de fuera: se deriva del orden del array, por metrica. Aceptarlo
 * permitiria enviar un orden que contradice los cortes, y entonces habria dos fuentes de
 * verdad para "cual es el primer tramo" (contrato-api.md 4.1).
 */
export function insertPlan(db: Db, plantilla: Plantilla, version: number, active: boolean): PlanWithTiers {
  const insertar = db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO plans (name, version, description, pricing_model, currency, active, created_at)
         VALUES (?, ?, ?, 'graduated', ?, ?, ?)`,
      )
      .run(
        plantilla.name,
        version,
        plantilla.description ?? null,
        plantilla.currency,
        active ? 1 : 0,
        new Date().toISOString(),
      )

    const planId = Number(lastInsertRowid)
    const insertTier = db.prepare(
      `INSERT INTO plan_tiers (plan_id, metric, up_to, unit_price_minor, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
    )

    const siguienteOrden = new Map<Metric, number>()
    for (const t of plantilla.tiers) {
      const sortOrder = siguienteOrden.get(t.metric) ?? 0
      siguienteOrden.set(t.metric, sortOrder + 1)
      insertTier.run(planId, t.metric, t.up_to, t.unit_price_minor, sortOrder)
    }

    return planId
  })

  const id = insertar()
  const creado = findPlanWithTiers(db, id)
  if (creado === undefined) throw new Error('El plan recien insertado no se encuentra.')
  return creado
}

/** Archiva. Para un plan USADO no hay otra cosa: el borrado fisico es solo del jamas usado. */
export function archivarPlan(db: Db, id: number): void {
  db.prepare('UPDATE plans SET active = 0 WHERE id = ?').run(id)
}

/**
 * ¿Alguien referencia este plan? Clientes suscritos O simulaciones cotizadas con el
 * (una simulacion guarda plan_id ademas del snapshot, y su FK necesita la fila viva).
 * Es la condicion del borrado fisico (ADR 0013): cero en AMBOS o no hay borrado.
 */
export function planEnUso(db: Db, id: number): boolean {
  const { n } = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM customers   WHERE plan_id = @id)
            + (SELECT COUNT(*) FROM simulations WHERE plan_id = @id) AS n`,
    )
    .get({ id }) as { n: number }

  return n > 0
}

/**
 * Borra DE VERDAD un plan jamas usado (ADR 0013): sus tramos y su fila, en transaccion.
 * El servicio comprueba planEnUso() antes; las FK ON DELETE RESTRICT son la red si
 * alguien llegara aqui sin comprobarlo — reventarian el DELETE en vez de dejar huerfanos.
 */
export function deletePlanFisico(db: Db, id: number): void {
  db.transaction(() => {
    db.prepare('DELETE FROM plan_tiers WHERE plan_id = ?').run(id)
    db.prepare('DELETE FROM plans WHERE id = ?').run(id)
  })()
}
