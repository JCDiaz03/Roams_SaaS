// Crea el esquema si el .db no existe. Spec: 2.1

import { readFileSync } from 'node:fs'
import type { Db } from './db'

const SCHEMA_SQL = new URL('./schema.sql', import.meta.url)

/**
 * Aplica el esquema. Idempotente: el DDL usa CREATE TABLE IF NOT EXISTS.
 *
 * Este modulo NO conoce al seed, y la direccion importa: sembrar exige tablas, crear
 * tablas no exige datos. El gate de "solo si el .db no existe" vive en
 * `ensureDatabase()` (seed.ts), que es quien orquesta los dos pasos.
 */
export function migrate(db: Db): void {
  db.exec(readFileSync(SCHEMA_SQL, 'utf8'))
}
