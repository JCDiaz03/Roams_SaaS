// Presentacion compartida de planes: etiquetas de metrica y metricas facturadas. Spec: 08
//
// Extraido del panel de admin cuando el detalle de plan y la seccion del dashboard se
// convirtieron en el segundo y tercer consumidor: tres copias de un Record se
// desincronizan la primera vez que alguien renombra una metrica.

import type { Metric } from '@saas/pricing'
import type { Plan } from './api-client'

/** La etiqueta de cada metrica, en lenguaje de comercial. */
export const ETIQUETA_METRICA: Record<Metric, string> = {
  users: 'Usuarios',
  storage_gb: 'Almacenamiento',
  api_calls: 'Llamadas API',
}

/** Las metricas que un plan factura, en el orden de sus tramos. */
export function metricasDe(plan: Plan): Metric[] {
  return [...new Set(plan.tiers.map((t) => t.metric))]
}
