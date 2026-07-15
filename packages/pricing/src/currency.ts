// Currency estatico con minor_unit (EUR 2, JPY 0, KWD 3). Spec: 4.3, 4.4

/**
 * Numero de decimales de la divisa segun ISO 4217. Es lo que convierte un importe
 * "_minor" en un importe legible: 140 EUR = 14000 minor (2 decimales), 140 JPY = 140
 * minor (0 decimales).
 */
export type MinorUnit = 0 | 2 | 3

/**
 * Divisas soportadas, con sus unidades menores.
 *
 * ESTATICO EN CODIGO, no leido de la API en caliente: cero acoplamiento en tiempo de
 * ejecucion (referencia 4.3). Si el proveedor de tipos cae o deja de listar una divisa,
 * el formulario de planes sigue funcionando. La API solo aporta tipos de cambio para
 * MOSTRAR; no define en que se puede facturar.
 *
 * Es tambien el filtro del payload de GET /rates: la API devuelve ~160 divisas y se
 * guardan solo estas (features/04-tipos-de-cambio.md 3.3). Por eso este objeto es la
 * unica definicion de "en que divisas trabaja el sistema".
 *
 * Un mapa plano codigo -> minor_unit, y no una lista de { code, minor_unit }: con la
 * segunda forma la clave y el campo `code` pueden divergir, y no hay nada que lo impida.
 * Aqui la clave ES el codigo.
 *
 * Alcance: las divisas de uso realista en una herramienta comercial europea, mas los
 * casos que hacen visible el problema de los decimales. Anadir una es una linea; no hace
 * falta que esten las 160 para que el diseno sea correcto.
 */
export const CURRENCIES = {
  // Zona euro y entorno inmediato
  EUR: 2,
  GBP: 2,
  CHF: 2,
  SEK: 2,
  NOK: 2,
  DKK: 2,
  PLN: 2,
  CZK: 2,
  HUF: 2, // ISO 4217 dice 2, aunque el florin se maneje coloquialmente sin decimales
  RON: 2,
  BGN: 2,
  ISK: 0,
  TRY: 2,

  // America
  USD: 2,
  CAD: 2,
  MXN: 2,
  BRL: 2,
  ARS: 2,
  CLP: 0,
  COP: 2,
  PEN: 2,

  // Asia-Pacifico
  JPY: 0, // el yen no tiene decimales: aqui "x100" deja de ser cierto (referencia 4.4)
  CNY: 2,
  HKD: 2,
  SGD: 2,
  KRW: 0,
  INR: 2,
  THB: 2,
  MYR: 2,
  IDR: 2,
  PHP: 2,
  VND: 0,
  AUD: 2,
  NZD: 2,

  // Africa y Oriente Medio
  ZAR: 2,
  AED: 2,
  SAR: 2,
  ILS: 2,
  EGP: 2,
  MAD: 2,

  // Las de tres decimales: el otro extremo del mismo problema
  KWD: 3,
  BHD: 3,
  OMR: 3,
  JOD: 3,
  TND: 3,
} as const satisfies Record<string, MinorUnit>

/** El codigo ISO 4217. Se deriva de las claves: no hay una segunda lista que mantener. */
export type CurrencyCode = keyof typeof CURRENCIES

export const CURRENCY_CODES: readonly CurrencyCode[] = Object.keys(CURRENCIES) as CurrencyCode[]

/**
 * Guarda para los datos que entran de fuera (la columna `currency` de un plan, el
 * `display_currency` de un pais, el payload de la API de tipos).
 *
 * Es lo que usa el chequeo de integridad del arranque para fallar ruidosamente en vez de
 * degradar en silencio (modelo-datos.md 4, chequeo 3).
 */
export function isCurrencyCode(valor: string): valor is CurrencyCode {
  return Object.hasOwn(CURRENCIES, valor)
}

export function minorUnitOf(code: CurrencyCode): MinorUnit {
  return CURRENCIES[code]
}

// Nota deliberada: aqui NO hay tabla de simbolos. El simbolo y los decimales al pintar
// se derivan con Intl.NumberFormat a partir del codigo ISO (referencia 4.4):
//   new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'JPY' }).format(140)
// Se guarda el codigo, nunca el simbolo (invariante 6).
