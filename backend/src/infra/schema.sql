-- Esquema de Roams SaaS. Spec: ai-workspace/01-specs/modelo-datos.md
--
-- Reglas transversales (modelo-datos.md 1):
--   * STRICT en todas las tablas: SQLite acepta por defecto un texto en una columna
--     INTEGER; STRICT lo convierte en error.
--   * Dinero en enteros con sufijo _minor (referencia 4.4, invariante 5). Nunca REAL.
--   * Tipos impositivos en puntos basicos enteros (_bp): 2100 = 21 %. Un REAL en
--     base * rate reintroduce el float en el calculo que el invariante 5 protege.
--   * Fechas como texto ISO 8601 en UTC: es lo que SQLite ordena y compara como texto.
--   * Sin borrado fisico en ninguna tabla (referencia 5.5): por eso todas las FK son
--     ON DELETE RESTRICT.
--
-- PRAGMA foreign_keys = ON NO va aqui: no es persistente, se aplica por conexion.
-- Vive en db.ts. Sin el, todas las FK de este fichero son decorativas.

-- Entidad agregadora: tipo impositivo, esquema fiscal y divisa de presentacion.
-- Spec: modelo-datos.md 2.1 / referencia 6.1
CREATE TABLE IF NOT EXISTS countries (
  code             TEXT PRIMARY KEY,          -- ISO 3166-1 alfa-2
  name             TEXT NOT NULL,
  tax_id_scheme    TEXT,                      -- clave del registro de validadores; NULL = sin validacion
  display_currency TEXT NOT NULL,             -- ISO 4217, SOLO presentacion (referencia 4.1)
  CHECK (length(code) = 2 AND code = upper(code)),
  CHECK (length(display_currency) = 3 AND display_currency = upper(display_currency))
) STRICT;

-- tax_id_scheme no lleva FK ni CHECK con lista cerrada a proposito: su universo vive en
-- el registro de codigo, no en la base de datos (referencia 6.1, linea divisoria
-- dato/codigo). La coherencia la garantiza el chequeo de integridad del arranque
-- (startup-checks.ts), no una restriccion SQL: un CHECK obligaria a migrar la base de
-- datos para anadir un validador, que es justo lo que el diseno evita.

-- Historico de tipos. Vigente = mayor vigente_desde <= hoy.
-- Spec: modelo-datos.md 2.2 / referencia 6.2
CREATE TABLE IF NOT EXISTS tax_rates (
  country       TEXT NOT NULL REFERENCES countries(code) ON DELETE RESTRICT,
  vigente_desde TEXT NOT NULL,                -- YYYY-MM-DD
  rate_bp       INTEGER NOT NULL,             -- puntos basicos: 2100 = 21 %
  PRIMARY KEY (country, vigente_desde),
  CHECK (rate_bp >= 0 AND rate_bp <= 10000),
  CHECK (vigente_desde LIKE '____-__-__')
) STRICT;

-- Spec: modelo-datos.md 2.3 / referencia 5
CREATE TABLE IF NOT EXISTS plans (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  version       INTEGER NOT NULL DEFAULT 1,
  description   TEXT,
  pricing_model TEXT NOT NULL DEFAULT 'graduated',
  currency      TEXT NOT NULL,               -- ISO 4217, divisa de FACTURACION (referencia 4.1)
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  UNIQUE (name, version),
  CHECK (version >= 1),
  -- Un solo valor es deliberado: el Strategy deja hueco a volume/flat (referencia 5.3),
  -- pero mientras no exista la implementacion el CHECK impide que una fila declare un
  -- modelo que nadie sabe calcular. Anadir el modelo = anadir la estrategia Y ampliar
  -- este CHECK, en el mismo commit.
  CHECK (pricing_model IN ('graduated')),
  CHECK (active IN (0, 1)),
  CHECK (length(currency) = 3 AND currency = upper(currency))
) STRICT;

CREATE TABLE IF NOT EXISTS plan_tiers (
  id               INTEGER PRIMARY KEY,
  plan_id          INTEGER NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  metric           TEXT NOT NULL,
  up_to            INTEGER,                  -- limite superior INCLUSIVO; NULL = infinito
  unit_price_minor INTEGER NOT NULL,
  sort_order       INTEGER NOT NULL,
  UNIQUE (plan_id, metric, sort_order),
  CHECK (metric IN ('users', 'storage_gb', 'api_calls')),
  CHECK (up_to IS NULL OR up_to > 0),
  CHECK (unit_price_minor >= 0),             -- el 0 entra por diseno: un precio de cero ES un precio
  CHECK (sort_order >= 0)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_plan_tiers_plan ON plan_tiers(plan_id);

-- Lo que este DDL NO valida: que los tramos de una metrica sean crecientes, sin huecos
-- ni solapes, y que el ultimo sea abierto. Eso es la validacion de plantilla
-- (referencia 5.4): vive en el servicio porque no hay CHECK capaz de mirar las filas
-- hermanas. Consecuencia asumida: la base de datos admite un plan incoherente si alguien
-- inserta saltandose el servicio; por eso el seed y el endpoint de admin son los dos
-- unicos caminos de escritura, y ambos pasan por el mismo validador.

-- Spec: modelo-datos.md 2.4 / referencia 7.4
CREATE TABLE IF NOT EXISTS customers (
  id             INTEGER PRIMARY KEY,
  company_name   TEXT NOT NULL,
  fiscal_id      TEXT NOT NULL UNIQUE,       -- forma NORMALIZADA (referencia 7.4)
  fiscal_id_type TEXT NOT NULL,              -- DNI | NIE | CIF | NIF (PT) | unvalidated
  email          TEXT NOT NULL,
  country        TEXT NOT NULL REFERENCES countries(code) ON DELETE RESTRICT,
  plan_id        INTEGER NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  created_at     TEXT NOT NULL,
  CHECK (fiscal_id_type IN ('DNI', 'NIE', 'CIF', 'NIF', 'unvalidated')),
  -- Red de la normalizacion: si algun camino de escritura olvidara normalizar, la fila
  -- se rechaza en vez de colarse y romper el UNIQUE en silencio ("b12345674" y
  -- "B12345674" convivirian como dos empresas distintas).
  CHECK (fiscal_id = upper(fiscal_id)),
  -- Duplican a proposito los maxLength del esquema Fastify (referencia 7.5): el esquema
  -- protege al validador de entradas largas, el CHECK protege a la tabla de cualquier
  -- otro camino.
  CHECK (length(company_name) BETWEEN 1 AND 200),
  CHECK (length(fiscal_id) BETWEEN 1 AND 20),
  CHECK (length(email) <= 254)
) STRICT;

-- UNIQUE ya crea el indice de fiscal_id; el buscador ataca esos dos campos.
-- Honestidad sobre este indice: el buscador usa LIKE '%term%' y un comodin inicial NO
-- usa indice (habra table scan). Se mantiene porque sirve al orden y a las busquedas por
-- prefijo, y porque a esta escala el scan es submilisegundo. A escala, la respuesta es
-- FTS5, no otro indice B-tree. Spec: features/03-buscador-y-detalle.md 2.4
CREATE INDEX IF NOT EXISTS idx_customers_company_name ON customers(company_name COLLATE NOCASE);

-- Spec: modelo-datos.md 2.5 / referencia 11.2
CREATE TABLE IF NOT EXISTS simulations (
  id               INTEGER PRIMARY KEY,
  customer_id      INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  plan_id          INTEGER NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  active_users     INTEGER NOT NULL,
  storage_gb       INTEGER NOT NULL,
  api_calls        INTEGER NOT NULL,
  pricing_snapshot TEXT NOT NULL,            -- JSON: foto inmutable (referencia 11.2)
  currency         TEXT NOT NULL,            -- divisa de FACTURACION aplicada
  base_minor       INTEGER NOT NULL,
  tax_rate_bp      INTEGER NOT NULL,         -- el tipo APLICADO, no el vigente hoy
  tax_minor        INTEGER NOT NULL,
  total_minor      INTEGER NOT NULL,
  created_at       TEXT NOT NULL,
  CHECK (active_users >= 0 AND storage_gb >= 0 AND api_calls >= 0),
  CHECK (base_minor >= 0 AND tax_minor >= 0 AND total_minor >= 0),
  CHECK (tax_rate_bp >= 0 AND tax_rate_bp <= 10000),
  -- El invariante del orden de calculo (referencia 4.2) escrito en la tabla: si un
  -- refactor del motor rompiera la suma, la fila no entra.
  CHECK (total_minor = base_minor + tax_minor),
  CHECK (json_valid(pricing_snapshot)),
  CHECK (length(currency) = 3 AND currency = upper(currency))
) STRICT;

-- Igualdad sobre customer_id + orden: esto SI lo sirve bien un B-tree.
CREATE INDEX IF NOT EXISTS idx_simulations_customer ON simulations(customer_id, created_at DESC);

-- No hay columna de divisa de visualizacion, y es intencionado: invariante 4
-- (referencia 3). Si alguna vez aparece en un PR, es un bug de diseno, no una mejora.
