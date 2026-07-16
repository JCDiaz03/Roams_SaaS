// Integracion: login, enforcement 401/403, revocacion, rate limit, guardian del literal. Spec: 07-autenticacion.md 8

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearHarness, type Harness } from '../../test-harness'

let h: Harness
beforeEach(() => {
  h = crearHarness()
})
afterEach(async () => {
  vi.useRealTimers()
  await h.close()
})

// Aqui se usa h.app.inject A PELO (sin la sesion del harness): esta feature ejercita
// justo los caminos sin sesion, con credenciales malas y con roles que no llegan.
const login = (usuario: string, password = '1111') =>
  h.app.inject({ method: 'POST', url: '/api/auth/login', payload: { usuario, password } })

/** El par cookie (`sid=...`) del Set-Cookie de una respuesta de login. */
const cookieDe = (r: { headers: Record<string, unknown> }): string => {
  const setCookie = r.headers['set-cookie']
  const linea = Array.isArray(setCookie) ? String(setCookie[0]) : String(setCookie)
  return linea.split(';')[0] ?? ''
}

describe('POST /auth/login', () => {
  it('credenciales correctas -> 200 con { nombre, rol } y la cookie con sus flags', async () => {
    const r = await login('Marta')

    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ nombre: 'Marta', rol: 'sales' })

    // Los flags se COMPRUEBAN, no se suponen: HttpOnly es lo que hace que un XSS no
    // pueda robar la sesion, y SameSite=Strict la primera capa anti-CSRF.
    const setCookie = String(r.headers['set-cookie'])
    expect(setCookie).toMatch(/^sid=[A-Za-z0-9_-]+;/)
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Strict')
    expect(setCookie).toContain('Path=/api')
  })

  it('el usuario administrador entra con rol admin, insensible a mayusculas', async () => {
    expect((await login('admin')).json().rol).toBe('admin')
    expect((await login('Admin')).json().rol).toBe('admin')
    expect((await login('marta')).json().rol).toBe('sales')
  })

  it('contraseña mala -> 401 con mensaje UNICO', async () => {
    const r = await login('Marta', '2222')

    expect(r.statusCode).toBe(401)
    const { error } = r.json()
    expect(error.code).toBe('AUTH_INVALID_CREDENTIALS')
    // El mensaje no dice CUAL de los dos fallo: eso seria un oraculo de usuarios.
    expect(error.message).not.toMatch(/contraseña incorrecta|usuario no existe/i)
  })

  it('usuario vacio -> 400 por esquema; solo espacios -> 401', async () => {
    expect((await login('')).statusCode).toBe(400)
    expect((await login('   ')).statusCode).toBe(401)
  })
})

describe('enforcement: sesion y rol se aplican EN EL BACKEND', () => {
  it('sin cookie -> 401 AUTH_REQUIRED en cualquier endpoint no publico', async () => {
    const r = await h.app.inject({ method: 'GET', url: '/api/plans' })

    expect(r.statusCode).toBe(401)
    expect(r.json().error.code).toBe('AUTH_REQUIRED')
  })

  it('con sesion, el mismo endpoint pasa', async () => {
    expect((await h.inject({ method: 'GET', url: '/api/plans' })).statusCode).toBe(200)
  })

  it('rol sales -> 403 en las mutaciones de planes; el listado de activos sigue abierto', async () => {
    const cookie = cookieDe(await login('Comercial'))

    // El listado de ACTIVOS alimenta el alta: cualquier comercial lo necesita.
    expect((await h.app.inject({ method: 'GET', url: '/api/plans', headers: { cookie } })).statusCode).toBe(200)

    // Las tres mutaciones, cortadas por el `requiereRol: 'admin'` de la ruta.
    const post = await h.app.inject({ method: 'POST', url: '/api/plans', headers: { cookie }, payload: {} })
    const put = await h.app.inject({ method: 'PUT', url: '/api/plans/1', headers: { cookie }, payload: {} })
    const del = await h.app.inject({ method: 'DELETE', url: '/api/plans/1', headers: { cookie } })

    for (const r of [post, put, del]) {
      expect(r.statusCode).toBe(403)
      expect(r.json().error.code).toBe('AUTH_FORBIDDEN')
    }
  })

  it('rol sales -> 403 tambien en ?include_archived=true: los archivados son del admin', async () => {
    const cookie = cookieDe(await login('Comercial'))
    const r = await h.app.inject({ method: 'GET', url: '/api/plans?include_archived=true', headers: { cookie } })

    expect(r.statusCode).toBe(403)
  })

  it('una mutacion declarada cross-site -> 403; same-origin o sin cabecera, pasa', async () => {
    // El cinturon anti-CSRF (spec 07, 5.4) mira Sec-Fetch-Site, NO compara Origin contra
    // Host: detras de un proxy el Host llega reescrito y esa comparacion rechazaba a la
    // propia aplicacion (bug real, cazado por el smoke E2E en su primer arranque). Los
    // tirantes (SameSite=Strict) no se pueden ejercitar con inject; esto fija el cinturon.
    const cuerpo = { customer_id: 1, active_users: 1, storage_gb: 0, api_calls: 0 }

    for (const sitio of ['cross-site', 'same-site']) {
      const r = await h.inject({
        method: 'POST',
        url: '/api/simulations',
        headers: { 'sec-fetch-site': sitio },
        payload: cuerpo,
      })
      expect(r.statusCode).toBe(403)
    }

    const propia = await h.inject({
      method: 'POST',
      url: '/api/simulations',
      headers: { 'sec-fetch-site': 'same-origin' },
      payload: cuerpo,
    })
    expect(propia.statusCode).toBe(201)

    // Sin cabecera (curl, tests): pasa. Es el cinturon, no la unica defensa.
    const sinCabecera = await h.inject({ method: 'POST', url: '/api/simulations', payload: cuerpo })
    expect(sinCabecera.statusCode).toBe(201)
  })
})

describe('ciclo de la sesion', () => {
  it('logout revoca DE INMEDIATO: la misma cookie deja de valer', async () => {
    const cookie = cookieDe(await login('Marta'))

    const antes = await h.app.inject({ method: 'GET', url: '/api/auth/session', headers: { cookie } })
    expect(antes.statusCode).toBe(200)
    expect(antes.json()).toEqual({ nombre: 'Marta', rol: 'sales' })

    const salida = await h.app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } })
    expect(salida.statusCode).toBe(204)
    expect(String(salida.headers['set-cookie'])).toContain('Max-Age=0')

    // Es la ventaja concreta de la sesion de servidor sobre un JWT (ADR 0009): borrar
    // la entrada ES revocar. Un token firmado seguiria valiendo hasta caducar.
    const despues = await h.app.inject({ method: 'GET', url: '/api/auth/session', headers: { cookie } })
    expect(despues.statusCode).toBe(401)
  })

  it('la sesion caduca a las 12 horas, sin renovacion deslizante', async () => {
    vi.useFakeTimers({ now: Date.now(), toFake: ['Date'] })
    const cookie = cookieDe(await login('Marta'))

    vi.setSystemTime(Date.now() + 11 * 60 * 60 * 1000)
    expect((await h.app.inject({ method: 'GET', url: '/api/auth/session', headers: { cookie } })).statusCode).toBe(200)

    vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000) // total: 13 h
    expect((await h.app.inject({ method: 'GET', url: '/api/auth/session', headers: { cookie } })).statusCode).toBe(401)
  })

  it('GET /auth/session sin cookie -> 401: el frontend lo lee como "no hay nadie"', async () => {
    expect((await h.app.inject({ method: 'GET', url: '/api/auth/session' })).statusCode).toBe(401)
  })
})

describe('rate limit del login', () => {
  it('el intento 11 dentro del minuto -> 429', async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await login('Marta', 'mala')).statusCode).toBe(401)
    }

    const r = await login('Marta', 'mala')
    expect(r.statusCode).toBe(429)
    expect(r.json().error.code).toBe('AUTH_RATE_LIMITED')
  })

  it('pasada la ventana, vuelve a aceptar intentos', async () => {
    vi.useFakeTimers({ now: Date.now(), toFake: ['Date'] })

    for (let i = 0; i < 11; i += 1) await login('Marta', 'mala')
    expect((await login('Marta')).statusCode).toBe(429)

    vi.setSystemTime(Date.now() + 61_000)
    expect((await login('Marta')).statusCode).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// El guardian del literal, migrado de frontend/src/lib/session.test.ts con la
// derivacion del rol (spec 07, 2). Mismo gotcha: quitar comentarios antes de
// buscar, o el test se caza a si mismo.
// ---------------------------------------------------------------------------

const SRC = fileURLToPath(new URL('../..', import.meta.url))

function ficherosFuente(dir: string): string[] {
  return readdirSync(dir).flatMap((entrada) => {
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) return ficherosFuente(ruta)
    return /\.ts$/.test(entrada) && !/\.test\.ts$/.test(entrada) ? [ruta] : []
  })
}

function soloCodigo(contenido: string): string {
  return contenido.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

describe('el literal "ADMIN" vive en un solo sitio del sistema', () => {
  it('aparece exactamente una vez en backend/src: dentro del MockIdentityProvider', () => {
    // Es lo que hace que el proveedor mock sea sustituible en UN modulo, que es la unica
    // razon por la que un mock es aceptable (referencia 8.2). El espejo de este test en
    // el frontend comprueba que alli las apariciones son CERO.
    // Sensible a mayusculas a proposito: 'admin' (el ROL, un enum cerrado) es legitimo
    // en cualquier sitio; lo que solo puede vivir aqui es el NOMBRE DE USUARIO mágico.
    const apariciones = ficherosFuente(SRC).flatMap((f) => {
      const contenido = soloCodigo(readFileSync(f, 'utf8'))
      return [...contenido.matchAll(/'ADMIN'|"ADMIN"/g)].map(() => f)
    })

    expect(apariciones.map((f) => relative(SRC, f).split('\\').join('/'))).toEqual([
      'domain/auth/mock-identity.provider.ts',
    ])
  })
})
