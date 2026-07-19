# Modelo de datos y seed

> **Mantenimiento — capa SPEC.**
>
> * Qué es: el DDL que se implementa y el contenido exacto del seed. Es la única casa del esquema físico: nombres de columna, tipos, restricciones e índices.
> * El **porqué** de cada estructura vive en `idea-referencia.md` (§11 tablas, §5.1 planes, §6 países e impuestos). Aquí se enlaza (`→ referencia §X`), no se repite.
> * Presente, sin fechas. Lo incompleto se marca con estado, nunca con fecha.

---

## 1. Reglas transversales del esquema

Cinco decisiones que aplican a todas las tablas y que conviene leer antes del DDL:

1. **`STRICT` en todas las tablas.** SQLite acepta por defecto un texto en una columna `INTEGER`; `STRICT` lo convierte en error. Es una línea por tabla y cierra la clase entera de "el importe se guardó como string".
2. **`PRAGMA foreign_keys = ON` en cada conexión.** SQLite trae las claves ajenas **desactivadas por defecto** y el pragma **no es persistente**: se aplica por conexión, no a la base de datos. Si no se ejecuta al abrir, todas las FK del DDL son decorativas. Va en el módulo de conexión (`infra/`), no en el seed.
3. **Dinero en enteros con sufijo `_minor`** (→ referencia §4.4, invariante 5). Nunca `REAL`.
4. **Tipos impositivos en puntos básicos enteros** (`_bp`): `2100` = 21 %, `810` = 8,1 %. Mismo motivo que el dinero — un `REAL` en `base × rate` reintroduce el float justo en el cálculo que el invariante 5 protege. 4 dígitos dan hasta 2 decimales de porcentaje, suficiente para cualquier tipo estándar real.
5. **Fechas como texto ISO 8601 en UTC** (`created_at` = `YYYY-MM-DDTHH:MM:SSZ`, `vigente_desde` = `YYYY-MM-DD`). Es el formato que SQLite ordena y compara correctamente como texto, que es todo lo que necesitamos (`vigente_desde <= date('now')`).

**Nada de borrado físico** en ninguna tabla (→ referencia §5.5), con una excepción estrecha: el plan con **cero referencias** (ni clientes ni simulaciones) se elimina de verdad en el `DELETE` (→ ADR 0013) — no hay integridad que proteger ni presupuesto que explicar. Por eso todas las FK son `ON DELETE RESTRICT`: si alguna vez un `DELETE` falla por integridad referencial, es que alguien intentó borrar algo usado, que la regla sigue prohibiendo.

---

## 2. DDL

### 2.1 `countries` — entidad agregadora (→ referencia §6.1)

```sql
CREATE TABLE countries (
  code             TEXT PRIMARY KEY,          -- ISO 3166-1 alfa-2
  name             TEXT NOT NULL,
  tax_id_scheme    TEXT,                      -- clave del registro de validadores; NULL = sin validación
  display_currency TEXT NOT NULL,             -- ISO 4217, SOLO presentación (→ referencia §4.1)
  CHECK (length(code) = 2 AND code = upper(code)),
  CHECK (length(display_currency) = 3 AND display_currency = upper(display_currency))
) STRICT;
```

`tax_id_scheme` **no** tiene FK ni `CHECK` con lista cerrada: su universo vive en el registro de código, no en la base de datos (→ referencia §6.1, la línea divisoria dato/código). Quien garantiza la coherencia es el **chequeo de integridad del arranque** (→ referencia §7.3), no una restricción SQL. Un `CHECK (tax_id_scheme IN ('ES_NIF', ...))` obligaría a migrar la base de datos para añadir un validador, que es exactamente lo que el diseño evita.

`display_currency` tampoco valida contra `Currency`: el enum es código (→ referencia §4.3). Lo cubre el mismo chequeo de arranque.

### 2.2 `tax_rates` — histórico de tipos (→ referencia §6.2)

```sql
CREATE TABLE tax_rates (
  country       TEXT NOT NULL REFERENCES countries(code) ON DELETE RESTRICT,
  vigente_desde TEXT NOT NULL,                -- YYYY-MM-DD
  rate_bp       INTEGER NOT NULL,             -- puntos básicos: 2100 = 21 %
  PRIMARY KEY (country, vigente_desde),
  CHECK (rate_bp >= 0 AND rate_bp <= 10000),
  CHECK (vigente_desde LIKE '____-__-__')
) STRICT;
```

**Regla de vigencia** (declarada en referencia §6.2, implementada aquí): la fila vigente es la de mayor `vigente_desde` **≤ hoy**. Una fila con fecha futura es legítima (un tipo anunciado y no aplicable aún) y **no debe aplicarse**; el `<= date('now')` no es cosmético.

```sql
SELECT rate_bp FROM tax_rates
WHERE country = ? AND vigente_desde <= date('now')
ORDER BY vigente_desde DESC LIMIT 1;
```

Esta consulta se ejecuta **una vez por país al arrancar** para poblar la caché en memoria (→ referencia §6.1), no por petición.

### 2.3 `plans` y `plan_tiers` (→ referencia §5)

```sql
CREATE TABLE plans (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  version       INTEGER NOT NULL DEFAULT 1,
  description   TEXT,
  pricing_model TEXT NOT NULL DEFAULT 'graduated',
  currency      TEXT NOT NULL,               -- ISO 4217, divisa de FACTURACIÓN (→ referencia §4.1)
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  UNIQUE (name, version),
  CHECK (version >= 1),
  CHECK (pricing_model IN ('graduated')),
  CHECK (active IN (0, 1)),
  CHECK (length(currency) = 3 AND currency = upper(currency))
) STRICT;

CREATE TABLE plan_tiers (
  id               INTEGER PRIMARY KEY,
  plan_id          INTEGER NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  metric           TEXT NOT NULL,
  up_to            INTEGER,                  -- límite superior INCLUSIVO; NULL = infinito
  unit_price_minor INTEGER NOT NULL,
  sort_order       INTEGER NOT NULL,
  UNIQUE (plan_id, metric, sort_order),
  CHECK (metric IN ('users', 'storage_gb', 'api_calls')),
  CHECK (up_to IS NULL OR up_to > 0),
  CHECK (unit_price_minor >= 0),
  CHECK (sort_order >= 0)
) STRICT;

CREATE INDEX idx_plan_tiers_plan ON plan_tiers(plan_id);
```

Notas que el DDL no puede expresar y el motor sí necesita:

- **`up_to` es inclusivo**: el tramo 1 del Plan Text tiene `up_to = 10` y cubre los usuarios 1–10. El enunciado dice "0 a 10" y "11 a 50"; con límite superior inclusivo esos son `up_to = 10` y `up_to = 50`. Es también como se le pide al admin en pantalla ("hasta cuántos usuarios", → referencia §5.4).
- **`CHECK (pricing_model IN ('graduated'))` con un solo valor es deliberado**: el Strategy deja hueco a `volume`/`flat` (→ referencia §5.3), pero mientras no exista la implementación, el `CHECK` impide que una fila declare un modelo que nadie sabe calcular. Añadir el modelo = añadir la estrategia **y** ampliar el `CHECK`, en el mismo commit.
- **Lo que el DDL NO valida**: que los tramos de una métrica sean crecientes, sin huecos ni solapes, y que el último sea abierto. Eso es la validación de plantilla (→ referencia §5.4) y vive en el servicio, no en SQL — no hay `CHECK` capaz de mirar las filas hermanas. Consecuencia asumida: **la base de datos admite un plan incoherente si alguien inserta saltándose el servicio**; por eso el seed y el endpoint de admin son los dos únicos caminos de escritura, y ambos pasan por el mismo validador.

### 2.4 `customers` (→ referencia §7.4, §11.1)

```sql
CREATE TABLE customers (
  id            INTEGER PRIMARY KEY,
  company_name  TEXT NOT NULL,
  fiscal_id     TEXT NOT NULL UNIQUE,        -- forma NORMALIZADA (→ referencia §7.4)
  fiscal_id_type TEXT NOT NULL,              -- DNI | NIE | CIF | NIF (PT) | unvalidated
  email         TEXT NOT NULL,
  country       TEXT NOT NULL REFERENCES countries(code) ON DELETE RESTRICT,
  plan_id       INTEGER NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  base_users      INTEGER,                   -- valores base de consumo (→ features/09 §3); NULL = no registrado
  base_storage_gb INTEGER,
  base_api_calls  INTEGER,
  created_at    TEXT NOT NULL,
  CHECK (fiscal_id_type IN ('DNI', 'NIE', 'CIF', 'NIF', 'unvalidated')),
  CHECK (fiscal_id = upper(fiscal_id)),
  CHECK (length(company_name) BETWEEN 1 AND 200),
  CHECK (length(fiscal_id) BETWEEN 1 AND 20),
  CHECK (length(email) <= 254),
  CHECK (base_users      IS NULL OR (base_users      BETWEEN 0 AND 1000000)),
  CHECK (base_storage_gb IS NULL OR (base_storage_gb BETWEEN 0 AND 10000000)),
  CHECK (base_api_calls  IS NULL OR (base_api_calls  BETWEEN 0 AND 1000000000))
) STRICT;

CREATE INDEX idx_customers_company_name ON customers(company_name COLLATE NOCASE);
```

- **`CHECK (fiscal_id = upper(fiscal_id))` es la red de la normalización**: si algún camino de escritura olvidara normalizar, la fila se rechaza en vez de colarse y romper el UNIQUE silenciosamente (`b12345674` y `B12345674` convivirían como dos empresas distintas). Los `length()` duplican a propósito los `maxLength` del esquema Fastify (→ referencia §7.5): el esquema protege al validador de entradas largas, el `CHECK` protege a la tabla de cualquier otro camino.
- **`fiscal_id` es UNIQUE global, no por país.** Es lo que fija la referencia §7.4 y su motivo (un duplicado accidental es mucho más probable que una colisión real). *Gotcha conocido y aceptado*: dos países podrían emitir la misma cadena; el día que ocurra, la migración es `UNIQUE (country, fiscal_id)` y el mensaje "esta empresa ya existe" pasa a ser por país. No se adelanta porque hoy costaría un índice más ancho para un caso que no se ha visto.
- **`UNIQUE` crea su propio índice**, así que `fiscal_id` no necesita un `CREATE INDEX` aparte (la referencia §11.1 pide índice en los dos campos del buscador; en `fiscal_id` ya lo da el UNIQUE).
- **Honestidad sobre el índice de `company_name`**: el buscador usa `LIKE '%term%'` y **un comodín inicial impide usar el índice** — SQLite hará scan completo. El índice se mantiene igual porque sirve al orden y a las búsquedas por prefijo, y porque el coste es nulo a esta escala (miles de filas). Lo que **no** se hace es fingir que el índice resuelve el `LIKE`: si la tabla creciera a millones, la respuesta es FTS5, no otro índice B-tree. → detalle en `features/03-buscador-y-detalle.md`.
- **Los `base_*` son un preajuste de UI persistido, no una entrada de cálculo**: el motor solo ve las cantidades de `POST /simulations` (→ `features/09-simulacion-parametrizada-y-plan-elegido.md` §2). `NULL` significa "no registrado" y es un valor de primera clase. Sus `CHECK` duplican a propósito los topes del esquema Fastify, que son los mismos de `simulations` — misma magnitud física, misma cota.
- **Mini-migración de columnas aditivas** (→ ADR 0012): estas tres columnas se añaden también con `ALTER TABLE ... ADD COLUMN` idempotente en el arranque (consultando `pragma table_info`), porque el `schema.sql` solo corre sobre una base nueva y un `.db` existente de desarrollo debe seguir arrancando tras un `git pull`. `schema.sql` y los `ALTER` se tocan **juntos, en el mismo commit**.
- `fiscal_id_type` incluye `'unvalidated'` como valor de primera clase: es el resultado que devuelve `PassThroughValidator` (→ referencia §7.3), no un hueco. `'NIF'` es el **portugués** (`PT_NIF`, → `features/02-validacion-fiscal-y-alta-cliente.md` §3.3); no colisiona con España porque el validador español devuelve el tipo concreto (DNI/NIE/CIF). Añadir un tipo = ampliar este `CHECK` en el mismo commit que el validador.

### 2.5 `simulations` (→ referencia §11.2)

```sql
CREATE TABLE simulations (
  id              INTEGER PRIMARY KEY,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  plan_id         INTEGER NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  active_users    INTEGER NOT NULL,
  storage_gb      INTEGER NOT NULL,
  api_calls       INTEGER NOT NULL,
  pricing_snapshot TEXT NOT NULL,            -- JSON: foto inmutable (→ referencia §11.2)
  currency        TEXT NOT NULL,             -- divisa de FACTURACIÓN aplicada
  base_minor      INTEGER NOT NULL,
  tax_rate_bp     INTEGER NOT NULL,          -- el tipo APLICADO, no el vigente hoy
  tax_minor       INTEGER NOT NULL,
  total_minor     INTEGER NOT NULL,
  archived        INTEGER NOT NULL DEFAULT 0,  -- estado de VISTA, no de negocio (spec 09 §5.5)
  created_by      TEXT,                        -- emisor: la sesión que guardó; NULL = fila anterior a la columna
  created_at      TEXT NOT NULL,
  CHECK (created_by IS NULL OR length(created_by) BETWEEN 1 AND 60),
  CHECK (archived IN (0, 1)),
  CHECK (active_users >= 0 AND storage_gb >= 0 AND api_calls >= 0),
  CHECK (base_minor >= 0 AND tax_minor >= 0 AND total_minor >= 0),
  CHECK (tax_rate_bp >= 0 AND tax_rate_bp <= 10000),
  CHECK (total_minor = base_minor + tax_minor),
  CHECK (json_valid(pricing_snapshot)),
  CHECK (length(currency) = 3 AND currency = upper(currency))
) STRICT;

CREATE INDEX idx_simulations_customer ON simulations(customer_id, created_at DESC);
```

- **`CHECK (total_minor = base_minor + tax_minor)` es el invariante del §4.2 escrito en la tabla.** Si un refactor del motor rompiera la suma, la fila no entra. Cuesta nada y convierte una regla de documento en una garantía.
- **`plan_id` se persiste además del snapshot** aunque el snapshot ya contenga los tramos: el snapshot explica **el número**, `plan_id` responde **con qué plan se cotizó** sin parsear JSON. No es redundancia: son dos preguntas distintas y solo la primera necesita ser inmutable.
- **`tax_rate_bp` es el tipo aplicado**, no una FK a `tax_rates`: si mañana el IVA español pasa al 22 %, una FK seguiría apuntando a "el tipo de España" y la simulación vieja cambiaría de explicación. Es el mismo motivo que el snapshot, aplicado al impuesto (→ referencia §6.2).
- **No hay columna de divisa de visualización.** Es intencionado y es el invariante 4 (→ referencia §3): la divisa de visualización no se persiste jamás. Si alguna vez aparece esa columna en un PR, es un bug de diseño, no una mejora.
- **`storage_gb` y `api_calls` se guardan aunque el plan no los facture** (→ referencia §5.2): son la entrada que el comercial registró, y aportan 0 al total sin dejar de constar.
- **`archived` es lo ÚNICO mutable de una simulación**, y es estado de vista: saca la card del historial por defecto sin tocar un número sellado (spec 09 §5.5). La inmutabilidad del §11.2 es de los números, no del flag. Columna aditiva (→ ADR 0012).
- **`created_by` es el emisor del presupuesto**: el nombre de la sesión que hizo el `POST`, fotografiado al guardar — el papel impreso declara a quien lo creó, no a quien lo abre. Se persiste el **valor**, no una referencia a la sesión (que muere al reiniciar, §8): mismo motivo que `tax_rate_bp`. `NULL` = fila anterior a la columna. Columna aditiva (→ ADR 0012); el tope 60 es el del `usuario` del login.

**Forma del `pricing_snapshot`** (JSON; es un dato opaco para SQL, pero su forma es contrato):

```json
{
  "plan": { "id": 1, "name": "Plan Text", "version": 1, "currency": "EUR", "pricing_model": "graduated" },
  "tiers": [
    { "metric": "users", "up_to": 10,   "unit_price_minor": 1000, "sort_order": 0 },
    { "metric": "users", "up_to": 50,   "unit_price_minor": 800,  "sort_order": 1 },
    { "metric": "users", "up_to": null, "unit_price_minor": 500,  "sort_order": 2 }
  ],
  "tax": { "country": "ES", "rate_bp": 2100 }
}
```

Contiene **exactamente lo que el motor necesita para recalcular el número desde cero**, y nada más. Regla para saber si algo va dentro: si al borrarlo de la base de datos el resto del sistema no pudiera reproducir el total, va en el snapshot; si es consultable y mutable sin cambiar el pasado (el email del cliente), no.

---

## 3. Seed

Se ejecuta **automáticamente si el fichero `.db` no existe** (→ referencia §2.1): el evaluador clona, `npm run dev`, y tiene datos. Es idempotente por construcción, porque solo corre sobre una base vacía.

### 3.1 `countries` + `tax_rates`

Diez países. El criterio de selección **no es "los más grandes"**: es que exista un **tipo impositivo estándar de ámbito estatal**, porque la cobertura fiscal es lo que define el universo de países (→ referencia §6.1) y un país sin tipo calculable es inexpresable por diseño.

| `code` | `name` | `tax_id_scheme` | `display_currency` | `rate_bp` | `vigente_desde` |
|---|---|---|---|---|---|
| `ES` | España | `ES_NIF` | `EUR` | `2100` | `2012-09-01` |
| `PT` | Portugal | `PT_NIF` | `EUR` | `2300` | `2011-01-01` |
| `FR` | Francia | `NULL` | `EUR` | `2000` | `2014-01-01` |
| `DE` | Alemania | `NULL` | `EUR` | `1900` | `2007-01-01` |
| `IT` | Italia | `NULL` | `EUR` | `2200` | `2013-10-01` |
| `NL` | Países Bajos | `NULL` | `EUR` | `2100` | `2012-10-01` |
| `IE` | Irlanda | `NULL` | `EUR` | `2300` | `2012-01-01` |
| `GB` | Reino Unido | `NULL` | `GBP` | `2000` | `2011-01-04` |
| `CH` | Suiza | `NULL` | `CHF` | `810` | `2024-01-01` |
| `JP` | Japón | `NULL` | `JPY` | `1000` | `2019-10-01` |

**Por qué esos diez y no otros**, que es donde está el criterio:

- **`ES` y `PT` llevan esquema fiscal** (los dos validadores del registro; `PT_NIF` entró en la Fase 3 como demostración de que añadir un país no toca endpoints). Los otros ocho van a `PassThroughValidator` (→ referencia §7.3): sigue siendo el caso mayoritario del mundo real, y el fallback queda ejercitado por el seed, no solo por un test.
- **`GB`, `CH` y `JP` no son decorado.** Dan tres divisas de presentación distintas de la de facturación, que es lo único que prueba de verdad el §4.1 (facturación ≠ visualización) en pantalla. **`JP` en particular ejercita `minor_unit = 0`**: el yen no tiene decimales y `Intl.NumberFormat` lo pinta sin ellos (→ referencia §4.4). Sin un país JPY en el seed, esa decisión queda como una frase en un documento.
- **`CH` a 8,1 %** aporta el único tipo con decimal del seed (`810` bp). Un seed donde todos los tipos son múltiplos de 100 no distingue un `rate_bp` correcto de un `rate_pct` con suerte.
- **Estados Unidos está excluido a propósito.** No tiene un tipo indirecto de ámbito federal: el *sales tax* es estatal y depende del nexo. Meterlo con `rate_bp = 0` sería escribir una mentira en la base de datos; meterlo "bien" es un modelo de jurisdicciones subestatales que no es este proyecto. Queda como recorte consciente (→ `03-proceso/recortes-conscientes.md`). USD sigue disponible como **divisa de visualización** — que es independiente del país, precisamente por el §4.1.

**Una fila histórica deliberada**, para que la regla de vigencia esté ejercitada por datos reales y no solo por fixtures:

| `country` | `vigente_desde` | `rate_bp` |
|---|---|---|
| `ES` | `2010-07-01` | `1800` |
| `ES` | `2012-09-01` | `2100` |

España tiene dos filas: al arrancar debe resolverse **21 %**, nunca 18 %. El caso simétrico (una fila **futura** que no debe aplicarse) **no va en el seed** —sería un tipo inventado— y vive en los fixtures de test (→ referencia §15).

> **Nota de procedencia**: los tipos y fechas son datos de seed documentados para una herramienta de simulación interna, no una fuente fiscal. La v1 no tiene panel de impuestos: se actualizan por seed/redeploy, que es el supuesto declarado en referencia §6.1.

### 3.2 `plans` + `plan_tiers`

Catálogo de la propuesta de planes (segunda iteración: los tramos salen de los ajustes hechos en el panel de admin y adoptados como default). Un ancla conservada: **Plan Text v1** lleva los tramos **literales del enunciado** (10/8/5). El versionado visible en pantalla vive en **MAX** (v1 archivada con Fjord suscrito + v2 activa).

Dos patrones de precio conviven a propósito: Text y Tokio **bajan** el precio por unidad al crecer (descuento por volumen) y el resto lo **sube** (freemium). Varios planes usan el tramo `hasta 1` caro como **cuota de entrada** (Premium: 150 € el primer usuario): es la forma de expresar una cuota fija dentro de graduated sin implementar el modelo `flat` (→ referencia §5.3).

Todos `pricing_model = 'graduated'` y `currency = 'EUR'` salvo **Plan Almacenamiento (`USD`)** — un plan en dólares hace visible que la divisa de facturación es del plan (→ referencia §4.1) y que los sugeridos no cruzan divisas — y **Plan Tokio (`JPY`)** — el caso `minor_unit = 0` en pantalla: sus `unit_price_minor` son yenes **enteros**, no centésimas (→ referencia §4.4).

**Plan Text v1** — los tramos **literales del enunciado**. Es el caso que el evaluador va a probar: 15 usuarios → 140 € + IVA. Nébula está suscrita con `base_users: 15`.

| `metric` | `up_to` | `unit_price_minor` |
|---|---|---|
| `users` | 10 / 50 / `NULL` | `1000` / `800` / `500` |

**Plan Demo v2** — el freemium de entrada: los primeros usuarios, GB y llamadas gratis. Versión 2 **sin una v1 en el seed**, a propósito: el catálogo la define como segunda iteración y la v1 nunca llegó a publicarse; el versionado en pantalla lo demuestra MAX.

| `metric` | `up_to` | `unit_price_minor` |
|---|---|---|
| `users` | 2 / 10 / `NULL` | `0` / `400` / `1000` |
| `storage_gb` | 2 / `NULL` | `0` / `400` |
| `api_calls` | 200 / 1000 / `NULL` | `0` / `1` / `4` |

**Plan PRO v1** — para equipos en crecimiento:

| `metric` | `up_to` | `unit_price_minor` |
|---|---|---|
| `users` | 8 / 20 / `NULL` | `50` / `100` / `300` |
| `storage_gb` | 2 / 10 / `NULL` | `0` / `100` / `400` |
| `api_calls` | 500 / 5000 / `NULL` | `0` / `1` / `4` |

**Plan MAX v1 `(active = 0)`** — la versión vieja, archivada, sin cuota de entrada. **No es adorno**: `Fjord Systems AS` sigue apuntando aquí, y es lo único que hace visible **en pantalla** que un precio publicado es inmutable (→ referencia §5.5): su ficha dice "Mantiene su tarifa contratada" y simula sin el tramo `hasta 1` de la v2. Sin esta fila, el versionado solo existe en un test.

| `metric` | `up_to` | `unit_price_minor` |
|---|---|---|
| `users` | 20 / 40 / `NULL` | `20` / `50` / `100` |
| `storage_gb` | 16 / 32 / `NULL` | `0` / `100` / `200` |
| `api_calls` | 15000 / 50000 / `NULL` | `0` / `1` / `3` |

**Plan MAX v2** — el multi-métrica de referencia (Meridian está suscrita). El §5.2 (un plan es un conjunto de métricas, cada una con su tabla) es la abstracción central del diseño, y sin un plan así en el seed solo se demuestra en un test unitario, nunca en pantalla. El tramo `hasta 1 → 20 €` es la cuota de entrada; a partir del segundo usuario, céntimos.

| `metric` | `up_to` | `unit_price_minor` |
|---|---|---|
| `users` | 1 / 20 / 40 / `NULL` | `2000` / `20` / `50` / `100` |
| `storage_gb` | 12 / 32 / `NULL` | `0` / `100` / `200` |
| `api_calls` | 5000 / 50000 / `NULL` | `0` / `1` / `3` |

**Plan Premium v1** — la cuota de entrada más visible del catálogo: 150 € el primer usuario y el resto del bloque a 2 €. Llamadas API ilimitadas incluidas (tramo único a 0). La cuota fija **pura** («700 € aunque no haya consumo») sigue siendo inexpresable en graduated y es el hueco `flat` del Strategy (→ referencia §5.3).

| `metric` | `up_to` | `unit_price_minor` |
|---|---|---|
| `users` | 1 / 50 / `NULL` | `15000` / `200` / `10` |
| `storage_gb` | 50 / 256 / `NULL` | `10` / `80` / `200` |
| `api_calls` | `NULL` | `0` |

**Plan Almacenamiento v1 (`USD`)** — solo almacenamiento; no cobra por usuarios. El primer GB a 60 $ es la cuota de entrada; el resto del primer bloque a 0,50 $/GB.

| `metric` | `up_to` | `unit_price_minor` |
|---|---|---|
| `storage_gb` | 1 / 120 / `NULL` | `6000` / `50` / `200` |
| `api_calls` | 2000 / `NULL` | `0` / `4` |

**Plan Tokio v1 (`JPY`)** — tarifa por usuario en yenes, sin decimales: `1500` = 1.500 ¥, no 15,00. Sin este plan, la pieza más fina del diseño de divisas (§4.4) solo vive en tests.

| `metric` | `up_to` | `unit_price_minor` |
|---|---|---|
| `users` | 10 / 50 / `NULL` | `1500` / `1200` / `800` |

### 3.3 `customers` de demo

Sin clientes, el evaluador entra al dashboard y ve el estado vacío: el buscador, las cards y el historial —tres de las cuatro vistas obligatorias del enunciado— solo se pueden juzgar dando de alta datos a mano primero. Cinco filas lo arreglan.

| `company_name` | `fiscal_id` | `fiscal_id_type` | `country` | `plan` | valores base |
|---|---|---|---|---|---|
| Nébula Cloud S.L. | `B12345674` | `CIF` | `ES` | Text v1 | `base_users: 15` |
| Meridian Data Ltd. | `GB428291` | `unvalidated` | `GB` | MAX v2 | `base_users: 40`, `base_storage_gb: 750`, `base_api_calls: 120000` |
| Talleres Duero | `12345678Z` | `DNI` | `ES` | Almacenamiento v1 (USD) | — |
| Lusitânia Dados Lda. | `512345678` | `NIF` | `PT` | PRO v1 | — |
| Fjord Systems AS | `NO993110` | `unvalidated` | `DE` | MAX **v1 (archivada)** | — |

Cada uno cubre un caso que si no habría que provocar a mano:

- **`fiscal_id_type` no se declara en el seed: lo dice el validador.** Declararlo permitiría escribir `'DNI'` junto a un CIF y que nadie se enterase. `Nébula` se siembra además con el identificador **sin normalizar** (`"b-1234 5674"`) para que el seed recorra el mismo camino que el alta; se persiste `B12345674`.
- Los CIF son **sintéticos y con dígito de control correcto** (no son de empresas reales). `B12345674`: pares 2+4+6=12; impares duplicados 1,3,5,7 → 2,6,10,14 → 2+6+1+5=14; total 26 → control `(10 − 6) mod 10 = 4`. ✓
- **`Talleres Duero` lleva un DNI** entre tantos CIF: el validador español despacha por formato (→ §7.7), y así se ve. Además está suscrito al plan en **USD**: un cliente español facturado en dólares es lo que hace visible que la divisa de facturación es del plan, no del país (→ referencia §4.1).
- **`Lusitânia` es el segundo validador del registro visible desde el primer arranque**: su ficha enseña el chip «NIF validado» sin que ningún componente sepa que Portugal existe. El NIF es **sintético con control correcto**: `5,1,2,3,4,5,6,7` ponderados 9..2 suman 157; 157 mod 11 = 3; 11 − 3 = **8**. ✓ Se siembra sin normalizar (`"512 345 678"`), como Nébula.
- **`Meridian` y `Fjord` son `unvalidated`**: pasan por `PassThroughValidator`. `Meridian` aporta además una divisa de presentación ≠ EUR (GBP) desde el primer arranque.
- **`Fjord` apunta a la versión archivada** (→ §3.2).
- **`Nébula` y `Meridian` llevan valores base** para que la simulación parametrizada sea visible desde el primer arranque: Nébula el caso literal del enunciado (`base_users: 15` → el botón «parametrizada» precarga 15 usuarios = 169,40 €) y Meridian los tres campos sobre el plan multi-métrica. Los otros tres quedan a `NULL` a propósito: la ficha sin valores base (con el botón «parametrizada» oculto) también es una vista que hay que poder ver.
- **El seed no crea simulaciones.** El estado vacío del historial es una vista que hay que poder ver (→ `diseno-frontend.md`, ventana 3), y crear la primera simulación es justo el flujo que el evaluador va a recorrer.

**El seed es un camino de escritura y pasa por el mismo validador que `POST /customers`**: normaliza, resuelve el validador por el esquema del país y le pregunta el tipo. Un seed que introduce datos que el sistema rechazaría es una bomba de relojería, y así nadie tiene que recalcular a mano un dígito de control nunca más.

---

## 4. Chequeos de integridad del arranque

Los ejecuta el backend al abrir, antes de aceptar peticiones, y **fallan ruidosamente** (→ referencia §6.1, §7.3). No son tests: son código de producción, porque protegen de una deriva dato↔código que puede aparecer con cualquier seed futuro.

1. Todo `tax_id_scheme` no nulo de `countries` existe en el registro de validadores. → si no: abortar. Nunca degradar en silencio a pass-through.
2. Todo país de `countries` tiene un tipo vigente en `tax_rates` (`vigente_desde <= date('now')`). → si no: abortar. Es lo que sostiene que "cliente sin impuesto calculable" sea inexpresable.
3. Todo `display_currency` de `countries` y toda `currency` de `plans` existe en el enum `Currency`. → si no: abortar. Es el equivalente al `CHECK` que deliberadamente no está en el DDL (§2.1).

El resultado del chequeo 1 y 2 **es** la caché en memoria (`code → { name, scheme, display_currency, rate_bp }`): se construye una vez y, si se construye entera, el sistema está íntegro. No son dos recorridos, es uno.
