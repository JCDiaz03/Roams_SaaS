// Superficie publica del paquete. Spec: ai-workspace/01-specs/idea-referencia.md 2, 10
//
// Este paquete es una funcion pura importada por backend y frontend: no existen dos
// implementaciones del calculo que puedan divergir. Reglas que lo sostienen y que no se
// negocian (directrices-ia.md 3.1):
//   * No importa NADA de backend/ ni de frontend/.
//   * No toca IO. Si algo necesita leer de la base de datos, se le pasa por argumento.

export { quote } from './quote'
export { computeBreakdown, baseMinorOf } from './engine'
export { roundHalfUpDiv } from './rounding'

export { CURRENCIES, CURRENCY_CODES, isCurrencyCode, minorUnitOf } from './currency'
export type { CurrencyCode, MinorUnit } from './currency'

export { METRICS } from './types'
export type {
  Metric,
  MetricBreakdown,
  PricingModel,
  Quantities,
  QuoteInput,
  QuoteResult,
  Tier,
  TierApplication,
} from './types'
