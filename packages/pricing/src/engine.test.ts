// Bordes 0/10/50/51, multi-metrica, metrica no facturada = 0. Spec: 15

import { describe, expect, it } from 'vitest'
import { baseMinorOf, computeBreakdown } from './engine'
import type { MetricBreakdown, Quantities, Tier } from './types'

// Los mismos tramos que siembra backend/src/infra/seed.ts. Spec: modelo-datos.md 3.2
const PLAN_A: readonly Tier[] = [
  { metric: 'users', up_to: 10, unit_price_minor: 1000, sort_order: 0 },
  { metric: 'users', up_to: 50, unit_price_minor: 800, sort_order: 1 },
  { metric: 'users', up_to: null, unit_price_minor: 500, sort_order: 2 },
]

const PLAN_B: readonly Tier[] = [
  { metric: 'storage_gb', up_to: 100, unit_price_minor: 1300, sort_order: 0 },
  { metric: 'storage_gb', up_to: 500, unit_price_minor: 700, sort_order: 1 },
  { metric: 'storage_gb', up_to: 2000, unit_price_minor: 400, sort_order: 2 },
  { metric: 'storage_gb', up_to: null, unit_price_minor: 200, sort_order: 3 },
]

const PLAN_ESCALADO: readonly Tier[] = [
  { metric: 'users', up_to: 25, unit_price_minor: 900, sort_order: 0 },
  { metric: 'users', up_to: null, unit_price_minor: 600, sort_order: 1 },
  { metric: 'api_calls', up_to: 100_000, unit_price_minor: 0, sort_order: 0 },
  { metric: 'api_calls', up_to: 1_000_000, unit_price_minor: 2, sort_order: 1 },
  { metric: 'api_calls', up_to: null, unit_price_minor: 1, sort_order: 2 },
]

const q = (parcial: Partial<Quantities>): Quantities => ({
  users: 0,
  storage_gb: 0,
  api_calls: 0,
  ...parcial,
})

const base = (tiers: readonly Tier[], cantidades: Quantities): number =>
  baseMinorOf(computeBreakdown(tiers, cantidades))

const de = (b: readonly MetricBreakdown[], metric: string): MetricBreakdown => {
  const encontrado = b.find((x) => x.metric === metric)
  if (encontrado === undefined) throw new Error(`El breakdown no trae la metrica ${metric}`)
  return encontrado
}

describe('motor — el caso literal del enunciado', () => {
  // Si falla este, no importa nada mas.
  it('Plan A con 15 usuarios cuesta 140 EUR', () => {
    expect(base(PLAN_A, q({ users: 15 }))).toBe(14_000)
  })

  it('desglosa 15 usuarios como 10x10 EUR + 5x8 EUR', () => {
    const users = de(computeBreakdown(PLAN_A, q({ users: 15 })), 'users')

    expect(users.tiers).toEqual([
      { up_to: 10, unit_price_minor: 1000, units: 10, amount_minor: 10_000 },
      { up_to: 50, unit_price_minor: 800, units: 5, amount_minor: 4_000 },
    ])
    // El tercer tramo no aparece: no se llego a el. Un desglose con un "0 x 5 EUR" seria
    // ruido en una pantalla que un comercial tiene que leer por telefono.
    expect(users.tiers).toHaveLength(2)
  })

  it('NO es volume pricing', () => {
    // Volume daria 15 x 8 EUR = 120 EUR. Graduated da 140 EUR.
    expect(base(PLAN_A, q({ users: 15 }))).not.toBe(12_000)
  })
})

describe('motor — bordes de los cortes', () => {
  // El off-by-one clasico: up_to es INCLUSIVO, asi que el corte pertenece al tramo de abajo.
  it.each([
    { users: 0, esperado: 0, por_que: 'sin usuarios no se entra al bucle' },
    { users: 1, esperado: 1_000, por_que: 'primera unidad al primer tramo' },
    { users: 10, esperado: 10_000, por_que: 'el corte 10 es del primer tramo: 10x1000, no 10x1000+0x800' },
    { users: 11, esperado: 10_800, por_que: 'la unidad 11 es la primera del segundo tramo' },
    { users: 15, esperado: 14_000, por_que: 'el ejemplo del enunciado' },
    { users: 50, esperado: 42_000, por_que: 'el corte 50 es del segundo tramo: 10x1000 + 40x800' },
    { users: 51, esperado: 42_500, por_que: 'la unidad 51 abre el tramo infinito' },
    { users: 100, esperado: 67_000, por_que: '10x1000 + 40x800 + 50x500' },
  ])('$users usuarios -> $esperado minor ($por_que)', ({ users, esperado }) => {
    expect(base(PLAN_A, q({ users }))).toBe(esperado)
  })

  it('la capacidad del tramo intermedio es up_to - anterior, no up_to', () => {
    // Con 50 usuarios: si el segundo tramo cobrara 50 unidades en vez de 40, saldria
    // 10x1000 + 50x800 = 50000. Es el error que este test existe para cazar.
    expect(base(PLAN_A, q({ users: 50 }))).toBe(42_000)
    expect(base(PLAN_A, q({ users: 50 }))).not.toBe(50_000)
  })

  it('Plan B recorre bien cuatro tramos', () => {
    expect(base(PLAN_B, q({ storage_gb: 100 }))).toBe(130_000)
    expect(base(PLAN_B, q({ storage_gb: 500 }))).toBe(130_000 + 400 * 700)
    expect(base(PLAN_B, q({ storage_gb: 2000 }))).toBe(130_000 + 280_000 + 1500 * 400)
    expect(base(PLAN_B, q({ storage_gb: 2001 }))).toBe(130_000 + 280_000 + 600_000 + 200)
  })
})

describe('motor — multi-metrica', () => {
  it('suma lo que aporta cada metrica', () => {
    // users: 25x900 = 22500 ; api_calls: 100000x0 + 150000x2 = 300000
    const b = computeBreakdown(PLAN_ESCALADO, q({ users: 25, api_calls: 250_000 }))

    expect(de(b, 'users').subtotal_minor).toBe(22_500)
    expect(de(b, 'api_calls').subtotal_minor).toBe(300_000)
    expect(baseMinorOf(b)).toBe(322_500)
  })

  it('un tramo a precio 0 aporta 0: "incluido hasta 100.000" sin concepto nuevo', () => {
    const b = computeBreakdown(PLAN_ESCALADO, q({ api_calls: 50_000 }))
    const api = de(b, 'api_calls')

    expect(api.subtotal_minor).toBe(0)
    // Pero SI aparece en el desglose: se consumieron 50.000 unidades a precio cero.
    expect(api.tiers).toEqual([
      { up_to: 100_000, unit_price_minor: 0, units: 50_000, amount_minor: 0 },
    ])
    expect(api.billed).toBe(true)
  })
})

describe('motor — metricas que el plan no factura', () => {
  it('aporta 0 pero NO desaparece del desglose', () => {
    const b = computeBreakdown(PLAN_A, q({ users: 15, storage_gb: 500, api_calls: 9_000 }))

    // Es lo que permite a la UI atenuar la tarjeta en vez de ocultarla, sin ningun `if`
    // sobre el plan en el cliente (referencia 5.2).
    expect(de(b, 'storage_gb')).toEqual({
      metric: 'storage_gb',
      billed: false,
      quantity: 500,
      subtotal_minor: 0,
      tiers: [],
    })
    expect(baseMinorOf(b)).toBe(14_000)
  })

  it('siempre devuelve las tres metricas, facture o no', () => {
    const b = computeBreakdown(PLAN_A, q({ users: 1 }))
    expect(b.map((x) => x.metric)).toEqual(['users', 'storage_gb', 'api_calls'])
  })

  it('billed:true con subtotal 0 NO es lo mismo que billed:false', () => {
    // Plan A con 0 usuarios: el plan SI cobra por usuarios, solo que no hay ninguno.
    const b = computeBreakdown(PLAN_A, q({ users: 0 }))

    expect(de(b, 'users')).toEqual({
      metric: 'users',
      billed: true,
      quantity: 0,
      subtotal_minor: 0,
      tiers: [],
    })
    expect(de(b, 'storage_gb').billed).toBe(false)
  })
})

describe('motor — propiedades del desglose', () => {
  const casos: Quantities[] = [
    q({ users: 0 }),
    q({ users: 15 }),
    q({ users: 51 }),
    q({ users: 25, api_calls: 250_000 }),
    q({ users: 1_000_000, api_calls: 1_000_000_000 }),
  ]

  it.each(casos)('el desglose explica su propio total (%j)', (cantidades) => {
    const b = computeBreakdown(PLAN_ESCALADO, cantidades)

    for (const metrica of b) {
      const sumaTramos = metrica.tiers.reduce((s, t) => s + t.amount_minor, 0)
      expect(sumaTramos).toBe(metrica.subtotal_minor)
    }
    const sumaSubtotales = b.reduce((s, m) => s + m.subtotal_minor, 0)
    expect(sumaSubtotales).toBe(baseMinorOf(b))
  })

  it.each(casos)('las unidades repartidas suman la cantidad pedida (%j)', (cantidades) => {
    const b = computeBreakdown(PLAN_ESCALADO, cantidades)

    for (const metrica of b.filter((x) => x.billed)) {
      const sumaUnits = metrica.tiers.reduce((s, t) => s + t.units, 0)
      expect(sumaUnits).toBe(metrica.quantity)
    }
  })

  it('todo importe del desglose es un entero', () => {
    const b = computeBreakdown(PLAN_ESCALADO, q({ users: 37, api_calls: 777_777 }))
    for (const m of b) {
      expect(Number.isInteger(m.subtotal_minor)).toBe(true)
      for (const t of m.tiers) expect(Number.isInteger(t.amount_minor)).toBe(true)
    }
  })
})

describe('motor — robustez de la entrada', () => {
  it('respeta sort_order aunque los tramos lleguen desordenados', () => {
    // El repositorio no garantiza el orden del SELECT si nadie pone ORDER BY.
    const desordenado = [...PLAN_A].reverse()
    expect(base(desordenado, q({ users: 15 }))).toBe(14_000)
  })

  it('no muta el array de tramos que recibe', () => {
    const original = [...PLAN_A].reverse()
    const copia = [...original]

    computeBreakdown(original, q({ users: 15 }))

    // Un .sort() sobre el array de entrada reordenaria los tramos del llamante. El
    // paquete es puro: no toca lo que le dan.
    expect(original).toEqual(copia)
  })

  it('es agnostico a la metrica: los mismos cortes dan el mismo numero en otra metrica', () => {
    const comoUsuarios: Tier[] = PLAN_A.map((t) => ({ ...t }))
    const comoGigas: Tier[] = PLAN_A.map((t) => ({ ...t, metric: 'storage_gb' as const }))

    // El motor no sabe si cuenta usuarios o gigas: es literalmente el mismo recorrido.
    expect(base(comoUsuarios, q({ users: 15 }))).toBe(base(comoGigas, q({ storage_gb: 15 })))
  })
})
