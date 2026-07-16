// Integracion: alta valida, fiscal_id invalido, duplicado, buscador. Spec: 15

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearHarness, customerId, planId, type Harness } from '../../test-harness'

let h: Harness
beforeEach(() => {
  h = crearHarness()
})
afterEach(async () => {
  await h.close()
})

const alta = (parcial: Record<string, unknown> = {}) => ({
  company_name: 'Empresa Nueva SL',
  fiscal_id: 'A87654323',
  email: 'compras@nueva.example',
  country: 'ES',
  plan_id: planId(h.db, 'Plan Ágora', 2),
  ...parcial,
})

const post = (payload: Record<string, unknown>) =>
  h.inject({ method: 'POST', url: '/api/customers', payload })

describe('POST /customers — alta', () => {
  it('da de alta y devuelve el fiscal_id NORMALIZADO', async () => {
    // El comercial escribio con guiones y minusculas; debe ver lo que quedo guardado.
    const r = await post(alta({ fiscal_id: 'a-8765 4323' }))

    expect(r.statusCode).toBe(201)
    expect(r.headers.location).toMatch(/^\/api\/customers\/\d+$/)
    expect(r.json()).toMatchObject({
      company_name: 'Empresa Nueva SL',
      fiscal_id: 'A87654323',
      fiscal_id_type: 'CIF',
      country: 'ES',
    })
  })

  it('el tipo lo dice el validador, no el cliente', async () => {
    const r = await post(alta({ fiscal_id: '00000000T' }))
    expect(r.json().fiscal_id_type).toBe('DNI')
  })

  it('un pais sin esquema guarda tal cual como unvalidated', async () => {
    // Ocho de los diez paises del seed pasan por PassThrough: es el caso mayoritario.
    const r = await post(alta({ country: 'GB', fiscal_id: 'GB999888' }))

    expect(r.statusCode).toBe(201)
    expect(r.json().fiscal_id_type).toBe('unvalidated')
  })

  it('el alta portuguesa valida con PT_NIF sin que el endpoint sepa que Portugal existe', async () => {
    // La demostracion del registro (roadmap 5.3): PT llego como una clase + una entrada
    // + su columna. Este endpoint no se toco, y este test lo comprueba de punta a punta.
    const r = await post(alta({ country: 'PT', fiscal_id: '123 456 789' }))

    expect(r.statusCode).toBe(201)
    expect(r.json().fiscal_id).toBe('123456789')
    expect(r.json().fiscal_id_type).toBe('NIF')
  })

  it('un NIF portugues con el control mal -> 422, el mismo error que un CIF mal', async () => {
    const r = await post(alta({ country: 'PT', fiscal_id: '123456780' }))

    expect(r.statusCode).toBe(422)
    expect(r.json().error).toMatchObject({ code: 'FISCAL_ID_INVALID', field: 'fiscal_id' })
  })
})

describe('POST /customers — errores', () => {
  it('CIF invalido -> 422 con el campo, para pintarlo junto al input', async () => {
    const r = await post(alta({ fiscal_id: 'B12345675' }))

    expect(r.statusCode).toBe(422)
    expect(r.json().error).toMatchObject({ code: 'FISCAL_ID_INVALID', field: 'fiscal_id' })
  })

  it('duplicado -> 409 y trae el cliente existente, para enlazar a su ficha', async () => {
    const r = await post(alta({ fiscal_id: 'b-1234 5674' })) // el de Nebula, ya sembrado
    expect(r.statusCode).toBe(409)

    const { error } = r.json()
    expect(error).toMatchObject({ code: 'FISCAL_ID_DUPLICATE', field: 'fiscal_id' })
    expect(error.existing_customer).toMatchObject({ company_name: 'Nébula Cloud S.L.' })
  })

  it('el duplicado se detecta sobre la forma NORMALIZADA', async () => {
    // "b-1234 5674" y "B12345674" son la misma empresa para el mundo.
    expect((await post(alta({ fiscal_id: 'B12345674' }))).statusCode).toBe(409)
  })

  it('pais no soportado -> 422 (es inexpresable, no un 500)', async () => {
    const r = await post(alta({ country: 'XX' }))
    expect(r.statusCode).toBe(422)
    expect(r.json().error).toMatchObject({ code: 'COUNTRY_NOT_SUPPORTED', field: 'country' })
  })

  it('plan inexistente -> 422, no 404: el recurso de la URL SI existe', async () => {
    const r = await post(alta({ plan_id: 9999 }))
    expect(r.statusCode).toBe(422)
    expect(r.json().error.code).toBe('PLAN_NOT_FOUND')
  })

  it('plan ARCHIVADO -> 422: no se ofrece a clientes nuevos', async () => {
    const r = await post(alta({ plan_id: planId(h.db, 'Plan Ágora', 1) }))
    expect(r.statusCode).toBe(422)
    expect(r.json().error.code).toBe('PLAN_ARCHIVED')
  })

  it('company_name de 201 caracteres -> 400, no 500', async () => {
    const r = await post(alta({ company_name: 'x'.repeat(201) }))
    expect(r.statusCode).toBe(400)
    expect(r.json().error).toMatchObject({ code: 'VALIDATION_ERROR', field: 'company_name' })
  })

  it('email invalido -> 400', async () => {
    expect((await post(alta({ email: 'no-soy-un-email' }))).statusCode).toBe(400)
  })

  it('campo de mas -> 400: es lo que hace verificable el invariante 1', async () => {
    // Un importe en el cuerpo del alta rebota en el esquema. "El frontend nunca envia
    // importes" deja de ser una promesa.
    const r = await post(alta({ total_minor: 1 }))
    expect(r.statusCode).toBe(400)
    expect(r.json().error.field).toBe('total_minor')
  })

  it('el error NUNCA filtra un stack trace ni SQL', async () => {
    const cuerpo = (await post(alta({ fiscal_id: 'B12345675' }))).body

    expect(cuerpo).not.toMatch(/at \w+|\.ts:\d+|SQLITE|node_modules/i)
  })

  it('JSON malformado -> 400 MALFORMED_REQUEST, no un 500', async () => {
    // Un cuerpo roto es un error DEL CLIENTE: responderlo como 500 mentiria y dejaria
    // que cualquiera llenara el log de errores falsos a voluntad.
    const r = await h.inject({
      method: 'POST',
      url: '/api/customers',
      headers: { 'content-type': 'application/json' },
      payload: '{"company_name":',
    })

    expect(r.statusCode).toBe(400)
    expect(r.json().error.code).toBe('MALFORMED_REQUEST')
  })

  it('cuerpo mayor que el bodyLimit -> 413, no un 500', async () => {
    const r = await h.inject({
      method: 'POST',
      url: '/api/customers',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ company_name: 'x'.repeat(70_000) }),
    })

    expect(r.statusCode).toBe(413)
    expect(r.json().error.code).toBe('MALFORMED_REQUEST')
  })
})

describe('GET /customers — buscador', () => {
  const buscar = (qs: string) => h.inject({ method: 'GET', url: `/api/customers${qs}` })

  it('el total es el de la COLECCION, no el de la pagina devuelta', async () => {
    const r = await buscar('?limit=2')

    expect(r.json().customers.length).toBe(2)
    expect(r.json().total).toBe(5)
  })

  it('sin termino devuelve los recientes, NO un 400', async () => {
    const r = await buscar('')
    expect(r.statusCode).toBe(200)
    expect(r.json().customers.length).toBe(5)
  })

  it('busca por nombre y por fiscal_id', async () => {
    expect((await buscar('?search=Nébula')).json().customers[0].company_name).toBe('Nébula Cloud S.L.')
    expect((await buscar('?search=B12345674')).json().customers[0].company_name).toBe('Nébula Cloud S.L.')
  })

  it('es insensible a mayusculas, tambien con acentos', async () => {
    // El LIKE de SQLite solo ignora mayusculas en ASCII: sin upper() en los dos lados,
    // "nébula" no encontraria "Nébula".
    expect((await buscar('?search=nébula')).json().total).toBe(1)
    expect((await buscar('?search=MERIDIAN')).json().total).toBe(1)
  })

  it('sin resultados es 200 con lista vacia, no un 404', async () => {
    const r = await buscar('?search=noexisteestaempresa')
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ customers: [], total: 0 })
  })

  it('el % NO se comporta como comodin', async () => {
    // Es el test del ESCAPE. Sin el, "%" devolveria los cuatro clientes.
    await post(alta({ company_name: '50% Descuento SL', fiscal_id: 'B12345690' }))

    const r = await buscar('?search=%25') // '%' urlencoded
    expect(r.json().total).toBe(1)
    expect(r.json().customers[0].company_name).toBe('50% Descuento SL')
  })

  it('el _ NO se comporta como comodin', async () => {
    await post(alta({ company_name: 'Guion_Bajo SL', fiscal_id: 'B12345690' }))

    const r = await buscar('?search=n_B')
    expect(r.json().total).toBe(1)
  })

  it('la barra invertida no rompe la consulta', async () => {
    const r = await buscar('?search=%5C') // '\' urlencoded
    expect(r.statusCode).toBe(200)
    expect(r.json().total).toBe(0)
  })

  it('termino de 101 caracteres -> 400', async () => {
    expect((await buscar(`?search=${'x'.repeat(101)}`)).statusCode).toBe(400)
  })

  it('trae el numero de simulaciones, para no hacer N+1 desde el cliente', async () => {
    expect((await buscar('?search=Nébula')).json().customers[0].simulation_count).toBe(0)
  })
})

describe('GET /customers/{id} — detalle', () => {
  const detalle = (id: number) => h.inject({ method: 'GET', url: `/api/customers/${id}` })

  it('trae el plan con sus tramos y el tipo del pais en UNA peticion', async () => {
    // Es lo que hace posible el preview local: todo lo que quote() necesita, de una vez.
    const r = await detalle(customerId(h.db, 'Nébula Cloud S.L.'))

    expect(r.statusCode).toBe(200)
    const body = r.json()
    expect(body.tax_rate_bp).toBe(2100)
    expect(body.country).toMatchObject({ code: 'ES', name: 'España', display_currency: 'EUR' })
    expect(body.plan.tiers).toHaveLength(3)
    expect(body.plan).toMatchObject({ name: 'Plan Ágora', version: 2, active: true })
  })

  it('EL CLIENTE CON PLAN ARCHIVADO trae su plan igual, con sus tramos viejos', async () => {
    // El test que impide "filtrar por activos" al escribir el JOIN. Fjord mantiene su
    // tarifa contratada (1200/700), no la de hoy.
    const r = await detalle(customerId(h.db, 'Fjord Systems AS'))

    expect(r.statusCode).toBe(200)
    expect(r.json().plan).toMatchObject({ name: 'Plan Ágora', version: 1, active: false })
    expect(r.json().plan.tiers[0].unit_price_minor).toBe(1200)
  })

  it('id inexistente -> 404', async () => {
    const r = await detalle(9999)
    expect(r.statusCode).toBe(404)
    expect(r.json().error.code).toBe('CUSTOMER_NOT_FOUND')
  })

  it('id no numerico -> 400', async () => {
    expect((await h.inject({ method: 'GET', url: '/api/customers/abc' })).statusCode).toBe(400)
  })
})

describe('GET /countries', () => {
  it('trae el hint YA RESUELTO por el validador de cada pais', async () => {
    // Es lo que hace que el frontend nunca compare un codigo de pais.
    const r = await h.inject({ method: 'GET', url: '/api/countries' })
    expect(r.statusCode).toBe(200)

    const { countries } = r.json() as { countries: { code: string; fiscal_id: { validated: boolean; hint: string } }[] }
    const es = countries.find((c) => c.code === 'ES')
    const pt = countries.find((c) => c.code === 'PT')
    const gb = countries.find((c) => c.code === 'GB')

    expect(es?.fiscal_id).toEqual({ validated: true, hint: 'DNI, NIE o CIF — se comprueba automáticamente' })
    // El hint del segundo validador llego solo, del mismo sitio que el primero: la clase.
    expect(pt?.fiscal_id).toEqual({ validated: true, hint: 'NIF — se comprueba automáticamente' })
    expect(gb?.fiscal_id).toEqual({ validated: false, hint: 'Identificador fiscal' })
  })

  it('ordena alfabeticamente con locale espanol', async () => {
    const r = await h.inject({ method: 'GET', url: '/api/countries' })
    const nombres = (r.json().countries as { name: string }[]).map((c) => c.name)

    expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, 'es')))
    expect(nombres).toContain('España')
  })
})
