// Validacion de plantilla + versionado no altera lo guardado. Spec: 15

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearHarness, customerId, planId, type Harness } from '../../test-harness'

let h: Harness
beforeEach(() => {
  h = crearHarness()
})
afterEach(async () => {
  await h.close()
})

const get = (qs = '') => h.app.inject({ method: 'GET', url: `/api/plans${qs}` })
const post = (payload: Record<string, unknown>) => h.app.inject({ method: 'POST', url: '/api/plans', payload })
const put = (id: number, payload: Record<string, unknown>) =>
  h.app.inject({ method: 'PUT', url: `/api/plans/${id}`, payload })
const del = (id: number) => h.app.inject({ method: 'DELETE', url: `/api/plans/${id}` })

const plantilla = (parcial: Record<string, unknown> = {}) => ({
  name: 'Plan Nuevo',
  description: 'Un plan de prueba',
  currency: 'EUR',
  tiers: [
    { metric: 'users', up_to: 10, unit_price_minor: 1000 },
    { metric: 'users', up_to: null, unit_price_minor: 500 },
  ],
  ...parcial,
})

describe('GET /plans', () => {
  it('por defecto solo los ACTIVOS: el alta no debe ofrecer un plan archivado', async () => {
    const { plans } = (await get()).json() as { plans: { name: string; version: number; active: boolean }[] }

    expect(plans.every((p) => p.active)).toBe(true)
    expect(plans.map((p) => `${p.name} v${p.version}`)).toEqual([
      'Plan Ágora v2',
      'Plan Bitácora v1',
      'Plan Cúspide v1',
    ])
  })

  it('?include_archived=true los trae todos, para el panel de admin', async () => {
    const { plans } = (await get('?include_archived=true')).json() as { plans: { active: boolean }[] }

    expect(plans).toHaveLength(4)
    expect(plans.filter((p) => !p.active)).toHaveLength(1)
  })

  it('trae los tramos de cada plan, y el multi-metrica los suyos', async () => {
    const { plans } = (await get()).json() as { plans: { name: string; tiers: { metric: string }[] }[] }
    const cuspide = plans.find((p) => p.name === 'Plan Cúspide')

    expect(cuspide?.tiers).toHaveLength(6)
    expect(new Set(cuspide?.tiers.map((t) => t.metric))).toEqual(
      new Set(['users', 'storage_gb', 'api_calls']),
    )
  })

  it('un parametro que no existe -> 400', async () => {
    expect((await get('?futuro=1')).statusCode).toBe(400)
  })
})

describe('POST /plans — crear', () => {
  it('crea en version 1 y activo', async () => {
    const r = await post(plantilla())

    expect(r.statusCode).toBe(201)
    expect(r.headers.location).toMatch(/^\/api\/plans\/\d+$/)
    expect(r.json()).toMatchObject({ name: 'Plan Nuevo', version: 1, active: true })
  })

  it('el sort_order lo deriva el servidor del orden del array', async () => {
    const tiers = (await post(plantilla())).json().tiers as { sort_order: number; up_to: number | null }[]

    expect(tiers.map((t) => t.sort_order)).toEqual([0, 1])
    expect(tiers.map((t) => t.up_to)).toEqual([10, null])
  })

  it('aparece en el listado de activos y se puede usar en un alta', async () => {
    const nuevo = (await post(plantilla())).json()

    const alta = await h.app.inject({
      method: 'POST',
      url: '/api/customers',
      payload: {
        company_name: 'Cliente del plan nuevo',
        fiscal_id: 'A87654323',
        email: 'a@b.example',
        country: 'ES',
        plan_id: nuevo.id,
      },
    })
    expect(alta.statusCode).toBe(201)
  })
})

describe('POST /plans — errores', () => {
  it('plantilla incoherente -> 422 con TODAS las violaciones y su fila', async () => {
    const r = await post(
      plantilla({
        tiers: [
          { metric: 'users', up_to: 50, unit_price_minor: 1000 },
          { metric: 'users', up_to: 10, unit_price_minor: 800 },
        ],
      }),
    )

    expect(r.statusCode).toBe(422)
    const { error } = r.json()
    expect(error.code).toBe('PLAN_TEMPLATE_INVALID')
    expect(error.field).toBe('tiers')
    // La UI las necesita todas y con su indice, para pintar cada una sobre su fila.
    expect(error.violations.map((v: { rule: string }) => v.rule).sort()).toEqual([
      'CUTS_NOT_INCREASING',
      'LAST_TIER_MUST_BE_OPEN',
    ])
    expect(error.violations[0]).toHaveProperty('metric')
  })

  it('nombre de un plan ACTIVO -> 409', async () => {
    const r = await post(plantilla({ name: 'Plan Ágora' }))

    expect(r.statusCode).toBe(409)
    expect(r.json().error).toMatchObject({ code: 'PLAN_NAME_TAKEN', field: 'name' })
  })

  it('el nombre de un plan ARCHIVADO se puede reutilizar', async () => {
    // Si no, archivar un plan quemaria su nombre para siempre. "Plan Ágora" esta ocupado
    // por la v2 activa; con la v1 archivada sola, no lo estaria.
    await del(planId(h.db, 'Plan Ágora', 2))
    expect((await post(plantilla({ name: 'Plan Ágora' }))).statusCode).toBe(201)
  })

  it('cero tramos -> 400 (lo para el esquema antes del servicio)', async () => {
    expect((await post(plantilla({ tiers: [] }))).statusCode).toBe(400)
  })

  it('un campo de mas -> 400', async () => {
    expect((await post(plantilla({ version: 7 }))).statusCode).toBe(400)
  })

  it('el sort_order NO se acepta: habria dos fuentes de verdad', async () => {
    const r = await post(
      plantilla({ tiers: [{ metric: 'users', up_to: null, unit_price_minor: 1, sort_order: 0 }] }),
    )
    expect(r.statusCode).toBe(400)
  })
})

describe('PUT /plans/{id} — "editar" es versionar', () => {
  it('crea version nueva y archiva la anterior', async () => {
    const v2 = planId(h.db, 'Plan Ágora', 2)
    const r = await put(v2, plantilla({ tiers: [{ metric: 'users', up_to: null, unit_price_minor: 400 }] }))

    // 201 y no 200: se ha creado un recurso nuevo, que es literalmente lo que ha pasado.
    expect(r.statusCode).toBe(201)
    expect(r.json()).toMatchObject({ name: 'Plan Ágora', version: 3, active: true })
    // El id devuelto NO es el de la URL, y ese desajuste ES la semantica de la operacion.
    expect(r.json().id).not.toBe(v2)

    const anterior = h.db.prepare('SELECT active FROM plans WHERE id = ?').get(v2) as { active: number }
    expect(anterior.active).toBe(0)
  })

  it('el nombre se hereda: editar no puede renombrar', async () => {
    const v2 = planId(h.db, 'Plan Ágora', 2)
    const r = await put(v2, plantilla({ name: 'Otro Nombre Cualquiera' }))

    // v1 y v2 tienen que compartir nombre para que "la version anterior de este plan"
    // signifique algo.
    expect(r.json().name).toBe('Plan Ágora')
  })

  it('EL CLIENTE EXISTENTE SIGUE APUNTANDO AL PLAN ANTIGUO', async () => {
    // Es la feature entera, no un efecto secundario.
    const v2 = planId(h.db, 'Plan Ágora', 2)
    const nebula = customerId(h.db, 'Nébula Cloud S.L.')

    await put(v2, plantilla({ tiers: [{ metric: 'users', up_to: null, unit_price_minor: 9999 }] }))

    const detalle = (await h.app.inject({ method: 'GET', url: `/api/customers/${nebula}` })).json()
    expect(detalle.plan.id).toBe(v2)
    expect(detalle.plan.version).toBe(2)
    expect(detalle.plan.active).toBe(false)
    // Y sus tramos siguen siendo los suyos.
    expect(detalle.plan.tiers[0].unit_price_minor).toBe(1000)
  })

  it('EDITAR NO ALTERA LAS SIMULACIONES GUARDADAS', async () => {
    // El otro lado de la moneda: el snapshot protege el pasado, el versionado protege el
    // contrato presente (referencia 11.2, 5.5).
    const nebula = customerId(h.db, 'Nébula Cloud S.L.')
    const antes = (
      await h.app.inject({
        method: 'POST',
        url: '/api/simulations',
        payload: { customer_id: nebula, active_users: 15, storage_gb: 0, api_calls: 0 },
      })
    ).json()

    await put(
      planId(h.db, 'Plan Ágora', 2),
      plantilla({ tiers: [{ metric: 'users', up_to: null, unit_price_minor: 9999 }] }),
    )

    const historial = (
      await h.app.inject({ method: 'GET', url: `/api/customers/${nebula}/simulations` })
    ).json().simulations

    expect(historial[0].total_minor).toBe(antes.total_minor)
    expect(historial[0].base_minor).toBe(14_000)
    expect(historial[0].breakdown).toEqual(antes.breakdown)
  })

  it('y el cliente sigue pudiendo simular con su tarifa vieja', async () => {
    const nebula = customerId(h.db, 'Nébula Cloud S.L.')
    await put(
      planId(h.db, 'Plan Ágora', 2),
      plantilla({ tiers: [{ metric: 'users', up_to: null, unit_price_minor: 9999 }] }),
    )

    const nueva = await h.app.inject({
      method: 'POST',
      url: '/api/simulations',
      payload: { customer_id: nebula, active_users: 15, storage_gb: 0, api_calls: 0 },
    })

    expect(nueva.statusCode).toBe(201)
    expect(nueva.json().base_minor).toBe(14_000)
  })

  it('plan inexistente -> 404', async () => {
    expect((await put(9999, plantilla())).statusCode).toBe(404)
  })

  it('NO se versiona desde una version archivada', async () => {
    // Crearia una v3 a partir de la v1 mientras la v2 sigue activa: dos ramas vivas.
    const r = await put(planId(h.db, 'Plan Ágora', 1), plantilla())

    expect(r.statusCode).toBe(422)
    expect(r.json().error.code).toBe('PLAN_ALREADY_ARCHIVED')
  })

  it('plantilla incoherente -> 422 y NO archiva nada', async () => {
    const v2 = planId(h.db, 'Plan Ágora', 2)
    const r = await put(v2, plantilla({ tiers: [{ metric: 'users', up_to: 10, unit_price_minor: 1 }] }))

    expect(r.statusCode).toBe(422)
    const sigue = h.db.prepare('SELECT active FROM plans WHERE id = ?').get(v2) as { active: number }
    expect(sigue.active).toBe(1)
  })
})

describe('DELETE /plans/{id} — archivar, nunca borrar', () => {
  it('marca active = 0 y LA FILA SIGUE EXISTIENDO', async () => {
    const v2 = planId(h.db, 'Plan Ágora', 2)
    const r = await del(v2)

    // 200 con el plan, no 204: la UI actualiza el badge con lo devuelto.
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ id: v2, active: false })

    // El test que caza un borrado fisico.
    const fila = h.db.prepare('SELECT id, active FROM plans WHERE id = ?').get(v2)
    expect(fila).toEqual({ id: v2, active: 0 })
  })

  it('el cliente de un plan archivado sigue funcionando', async () => {
    const nebula = customerId(h.db, 'Nébula Cloud S.L.')
    await del(planId(h.db, 'Plan Ágora', 2))

    const sim = await h.app.inject({
      method: 'POST',
      url: '/api/simulations',
      payload: { customer_id: nebula, active_users: 15, storage_gb: 0, api_calls: 0 },
    })
    expect(sim.statusCode).toBe(201)
    expect(sim.json().base_minor).toBe(14_000)
  })

  it('desaparece del listado de activos', async () => {
    await del(planId(h.db, 'Plan Ágora', 2))
    const { plans } = (await get()).json() as { plans: { name: string }[] }

    expect(plans.map((p) => p.name)).not.toContain('Plan Ágora')
    expect(((await get('?include_archived=true')).json() as { plans: unknown[] }).plans).toHaveLength(4)
  })

  it('un plan archivado no se puede elegir en un alta', async () => {
    const v2 = planId(h.db, 'Plan Ágora', 2)
    await del(v2)

    const alta = await h.app.inject({
      method: 'POST',
      url: '/api/customers',
      payload: {
        company_name: 'X',
        fiscal_id: 'A87654323',
        email: 'a@b.example',
        country: 'ES',
        plan_id: v2,
      },
    })
    expect(alta.statusCode).toBe(422)
    expect(alta.json().error.code).toBe('PLAN_ARCHIVED')
  })

  it('archivar dos veces -> 422', async () => {
    const v2 = planId(h.db, 'Plan Ágora', 2)
    await del(v2)
    expect((await del(v2)).statusCode).toBe(422)
  })

  it('plan inexistente -> 404', async () => {
    expect((await del(9999)).statusCode).toBe(404)
  })
})
