// La mini-migracion de columnas aditivas (ADR 0012): un .db viejo gana las columnas
// nuevas al arrancar, con sus datos intactos; una segunda pasada es inocua.

import { describe, expect, it } from 'vitest'
import { openDb } from './db'
import { migrate } from './migrate'

/**
 * Reproduce una base creada ANTES de las columnas base_*: el DDL de customers tal y como
 * era, mas las dos tablas minimas que sus FK exigen para poder insertar una fila real.
 * No se usa schema.sql a proposito: schema.sql ya trae las columnas, y esta prueba
 * existe precisamente para el .db que no las tiene.
 */
function crearBaseVieja() {
  const db = openDb(':memory:')

  db.exec(`
    CREATE TABLE countries (
      code             TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      tax_id_scheme    TEXT,
      display_currency TEXT NOT NULL
    ) STRICT;

    CREATE TABLE plans (
      id            INTEGER PRIMARY KEY,
      name          TEXT NOT NULL,
      version       INTEGER NOT NULL DEFAULT 1,
      description   TEXT,
      pricing_model TEXT NOT NULL DEFAULT 'graduated',
      currency      TEXT NOT NULL,
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL,
      UNIQUE (name, version)
    ) STRICT;

    CREATE TABLE customers (
      id             INTEGER PRIMARY KEY,
      company_name   TEXT NOT NULL,
      fiscal_id      TEXT NOT NULL UNIQUE,
      fiscal_id_type TEXT NOT NULL,
      email          TEXT NOT NULL,
      country        TEXT NOT NULL REFERENCES countries(code) ON DELETE RESTRICT,
      plan_id        INTEGER NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
      created_at     TEXT NOT NULL
    ) STRICT;

    CREATE TABLE simulations (
      id               INTEGER PRIMARY KEY,
      customer_id      INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
      plan_id          INTEGER NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
      active_users     INTEGER NOT NULL,
      storage_gb       INTEGER NOT NULL,
      api_calls        INTEGER NOT NULL,
      pricing_snapshot TEXT NOT NULL,
      currency         TEXT NOT NULL,
      base_minor       INTEGER NOT NULL,
      tax_rate_bp      INTEGER NOT NULL,
      tax_minor        INTEGER NOT NULL,
      total_minor      INTEGER NOT NULL,
      created_at       TEXT NOT NULL
    ) STRICT;
  `)

  db.prepare("INSERT INTO countries VALUES ('ES', 'España', 'ES_NIF', 'EUR')").run()
  db.prepare(
    "INSERT INTO plans (name, currency, created_at) VALUES ('Plan Viejo', 'EUR', '2026-01-01T00:00:00Z')",
  ).run()
  db.prepare(
    `INSERT INTO customers (company_name, fiscal_id, fiscal_id_type, email, country, plan_id, created_at)
     VALUES ('Empresa Preexistente SL', 'B12345674', 'CIF', 'a@b.example', 'ES', 1, '2026-01-01T00:00:00Z')`,
  ).run()

  return db
}

function columnasDe(db: ReturnType<typeof openDb>, tabla: string): string[] {
  return (db.pragma(`table_info(${tabla})`) as { name: string }[]).map((c) => c.name)
}

describe('migrate() sobre una base con el DDL viejo', () => {
  it('añade las columnas base_* sin tocar los datos existentes', () => {
    const db = crearBaseVieja()
    expect(columnasDe(db, 'customers')).not.toContain('base_users')

    migrate(db)

    expect(columnasDe(db, 'customers')).toEqual(
      expect.arrayContaining(['base_users', 'base_storage_gb', 'base_api_calls']),
    )
    // Y el archived de simulaciones, con su DEFAULT 0 rellenando las filas viejas.
    expect(columnasDe(db, 'simulations')).toContain('archived')

    // La fila anterior sigue ahi, con "no registrado" (NULL) en las columnas nuevas.
    const fila = db.prepare("SELECT * FROM customers WHERE fiscal_id = 'B12345674'").get() as {
      company_name: string
      base_users: number | null
    }
    expect(fila.company_name).toBe('Empresa Preexistente SL')
    expect(fila.base_users).toBeNull()

    db.close()
  })

  it('una segunda pasada es inocua', () => {
    const db = crearBaseVieja()

    migrate(db)
    expect(() => migrate(db)).not.toThrow()

    db.close()
  })

  it('la columna añadida por ALTER lleva su CHECK: el tope rige tambien en bases migradas', () => {
    const db = crearBaseVieja()
    migrate(db)

    expect(() =>
      db.prepare("UPDATE customers SET base_users = 1000001 WHERE fiscal_id = 'B12345674'").run(),
    ).toThrow(/CHECK/i)

    db.close()
  })
})

describe('migrate() sobre una base nueva', () => {
  it('schema.sql ya trae las columnas y ensureColumn no tiene nada que hacer', () => {
    const db = openDb(':memory:')

    migrate(db)

    expect(columnasDe(db, 'customers')).toEqual(
      expect.arrayContaining(['base_users', 'base_storage_gb', 'base_api_calls']),
    )

    db.close()
  })
})
