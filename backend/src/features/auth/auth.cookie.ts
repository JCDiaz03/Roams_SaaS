// La cookie de sesion: HttpOnly + SameSite=Strict, sin dependencias. Spec: 07-autenticacion.md 3

const NOMBRE = 'sid'

/**
 * Serializa la cookie de sesion. A mano y no con @fastify/cookie: es UNA cookie con
 * flags fijos, y doce lineas propias pesan menos que una dependencia mas en la cadena
 * de suministro (referencia 14.3).
 *
 * Los flags son la defensa (spec 07, 3):
 *   * HttpOnly     -> el JS del cliente no puede leerla: un XSS no roba la sesion.
 *   * SameSite=Strict -> no viaja en peticiones cross-site: primera capa anti-CSRF.
 *   * Path=/api    -> solo va donde se usa.
 *   * Sin Max-Age  -> cookie de sesion de navegador; la caducidad real (12 h) la aplica
 *                     el servidor, que es quien manda.
 *   * Sin Secure   -> no hay HTTPS en local, y se DECLARA en vez de fingirlo. Detras de
 *                     un proxy TLS se añade.
 */
export function cookieDeSesion(sid: string): string {
  return `${NOMBRE}=${sid}; HttpOnly; SameSite=Strict; Path=/api`
}

/** La misma cookie, expirada: lo que manda el logout. */
export function cookieExpirada(): string {
  return `${NOMBRE}=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/api`
}

/** El sid de la cabecera Cookie, o null. Parser minimo: una cookie, sin atributos. */
export function sidDe(cabeceraCookie: string | undefined): string | null {
  if (cabeceraCookie === undefined) return null

  for (const parte of cabeceraCookie.split(';')) {
    const igual = parte.indexOf('=')
    if (igual === -1) continue
    if (parte.slice(0, igual).trim() !== NOMBRE) continue

    const valor = parte.slice(igual + 1).trim()
    return valor === '' ? null : valor
  }

  return null
}
