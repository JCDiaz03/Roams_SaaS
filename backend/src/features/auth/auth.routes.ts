// POST /auth/login (rate limit), GET /auth/session, POST /auth/logout. Spec: 07-autenticacion.md 4

import type { FastifyInstance } from 'fastify'
import type { IdentityProvider } from '../../domain/auth/identity-provider'
import { AppError } from '../../plugins/error-handler'
import { cookieDeSesion, cookieExpirada, sidDe } from './auth.cookie'
import { loginSchema, logoutSchema, sessionSchema } from './auth.schemas'
import type { SessionStore } from './auth.sessions'

type Deps = { identityProvider: IdentityProvider; sessions: SessionStore }

/**
 * Rate limit del login: N intentos por IP y minuto. No convierte la 1111 en secreto
 * -es publica y declarada-: existe para que la ESTRUCTURA quede bien construida. El dia
 * del IdP real, el freno a fuerza bruta ya esta donde tiene que estar (spec 07, 4).
 */
const INTENTOS_MAX = 10
const VENTANA_MS = 60_000

/** Tope de IPs recordadas: la memoria no puede crecer sin limite POR DISEÑO, como el
 *  Map de sesiones (auth.sessions.ts). Sin el, una rotacion de direcciones IPv6 dejaria
 *  una entrada por direccion para siempre. */
const MAX_IPS = 1000

export function authRoutes({ identityProvider, sessions }: Deps) {
  // En memoria y por proceso, como las sesiones: mismo alcance, mismo ciclo de vida.
  const intentos = new Map<string, { n: number; resetEn: number }>()

  function limitar(ip: string): void {
    const ahora = Date.now()

    // Al llenarse se barren las ventanas caducadas y, si no basta, cae la mas antigua.
    if (intentos.size >= MAX_IPS && !intentos.has(ip)) {
      for (const [llave, entrada] of intentos) {
        if (ahora >= entrada.resetEn) intentos.delete(llave)
      }
      if (intentos.size >= MAX_IPS) {
        const masVieja = intentos.keys().next().value
        if (masVieja !== undefined) intentos.delete(masVieja)
      }
    }

    const actual = intentos.get(ip)

    if (actual === undefined || ahora >= actual.resetEn) {
      intentos.set(ip, { n: 1, resetEn: ahora + VENTANA_MS })
      return
    }

    actual.n += 1
    if (actual.n > INTENTOS_MAX) {
      throw new AppError(429, 'AUTH_RATE_LIMITED', 'Demasiados intentos. Espera un minuto.')
    }
  }

  return async (app: FastifyInstance): Promise<void> => {
    // La UNICA ruta publica del sistema (spec 07, 5.1): todo lo demas exige sesion.
    app.post('/auth/login', { schema: loginSchema, config: { publica: true } }, async (req, reply) => {
      limitar(req.ip)

      const { usuario, password } = req.body as { usuario: string; password: string }

      const identity = identityProvider.authenticate(usuario, password)
      if (identity === null) {
        // Mensaje UNICO: no se revela si fallo el usuario o la contraseña.
        throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.')
      }

      void reply.header('Set-Cookie', cookieDeSesion(sessions.create(identity)))
      return identity
    })

    // La rehidratacion tras F5: el frontend pregunta quien soy al arrancar. Sin sesion,
    // el hook ya devolvio 401 y el cliente lo lee como "no hay nadie", no como error.
    app.get('/auth/session', { schema: sessionSchema }, async (req) => req.identity)

    // PUBLICA como el login, y con motivo: salir tiene que funcionar precisamente cuando
    // la sesion ya murio sola (caducidad, reinicio). Si exigiera sesion, el 401 del hook
    // impediria expirar la cookie muerta del navegador.
    app.post('/auth/logout', { schema: logoutSchema, config: { publica: true } }, async (req, reply) => {
      const sid = sidDe(req.headers.cookie)
      // Borrar la entrada ES revocar: la misma cookie deja de valer en este instante.
      if (sid !== null) sessions.delete(sid)

      void reply.header('Set-Cookie', cookieExpirada())
      return reply.status(204).send()
    })
  }
}
