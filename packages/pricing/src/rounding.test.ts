// Half-up con .5 exacto; minor_unit distinto de 2. Spec: 15

import { describe, expect, it } from 'vitest'
import { roundHalfUpDiv } from './rounding'

const BP = 10_000n

describe('roundHalfUpDiv — la mitad exacta se aleja del cero', () => {
  it('redondea .5 hacia arriba', () => {
    expect(roundHalfUpDiv(5n, 10n)).toBe(1n) // 0,5 -> 1
    expect(roundHalfUpDiv(25n, 10n)).toBe(3n) // 2,5 -> 3
    expect(roundHalfUpDiv(35n, 10n)).toBe(4n) // 3,5 -> 4  (half-EVEN daria 4)
    expect(roundHalfUpDiv(45n, 10n)).toBe(5n) // 4,5 -> 5  (half-EVEN daria 4: aqui se separan)
  })

  it('no redondea por debajo de la mitad, y si por encima', () => {
    expect(roundHalfUpDiv(24n, 10n)).toBe(2n)
    expect(roundHalfUpDiv(26n, 10n)).toBe(3n)
    expect(roundHalfUpDiv(0n, 10n)).toBe(0n)
    expect(roundHalfUpDiv(10n, 10n)).toBe(1n)
  })

  // Este es el test que documenta POR QUE esta funcion existe en vez de un Math.round.
  // Hoy no hay importes negativos; el dia que haya un abono, Math.round daria -2 donde
  // half-up da -3, y el bug seria silencioso y contable.
  it('trata los negativos alejandose del cero, donde Math.round falla', () => {
    expect(roundHalfUpDiv(-5n, 10n)).toBe(-1n) // -0,5 -> -1   (Math.round daria 0)
    expect(roundHalfUpDiv(-25n, 10n)).toBe(-3n) // -2,5 -> -3   (Math.round daria -2)
    expect(roundHalfUpDiv(-24n, 10n)).toBe(-2n) // -2,4 -> -2
    expect(roundHalfUpDiv(-26n, 10n)).toBe(-3n) // -2,6 -> -3

    expect(Math.round(-2.5)).toBe(-2) // deja constancia de que no es lo mismo
  })

  it('es simetrico respecto al cero', () => {
    for (const n of [1n, 4n, 5n, 6n, 9n, 14n, 15n, 16n, 25n, 9999n, 10_000n, 10_001n]) {
      expect(roundHalfUpDiv(-n, 10n)).toBe(-roundHalfUpDiv(n, 10n))
    }
  })

  it('resuelve bien el signo con denominador negativo', () => {
    // El signo del cociente es el producto de los signos, no el del numerador.
    expect(roundHalfUpDiv(25n, -10n)).toBe(-3n) // -2,5 -> -3
    expect(roundHalfUpDiv(-25n, -10n)).toBe(3n) // 2,5 -> 3
  })

  it('rechaza el denominador cero en vez de devolver basura', () => {
    expect(() => roundHalfUpDiv(1n, 0n)).toThrow(RangeError)
  })

  it('decide bien la mitad con denominadores impares', () => {
    // 3/2 = 1,5 -> 2 ; 1/3 = 0,33 -> 0 ; 2/3 = 0,66 -> 1
    expect(roundHalfUpDiv(3n, 2n)).toBe(2n)
    expect(roundHalfUpDiv(1n, 3n)).toBe(0n)
    expect(roundHalfUpDiv(2n, 3n)).toBe(1n)
  })
})

describe('roundHalfUpDiv — exactitud fuera del rango seguro de number', () => {
  it('no pierde precision por encima de MAX_SAFE_INTEGER', () => {
    // 2^53 + 1: el primer entero que un double NO puede representar. Con aritmetica de
    // `number`, multiplicar y dividir por 10000 lo devolveria cambiado.
    const inseguro = 9_007_199_254_740_993n
    expect(roundHalfUpDiv(inseguro * BP, BP)).toBe(inseguro)

    // Deja constancia de que el problema es real y no teorico: al pasar por `number`,
    // 2^53+1 colapsa a 2^53. No se puede escribir el fallo como `not.toBe(2^53+1)`
    // porque ESE literal es tambien un double y colapsa igual: la unica forma de
    // ensenar la perdida es afirmar el valor al que cae.
    expect(Number(inseguro)).toBe(9_007_199_254_740_992)
    expect(BigInt(Number(inseguro))).not.toBe(inseguro)
  })

  it('resuelve la mitad exacta justo en el borde de MAX_SAFE_INTEGER', () => {
    // Cociente exacto = 9007199254740991,5 -> half-up -> 9007199254740992
    expect(roundHalfUpDiv(90_071_992_547_409_915_000n, BP)).toBe(9_007_199_254_740_992n)
  })
})

describe('roundHalfUpDiv — como lo usa el impuesto', () => {
  // El unico punto del sistema donde aparece una fraccion: tax = base * rate_bp / 10000.
  const impuesto = (baseMinor: number, rateBp: number): number =>
    Number(roundHalfUpDiv(BigInt(baseMinor) * BigInt(rateBp), BP))

  it('el caso de .5 exacto del enunciado de la spec', () => {
    // base 10 minor, 5 % -> 0,5 -> 1 (spec 01, seccion 5)
    expect(impuesto(10, 500)).toBe(1)
  })

  it('el caso literal del reto: 140 EUR al 21 %', () => {
    expect(impuesto(14_000, 2100)).toBe(2940)
  })

  it('un tipo con decimal (Suiza, 8,1 %) redondea al centimo', () => {
    // 14000 * 810 / 10000 = 1134 exacto
    expect(impuesto(14_000, 810)).toBe(1134)
    // 999 * 810 / 10000 = 80,919 -> 81
    expect(impuesto(999, 810)).toBe(81)
  })

  it('minor_unit = 0: un plan en yenes redondea a yenes enteros', () => {
    // 140 JPY = 140 minor. Al 10 % -> 14 exacto.
    expect(impuesto(140, 1000)).toBe(14)
    // 145 al 10 % -> 14,5 -> 15. Es el .5 exacto en una divisa sin decimales: sin
    // enteros _minor + half-up, aqui aparecerian centimos de yen.
    expect(impuesto(145, 1000)).toBe(15)
  })

  it('minor_unit = 3: un plan en dinares redondea a la milesima', () => {
    // 140,000 KWD = 140000 minor. Al 5 % -> 7000 exacto.
    expect(impuesto(140_000, 500)).toBe(7000)
    // 1 minor al 50 % -> 0,5 -> 1
    expect(impuesto(1, 5000)).toBe(1)
  })

  it('tipo 0 y base 0 no son casos especiales, son aritmetica', () => {
    expect(impuesto(14_000, 0)).toBe(0)
    expect(impuesto(0, 2100)).toBe(0)
  })
})
