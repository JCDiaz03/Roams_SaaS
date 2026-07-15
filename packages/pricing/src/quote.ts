// Orden canonico de calculo: base -> tax -> total (redondeo una sola vez). Spec: 4.2

import { baseMinorOf, computeBreakdown } from './engine'
import { roundHalfUpDiv } from './rounding'
import type { QuoteInput, QuoteResult } from './types'

/** Los puntos basicos son centesimas de punto porcentual: 2100 bp = 21 % = 2100/10000. */
const BP_POR_UNIDAD = 10_000n

/**
 * El presupuesto completo. Es la funcion que importan backend y frontend, y la razon de
 * ser del paquete compartido: no existen dos implementaciones que puedan divergir
 * (referencia 10).
 *
 * Orden canonico (referencia 4.2):
 *
 *   1. base_minor  = motor de tramos                       -> entero exacto, divisa del plan
 *   2. tax_rate_bp = tipo del PAIS DEL CLIENTE             -> entero, puntos basicos
 *   3. tax_minor   = round_half_up(base * rate / 10000)
 *   4. total_minor = base + tax
 *   5. mostrado    = total * tipo_de_cambio                -> SOLO VISTA, fuera de aqui
 *
 * El paso 5 no esta y no puede estar: ningun tipo de cambio entra jamas en un importe
 * persistido (invariante 3). La conversion es presentacion y vive en el frontend.
 *
 * Por que redondear en el paso 3 no contradice el "se redondea una sola vez, al final":
 * como base_minor es entero,
 *
 *   round_half_up(base + tax_exacto) === base + round_half_up(tax_exacto)
 *
 * Las dos lecturas dan el MISMO entero, siempre. Y la del paso 3 es la unica
 * implementable, porque tax_minor se persiste y una columna INTEGER no admite una
 * fraccion. Lo que el 4.2 prohibe de verdad es otra cosa: redondear antes de tener el
 * total en la divisa de facturacion, o redondear en la divisa de visualizacion.
 *
 * El invariante que si importa -y que el CHECK (total_minor = base_minor + tax_minor) de
 * la tabla garantiza- es que base y tax suman total exactamente, sin un centimo de
 * deriva.
 */
export function quote(input: QuoteInput): QuoteResult {
  const breakdown = computeBreakdown(input.tiers, input.quantities)
  const base_minor = baseMinorOf(breakdown)

  const tax_minor = Number(
    roundHalfUpDiv(BigInt(base_minor) * BigInt(input.tax_rate_bp), BP_POR_UNIDAD),
  )

  return {
    base_minor,
    tax_rate_bp: input.tax_rate_bp,
    tax_minor,
    total_minor: base_minor + tax_minor,
    // La divisa entra y sale sin usarse en la aritmetica, y no es decorativa: es lo que
    // hace que un importe nunca viaje sin su codigo ISO (invariante 5). El motor la
    // transporta; nadie tiene ocasion de perderla.
    currency: input.currency,
    breakdown,
  }
}
