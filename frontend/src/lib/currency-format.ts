// Intl.NumberFormat a partir del codigo ISO; cero tablas de simbolos. Ref: 4.4

import { minorUnitOf, type CurrencyCode } from '@saas/pricing'

const LOCALE = 'es-ES'

// Intl.NumberFormat es caro de construir y se llama en cada frame del slider.
const cache = new Map<string, Intl.NumberFormat>()

function formateador(code: CurrencyCode): Intl.NumberFormat {
  const existente = cache.get(code)
  if (existente !== undefined) return existente

  const nuevo = new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: code,
    // narrowSymbol, y NO el 'symbol' por defecto. Con el defecto, es-ES mezcla simbolos y
    // codigos segun la divisa: EUR -> "140,00 €" pero JPY -> "140 JPY" y GBP ->
    // "140,00 GBP". Con narrowSymbol salen "140 ¥" y "140,00 £", que es el precio como
    // protagonista tipografico que pide el diseno (2.1) y lo que la referencia 4.4 da por
    // hecho en su ejemplo.
    //
    // Contrapartida asumida: USD pasa de "US$" a "$", que es ambiguo con otros dolares.
    // Se acepta porque el importe convertido va SIEMPRE etiquetado como referencia y con
    // el codigo ISO al lado en el selector (4.1).
    currencyDisplay: 'narrowSymbol',
  })
  cache.set(code, nuevo)
  return nuevo
}

/**
 * Pinta un importe en unidades menores.
 *
 *   formatMinor(14000, 'EUR') -> "140,00 €"
 *   formatMinor(140, 'JPY')   -> "140 ¥"     (el yen no tiene decimales)
 *
 * El simbolo y los decimales los deriva Intl a partir del codigo ISO: CERO tablas de
 * simbolos que mantener (referencia 4.4). El prototipo lleva un `symbolOf()` a mano
 * porque es un mockup; aqui seria una lista que se queda vieja.
 *
 * La division por 10^minor_unit es el UNICO sitio donde un importe pasa a decimal, y es
 * presentacion: el resultado no vuelve al negocio ni se envia a ningun sitio
 * (invariantes 3 y 5). Por eso vive en el frontend y no en @saas/pricing.
 */
export function formatMinor(minor: number, code: CurrencyCode): string {
  return formateador(code).format(minor / 10 ** minorUnitOf(code))
}

/** Solo el simbolo ("€", "¥", "CHF"), para el selector. Tambien lo deriva Intl. */
export function simboloDe(code: CurrencyCode): string {
  const parte = formateador(code)
    .formatToParts(0)
    .find((p) => p.type === 'currency')

  return parte?.value ?? code
}

/**
 * Convierte un importe a la divisa de visualizacion. SOLO VISTA (invariante 3, 4.2 paso
 * 5): el resultado se pinta y se tira, nunca se persiste ni se envia.
 *
 * Se redondea con Math.round y NO con la funcion de @saas/pricing, a proposito: esto no
 * es el redondeo del negocio, es el ultimo decimal de un numero que ya va etiquetado como
 * "referencia" en pantalla. El redondeo half-up del sistema es para el importe de
 * FACTURACION, que aqui ya viene calculado y cerrado por el backend.
 */
export function convertMinor(
  minor: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Readonly<Record<string, number>>,
): number | null {
  if (from === to) return minor

  const tasaOrigen = rates[from]
  const tasaDestino = rates[to]
  // Sin tipo no se inventa uno: quien llama decide que pintar (13.1).
  if (tasaOrigen === undefined || tasaDestino === undefined) return null

  const enMayor = minor / 10 ** minorUnitOf(from)
  const convertido = (enMayor / tasaOrigen) * tasaDestino

  return Math.round(convertido * 10 ** minorUnitOf(to))
}
