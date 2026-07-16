// Sesiones de servidor en memoria: id aleatorio, caducidad absoluta, revocacion inmediata. Spec: 07-autenticacion.md 3

import { randomBytes } from 'node:crypto'
import type { Identity } from '../../domain/auth/identity-provider'

/** Caducidad ABSOLUTA: una jornada holgada. Sin TTL deslizante: renovar es volver a entrar. */
const TTL_MS = 12 * 60 * 60 * 1000

/**
 * Tope del Map. No es un limite de negocio: es que la memoria no pueda crecer sin
 * limite POR DISEÑO, no por confianza en el rate limit del login.
 */
const MAX_SESIONES = 1000

type SesionActiva = Identity & { creadaEn: number }

/**
 * El almacen de sesiones. EN MEMORIA, no en SQLite, por el mismo criterio que la cache
 * de tipos (spec 04, 3.2): estado volatil de una jornada de trabajo. Reiniciar el
 * servidor = volver a entrar; aceptable en herramienta interna y declarado (ADR 0009).
 *
 * La ventaja concreta de esto sobre un token stateless es este Map: borrar la entrada ES
 * revocar la sesion, ya. Un JWT seguiria siendo valido hasta caducar.
 */
export class SessionStore {
  private sesiones = new Map<string, SesionActiva>()

  /** Crea la sesion y devuelve su id: 256 bits aleatorios. El id no codifica nada. */
  create(identity: Identity): string {
    if (this.sesiones.size >= MAX_SESIONES) {
      // Primero caen las CADUCADAS (que solo se borran perezosamente en get(), asi que
      // pueden estar ocupando hueco): expulsar una sesion viva mientras quedan muertas
      // seria un logout silencioso gratuito.
      const ahora = Date.now()
      for (const [id, sesion] of this.sesiones) {
        if (ahora - sesion.creadaEn > TTL_MS) this.sesiones.delete(id)
      }

      // Map conserva el orden de insercion: la primera clave es la sesion mas antigua.
      if (this.sesiones.size >= MAX_SESIONES) {
        const masVieja = this.sesiones.keys().next().value
        if (masVieja !== undefined) this.sesiones.delete(masVieja)
      }
    }

    const id = randomBytes(32).toString('base64url')
    this.sesiones.set(id, { ...identity, creadaEn: Date.now() })
    return id
  }

  /** La identidad de la sesion, o null si no existe o caduco (y entonces se borra). */
  get(id: string): Identity | null {
    const sesion = this.sesiones.get(id)
    if (sesion === undefined) return null

    if (Date.now() - sesion.creadaEn > TTL_MS) {
      this.sesiones.delete(id)
      return null
    }

    return { nombre: sesion.nombre, rol: sesion.rol }
  }

  /** Revocacion inmediata: la razon de que las sesiones vivan en el servidor. */
  delete(id: string): void {
    this.sesiones.delete(id)
  }
}
