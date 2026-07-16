// Implementacion mock del puerto: el comportamiento literal del enunciado. Spec: 07-autenticacion.md 2

import type { Identity, IdentityProvider } from './identity-provider'

/**
 * Las credenciales de DEMOSTRACION del enunciado: cualquier usuario no vacio con la
 * contraseña 1111; el usuario ADMIN (insensible a mayusculas) es administrador.
 *
 * Que el proveedor sea mock ya no significa que el auth lo sea (spec 07, 1): la sesion,
 * la cookie y el 403 de las rutas de admin son reales. Lo unico de mentira es la
 * verificacion de credenciales, que es exactamente la mitad que no se puede construir
 * sin conocer el sistema de identidad de la empresa.
 *
 * EL LITERAL "ADMIN" VIVE AQUI Y SOLO AQUI, en todo el sistema. Antes vivia (tambien una
 * sola vez) en frontend/src/lib/session.tsx; se mudo con la derivacion del rol al
 * servidor, y el test guardian se mudo con el (auth.test.ts). Si aparece en un segundo
 * sitio, la sustituibilidad del mock -la razon por la que es aceptable- se ha roto.
 */
export class MockIdentityProvider implements IdentityProvider {
  authenticate(usuario: string, password: string): Identity | null {
    const nombre = usuario.trim()
    if (nombre === '' || password !== '1111') return null

    return { nombre, rol: nombre.toUpperCase() === 'ADMIN' ? 'admin' : 'sales' }
  }
}
