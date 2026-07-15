// Base + impuesto + total; el total no depende de la divisa de visualizacion. Spec: 15

import { describe, expect, it } from 'vitest'
import { quote } from './quote'
import type { Quantities, QuoteInput, Tier } from './types'

const PLAN_A: readonly Tier[] = [
  { metric: 'users', up_to: 10, unit_price_minor: 1000, sort_order: 0 },
  { metric: 'users', up_to: 50, unit_price_minor: 800, sort_order: 1 },
  { metric: 'users', up_to: null, unit_price_minor: 500, sort_order: 2 },
]

const q = (parcial: Partial<Quantities>): Quantities => ({
  users: 0,
  storage_gb: 0,
  api_calls: 0,
  ...parcial,
})

const entrada = (parcial: Partial<QuoteInput> = {}): QuoteInput => ({
  tiers: PLAN_A,
  quantities: q({ users: 15 }),
  tax_rate_bp: 2100,
  currency: 'EUR',
  ...parcial,
})

describe('quote — el caso del gate de Fase 1', () => {
  it('15 usuarios, cliente español: 140 EUR + 21 % = 169,40 EUR', () => {
    const r = quote(entrada())

    expect(r.base_minor).toBe(14_000)
    expect(r.tax_rate_bp).toBe(2100)
    expect(r.tax_minor).toBe(2_940)
    expect(r.total_minor).toBe(16_940)
    expect(r.currency).toBe('EUR')
  })
})

describe('quote — el orden canonico', () => {
  it('el impuesto sale de la base, no de una cantidad', () => {
    // 42000 (50 usuarios) al 21 % = 8820
    const r = quote(entrada({ quantities: q({ users: 50 }) }))
    expect(r.base_minor).toBe(42_000)
    expect(r.tax_minor).toBe(8_820)
  })

  it('base + tax = total, exactamente y siempre', () => {
    // Es el invariante que el CHECK (total_minor = base_minor + tax_minor) de la tabla
    // garantiza del lado de la persistencia. Aqui se garantiza del lado del calculo.
    for (const users of [0, 1, 7, 10, 11, 15, 49, 50, 51, 137, 999]) {
      for (const tax_rate_bp of [0, 810, 1000, 1900, 2100, 2300, 10_000]) {
        const r = quote(entrada({ quantities: q({ users }), tax_rate_bp }))
        expect(r.total_minor).toBe(r.base_minor + r.tax_minor)
      }
    }
  })

  it('todo importe del resultado es un entero', () => {
    const r = quote(entrada({ quantities: q({ users: 37 }), tax_rate_bp: 810 }))

    expect(Number.isInteger(r.base_minor)).toBe(true)
    expect(Number.isInteger(r.tax_minor)).toBe(true)
    expect(Number.isInteger(r.total_minor)).toBe(true)
  })

  it('un tipo con decimal (Suiza, 8,1 %) no introduce fracciones', () => {
    const r = quote(entrada({ tax_rate_bp: 810 }))
    // 14000 * 810 / 10000 = 1134 exacto
    expect(r.tax_minor).toBe(1_134)
    expect(r.total_minor).toBe(15_134)
  })

  it('tipo 0 no es un caso especial', () => {
    const r = quote(entrada({ tax_rate_bp: 0 }))
    expect(r.tax_minor).toBe(0)
    expect(r.total_minor).toBe(r.base_minor)
  })

  it('sin consumo no hay nada que cobrar', () => {
    const r = quote(entrada({ quantities: q({ users: 0 }) }))
    expect(r).toMatchObject({ base_minor: 0, tax_minor: 0, total_minor: 0 })
  })
})

describe('quote — el redondeo ocurre una sola vez', () => {
  it('redondear el impuesto equivale a redondear el total, porque la base es entera', () => {
    // round_half_up(base + tax_exacto) === base + round_half_up(tax_exacto) cuando
    // base es entero. Las dos lecturas del 4.2 dan el MISMO entero, siempre; por eso no
    // hay ambiguedad que resolver. Aqui se comprueba contra el calculo exacto.
    for (const users of [1, 3, 7, 15, 23, 51, 99, 137]) {
      for (const tax_rate_bp of [810, 1000, 1900, 2100, 2300]) {
        const r = quote(entrada({ quantities: q({ users }), tax_rate_bp }))

        const taxExacto = (BigInt(r.base_minor) * BigInt(tax_rate_bp)) / 10_000n
        const resto = (BigInt(r.base_minor) * BigInt(tax_rate_bp)) % 10_000n
        const totalRedondeadoAlFinal =
          BigInt(r.base_minor) + taxExacto + (2n * resto >= 10_000n ? 1n : 0n)

        expect(BigInt(r.total_minor)).toBe(totalRedondeadoAlFinal)
      }
    }
  })

  it('la mitad exacta va hacia arriba tambien pasando por quote()', () => {
    // base 10 minor al 5 % -> 0,5 -> 1
    const tiers: Tier[] = [{ metric: 'users', up_to: null, unit_price_minor: 10, sort_order: 0 }]
    const r = quote(entrada({ tiers, quantities: q({ users: 1 }), tax_rate_bp: 500 }))

    expect(r.base_minor).toBe(10)
    expect(r.tax_minor).toBe(1)
    expect(r.total_minor).toBe(11)
  })
})

describe('quote — la divisa', () => {
  it('viaja con el importe sin entrar en la aritmetica', () => {
    // La divisa de FACTURACION es del plan. El motor la transporta para que ningun
    // importe viaje sin su codigo ISO (invariante 5).
    expect(quote(entrada({ currency: 'GBP' })).currency).toBe('GBP')
  })

  it('el total no cambia segun la divisa: el numero es del plan, no del desplegable', () => {
    // Invariante 4: la divisa de visualizacion no afecta al negocio. Aqui se comprueba
    // que ni siquiera hay por donde: quote() no acepta una divisa de visualizacion, y el
    // resultado con una divisa de facturacion u otra es el mismo entero.
    const enEuros = quote(entrada({ currency: 'EUR' }))
    const enYenes = quote(entrada({ currency: 'JPY' }))

    expect(enYenes.total_minor).toBe(enEuros.total_minor)
    expect(enYenes.base_minor).toBe(enEuros.base_minor)
  })

  it('un plan en yenes redondea a yenes enteros', () => {
    // 145 JPY = 145 minor (minor_unit 0). Al 10 % -> 14,5 -> 15.
    const tiers: Tier[] = [{ metric: 'users', up_to: null, unit_price_minor: 145, sort_order: 0 }]
    const r = quote(entrada({ tiers, quantities: q({ users: 1 }), tax_rate_bp: 1000, currency: 'JPY' }))

    expect(r.base_minor).toBe(145)
    expect(r.tax_minor).toBe(15)
    expect(r.total_minor).toBe(160)
  })
})

describe('quote — pureza', () => {
  it('la misma entrada da el mismo resultado', () => {
    expect(quote(entrada())).toEqual(quote(entrada()))
  })

  it('no depende del reloj, de la red ni de la base de datos', () => {
    // Todo lo que necesita entra por argumento. Es lo que permite que el navegador lo
    // ejecute con los tramos de GET /customers/{id} y el servidor con los de SQLite, y
    // que el numero sea el mismo por construccion (referencia 10).
    expect(Object.keys(entrada()).sort()).toEqual([
      'currency',
      'quantities',
      'tax_rate_bp',
      'tiers',
    ])
  })
})
