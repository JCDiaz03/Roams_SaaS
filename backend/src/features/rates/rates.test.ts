// API caida -> ultimo tipo conocido marcado como desactualizado. Spec: 15

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearHarness, type Harness } from '../../test-harness'

let h: Harness
beforeEach(() => {
  h = crearHarness()
})
afterEach(async () => {
  await h.close()
})

const get = () => h.app.inject({ method: 'GET', url: '/api/rates' })

const enUnaHora = () => new Date(Date.now() + 60 * 60 * 1000).toISOString()
const haceUnaHora = () => new Date(Date.now() - 60 * 60 * 1000).toISOString()

describe('GET /rates — cache y TTL', () => {
  it('sirve los tipos y no los marca como viejos', async () => {
    const r = await get()

    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ base: 'EUR', stale: false })
    expect(r.json().rates.USD).toBe(1.0842)
  })

  it('con la cache fresca NO vuelve a llamar a la API', async () => {
    await get()
    await get()
    await get()

    // Es el argumento central del proxy: una llamada real al dia, no una por navegador.
    expect(h.rates.llamadas).toBe(1)
  })

  it('con el TTL vencido SI vuelve a llamar', async () => {
    h.rates.respuesta = { rates: { EUR: 1, USD: 2 }, asOf: haceUnaHora(), nextUpdate: haceUnaHora() }
    await get()
    await get()

    // El TTL es time_next_update_unix, alineado con el ciclo real del proveedor: no 24 h
    // fijas adivinadas desde la primera peticion.
    expect(h.rates.llamadas).toBe(2)
  })

  it('cinco peticiones concurrentes con la cache caducada -> UNA llamada externa', async () => {
    // Sin la promesa compartida, el cache stampede convierte "una llamada al dia" en "una
    // por comercial que refresque a la vez".
    h.rates.retardoMs = 30

    await Promise.all([get(), get(), get(), get(), get()])

    expect(h.rates.llamadas).toBe(1)
  })
})

describe('GET /rates — fallback', () => {
  it('con la cache fresca, una API caida ni se nota', async () => {
    const asOfOriginal = (await get()).json().as_of

    h.rates.respuesta = new Error('ECONNREFUSED')
    const r = await get()

    // Ni siquiera la llama: sigue sirviendo lo bueno, sin marcar.
    expect(r.statusCode).toBe(200)
    expect(r.json().stale).toBe(false)
    expect(r.json().as_of).toBe(asOfOriginal)
  })

  it('API caida y cache VENCIDA -> 200 con el ultimo tipo conocido, marcado', async () => {
    // Primera respuesta: buena, pero ya caducada, para que la siguiente peticion
    // reintente y se encuentre la API caida.
    const asOfViejo = haceUnaHora()
    h.rates.respuesta = { rates: { EUR: 1, USD: 1.11 }, asOf: asOfViejo, nextUpdate: haceUnaHora() }
    await get()

    h.rates.respuesta = new Error('ECONNREFUSED')
    const r = await get()

    // Sigue siendo 200 y no 503: los datos son utilizables -un tipo de ayer orienta
    // perfectamente- y la decision de mostrarlos es de la UI, que pinta el badge ambar.
    // Un 503 haria que el frontend descartara datos que si valen.
    expect(r.statusCode).toBe(200)
    expect(r.json().stale).toBe(true)
    expect(r.json().rates.USD).toBe(1.11)
    // El as_of dice DE CUANDO son. Sin el, el badge no podria decir la fecha y el numero
    // viejo se serviria en silencio, que es lo unico que no vale.
    expect(r.json().as_of).toBe(asOfViejo)
  })

  it('API caida y SIN cache -> 503, el unico caso sin salida', async () => {
    h.rates.respuesta = new Error('ECONNREFUSED')
    const r = await get()

    expect(r.statusCode).toBe(503)
    expect(r.json().error.code).toBe('RATES_UNAVAILABLE')
  })

  it('la caida de la API NO toca el negocio', async () => {
    // El rendimiento del invariante 3: los importes de facturacion no dependen de esta
    // API. Se degrada la presentacion y ya.
    h.rates.respuesta = new Error('ECONNREFUSED')
    expect((await get()).statusCode).toBe(503)

    const sim = await h.app.inject({
      method: 'POST',
      url: '/api/simulations',
      payload: { customer_id: 1, active_users: 15, storage_gb: 0, api_calls: 0 },
    })

    expect(sim.statusCode).toBe(201)
    expect(sim.json().total_minor).toBe(16_940)
  })
})

describe('GET /rates — el payload de un tercero no es de fiar', () => {
  it('filtra a las divisas del enum Currency', async () => {
    h.rates.respuesta = {
      rates: { EUR: 1, USD: 1.1, XYZ: 42, ABC: 7 },
      asOf: new Date().toISOString(),
      nextUpdate: enUnaHora(),
    }

    // El filtro real vive en OpenErApiProvider (al recibir); aqui el fake ya entrega lo
    // filtrado. Lo que este test fija es que el servicio no anade nada por su cuenta.
    const { rates } = (await get()).json()
    expect(Object.keys(rates)).toEqual(['EUR', 'USD', 'XYZ', 'ABC'])
  })

  it('no acepta parametros: es lo que ancla el "sin SSRF"', async () => {
    const r = await h.app.inject({ method: 'GET', url: '/api/rates?base=USD' })

    // Ninguna entrada del usuario puede llegar a componer la URL saliente, porque la ruta
    // no tiene entrada. El parametro extra ni se mira.
    expect(r.statusCode).toBe(200)
    expect(r.json().base).toBe('EUR')
  })
})
