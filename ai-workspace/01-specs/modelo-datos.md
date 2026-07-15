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

**Nada de borrado físico** en ninguna tabla (→ referencia §5.5): por eso todas las FK son `ON DELETE RESTRICT`. Si alguna vez un `DELETE` falla por integridad referencial, es que alguien intentó algo que la regla ya prohibía.

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

- **`up_to` es inclusivo**: el tramo 1 del Plan A tiene `up_to = 10` y cubre los usuarios 1–10. El enunciado dice "0 a 10" y "11 a 50"; con límite superior inclusivo esos son `up_to = 10` y `up_to = 50`. Es también como se le pide al admin en pantalla ("hasta cuántos usuarios", → referencia §5.4).
- **`CHECK (pricing_model IN ('graduated'))` con un solo valor es deliberado**: el Strategy deja hueco a `volume`/`flat` (→ referencia §5.3), pero mientras no exista la implementación, el `CHECK` impide que una fila declare un modelo que nadie sabe calcular. Añadir el modelo = añadir la estrategia **y** ampliar el `CHECK`, en el mismo commit.
- **Lo que el DDL NO valida**: que los tramos de una métrica sean crecientes, sin huecos ni solapes, y que el último sea abierto. Eso es la validación de plantilla (→ referencia §5.4) y vive en el servicio, no en SQL — no hay `CHECK` capaz de mirar las filas hermanas. Consecuencia asumida: **la base de datos admite un plan incoherente si alguien inserta saltándose el servicio**; por eso el seed y el endpoint de admin son los dos únicos caminos de escritura, y ambos pasan por el mismo validador.

### 2.4 `customers` (→ referencia §7.4, §11.1)

```sql
CREATE TABLE customers (
  id            INTEGER PRIMARY KEY,
  company_name  TEXT NOT NULL,
  fiscal_id     TEXT NOT NULL UNIQUE,        -- forma NORMALIZADA (→ referencia §7.4)
  fiscal_id_type TEXT NOT NULL,              -- DNI | NIE | CIF | unvalidated
  email         TEXT NOT NULL,
  country       TEXT NOT NULL REFERENCES countries(code) ON DELETE RESTRICT,
  plan_id       INTEGER NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  created_at    TEXT NOT NULL,
  CHECK (fiscal_id_type IN ('DNI', 'NIE', 'CIF', 'unvalidated')),
  CHECK (fiscal_id = upper(fiscal_id)),
  CHECK (length(company_name) BETWEEN 1 AND 200),
  CHECK (length(fiscal_id) BETWEEN 1 AND 20),
  CHECK (length(email) <= 254)
) STRICT;

CREATE INDEX idx_customers_company_name ON customers(company_name COLLATE NOCASE);
```

- **`CHECK (fiscal_id = upper(fiscal_id))` es la red de la normalización**: si algún camino de escritura olvidara normalizar, la fila se rechaza en vez de colarse y romper el UNIQUE silenciosamente (`b12345674` y `B12345674` convivirían como dos empresas distintas). Los `length()` duplican a propósito los `maxLength` del esquema Fastify (→ referencia §7.5): el esquema protege al validador de entradas largas, el `CHECK` protege a la tabla de cualquier otro camino.
- **`fiscal_id` es UNIQUE global, no por país.** Es lo que fija la referencia §7.4 y su motivo (un duplicado accidental es mucho más probable que una colisión real). *Gotcha conocido y aceptado*: dos países podrían emitir la misma cadena; el día que ocurra, la migración es `UNIQUE (country, fiscal_id)` y el mensaje "esta empresa ya existe" pasa a ser por país. No se adelanta porque hoy costaría un índice más ancho para un caso que no se ha visto.
- **`UNIQUE` crea su propio índice**, así que `fiscal_id` no necesita un `CREATE INDEX` aparte (la referencia §11.1 pide índice en los dos campos del buscador; en `fiscal_id` ya lo da el UNIQUE).
- **Honestidad sobre el índice de `company_name`**: el buscador usa `LIKE '%term%'` y **un comodín inicial impide usar el índice** — SQLite hará scan completo. El índice se mantiene igual porque sirve al orden y a las búsquedas por prefijo, y porque el coste es nulo a esta escala (miles de filas). Lo que **no** se hace es fingir que el índice resuelve el `LIKE`: si la tabla creciera a millones, la respuesta es FTS5, no otro índice B-tree. → detalle en `features/03-buscador-y-detalle.md`.
- `fiscal_id_type` incluye `'unvalidated'` como valor de primera clase: es el resultado que devuelve `PassThroughValidator` (→ referencia §7.3), no un hueco.

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
  created_at      TEXT NOT NULL,
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

**Forma del `pricing_snapshot`** (JSON; es un dato opaco para SQL, pero su forma es contrato):

```json
{
  "plan": { "id": 1, "name": "Plan A", "version": 1, "currency": "EUR", "pricing_model": "graduated" },
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
| `PT` | Portugal | `NULL` | `EUR` | `2300` | `2011-01-01` |
| `FR` | Francia | `NULL` | `EUR` | `2000` | `2014-01-01` |
| `DE` | Alemania | `NULL` | `EUR` | `1900` | `2007-01-01` |
| `IT` | Italia | `NULL` | `EUR` | `2200` | `2013-10-01` |
| `NL` | Países Bajos | `NULL` | `EUR` | `2100` | `2012-10-01` |
| `IE` | Irlanda | `NULL` | `EUR` | `2300` | `2012-01-01` |
| `GB` | Reino Unido | `NULL` | `GBP` | `2000` | `2011-01-04` |
| `CH` | Suiza | `NULL` | `CHF` | `810` | `2024-01-01` |
| `JP` | Japón | `NULL` | `JPY` | `1000` | `2019-10-01` |

**Por qué esos diez y no otros**, que es donde está el criterio:

- **Solo `ES` lleva esquema fiscal.** Los otros nueve van a `PassThroughValidator` (→ referencia §7.3). Eso es el caso mayoritario del mundo real y hace que el fallback esté ejercitado por el seed, no solo por un test.
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

Nombres y tramos tomados del **prototipo de Claude Design** (`SaaS-O-Matic.dc.html`), que es la fuente del producto. El enunciado no nombra los planes: solo fija los tramos 10/8/5, que Ágora v2 respeta.

Todos: `currency = 'EUR'`, `pricing_model = 'graduated'`.

**Plan Ágora v1 `(active = 0)`** — la versión vieja, archivada:

| `metric` | `sort_order` | `up_to` | `unit_price_minor` |
|---|---|---|---|
| `users` | 0 | 10 | `1200` |
| `users` | 1 | `NULL` | `700` |

**No es adorno.** `Fjord Systems AS` sigue apuntando aquí, y es lo único que hace visible **en pantalla** que un precio publicado es inmutable (→ referencia §5.5): su ficha dice "Mantiene su tarifa contratada" y simula con 1200/700, no con los tramos de hoy. Sin esta fila, el versionado solo existe en un test.

**Plan Ágora v2 `(active = 1)`** — los tramos **literales del enunciado**. Es el caso que el evaluador va a probar: 15 usuarios → 140 € + IVA.

| `metric` | `sort_order` | `up_to` | `unit_price_minor` |
|---|---|---|---|
| `users` | 0 | 10 | `1000` |
| `users` | 1 | 50 | `800` |
| `users` | 2 | `NULL` | `500` |

**Plan Bitácora v1** — tramos por almacenamiento (→ referencia §5.1):

| `metric` | `sort_order` | `up_to` | `unit_price_minor` |
|---|---|---|---|
| `storage_gb` | 0 | 100 | `1300` |
| `storage_gb` | 1 | 500 | `700` |
| `storage_gb` | 2 | 2000 | `400` |
| `storage_gb` | 3 | `NULL` | `200` |

**Plan Cúspide v1** — el multi-métrica. El §5.2 (un plan es un conjunto de métricas, cada una con su tabla) es la abstracción central del diseño, y **sin un plan así en el seed solo se demuestra en un test unitario, nunca en pantalla**. Con él, el simulador enseña tres bloques sumando, y por contraste el callout "esta métrica no afecta al coste" aparece en Ágora y en Bitácora.

| `metric` | `sort_order` | `up_to` | `unit_price_minor` |
|---|---|---|---|
| `users` | 0 | 20 | `900` |
| `users` | 1 | `NULL` | `600` |
| `storage_gb` | 0 | 500 | `500` |
| `storage_gb` | 1 | `NULL` | `300` |
| `api_calls` | 0 | 50000 | `2` |
| `api_calls` | 1 | `NULL` | `1` |

### 3.3 `customers` de demo

Sin clientes, el evaluador entra al dashboard y ve el estado vacío: el buscador, las cards y el historial —tres de las cuatro vistas obligatorias del enunciado— solo se pueden juzgar dando de alta datos a mano primero. Cuatro filas lo arreglan.

| `company_name` | `fiscal_id` | `fiscal_id_type` | `country` | `plan` |
|---|---|---|---|---|
| Nébula Cloud S.L. | `B12345674` | `CIF` | `ES` | Ágora **v2** |
| Meridian Data Ltd. | `GB428291` | `unvalidated` | `GB` | Cúspide v1 |
| Talleres Duero | `12345678Z` | `DNI` | `ES` | Bitácora v1 |
| Fjord Systems AS | `NO993110` | `unvalidated` | `DE` | Ágora **v1 (archivada)** |

Cada uno cubre un caso que si no habría que provocar a mano:

- **`fiscal_id_type` no se declara en el seed: lo dice el validador.** Declararlo permitiría escribir `'DNI'` junto a un CIF y que nadie se enterase. `Nébula` se siembra además con el identificador **sin normalizar** (`"b-1234 5674"`) para que el seed recorra el mismo camino que el alta; se persiste `B12345674`.
- Los CIF son **sintéticos y con dígito de control correcto** (no son de empresas reales). `B12345674`: pares 2+4+6=12; impares duplicados 1,3,5,7 → 2,6,10,14 → 2+6+1+5=14; total 26 → control `(10 − 6) mod 10 = 4`. ✓
- **`Talleres Duero` lleva un DNI** entre tantos CIF: el validador español despacha por formato (→ §7.7), y así se ve.
- **`Meridian` y `Fjord` son `unvalidated`**: pasan por `PassThroughValidator`. `Meridian` aporta además una divisa de presentación ≠ EUR (GBP) desde el primer arranque.
- **`Fjord` apunta a la versión archivada** (→ §3.2).
- **El seed no crea simulaciones.** El estado vacío del historial es una vista que hay que poder ver (→ `diseño-frontend.md`, ventana 3), y crear la primera simulación es justo el flujo que el evaluador va a recorrer.

**El seed es un camino de escritura y pasa por el mismo validador que `POST /customers`**: normaliza, resuelve el validador por el esquema del país y le pregunta el tipo. Un seed que introduce datos que el sistema rechazaría es una bomba de relojería, y así nadie tiene que recalcular a mano un dígito de control nunca más.

---

## 4. Chequeos de integridad del arranque

Los ejecuta el backend al abrir, antes de aceptar peticiones, y **fallan ruidosamente** (→ referencia §6.1, §7.3). No son tests: son código de producción, porque protegen de una deriva dato↔código que puede aparecer con cualquier seed futuro.

1. Todo `tax_id_scheme` no nulo de `countries` existe en el registro de validadores. → si no: abortar. Nunca degradar en silencio a pass-through.
2. Todo país de `countries` tiene un tipo vigente en `tax_rates` (`vigente_desde <= date('now')`). → si no: abortar. Es lo que sostiene que "cliente sin impuesto calculable" sea inexpresable.
3. Todo `display_currency` de `countries` y toda `currency` de `plans` existe en el enum `Currency`. → si no: abortar. Es el equivalente al `CHECK` que deliberadamente no está en el DDL (§2.1).

El resultado del chequeo 1 y 2 **es** la caché en memoria (`code → { name, scheme, display_currency, rate_bp }`): se construye una vez y, si se construye entera, el sistema está íntegro. No son dos recorridos, es uno.
