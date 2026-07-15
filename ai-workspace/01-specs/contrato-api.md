# Contrato de API

> **Mantenimiento — capa SPEC.**
>
> * Qué es: la forma exacta de cada petición y cada respuesta, con sus códigos de error. Es la única casa del contrato HTTP; se cierra **antes** de escribir la primera ruta.
> * El **porqué** de cada endpoint vive en `idea-referencia.md` §12; los topes de longitud en §7.5. Aquí se enlaza (`→ referencia §X`), no se repite.
> * Los nombres de columna y su semántica → `modelo-datos.md`. Este documento describe el **contrato**, que no siempre coincide con la tabla (§1.4).

---

## 1. Reglas transversales

### 1.1 Prefijo `/api` y versionado

**Toda ruta cuelga de `/api`.** Es lo que mantiene el proxy de dev de Vite en una sola regla y garantiza que ningún endpoint colisione con una ruta del SPA (→ referencia §14.1). En este documento las rutas se escriben sin el prefijo por brevedad (`POST /customers` = `POST /api/customers`).

**Sin `/v1` en la v1**: no hay ningún consumidor externo al que romper — el único cliente se despliega con el servidor. Añadir versión de API aquí es ceremonia; el día que haya un consumidor con su propio ciclo de vida, `/api/v2` convive con `/api` sin migrar nada.

### 1.2 Formato de error, único para todas las rutas

```json
{
  "error": {
    "code": "FISCAL_ID_INVALID",
    "message": "La letra de control no corresponde con los dígitos.",
    "field": "fiscal_id"
  }
}
```

- **`code`** es para la máquina: estable, en inglés, `SCREAMING_SNAKE`. El frontend decide con esto, **nunca parseando `message`**.
- **`message`** es para la persona: castellano, dirigido a un comercial no técnico, sin jerga y sin nombres internos. Es texto de producto, no de log.
- **`field`** es opcional y solo aparece cuando el error es atribuible a un campo del formulario. Existe porque el diseño exige el error **junto al campo**, no en un alert genérico (→ referencia §13.1): sin `field`, el frontend tendría que adivinar con un `switch` sobre `code`, y ese `switch` se desincroniza en cuanto se añade un campo.
- **El error handler de producción no devuelve stack traces jamás** (→ referencia §14.2). Un fallo no contemplado sale como `INTERNAL_ERROR` con mensaje genérico; el detalle va al log del servidor.

### 1.3 `400` vs `422`: la forma frente al significado

| Código | Cuándo | Quién lo emite |
|---|---|---|
| `400` | El cuerpo **no tiene la forma** declarada: falta un campo, sobra, tipo incorrecto, excede `maxLength`. | El esquema JSON de Fastify, **antes** de tocar el servicio |
| `422` | La forma es correcta pero el **contenido no es válido en el dominio**: el CIF no cuadra, el plan está archivado. | El servicio de la feature |

La línea es útil porque separa dos responsabilidades reales: un `400` significa "el cliente está mal programado" (el formulario nunca debería producirlo); un `422` significa "el usuario ha escrito algo que no vale" y **es un flujo normal de la aplicación**, no una anomalía. El frontend los trata distinto: un `422` se pinta junto al campo; un `400` es un bug y sale como error genérico.

### 1.4 Dinero y divisas en el contrato

- **Todo importe viaja como entero `_minor` acompañado de su código ISO.** Nunca un decimal, nunca un símbolo, nunca un importe preformateado (→ referencia §3, invariantes 5 y 6). Quien formatea es el frontend con `Intl.NumberFormat` (→ referencia §4.4).
- **Ninguna respuesta contiene un importe convertido.** La conversión es presentación y se hace en el cliente con lo que devuelve `GET /rates` (→ referencia §4.2, paso 5). Si un día apareciera `total_display_minor` en una respuesta, sería el invariante 3 roto por la puerta de atrás.
- **Ninguna petición acepta un importe.** El cliente envía entradas (usuarios, GB, llamadas); el servidor calcula (→ referencia §3, invariante 1). No es que se ignore un importe entrante: es que **no existe el campo**, y `additionalProperties: false` lo convierte en `400`.
- **`tax_rate_bp` viaja en puntos básicos** (`2100` = 21 %), igual que se persiste (→ `modelo-datos.md` §1).

### 1.5 Reglas de esquema comunes a todas las rutas

- **`additionalProperties: false` en todos los cuerpos.** Un campo que sobra es un `400`, no un campo que se ignora. Es lo que hace que "el frontend nunca envía importes" sea verificable.
- **`maxLength` en todos los campos de texto** (→ referencia §7.5). Los valores son los de `modelo-datos.md` §2.4 y se duplican a propósito en el `CHECK` de la tabla.
- **Límite de cuerpo de petición en Fastify**: `bodyLimit` global. Ninguna ruta acepta cuerpos grandes; no hay subida de ficheros.
- **`Content-Type: application/json`** en todo. No hay `multipart` ni formularios URL-encoded.

### 1.6 Autenticación

El middleware de auth existe desde el día 1 y **hoy no valida nada** (→ referencia §8.2, regla 3). Ninguna ruta de este contrato exige cabecera de autorización, y **los endpoints de admin no están protegidos**: es un riesgo aceptado y declarado (→ referencia §8.3), no un olvido. El contrato no inventa hoy la forma del token porque no se conoce el sistema de identidad de la empresa; cuando se conozca, cambia el middleware, no las rutas.

---

## 2. Endpoints requeridos por el enunciado

### 2.1 `POST /customers` — alta de cliente

→ spec: `features/02-validacion-fiscal-y-alta-cliente.md`

**Petición**

```json
{
  "company_name": "Nébula Sistemas SL",
  "fiscal_id": "b-1234 5674",
  "email": "compras@nebula.example",
  "country": "ES",
  "plan_id": 1
}
```

| Campo | Tipo | Restricciones |
|---|---|---|
| `company_name` | string | `minLength: 1`, `maxLength: 200`, requerido |
| `fiscal_id` | string | `minLength: 1`, `maxLength: 20`, requerido |
| `email` | string | `format: 'email'`, `maxLength: 254`, requerido |
| `country` | string | `pattern: '^[A-Z]{2}$'`, requerido |
| `plan_id` | integer | `minimum: 1`, requerido |

`fiscal_id` se acepta **tal y como lo teclea el humano** (con espacios, guiones, minúsculas): la normalización es responsabilidad del servidor (→ referencia §7.4), no del formulario. Un contrato que exigiera la forma normalizada estaría delegando la regla al cliente y obligaría a reimplementarla allí.

**Respuesta `201`**

```json
{
  "id": 1,
  "company_name": "Nébula Sistemas SL",
  "fiscal_id": "B12345674",
  "fiscal_id_type": "CIF",
  "email": "compras@nebula.example",
  "country": "ES",
  "plan_id": 1,
  "created_at": "2026-07-15T10:30:00Z"
}
```

Devuelve el `fiscal_id` **normalizado**: el cliente escribió `"b-1234 5674"` y debe ver en pantalla lo que quedó guardado. `Location: /api/customers/1`.

**Errores**

| Código HTTP | `code` | `field` | Cuándo |
|---|---|---|---|
| `400` | `VALIDATION_ERROR` | el que falle | Forma del cuerpo (§1.3) |
| `422` | `FISCAL_ID_INVALID` | `fiscal_id` | El validador del país rechaza el identificador |
| `409` | `FISCAL_ID_DUPLICATE` | `fiscal_id` | Ya existe un cliente con ese `fiscal_id` normalizado |
| `422` | `COUNTRY_NOT_SUPPORTED` | `country` | El país no tiene fila en `countries` (→ referencia §7.3) |
| `422` | `PLAN_NOT_FOUND` | `plan_id` | El plan no existe |
| `422` | `PLAN_ARCHIVED` | `plan_id` | El plan existe pero `active = 0` (→ referencia §5.5) |

`FISCAL_ID_DUPLICATE` devuelve además el cliente existente, porque el diseño pide enlazar a su ficha (→ `diseño-frontend.md`, ventana 5: *"Esta empresa ya existe"* con enlace):

```json
{
  "error": {
    "code": "FISCAL_ID_DUPLICATE",
    "message": "Ya hay una empresa dada de alta con este identificador fiscal.",
    "field": "fiscal_id",
    "existing_customer": { "id": 1, "company_name": "Nébula Sistemas SL" }
  }
}
```

Es la única extensión del sobre de error, y está justificada: sin ella el frontend necesitaría una segunda petición de búsqueda para pintar un enlace que el servidor ya tenía en la mano.

### 2.2 `POST /simulations` — registrar simulación

→ spec: `features/01-motor-tramos-y-simulaciones.md`

**Petición** — solo entradas, jamás importes (§1.4):

```json
{ "customer_id": 1, "active_users": 15, "storage_gb": 40, "api_calls": 250000 }
```

| Campo | Tipo | Restricciones |
|---|---|---|
| `customer_id` | integer | `minimum: 1`, requerido |
| `active_users` | integer | `minimum: 0`, `maximum: 1000000`, requerido |
| `storage_gb` | integer | `minimum: 0`, `maximum: 10000000`, requerido |
| `api_calls` | integer | `minimum: 0`, `maximum: 1000000000`, requerido |

**El `plan_id` no se envía**: se deriva del cliente. Si lo aceptara, el frontend podría cotizar a un cliente con un plan que no es el suyo — y el plan del cliente es precisamente lo que el versionado protege (→ referencia §5.5).

Los `maximum` son topes anti-DoS con la misma lógica que `maxLength` (→ referencia §7.5): sin ellos, `active_users: 1e15` es una petición válida que el motor recorrería. Son deliberadamente holgados: no son reglas de negocio, son el borde de lo físicamente sensato.

**Respuesta `201`**

```json
{
  "id": 7,
  "customer_id": 1,
  "plan_id": 1,
  "inputs": { "active_users": 15, "storage_gb": 40, "api_calls": 250000 },
  "currency": "EUR",
  "base_minor": 14000,
  "tax_rate_bp": 2100,
  "tax_minor": 2940,
  "total_minor": 16940,
  "breakdown": [
    {
      "metric": "users",
      "billed": true,
      "quantity": 15,
      "subtotal_minor": 14000,
      "tiers": [
        { "up_to": 10, "unit_price_minor": 1000, "units": 10, "amount_minor": 10000 },
        { "up_to": 50, "unit_price_minor": 800,  "units": 5,  "amount_minor": 4000 }
      ]
    },
    { "metric": "storage_gb", "billed": false, "quantity": 40,     "subtotal_minor": 0, "tiers": [] },
    { "metric": "api_calls",  "billed": false, "quantity": 250000, "subtotal_minor": 0, "tiers": [] }
  ],
  "created_at": "2026-07-15T10:35:00Z"
}
```

Ese es el caso literal del enunciado: 15 usuarios → `10×1000 + 5×800 = 14000` minor = **140 €**, más 21 % = 169,40 €.

- **`breakdown` no se persiste**: es una proyección del cálculo, derivable del `pricing_snapshot` y las entradas. Se devuelve porque la pantalla lo exige ("10 usuarios × 10 € + 5 × 8 €" → referencia §13) y porque el desglose que enseña el servidor debe ser **el del número que el servidor calculó**, no una reconstrucción del cliente.
- **`billed: false` con `subtotal_minor: 0`** es el contrato de "métrica que este plan no factura" (→ referencia §5.2). La métrica **aparece igual**: es lo que permite a la UI atenuar la tarjeta en vez de ocultarla, sin ningún `if` sobre el plan en el cliente.
- **`pricing_snapshot` no se devuelve.** Es interno: sirve para explicar el pasado, y lo que la pantalla necesita explicar ya está en `breakdown`. Exponerlo sería filtrar una estructura de persistencia al contrato.

**Errores**

| Código HTTP | `code` | Cuándo |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Forma del cuerpo |
| `404` | `CUSTOMER_NOT_FOUND` | El cliente no existe |

No hay error de "plan archivado" aquí: un cliente con plan archivado **debe poder simular** con su tarifa contratada (→ referencia §5.5, el versionado protege el contrato presente). Es exactamente el caso que un `PLAN_ARCHIVED` copiado del alta rompería en silencio.

---

## 3. Endpoints que necesita el frontend

### 3.1 `GET /countries`

→ spec: `features/02-validacion-fiscal-y-alta-cliente.md`

Sin parámetros. Sirve el desplegable del alta y el hint fiscal (→ referencia §7.2).

**Respuesta `200`**

```json
{
  "countries": [
    {
      "code": "ES",
      "name": "España",
      "display_currency": "EUR",
      "fiscal_id": { "validated": true, "hint": "DNI, NIE o CIF — se comprueba automáticamente" }
    },
    {
      "code": "GB",
      "name": "Reino Unido",
      "display_currency": "GBP",
      "fiscal_id": { "validated": false, "hint": "Identificador fiscal" }
    }
  ]
}
```

**El `hint` viaja ya resuelto por el validador del país.** Es la pieza que hace que el frontend **nunca compare un código de país**: pinta el texto que recibe. El conocimiento vive junto al algoritmo (→ referencia §7.2), tanto en el back como en el front. Si este campo no existiera, el `if (país === 'ES')` que el diseño prohíbe en el backend reaparecería en el cliente.

`validated` es lo que distingue "se comprobará" de "se guarda tal cual", por si la UI quiere mostrar el check verde. Se sirve de la caché de arranque: **cero consultas a SQLite** (→ referencia §6.1).

### 3.2 `GET /customers?search=`

→ spec: `features/03-buscador-y-detalle.md`

| Parámetro | Tipo | Restricciones |
|---|---|---|
| `search` | string | `maxLength: 100`, opcional |
| `limit` | integer | `minimum: 1`, `maximum: 50`, por defecto `20` |

**`search` ausente o vacío no es un error**: devuelve los clientes más recientes, que es el estado inicial del dashboard (→ `diseño-frontend.md`, ventana 2). Un `400` aquí obligaría al frontend a no llamar hasta tener texto, y el estado inicial dejaría de existir.

**Respuesta `200`**

```json
{
  "customers": [
    {
      "id": 1,
      "company_name": "Nébula Sistemas SL",
      "fiscal_id": "B12345674",
      "fiscal_id_type": "CIF",
      "country": "ES",
      "plan": { "id": 1, "name": "Plan A", "version": 1 },
      "simulation_count": 3
    }
  ],
  "total": 1
}
```

Sin resultados → `200` con `customers: []` y `total: 0`. **Vacío no es error** y por eso no es un `404`: son dos pantallas distintas (→ referencia §13.1).

`simulation_count` va aquí porque la card del buscador lo muestra y evita N+1 peticiones desde el cliente.

### 3.3 `GET /customers/{id}`

→ spec: `features/03-buscador-y-detalle.md`

**Es la petición que alimenta el preview local** (→ referencia §10): debe traer en **una sola llamada** todo lo que el motor necesita en el navegador.

**Respuesta `200`**

```json
{
  "id": 1,
  "company_name": "Nébula Sistemas SL",
  "fiscal_id": "B12345674",
  "fiscal_id_type": "CIF",
  "email": "compras@nebula.example",
  "country": { "code": "ES", "name": "España", "display_currency": "EUR" },
  "tax_rate_bp": 2100,
  "plan": {
    "id": 1,
    "name": "Plan A",
    "version": 1,
    "description": "…",
    "currency": "EUR",
    "pricing_model": "graduated",
    "active": true,
    "tiers": [
      { "metric": "users", "up_to": 10,   "unit_price_minor": 1000, "sort_order": 0 },
      { "metric": "users", "up_to": 50,   "unit_price_minor": 800,  "sort_order": 1 },
      { "metric": "users", "up_to": null, "unit_price_minor": 500,  "sort_order": 2 }
    ]
  },
  "created_at": "2026-07-15T10:30:00Z"
}
```

- **El plan se embebe con sus tramos aunque esté archivado** (`active: false`). No es una excepción: es el caso normal de un cliente antiguo (→ referencia §5.5). La UI lo traduce a "Mantiene su tarifa contratada", sin jerga de versionado.
- **`tax_rate_bp` es del país del cliente**, resuelto de la caché. Sin él, el preview no puede pintar el impuesto y habría que pedirlo aparte.
- **`country` se expande a objeto** aquí (y es un string en el listado): el detalle necesita el nombre y la divisa de presentación para preseleccionar el selector (→ referencia §13); el listado solo pinta un chip.

| Código HTTP | `code` |
|---|---|
| `404` | `CUSTOMER_NOT_FOUND` |

### 3.4 `GET /customers/{id}/simulations`

→ spec: `features/03-buscador-y-detalle.md`

| Parámetro | Tipo | Restricciones |
|---|---|---|
| `limit` | integer | `minimum: 1`, `maximum: 100`, por defecto `20` |

**Respuesta `200`** — misma forma de elemento que la respuesta de `POST /simulations` (incluido `breakdown`, reconstruido desde el `pricing_snapshot` de cada fila, **no desde el plan actual**: es justo para lo que existe el snapshot → referencia §11.2), ordenadas por `created_at` descendente:

```json
{ "simulations": [ { "id": 7, "…": "…" } ], "total": 1 }
```

Que el elemento del historial y el del `POST` sean **el mismo tipo** es deliberado: la card del historial y la card recién guardada son el mismo componente, y una divergencia de forma aquí se paga en el frontend.

| Código HTTP | `code` |
|---|---|
| `404` | `CUSTOMER_NOT_FOUND` |

### 3.5 `GET /plans`

→ spec: `features/06-admin-planes.md`

| Parámetro | Tipo | Por defecto |
|---|---|---|
| `include_archived` | boolean | `false` |

Por defecto solo planes **activos** (alimenta el selector del alta). `?include_archived=true` los devuelve todos, para el panel de administración (→ referencia §12). Es un parámetro y no un endpoint aparte porque el gating por rol es **UX declarada, no seguridad** (→ referencia §8.3): un endpoint `/admin/plans` sin auth real solo daría la ilusión de protección.

**Respuesta `200`**

```json
{
  "plans": [
    {
      "id": 1, "name": "Plan A", "version": 1, "description": "…",
      "currency": "EUR", "pricing_model": "graduated", "active": true,
      "tiers": [ { "metric": "users", "up_to": 10, "unit_price_minor": 1000, "sort_order": 0 } ]
    }
  ]
}
```

### 3.6 `GET /rates`

→ spec: `features/04-tipos-de-cambio.md`

Proxy con caché de servidor sobre `open.er-api.com` (→ referencia §9).

**Respuesta `200`**

```json
{
  "base": "EUR",
  "rates": { "EUR": 1, "USD": 1.0842, "GBP": 0.8531, "CHF": 0.9412, "JPY": 168.35 },
  "as_of": "2026-07-15T00:02:11Z",
  "next_update": "2026-07-16T00:02:11Z",
  "stale": false
}
```

- **`rates` sí lleva decimales, y no contradice el invariante 5.** Un tipo de cambio **no es dinero**: es un factor de presentación que jamás entra en un importe persistido (→ referencia §3, invariante 3). El float vive solo en el paso 5 del orden de cálculo (→ referencia §4.2), que es pintar.
- **`stale: true`** significa que la API externa no respondió y se sirve el último tipo conocido. **Sigue siendo un `200`**, no un `503`: los datos son utilizables y la decisión de mostrarlos es de la UI, que pinta el badge ámbar "Tipos de cambio del {fecha}" con `as_of` (→ referencia §9, §13.1). Un `503` haría que el frontend descartara datos que sí valen para orientar.
- **Payload filtrado** a las divisas del enum `Currency` (→ referencia §9): la API devuelve ~160 y se usan unas pocas.

| Código HTTP | `code` | Cuándo |
|---|---|---|
| `503` | `RATES_UNAVAILABLE` | La API externa falla **y no hay ningún tipo cacheado** (primer arranque sin red) |

Ese `503` es el único caso sin salida: no hay número viejo que enseñar. La UI cae a EUR con aviso visible (→ referencia §13.1).

---

## 4. Endpoints de administración (Fase 2)

→ spec: `features/06-admin-planes.md`. Sin protección real (§1.6).

### 4.1 `POST /plans`

**Petición**

```json
{
  "name": "Plan Escalado",
  "description": "…",
  "currency": "EUR",
  "tiers": [
    { "metric": "users", "up_to": 25, "unit_price_minor": 900 },
    { "metric": "users", "up_to": null, "unit_price_minor": 600 }
  ]
}
```

| Campo | Tipo | Restricciones |
|---|---|---|
| `name` | string | `minLength: 1`, `maxLength: 100`, requerido |
| `description` | string | `maxLength: 500`, opcional |
| `currency` | string | `pattern: '^[A-Z]{3}$'`, requerido |
| `tiers` | array | `minItems: 1`, `maxItems: 30`, requerido |
| `tiers[].metric` | string | `enum: ['users','storage_gb','api_calls']` |
| `tiers[].up_to` | integer\|null | `minimum: 1` |
| `tiers[].unit_price_minor` | integer | `minimum: 0` |

**`sort_order` no se envía: lo deriva el servidor** ordenando cada métrica por `up_to` con el abierto (`null`) al final. Aceptarlo permitiría enviar un orden que contradice los cortes, y entonces habría dos fuentes de verdad para "cuál es el primer tramo".

**El `version` tampoco se envía**: siempre `1` en un plan nuevo (→ referencia §5.5).

**Respuesta `201`**: el plan creado, misma forma que el elemento de `GET /plans`.

**Errores**

| Código HTTP | `code` | Cuándo |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Forma del cuerpo |
| `422` | `PLAN_TEMPLATE_INVALID` | La plantilla es incoherente (→ referencia §5.4) |
| `409` | `PLAN_NAME_TAKEN` | Ya existe un plan activo con ese nombre |

`PLAN_TEMPLATE_INVALID` **detalla qué tramo falla**, porque el diseño exige el error sobre la fila afectada (→ `diseño-frontend.md`, ventana 7):

```json
{
  "error": {
    "code": "PLAN_TEMPLATE_INVALID",
    "message": "El último tramo de «Usuarios» debe quedar abierto: hoy los usuarios por encima de 50 no tienen precio.",
    "field": "tiers",
    "violations": [
      { "metric": "users", "index": 2, "rule": "LAST_TIER_MUST_BE_OPEN" }
    ]
  }
}
```

`rule` es el código estable; `message` es la traducción a lenguaje de comercial. Las reglas y sus códigos → `features/06-admin-planes.md`.

### 4.2 `PUT /plans/{id}` — "editar" = versionar

Mismo cuerpo que `POST /plans`. **No modifica el plan**: crea una versión nueva (`version + 1`, `active = 1`) y archiva la anterior (→ referencia §5.5).

**Respuesta `201`** (no `200`): la respuesta correcta a "se ha creado un recurso nuevo" — y aquí **eso es literalmente lo que ha pasado**. El `id` del cuerpo devuelto **no es el `id` de la URL**, y ese desajuste aparente es la propia semántica de la operación:

```json
{ "id": 9, "name": "Plan A", "version": 2, "active": true, "…": "…" }
```

`Location: /api/plans/9`. El plan `{id}` de la URL queda con `active = 0` y **los clientes existentes siguen apuntando a él**.

| Código HTTP | `code` |
|---|---|
| `404` | `PLAN_NOT_FOUND` |
| `422` | `PLAN_TEMPLATE_INVALID` |
| `422` | `PLAN_ALREADY_ARCHIVED` — no se versiona desde una versión ya archivada |

### 4.3 `DELETE /plans/{id}` — archivar

Pone `active = 0`. **Nunca borra** (→ referencia §5.5).

**Respuesta `200`** con el plan archivado. No `204`: la UI actualiza el badge de estado con lo devuelto, sin una segunda petición.

| Código HTTP | `code` |
|---|---|
| `404` | `PLAN_NOT_FOUND` |
| `422` | `PLAN_ALREADY_ARCHIVED` |

**Que `DELETE` archive y no borre es una desviación consciente de la semántica HTTP**, y es la correcta aquí: el verbo describe la intención del admin ("quitar este plan de circulación") y el sistema la cumple de la única forma que no rompe integridad referencial ni presupuestos ya enviados. La alternativa honesta sería `POST /plans/{id}/archive`; se descarta porque el recurso **sí** desaparece desde el punto de vista del consumidor (deja de listarse), y `DELETE` es lo que cualquiera espera teclear. El README lo declara.

---

## 5. Catálogo de códigos de error

Único listado; cualquier `code` nuevo se añade aquí primero.

| `code` | HTTP | Significado |
|---|---|---|
| `VALIDATION_ERROR` | 400 | El cuerpo no respeta el esquema declarado |
| `FISCAL_ID_INVALID` | 422 | El validador del país rechaza el identificador |
| `FISCAL_ID_DUPLICATE` | 409 | Ya existe un cliente con ese `fiscal_id` normalizado |
| `COUNTRY_NOT_SUPPORTED` | 422 | El país no tiene fila en `countries` |
| `CUSTOMER_NOT_FOUND` | 404 | — |
| `PLAN_NOT_FOUND` | 404 / 422 | 404 si es el recurso de la URL; 422 si es una referencia dentro del cuerpo |
| `PLAN_ARCHIVED` | 422 | No se puede dar de alta un cliente en un plan archivado |
| `PLAN_ALREADY_ARCHIVED` | 422 | No se puede archivar ni versionar lo ya archivado |
| `PLAN_NAME_TAKEN` | 409 | Ya hay un plan activo con ese nombre |
| `PLAN_TEMPLATE_INVALID` | 422 | La plantilla de tramos es incoherente (lleva `violations`) |
| `RATES_UNAVAILABLE` | 503 | Sin tipos de cambio y sin caché que servir |
| `INTERNAL_ERROR` | 500 | Fallo no contemplado. Mensaje genérico, detalle solo en el log |

**`PLAN_NOT_FOUND` con dos códigos HTTP no es una inconsistencia**: `PUT /plans/999` es un recurso inexistente (404); `POST /customers` con `plan_id: 999` es un **cuerpo** que referencia algo que no existe, y el recurso de esa URL (la colección de clientes) sí existe. Devolver 404 en el segundo caso haría creer al frontend que la ruta está mal.
