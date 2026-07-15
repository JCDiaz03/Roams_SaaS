// Conexion better-sqlite3 + sentencias preparadas. Spec: 14.2

import Database from 'better-sqlite3'

export type Db = Database.Database

export function openDb(path: string): Db {
  const db = new Database(path)

  // SQLite trae las claves ajenas DESACTIVADAS por defecto, y el pragma NO es
  // persistente: se aplica por conexion, no a la base de datos. Sin esta linea, todas
  // las FK del esquema son decorativas. Spec: modelo-datos.md 1 (regla 2)
  db.pragma('foreign_keys = ON')

  // WAL: lecturas concurrentes sin bloquear al escritor. Barato y sin contrapartidas
  // para un fichero local.
  db.pragma('journal_mode = WAL')

  return db
}
