// Motor graduated multi-metrica: funcion pura, agnostica a la metrica. Spec: 5.3

import { METRICS } from './types'
import type { Metric, MetricBreakdown, Quantities, Tier, TierApplication } from './types'

/**
 * Recorre los tramos de UNA metrica y reparte `quantity` entre ellos.
 *
 * Graduated (acumulativo): cada unidad paga el precio del tramo en el que cae. NO es
 * volume: 15 usuarios en el Plan A son 140 EUR (10x10 + 5x8), no 120 EUR (15x8). El
 * ejemplo del enunciado lo confirma.
 *
 * `tramos` debe venir ordenado por sort_order.
 */
function aplicarTramos(tramos: readonly Tier[], quantity: number): TierApplication[] {
  const aplicados: TierApplication[] = []

  let restantes = quantity
  let inferior = 0 // limite superior del tramo anterior = cuantas unidades ya se cobraron

  for (const tramo of tramos) {
    // Con quantity = 0 no se entra ni una vez: tiers queda vacio, que es lo correcto.
    // Tambien corta en cuanto se agotan las unidades, y por eso una simulacion de 15
    // usuarios devuelve 2 tramos y no 3.
    if (restantes === 0) break

    const capacidad = tramo.up_to === null ? restantes : tramo.up_to - inferior
    const units = Math.min(restantes, capacidad)

    aplicados.push({
      up_to: tramo.up_to,
      unit_price_minor: tramo.unit_price_minor,
      units,
      // Producto de enteros: exacto. Aqui no hay nada que redondear.
      amount_minor: units * tramo.unit_price_minor,
    })

    restantes -= units
    inferior = tramo.up_to ?? inferior
  }

  return aplicados
}

/**
 * Desglose por metrica. La suma de los subtotales es la base (referencia 4.2, paso 1).
 *
 * Devuelve SIEMPRE una entrada por cada metrica soportada, tambien las que el plan no
 * factura (billed: false, subtotal 0): es lo que permite a la UI atenuar la tarjeta en
 * vez de ocultarla, sin ningun `if` sobre el plan en el cliente (referencia 5.2).
 *
 * El motor es AGNOSTICO A LA METRICA: no sabe si cuenta usuarios o gigas. Anadir ram_gb
 * son filas nuevas en plan_tiers y una entrada en METRICS; este bucle no se toca.
 *
 * NO valida sus entradas, y es una decision (01-motor-tramos-y-simulaciones.md 4): si
 * los tramos tienen huecos, no son crecientes o el ultimo esta cerrado, el resultado es
 * basura silenciosa. Se acepta porque los tramos solo entran por el seed o por
 * POST /plans, y ambos pasan por el mismo validador de plantilla. Validar aqui obligaria
 * a devolver errores, y una funcion que puede fallar es una funcion que el preview
 * tendria que saber manejar en mitad de un arrastre de slider.
 */
export function computeBreakdown(tiers: readonly Tier[], quantities: Quantities): MetricBreakdown[] {
  return METRICS.map((metric: Metric): MetricBreakdown => {
    const propios = tiers
      .filter((t) => t.metric === metric)
      .sort((a, b) => a.sort_order - b.sort_order)

    const quantity = quantities[metric]

    if (propios.length === 0) {
      // El plan no cobra esta metrica: se registra la entrada, aporta 0.
      return { metric, billed: false, quantity, subtotal_minor: 0, tiers: [] }
    }

    const aplicados = aplicarTramos(propios, quantity)

    return {
      metric,
      billed: true,
      quantity,
      subtotal_minor: aplicados.reduce((suma, a) => suma + a.amount_minor, 0),
      tiers: aplicados,
    }
  })
}

/** La base: suma de lo que aporta cada metrica. Entero exacto. */
export function baseMinorOf(breakdown: readonly MetricBreakdown[]): number {
  return breakdown.reduce((suma, b) => suma + b.subtotal_minor, 0)
}
