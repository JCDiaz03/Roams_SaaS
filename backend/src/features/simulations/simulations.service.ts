// Recalcula desde cero con el paquete pricing; su numero manda. Spec: 10

import { quote, type CurrencyCode, type Quantities, type QuoteResult } from '@saas/pricing'
import type { TaxProvider } from '../../domain/tax/tax-provider'
import type { Db } from '../../infra/db'
import { findPlanWithTiers } from '../customers/customers.repo'
import { obtenerClienteOFallar } from '../customers/customers.service'
import {
  insertSimulation,
  listSimulationsByCustomer,
  type PricingSnapshot,
  type SimulationRow,
} from './simulations.repo'

export type EntradasSimulacion = {
  customer_id: number
  active_users: number
  storage_gb: number
  api_calls: number
}

export type SimulationView = {
  id: number
  customer_id: number
  plan_id: number
  inputs: { active_users: number; storage_gb: number; api_calls: number }
  currency: string
  base_minor: number
  tax_rate_bp: number
  tax_minor: number
  total_minor: number
  breakdown: QuoteResult['breakdown']
  created_at: string
}

const cantidades = (e: EntradasSimulacion): Quantities => ({
  users: e.active_users,
  storage_gb: e.storage_gb,
  api_calls: e.api_calls,
})

/**
 * Registra una simulacion. Contrato: contrato-api.md 2.2.
 *
 * La secuencia (spec 01, 3.1) tiene un corte deliberado: los pasos 1-4 REUNEN datos, el 5
 * CALCULA y no sabe nada de los anteriores, y el resto GUARDA. Ese corte es lo que hace
 * que el motor sea testeable sin base de datos y que el navegador pueda ejecutar el paso
 * 5 con los datos que ya tiene.
 */
export function crearSimulacion(
  db: Db,
  taxProvider: TaxProvider,
  entradas: EntradasSimulacion,
): SimulationView {
  // 1. El cliente. No existe -> 404.
  const cliente = obtenerClienteOFallar(db, entradas.customer_id)

  // 2. El plan sale DEL CLIENTE, nunca del cuerpo: es lo que garantiza que se cotiza con
  //    la tarifa contratada.
  // 3. Y se carga este ACTIVO O ARCHIVADO. Un plan archivado NO es un error aqui
  //    (referencia 5.5): un cliente antiguo cotiza con su version, y ese es justo el caso
  //    que el versionado existe para proteger. Un PLAN_ARCHIVED copiado del alta romperia
  //    el diseno entero en silencio.
  const plan = findPlanWithTiers(db, cliente.plan_id)
  if (plan === undefined) {
    throw new Error(`El cliente ${cliente.id} apunta al plan ${cliente.plan_id}, que no existe.`)
  }

  // 4. El tipo, via el puerto. Sin IO, sin `if` por pais.
  const taxRateBp = taxProvider.rateBpFor(cliente.country)

  // 5. El unico paso que calcula. La MISMA funcion que corre en el navegador.
  const resultado = quote({
    tiers: plan.tiers,
    quantities: cantidades(entradas),
    tax_rate_bp: taxRateBp,
    currency: plan.currency as CurrencyCode,
  })

  // 6. El snapshot se construye con los datos que se ACABAN de usar para calcular, no
  //    releyendo nada: una segunda consulta describiria un instante distinto del que
  //    produjo el numero.
  const snapshot: PricingSnapshot = {
    plan: {
      id: plan.id,
      name: plan.name,
      version: plan.version,
      currency: plan.currency,
      pricing_model: plan.pricing_model,
    },
    tiers: plan.tiers,
    tax: { country: cliente.country, rate_bp: taxRateBp },
  }

  const fila = insertSimulation(db, {
    customer_id: cliente.id,
    plan_id: plan.id,
    active_users: entradas.active_users,
    storage_gb: entradas.storage_gb,
    api_calls: entradas.api_calls,
    snapshot,
    currency: resultado.currency,
    base_minor: resultado.base_minor,
    tax_rate_bp: resultado.tax_rate_bp,
    tax_minor: resultado.tax_minor,
    total_minor: resultado.total_minor,
  })

  return vista(fila, resultado)
}

/**
 * El historial. Cada fila se reconstruye desde SU snapshot, jamas desde el plan actual.
 *
 * Es literalmente para esto que el snapshot existe (referencia 11.2). El motor se vuelve
 * a llamar con los tramos y el tipo GUARDADOS, asi que el desglose de una simulacion de
 * hace un mes sigue explicando su numero aunque el plan haya cambiado tres veces.
 */
export function historialDe(db: Db, customerId: number, limit: number): SimulationView[] {
  // Que el cliente exista se comprueba antes: sin esto, un id inexistente devolveria una
  // lista vacia (un 200 mintiendo) en vez de un 404.
  obtenerClienteOFallar(db, customerId)

  return listSimulationsByCustomer(db, customerId, limit).map((fila) => {
    const snapshot = JSON.parse(fila.pricing_snapshot) as PricingSnapshot

    const resultado = quote({
      tiers: snapshot.tiers,
      quantities: cantidades(fila),
      tax_rate_bp: snapshot.tax.rate_bp,
      currency: snapshot.plan.currency as CurrencyCode,
    })

    return vista(fila, resultado)
  })
}

/**
 * La fila persistida + el desglose recalculado.
 *
 * Los importes salen de LA FILA, no del `resultado`: lo que manda es lo que se guardo. El
 * `resultado` solo aporta el `breakdown`, que es una proyeccion derivable y por eso no se
 * persiste (contrato-api.md 2.2).
 *
 * El `pricing_snapshot` NO se devuelve: es interno. Lo que la pantalla necesita explicar
 * ya esta en `breakdown`; exponerlo seria filtrar una estructura de persistencia al
 * contrato.
 */
function vista(fila: SimulationRow, resultado: QuoteResult): SimulationView {
  return {
    id: fila.id,
    customer_id: fila.customer_id,
    plan_id: fila.plan_id,
    inputs: {
      active_users: fila.active_users,
      storage_gb: fila.storage_gb,
      api_calls: fila.api_calls,
    },
    currency: fila.currency,
    base_minor: fila.base_minor,
    tax_rate_bp: fila.tax_rate_bp,
    tax_minor: fila.tax_minor,
    total_minor: fila.total_minor,
    breakdown: resultado.breakdown,
    created_at: fila.created_at,
  }
}
