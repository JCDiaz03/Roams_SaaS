// Presentacion compartida de planes: etiquetas de metrica y metricas facturadas. Spec: 08
//
// Extraido del panel de admin cuando el detalle de plan y la seccion del dashboard se
// convirtieron en el segundo y tercer consumidor: tres copias de un Record se
// desincronizan la primera vez que alguien renombra una metrica.

import { METRICS, type Metric } from '@saas/pricing'
import type { Plan } from './api-client'

/** La etiqueta de cada metrica, en lenguaje de comercial. */
export const ETIQUETA_METRICA: Record<Metric, string> = {
  users: 'Usuarios',
  storage_gb: 'Almacenamiento',
  api_calls: 'Llamadas API',
}

/**
 * Las metricas que un plan factura, SIEMPRE en el orden canonico (usuarios,
 * almacenamiento, llamadas): el mismo que los sliders del simulador. Ordenar por
 * aparicion de los tramos pintaba las tarjetas de un plan solo-almacenamiento con las
 * llamadas primero (la API devuelve los tramos por metrica alfabetica).
 */
export function metricasDe(plan: Plan): Metric[] {
  const presentes = new Set(plan.tiers.map((t) => t.metric))
  return METRICS.filter((m) => presentes.has(m))
}
