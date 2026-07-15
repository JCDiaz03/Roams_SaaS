// Validacion de plantilla: cortes, huecos, ultimo abierto, bloques. Spec: 15, 5.4

import { describe, expect, it } from 'vitest'
import { validarPlantilla, type Plantilla, type PlantillaTier } from './plan-template.validation'

const plantilla = (tiers: PlantillaTier[], parcial: Partial<Plantilla> = {}): Plantilla => ({
  name: 'Plan Nuevo',
  currency: 'EUR',
  tiers,
  ...parcial,
})

const reglas = (p: Plantilla) => validarPlantilla(p).map((v) => v.rule)

const USERS = (up_to: number | null, unit_price_minor = 1000): PlantillaTier => ({
  metric: 'users',
  up_to,
  unit_price_minor,
})

describe('plantillas validas', () => {
  it('los tramos literales del enunciado', () => {
    expect(validarPlantilla(plantilla([USERS(10), USERS(50, 800), USERS(null, 500)]))).toEqual([])
  })

  it('un solo tramo abierto: el plan de tarifa plana por unidad', () => {
    expect(validarPlantilla(plantilla([USERS(null)]))).toEqual([])
  })

  it('multi-metrica: cada bloque se valida por separado', () => {
    const p = plantilla([
      USERS(20, 900),
      USERS(null, 600),
      { metric: 'storage_gb', up_to: 500, unit_price_minor: 500 },
      { metric: 'storage_gb', up_to: null, unit_price_minor: 300 },
      { metric: 'api_calls', up_to: 50_000, unit_price_minor: 2 },
      { metric: 'api_calls', up_to: null, unit_price_minor: 1 },
    ])
    expect(validarPlantilla(p)).toEqual([])
  })

  it('un precio de CERO es un precio: modela "incluido hasta N"', () => {
    const p = plantilla([
      { metric: 'api_calls', up_to: 100_000, unit_price_minor: 0 },
      { metric: 'api_calls', up_to: null, unit_price_minor: 1 },
    ])
    expect(validarPlantilla(p)).toEqual([])
  })

  it('una metrica ausente es legitima: ese plan no la cobra', () => {
    // No mandar el bloque ES la forma de decir "no cobro por esto" (referencia 5.2).
    expect(validarPlantilla(plantilla([USERS(null)]))).toEqual([])
  })
})

describe('cortes', () => {
  it('cortes iguales -> el tramo quedaria vacio', () => {
    expect(reglas(plantilla([USERS(10), USERS(10), USERS(null)]))).toContain('CUTS_NOT_INCREASING')
  })

  it('cortes decrecientes', () => {
    expect(reglas(plantilla([USERS(50), USERS(10), USERS(null)]))).toContain('CUTS_NOT_INCREASING')
  })

  it('el primer corte tiene que superar a 0', () => {
    // up_to: 0 lo rebota antes el esquema JSON (minimum: 1), pero el seed no pasa por el.
    expect(reglas(plantilla([USERS(0), USERS(null)]))).toContain('CUTS_NOT_INCREASING')
  })

  it('el error dice DONDE, para pintarlo en su fila', () => {
    const v = validarPlantilla(plantilla([USERS(10), USERS(5), USERS(null)]))
    expect(v[0]).toMatchObject({ rule: 'CUTS_NOT_INCREASING', metric: 'users', index: 1 })
  })
})

describe('el ultimo tramo', () => {
  it('cerrado -> hay unidades sin precio', () => {
    expect(reglas(plantilla([USERS(10), USERS(50)]))).toContain('LAST_TIER_MUST_BE_OPEN')
  })

  it('el mensaje explica LA CONSECUENCIA, no la regla', () => {
    const v = validarPlantilla(plantilla([USERS(10), USERS(50)]))
    const m = v.find((x) => x.rule === 'LAST_TIER_MUST_BE_OPEN')?.message ?? ''

    expect(m).toContain('por encima de 50 no hay precio')
    // Nada de jerga: el admin no sabe lo que es un "tramo abierto" ni le hace falta.
    expect(m).not.toMatch(/null|up_to|LAST_TIER/)
  })

  it('un abierto EN MEDIO hace inalcanzables los siguientes', () => {
    expect(reglas(plantilla([USERS(10), USERS(null), USERS(50)]))).toContain('OPEN_TIER_NOT_LAST')
  })
})

describe('bloques', () => {
  it('cero tramos -> el plan no cobra por nada', () => {
    expect(reglas(plantilla([]))).toEqual(['AT_LEAST_ONE_BLOCK'])
  })
})

describe('divisa y metrica', () => {
  it('divisa fuera del enum Currency', () => {
    expect(reglas(plantilla([USERS(null)], { currency: 'XXX' }))).toContain('CURRENCY_NOT_SUPPORTED')
  })

  it('metrica no soportada', () => {
    const p = plantilla([{ metric: 'ram_gb' as 'users', up_to: null, unit_price_minor: 1 }])
    expect(reglas(p)).toContain('METRIC_NOT_SUPPORTED')
  })

  it('precio negativo', () => {
    expect(reglas(plantilla([USERS(null, -1)]))).toContain('PRICE_NEGATIVE')
  })
})

describe('devuelve TODAS las violaciones, no la primera', () => {
  it('el admin que ha escrito cuatro tramos mal no los descubre de uno en uno', () => {
    // Cortes decrecientes Y ultimo cerrado Y otra metrica tambien mal.
    const p = plantilla([
      USERS(50),
      USERS(10),
      { metric: 'storage_gb', up_to: 100, unit_price_minor: 500 },
    ])

    const v = validarPlantilla(p)
    expect(v.map((x) => x.rule).sort()).toEqual([
      'CUTS_NOT_INCREASING',
      'LAST_TIER_MUST_BE_OPEN',
      'LAST_TIER_MUST_BE_OPEN',
    ])
    // Es el test que impide "optimizar" con un early return.
    expect(v.length).toBeGreaterThan(1)
  })

  it('cada violacion sabe a que metrica pertenece', () => {
    const p = plantilla([USERS(10), { metric: 'storage_gb', up_to: 100, unit_price_minor: 5 }])
    const v = validarPlantilla(p)

    expect(v.map((x) => x.metric).sort()).toEqual(['storage_gb', 'users'])
  })
})

describe('pureza', () => {
  it('no muta la plantilla que recibe', () => {
    const tiers = [USERS(50), USERS(10), USERS(null)]
    const copia = structuredClone(tiers)

    validarPlantilla(plantilla(tiers))

    // Si ordenara por up_to para validar, reordenaria el array del llamante Y esconderia
    // el error del admin que escribio los cortes al reves.
    expect(tiers).toEqual(copia)
  })
})
