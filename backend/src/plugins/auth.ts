// El hook de auth, relleno: sesion obligatoria, rol por config de ruta, cinturon anti-CSRF. Spec: 07-autenticacion.md 5

import type { FastifyInstance } from 'fastify'
import type { Identity, Rol } from '../domain/auth/identity-provider'
import { sidDe } from '../features/auth/auth.cookie'
import type { SessionStore } from '../features/auth/auth.sessions'
import { AppError } from './error-handler'

declare module 'fastify' {
  interface FastifyRequest {
    /** La identidad de la sesion. Poblada por el hook; null solo en rutas publicas. */
    identity: Identity | null
  }
  interface FastifyContextConfig {
    /** true = no exige sesion. La unica es POST /auth/login. */
    publica?: boolean
    /** El rol que la ruta exige, declarado como el esquema: visible en code review. */
    requiereRol?: Rol
  }
}

const MUTACIONES = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * LA COSTURA DE AUTH, RELLENA. Este hook estuvo vacio desde el dia 1 con un comentario
 * que decia "aqui se enchufara la validacion real": esto es ese enchufe (ADR 0009). La
 * verificacion de credenciales sigue detras del puerto IdentityProvider; lo que hay aqui
 * es lo INVARIANTE, que no cambia decida lo que decida la empresa sobre su IdP.
 *
 * Tres comprobaciones, en este orden:
 *
 *  1. Cinturon anti-CSRF: una mutacion que el navegador declara CROSS-SITE se rechaza.
 *     Se mira `Sec-Fetch-Site` y NO se compara `Origin` contra `Host`, y el motivo es un
 *     bug real que el smoke E2E cazo en su primer arranque: detras de un proxy (el de
 *     Vite aqui; cualquier TLS terminator en un despliegue) el Host llega REESCRITO
 *     (`changeOrigin`), y la comparacion rechazaba a la propia aplicacion. Sec-Fetch-Site
 *     lo calcula el navegador contra el origen que el usuario ve, asi que sobrevive a
 *     cualquier proxy. Sin cabecera (curl, tests, navegadores viejos) pasa: esto es el
 *     cinturon; el tirante es SameSite=Strict.
 *  2. Sesion: todo lo que no sea publico exige sesion viva -> 401. Herramienta interna:
 *     no hay lecturas anonimas que justificar.
 *  3. Rol: si la ruta declara `requiereRol` y la sesion no lo tiene -> 403. El gating
 *     visual del frontend sigue existiendo, pero ahora es UX sobre una autorizacion
 *     real, no en vez de ella.
 */
export function registerAuth(app: FastifyInstance, deps: { sessions: SessionStore }): void {
  app.decorateRequest('identity', null)

  app.addHook('onRequest', async (req) => {
    // `same-site` (otro subdominio) tambien se rechaza: en una herramienta interna no
    // hay ningun subdominio legitimo que deba mutar aqui. `same-origin`, `none` (gesto
    // directo del usuario) y ausente, pasan.
    const sitio = req.headers['sec-fetch-site']
    if (MUTACIONES.has(req.method) && (sitio === 'cross-site' || sitio === 'same-site')) {
      throw new AppError(403, 'AUTH_FORBIDDEN', 'La petición no viene de esta aplicación.')
    }

    // El not-found handler tambien pasa por aqui y no trae config de ruta.
    const config = req.routeOptions.config ?? {}
    if (config.publica === true) return

    const sid = sidDe(req.headers.cookie)
    const identity = sid === null ? null : deps.sessions.get(sid)
    if (identity === null) {
      throw new AppError(401, 'AUTH_REQUIRED', 'Tu sesión ha caducado. Vuelve a entrar.')
    }

    req.identity = identity

    if (config.requiereRol !== undefined && identity.rol !== config.requiereRol) {
      throw new AppError(403, 'AUTH_FORBIDDEN', 'Tu usuario no puede hacer esta operación.')
    }
  })
}
