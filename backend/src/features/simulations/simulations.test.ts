// Integracion: 15 usuarios = 140 EUR + IVA; snapshot persistido. Spec: 15

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearHarness, customerId, planId, type Harness } from '../../test-harness'

let h: Harness
beforeEach(() => {
  h = crearHarness()
})
afterEach(async () => {
  await h.close()
})

const simular = (payload: Record<string, unknown>) =>
  h.inject({ method: 'POST', url: '/api/simulations', payload })

const entradas = (parcial: Record<string, unknown> = {}) => ({
  customer_id: customerId(h.db, 'Nébula Cloud S.L.'),
  active_users: 15,
  storage_gb: 0,
  api_calls: 0,
  ...parcial,
})

describe('POST /simulations — el caso del gate de Fase 1', () => {
  it('15 usuarios, cliente español: 140 EUR + 21 % = 169,40 EUR', async () => {
    // El caso LITERAL del enunciado, recorriendo el sistema entero: esquema, cliente,
    // plan, TaxProvider, motor y persistencia.
    const r = await simular(entradas())

    expect(r.statusCode).toBe(201)
    expect(r.json()).toMatchObject({
      base_minor: 14_000,
      tax_rate_bp: 2100,
      tax_minor: 2_940,
      total_minor: 16_940,
      currency: 'EUR',
    })
  })

  it('el desglose explica el numero: 10 x 10 EUR + 5 x 8 EUR', async () => {
    const users = (await simular(entradas())).json().breakdown.find(
      (b: { metric: string }) => b.metric === 'users',
    )

    expect(users.tiers).toEqual([
      { up_to: 10, unit_price_minor: 1000, units: 10, amount_minor: 10_000 },
      { up_to: 50, unit_price_minor: 800, units: 5, amount_minor: 4_000 },
    ])
  })

  it('las metricas que el plan no factura aparecen con billed:false', async () => {
    // Es lo que permite a la UI atenuar la tarjeta en vez de ocultarla, sin ningun `if`
    // sobre el plan en el cliente.
    const b = (await simular(entradas({ storage_gb: 500, api_calls: 9_000 }))).json().breakdown

    expect(b.map((x: { metric: string }) => x.metric)).toEqual(['users', 'storage_gb', 'api_calls'])
    expect(b.find((x: { metric: string }) => x.metric === 'storage_gb')).toMatchObject({
      billed: false,
      quantity: 500,
      subtotal_minor: 0,
    })
  })

  it('el multi-metrica suma los tres bloques', async () => {
    // Meridian esta en MAX v2: users 1@2000 + 20@20 + 40@50 + null@100 (el "hasta 1" es
    // la cuota de entrada), storage 12@0 + 32@100 + null@200, api 5000@0 + 50000@1 +
    // null@3. Con 25/600/60000:
    //   users:   1x2000 + 19x20 + 5x50            = 2630
    //   storage: 12x0 + 20x100 + 568x200          = 115600
    //   api:     5000x0 + 45000x1 + 10000x3       = 75000
    const r = await simular({
      customer_id: customerId(h.db, 'Meridian Data Ltd.'),
      active_users: 25,
      storage_gb: 600,
      api_calls: 60_000,
    })

    expect(r.json().base_minor).toBe(2_630 + 115_600 + 75_000)
  })
})

describe('POST /simulations — el plan archivado NO es un error aqui', () => {
  it('un cliente con plan archivado simula con SU tarifa contratada', async () => {
    // El test que impide "arreglar" el servicio con un PLAN_ARCHIVED copiado del alta.
    // Fjord esta en MAX v1 (sin cuota de entrada): 15x20 = 300, no los 2630 que daria
    // la v2 con su tramo "hasta 1" a 20 EUR.
    const r = await simular({
      customer_id: customerId(h.db, 'Fjord Systems AS'),
      active_users: 15,
      storage_gb: 0,
      api_calls: 0,
    })

    expect(r.statusCode).toBe(201)
    expect(r.json().base_minor).toBe(300)
    expect(r.json().plan_id).toBe(planId(h.db, 'Plan MAX', 1))
  })
})

describe('POST /simulations — el emisor (created_by)', () => {
  it('persiste el nombre de la sesion que GUARDA, y otro comercial lo lee tal cual', async () => {
    // El presupuesto impreso declara a quien lo creo, no a quien lo abre: se guarda con
    // la sesion del harness ('Evaluadora') y se lee con OTRA sesion. Si created_by
    // saliera de la sesion del lector, este test lo caza.
    const creada = await simular(entradas())
    expect(creada.json().created_by).toBe('Evaluadora')

    const otroSid = h.sessions.create({ nombre: 'Comercial B', rol: 'sales' })
    const historial = await h.app.inject({
      method: 'GET',
      url: `/api/customers/${customerId(h.db, 'Nébula Cloud S.L.')}/simulations`,
      cookies: { sid: otroSid },
    })

    expect(historial.json().simulations[0].created_by).toBe('Evaluadora')
  })

  it('una simulacion anterior a la columna sale con created_by null', async () => {
    // Las filas guardadas antes de existir la columna no tienen emisor y el contrato lo
    // dice con null, no con un nombre inventado ni un 500 de serializacion.
    const id = (await simular(entradas())).json().id
    h.db.prepare('UPDATE simulations SET created_by = NULL WHERE id = ?').run(id)

    const historial = await h.inject({
      method: 'GET',
      url: `/api/customers/${customerId(h.db, 'Nébula Cloud S.L.')}/simulations`,
    })

    expect(historial.statusCode).toBe(200)
    expect(historial.json().simulations[0].created_by).toBeNull()
  })
})

describe('POST /simulations — errores', () => {
  it('cliente inexistente -> 404', async () => {
    const r = await simular(entradas({ customer_id: 9999 }))
    expect(r.statusCode).toBe(404)
    expect(r.json().error.code).toBe('CUSTOMER_NOT_FOUND')
  })

  it('UN IMPORTE EN EL CUERPO -> 400', async () => {
    // El test que convierte el invariante 1 en algo verificable. Ojo: Fastify trae
    // removeAdditional:true por defecto, que ELIMINA el campo en silencio y devolveria
    // 201. Si este test se pone rojo, mira el ajv de server.ts antes que el esquema.
    const r = await simular(entradas({ total_minor: 1 }))

    expect(r.statusCode).toBe(400)
    expect(r.json().error.field).toBe('total_minor')
  })

  it('cantidades negativas -> 400', async () => {
    expect((await simular(entradas({ active_users: -1 }))).statusCode).toBe(400)
  })

  it('cantidades por encima del tope anti-DoS -> 400', async () => {
    expect((await simular(entradas({ active_users: 1_000_001 }))).statusCode).toBe(400)
  })

  it('cantidad decimal -> 400', async () => {
    expect((await simular(entradas({ active_users: 1.5 }))).statusCode).toBe(400)
  })
})

describe('POST /simulations — plan_id opcional (ADR 0011)', () => {
  // Sustituye al guardian "el plan_id NO se acepta": la prohibicion protegia que nadie
  // cotizara con una tarifa que ya no se ofrece, y esta bateria comprueba que la regla
  // activo-o-contratado preserva EXACTAMENTE esa proteccion.

  it('sin plan_id se deriva del cliente: el camino de siempre, intacto', async () => {
    const r = await simular(entradas())
    expect(r.statusCode).toBe(201)
    expect(r.json().plan_id).toBe(planId(h.db, 'Plan Text', 1))
  })

  it('un plan ACTIVO ajeno -> 201, cotizado con SUS tramos y el impuesto del cliente', async () => {
    // Nebula (ES, 21 %) cotizada con PRO: users 8x50 + 7x100 = 1100. El tax_rate_bp sigue
    // siendo el del PAIS DEL CLIENTE, se cotice con el plan que se cotice (spec 09, 2).
    const pro = planId(h.db, 'Plan PRO', 1)
    const r = await simular(entradas({ plan_id: pro }))

    expect(r.statusCode).toBe(201)
    expect(r.json()).toMatchObject({
      plan_id: pro,
      plan_name: 'Plan PRO',
      base_minor: 1_100,
      tax_rate_bp: 2100,
    })
  })

  it('un plan ARCHIVADO ajeno -> 422 PLAN_ARCHIVED: esa tarifa ya no se ofrece', async () => {
    // Nebula intentando cotizar con MAX v1 (el archivado de Fjord). Es lo que la
    // prohibicion original protegia, y sigue protegido.
    const r = await simular(entradas({ plan_id: planId(h.db, 'Plan MAX', 1) }))

    expect(r.statusCode).toBe(422)
    expect(r.json().error).toMatchObject({ code: 'PLAN_ARCHIVED', field: 'plan_id' })
  })

  it('el contratado ARCHIVADO enviado explicitamente -> 201: es su tarifa', async () => {
    // Fjord enviando su propio plan archivado en el cuerpo. La regla compara contra
    // cliente.plan_id, no contra "vino en el cuerpo".
    const maxV1 = planId(h.db, 'Plan MAX', 1)
    const r = await simular({
      customer_id: customerId(h.db, 'Fjord Systems AS'),
      plan_id: maxV1,
      active_users: 15,
      storage_gb: 0,
      api_calls: 0,
    })

    expect(r.statusCode).toBe(201)
    expect(r.json().base_minor).toBe(300)
  })

  it('plan_id inexistente -> 422 PLAN_NOT_FOUND, no 404: es una referencia del cuerpo', async () => {
    const r = await simular(entradas({ plan_id: 9999 }))
    expect(r.statusCode).toBe(422)
    expect(r.json().error).toMatchObject({ code: 'PLAN_NOT_FOUND', field: 'plan_id' })
  })

  it('el snapshot captura el plan ELEGIDO, no el contratado', async () => {
    const pro = planId(h.db, 'Plan PRO', 1)
    await simular(entradas({ plan_id: pro }))

    const { pricing_snapshot } = h.db
      .prepare('SELECT pricing_snapshot FROM simulations ORDER BY id DESC LIMIT 1')
      .get() as { pricing_snapshot: string }

    expect(JSON.parse(pricing_snapshot).plan).toMatchObject({ id: pro, name: 'Plan PRO' })
  })
})

describe('POST /simulations — persistencia', () => {
  it('total = base + tax en la fila, no solo en la respuesta', async () => {
    await simular(entradas())

    const fila = h.db.prepare('SELECT * FROM simulations ORDER BY id DESC LIMIT 1').get() as {
      base_minor: number
      tax_minor: number
      total_minor: number
      pricing_snapshot: string
    }

    expect(fila.total_minor).toBe(fila.base_minor + fila.tax_minor)
  })

  it('el snapshot guarda los tramos y el tipo APLICADOS', async () => {
    await simular(entradas())

    const { pricing_snapshot } = h.db
      .prepare('SELECT pricing_snapshot FROM simulations ORDER BY id DESC LIMIT 1')
      .get() as { pricing_snapshot: string }

    expect(JSON.parse(pricing_snapshot)).toMatchObject({
      plan: { name: 'Plan Text', version: 1, currency: 'EUR' },
      tax: { country: 'ES', rate_bp: 2100 },
    })
    expect(JSON.parse(pricing_snapshot).tiers).toHaveLength(3)
  })

  it('la respuesta NO expone el pricing_snapshot: es interno', async () => {
    expect((await simular(entradas())).json()).not.toHaveProperty('pricing_snapshot')
  })
})

describe('GET /customers/{id}/simulations — historial', () => {
  const historial = (id: number) =>
    h.inject({ method: 'GET', url: `/api/customers/${id}/simulations` })

  it('cliente sin simulaciones -> 200 con lista vacia', async () => {
    const r = await historial(customerId(h.db, 'Talleres Duero'))
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ simulations: [], total: 0 })
  })

  it('cliente inexistente -> 404, no una lista vacia mintiendo', async () => {
    expect((await historial(9999)).statusCode).toBe(404)
  })

  it('ordena por fecha descendente', async () => {
    const id = customerId(h.db, 'Nébula Cloud S.L.')
    await simular(entradas({ active_users: 10 }))
    await simular(entradas({ active_users: 20 }))

    const sims = (await historial(id)).json().simulations
    expect(sims).toHaveLength(2)
    expect(sims[0].inputs.active_users).toBe(20)
  })

  it('mismo formato que la respuesta del POST: es el mismo componente', async () => {
    const id = customerId(h.db, 'Nébula Cloud S.L.')
    const creada = (await simular(entradas())).json()
    const delHistorial = (await historial(id)).json().simulations[0]

    expect(delHistorial).toEqual(creada)
  })

  it('EL DESGLOSE SALE DEL SNAPSHOT, no del plan de hoy', async () => {
    // El test que caza un JOIN con plan_tiers en el historial. Se guarda una simulacion,
    // se cambian los tramos del plan por debajo, y el historial tiene que seguir
    // explicando SU numero (referencia 11.2).
    const id = customerId(h.db, 'Nébula Cloud S.L.')
    const creada = (await simular(entradas())).json()

    h.db
      .prepare('UPDATE plan_tiers SET unit_price_minor = 9999 WHERE plan_id = ?')
      .run(planId(h.db, 'Plan Text', 1))

    const delHistorial = (await historial(id)).json().simulations[0]

    expect(delHistorial.total_minor).toBe(creada.total_minor)
    expect(delHistorial.breakdown).toEqual(creada.breakdown)
    expect(delHistorial.base_minor).toBe(14_000)
  })

  it('EL NOMBRE DEL PLAN tambien sale del snapshot: versionar no renombra el pasado', async () => {
    // Extension del test anterior a la presentacion (spec 09, 5.1): se guarda una
    // simulacion, el plan se versiona por debajo (v1 -> v2), y la simulacion vieja sigue
    // declarando su v1.
    const id = customerId(h.db, 'Nébula Cloud S.L.')
    await simular(entradas())

    const versionado = await h.inject({
      method: 'PUT',
      url: `/api/plans/${planId(h.db, 'Plan Text', 1)}`,
      payload: {
        name: 'Plan Text',
        currency: 'EUR',
        tiers: [{ metric: 'users', up_to: null, unit_price_minor: 100 }],
      },
    })
    expect(versionado.statusCode).toBe(201)

    const vieja = (await historial(id)).json().simulations[0]
    expect(vieja).toMatchObject({ plan_name: 'Plan Text', plan_version: 1 })
  })
})

describe('PATCH /simulations/{id} — archivar es estado de vista (spec 09, 5.5)', () => {
  const patch = (id: number, payload: unknown) =>
    h.inject({ method: 'PATCH', url: `/api/simulations/${id}`, payload: payload as Record<string, unknown> })
  const historial = (id: number, qs = '') =>
    h.inject({ method: 'GET', url: `/api/customers/${id}/simulations${qs}` })

  it('archivada desaparece del historial por defecto y vuelve con include_archived', async () => {
    const cliente = customerId(h.db, 'Nébula Cloud S.L.')
    const guardada = (await simular(entradas())).json()
    await simular(entradas({ active_users: 30 }))

    const r = await patch(guardada.id, { archived: true })
    expect(r.statusCode).toBe(200)
    expect(r.json().archived).toBe(true)

    // El historial por defecto: solo la viva, y el total describe ESA coleccion.
    const vivas = (await historial(cliente)).json()
    expect(vivas.simulations).toHaveLength(1)
    expect(vivas.total).toBe(1)

    // Con include_archived: las dos.
    const todas = (await historial(cliente, '?include_archived=true')).json()
    expect(todas.simulations).toHaveLength(2)
    expect(todas.total).toBe(2)
  })

  it('recuperar (archived: false) la devuelve al historial', async () => {
    const cliente = customerId(h.db, 'Nébula Cloud S.L.')
    const guardada = (await simular(entradas())).json()

    await patch(guardada.id, { archived: true })
    await patch(guardada.id, { archived: false })

    expect((await historial(cliente)).json().simulations).toHaveLength(1)
  })

  it('EL GUARDIAN: archivar no toca ni un numero sellado', async () => {
    // La inmutabilidad del 11.2 es de los numeros. Si este test falla, alguien convirtio
    // el flag de vista en una puerta a la simulacion.
    const guardada = (await simular(entradas())).json()
    const archivada = (await patch(guardada.id, { archived: true })).json()

    expect({ ...archivada, archived: false }).toEqual(guardada)
  })

  it('un importe en el cuerpo del PATCH -> 400: la frontera es verificable', async () => {
    const guardada = (await simular(entradas())).json()
    const r = await patch(guardada.id, { archived: true, total_minor: 1 })

    expect(r.statusCode).toBe(400)
    expect(r.json().error.field).toBe('total_minor')
  })

  it('cuerpo sin archived -> 400; simulacion inexistente -> 404', async () => {
    const guardada = (await simular(entradas())).json()
    expect((await patch(guardada.id, {})).statusCode).toBe(400)

    const r = await patch(99_999, { archived: true })
    expect(r.statusCode).toBe(404)
    expect(r.json().error.code).toBe('SIMULATION_NOT_FOUND')
  })
})

describe('paridad preview/persistencia — cinturon y tirantes', () => {
  it('el numero del backend es el que da quote() en el navegador', async () => {
    // Con modulo unico no puede fallar; el test existe para que SIGA sin poder el dia que
    // a alguien se le ocurra optimizar uno de los dos lados (referencia 10, 15).
    const { quote } = await import('@saas/pricing')
    const id = customerId(h.db, 'Meridian Data Ltd.')

    // Lo que el frontend tiene: el detalle del cliente, en una sola peticion.
    const detalle = (await h.inject({ method: 'GET', url: `/api/customers/${id}` })).json()

    for (const [users, gb, api] of [
      [0, 0, 0],
      [15, 100, 10_000],
      [20, 500, 50_000],
      [21, 501, 50_001],
      [137, 1_234, 999_999],
    ]) {
      const preview = quote({
        tiers: detalle.plan.tiers,
        quantities: { users: users as number, storage_gb: gb as number, api_calls: api as number },
        tax_rate_bp: detalle.tax_rate_bp,
        currency: detalle.plan.currency,
      })

      const persistida = (
        await simular({ customer_id: id, active_users: users, storage_gb: gb, api_calls: api })
      ).json()

      expect(persistida.total_minor).toBe(preview.total_minor)
      expect(persistida.breakdown).toEqual(preview.breakdown)
    }
  })
})

describe('GET /customers/{id}/simulations — total', () => {
  it('el total es el de la COLECCION, no el de la pagina devuelta', async () => {
    for (const n of [1, 2, 3]) await simular(entradas({ active_users: n }))

    const r = await h.inject({
      method: 'GET',
      url: `/api/customers/${customerId(h.db, 'Nébula Cloud S.L.')}/simulations?limit=2`,
    })

    expect(r.json().simulations.length).toBe(2)
    expect(r.json().total).toBe(3)
  })
})
