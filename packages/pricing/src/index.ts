// Superficie publica del paquete. Spec: ai-workspace/01-specs/idea-referencia.md 2, 10
//
// Este paquete es una funcion pura importada por backend y frontend: no existen dos
// implementaciones del calculo que puedan divergir. Reglas que lo sostienen y que no se
// negocian (directrices-ia.md 3.1):
//   * No importa NADA de backend/ ni de frontend/.
//   * No toca IO. Si algo necesita leer de la base de datos, se le pasa por argumento.
//
// Estado: (parcial). Motor, redondeo y enum Currency entran en Fase 1.

export { METRICS } from './types'
export type { Metric, PricingModel } from './types'
