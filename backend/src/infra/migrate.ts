// Crea el esquema si falta y añade columnas aditivas si faltan. Spec: 2.1, ADR 0012

import { readFileSync } from 'node:fs'
import type { Db } from './db'

const SCHEMA_SQL = new URL('./schema.sql', import.meta.url)

/**
 * Columnas añadidas después del primer despliegue del esquema. schema.sql las trae para
 * bases nuevas; esta lista las añade a bases existentes. AMBOS se tocan en el mismo
 * commit (ADR 0012).
 *
 * Límite declarado: esto cubre columnas aditivas NULLABLE, nada más. Una migración que
 * renombre, cambie tipos o mueva datos no cabe aquí — será el día del sistema de
 * migraciones de verdad, y este helper no debe crecer hasta convertirse en uno.
 */
const COLUMNAS_ADITIVAS: readonly { tabla: string; columna: string; ddl: string }[] = [
  // Valores base de consumo del cliente (spec 09, 3). El CHECK solo puede referenciar la
  // propia columna en un ADD COLUMN, que es exactamente lo que estos hacen.
  {
    tabla: 'customers',
    columna: 'base_users',
    ddl: 'INTEGER CHECK (base_users IS NULL OR (base_users BETWEEN 0 AND 1000000))',
  },
  {
    tabla: 'customers',
    columna: 'base_storage_gb',
    ddl: 'INTEGER CHECK (base_storage_gb IS NULL OR (base_storage_gb BETWEEN 0 AND 10000000))',
  },
  {
    tabla: 'customers',
    columna: 'base_api_calls',
    ddl: 'INTEGER CHECK (base_api_calls IS NULL OR (base_api_calls BETWEEN 0 AND 1000000000))',
  },
  // Archivado de simulaciones (spec 09, 5.5): estado de vista, no de negocio. NOT NULL
  // con DEFAULT es legal en un ADD COLUMN porque el default rellena las filas viejas.
  {
    tabla: 'simulations',
    columna: 'archived',
    ddl: 'INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1))',
  },
]

/**
 * Aplica el esquema y las columnas aditivas. Idempotente por dos vías: el DDL usa
 * CREATE TABLE IF NOT EXISTS, y ensureColumn consulta pragma table_info antes de alterar.
 *
 * Corre SIEMPRE al arrancar (no solo la primera vez): es lo que hace que un .db de
 * desarrollo sobreviva a un git pull que trae columnas nuevas, sin perder datos ni
 * exigir borrarlo (ADR 0012). El gate de "solo si el .db no existe" queda para el seed,
 * en `ensureDatabase()` (seed.ts) — sembrar exige base vacía; migrar no.
 */
export function migrate(db: Db): void {
  db.exec(readFileSync(SCHEMA_SQL, 'utf8'))

  for (const c of COLUMNAS_ADITIVAS) {
    ensureColumn(db, c.tabla, c.columna, c.ddl)
  }
}

/** Añade la columna solo si falta. Los nombres vienen de COLUMNAS_ADITIVAS, jamás de entrada externa. */
function ensureColumn(db: Db, tabla: string, columna: string, ddl: string): void {
  const existentes = db.pragma(`table_info(${tabla})`) as { name: string }[]
  if (existentes.some((c) => c.name === columna)) return

  db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${ddl}`)
}
