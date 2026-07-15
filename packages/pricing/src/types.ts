// Tipos compartidos: Metric, Tier, PricingModel, QuoteInput/QuoteResult. Spec: 5.2, 11.1
//
// Estado: (parcial). Aqui vive de momento solo el vocabulario que ya tiene consumidor
// (el seed). Tier, QuoteInput y QuoteResult entran con el motor, en Fase 1.

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
