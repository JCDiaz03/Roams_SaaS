// Tipos compartidos: Metric, Tier, PricingModel, QuoteInput/QuoteResult. Spec: 5.2, 11.1

import type { CurrencyCode } from './currency'

/**
 * Metricas facturables. Un plan es un conjunto de metricas, cada una con su tabla de
 * tramos (referencia 5.2).
 *
 * Anadir una metrica (p. ej. ram_gb) = filas nuevas en plan_tiers + una entrada aqui +
 * ampliar el CHECK de plan_tiers. El motor NO se toca: recorre tramos sin saber si
 * cuenta usuarios o gigas. Si algun cambio obliga a tocar el bucle para anadir una
 * metrica, la abstraccion esta rota.
 */
export type Metric = 'users' | 'storage_gb' | 'api_calls'

/** El mismo conjunto, recorrible. Debe cuadrar con el CHECK de plan_tiers. */
export const METRICS: readonly Metric[] = ['users', 'storage_gb', 'api_calls']

/**
 * Modelo de tarificacion. Hoy solo graduated; el Strategy deja hueco a volume/flat
 * (referencia 5.3). Anadir uno = la estrategia Y ampliar el CHECK de plans, en el mismo
 * commit: mientras no exista la implementacion, el CHECK impide que una fila declare un
 * modelo que nadie sabe calcular.
 */
export type PricingModel = 'graduated'

/** Un tramo de una metrica. Espejo de una fila de plan_tiers. */
export type Tier = {
  metric: Metric
  /**
   * Limite superior INCLUSIVO; null = infinito.
   *
   * El enunciado dice "Tramo 1 (0 a 10)" y "Tramo 2 (11 a 50)": con up_to inclusivo, la
   * capacidad del tramo 2 es 50 - 10 = 40 unidades (los usuarios 11 a 50, ambos
   * incluidos). Es tambien como se le piden los cortes al admin en pantalla ("hasta
   * cuantos usuarios", referencia 5.4).
   */
  up_to: number | null
  /** Entero en unidades menores de la divisa del plan. Nunca float (invariante 5). */
  unit_price_minor: number
  sort_order: number
}

/** Las entradas que el comercial mueve con los sliders. Enteros >= 0. */
export type Quantities = Record<Metric, number>

/** Lo que un tramo concreto aporta al subtotal de su metrica. */
export type TierApplication = {
  up_to: number | null
  unit_price_minor: number
  /** Unidades que caen en ESTE tramo. */
  units: number
  /** units * unit_price_minor. Producto de enteros: exacto. */
  amount_minor: number
}

export type MetricBreakdown = {
  metric: Metric
  /** false = el plan no tiene tramos de esta metrica: se registra, pero aporta 0. */
  billed: boolean
  quantity: number
  subtotal_minor: number
  /** Vacio si billed = false, y tambien si quantity = 0. */
  tiers: TierApplication[]
}

/**
 * Todo lo que el motor necesita entra por argumento: no lee de la base de datos, no
 * llama al TaxProvider, no conoce el reloj y no conoce el plan_id.
 *
 * Es lo que permite que el navegador lo ejecute con los tramos que trae
 * GET /customers/{id} y el servidor con los que lee de SQLite, y que el resultado sea el
 * mismo numero por construccion, no por disciplina (referencia 10).
 */
export type QuoteInput = {
  tiers: readonly Tier[]
  quantities: Quantities
  /** Puntos basicos: 2100 = 21 %. Entero, para que el float no toque el calculo. */
  tax_rate_bp: number
  /** La divisa de FACTURACION del plan (referencia 4.1). */
  currency: CurrencyCode
}

export type QuoteResult = {
  base_minor: number
  tax_rate_bp: number
  tax_minor: number
  total_minor: number
  currency: CurrencyCode
  breakdown: MetricBreakdown[]
}
