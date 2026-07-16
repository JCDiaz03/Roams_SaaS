// Puerto IdentityProvider: authenticate(usuario, password) -> Identity | null. Spec: 07-autenticacion.md 2

export type Rol = 'admin' | 'sales'

/** Lo que el sistema sabe de quien esta dentro. Nada mas: no hay modelo de usuarios. */
export type Identity = { nombre: string; rol: Rol }

/**
 * El puerto de la identidad. Es la linea que parte el auth en dos (spec 07, 1): lo
 * INCOGNOSCIBLE (quien es usuario, como se autentica de verdad: SSO/LDAP/OIDC) queda
 * detras de esta interfaz; lo INVARIANTE (sesion, cookie, enforcement del rol) se
 * construye alrededor y no cambia decida lo que decida la empresa.
 *
 * Conectar el sistema de identidad real = otra implementacion de esto + cambiar que se
 * inyecta en index.ts. Cero cambios en sesiones, rutas o enforcement (ADR 0009).
 *
 * Sincrona a proposito, como TaxProvider: la implementacion de hoy no toca IO. El dia
 * que un proveedor real necesite red, la firma pasa a Promise y el compilador dice donde.
 */
export interface IdentityProvider {
  /** null = credenciales no validas. No distingue usuario de contraseña: eso es del caller. */
  authenticate(usuario: string, password: string): Identity | null
}
