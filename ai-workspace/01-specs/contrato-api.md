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
    "message": "El control del identificador no corresponde. Revísalo.",
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

  **Gotcha de Fastify, y no es menor**: `additionalProperties: false` **por sí solo no da un `400`**. Fastify configura Ajv con `removeAdditional: true` por defecto, y con eso **elimina el campo sobrante en silencio** y sigue adelante — un `total_minor` en el cuerpo de `POST /simulations` se ignoraría calladamente y el invariante 1 dejaría de ser verificable. Hace falta `ajv.customOptions.removeAdditional = false` en la construcción del servidor. Hay un test que lo fija.
- **`maxLength` en todos los campos de texto** (→ referencia §7.5). Los valores son los de `modelo-datos.md` §2.4 y se duplican a propósito en el `CHECK` de la tabla.
- **Límite de cuerpo de petición en Fastify**: `bodyLimit` global. Ninguna ruta acepta cuerpos grandes; no hay subida de ficheros.
- **`Content-Type: application/json`** en todo. No hay `multipart` ni formularios URL-encoded.

### 1.6 Autenticación

**Toda ruta de este contrato exige sesión viva, salvo `POST /auth/login` y `POST /auth/logout`** (→ `features/07-autenticacion.md`). El logout es público con motivo: salir tiene que funcionar precisamente cuando la sesión ya murió sola (caducidad, reinicio); si exigiera sesión, el 401 impediría expirar la cookie muerta del navegador. La sesión viaja en una cookie `HttpOnly` + `SameSite=Strict` que el navegador gestiona solo; sin ella, cualquier endpoint devuelve `401 AUTH_REQUIRED`. Las rutas de administración (`POST/PUT/DELETE /plans`, y `GET /plans?include_archived=true`) exigen además rol `admin` → `403 AUTH_FORBIDDEN`.

La **verificación de credenciales** sigue detrás del puerto `IdentityProvider` con la implementación de demostración del enunciado (cualquier usuario + `1111`, `ADMIN` → admin): cuando se conozca el sistema de identidad de la empresa, cambia esa implementación, **no este contrato**.

#### `POST /auth/login` — la única ruta pública

```
{ "usuario": string(1..60), "password": string(1..100) }
  -> 200 { "nombre": string, "rol": "admin" | "sales" }  + Set-Cookie: sid=...
  -> 401 AUTH_INVALID_CREDENTIALS   (mensaje ÚNICO: no revela si falló usuario o contraseña)
  -> 429 AUTH_RATE_LIMITED          (~10 intentos por IP y minuto)
```

#### `GET /auth/session` — rehidratación tras F5

```
  -> 200 { "nombre", "rol" }   con sesión viva
  -> 401 AUTH_REQUIRED         sin sesión: el frontend lo lee como "no hay nadie", no como error
```

#### `POST /auth/logout`

```
  -> 204   borra la sesión del servidor (revocación inmediata) y expira la cookie
```

---

## 2. Endpoints requeridos por el enunciado

### 2.1 `POST /customers` — alta de cliente

→ spec: `features/02-validacion-fiscal-y-alta-cliente.md`

**Petición**

```json
{
  "company_name": "Nébula Cloud S.L.",
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
| `base_users` | integer | `minimum: 0`, `maximum: 1000000`, **opcional** |
| `base_storage_gb` | integer | `minimum: 0`, `maximum: 10000000`, **opcional** |
| `base_api_calls` | integer | `minimum: 0`, `maximum: 1000000000`, **opcional** |

Los `base_*` son los **valores base de consumo** del cliente (→ `features/09-simulacion-parametrizada-y-plan-elegido.md` §3): un preajuste de la simulación parametrizada, no una entrada de cálculo. Sus topes son los de `POST /simulations` — misma magnitud física, misma cota. Se editan después vía `PATCH /customers/{id}` (§3.8).

`fiscal_id` se acepta **tal y como lo teclea el humano** (con espacios, guiones, minúsculas): la normalización es responsabilidad del servidor (→ referencia §7.4), no del formulario. Un contrato que exigiera la forma normalizada estaría delegando la regla al cliente y obligaría a reimplementarla allí.

**Respuesta `201`**

```json
{
  "id": 1,
  "company_name": "Nébula Cloud S.L.",
  "fiscal_id": "B12345674",
  "fiscal_id_type": "CIF",
  "email": "compras@nebula.example",
  "country": "ES",
  "plan_id": 1,
  "base_users": 15,
  "base_storage_gb": null,
  "base_api_calls": null,
  "created_at": "2026-07-15T10:30:00Z"
}
```

Los `base_*` no enviados vuelven como `null` — "no registrado" es un valor de primera clase, no una ausencia.

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

`FISCAL_ID_DUPLICATE` devuelve además el cliente existente, porque el diseño pide enlazar a su ficha (→ `diseno-frontend.md`, ventana 5: *"Esta empresa ya existe"* con enlace):

```json
{
  "error": {
    "code": "FISCAL_ID_DUPLICATE",
    "message": "Ya hay una empresa dada de alta con este identificador fiscal.",
    "field": "fiscal_id",
    "existing_customer": { "id": 1, "company_name": "Nébula Cloud S.L." }
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
| `plan_id` | integer | `minimum: 1`, **opcional** (→ ADR 0011) |

**`plan_id` ausente** → se cotiza con el plan del cliente, activo o archivado: el comportamiento de siempre. **Presente** → se cotiza con ese plan, con dos reglas: debe existir y debe estar **activo salvo que sea el contratado del cliente**. La excepción preserva lo que la regla original («el plan_id no se acepta») protegía: la tarifa contratada de un cliente antiguo se sigue cotizando; una tarifa archivada *ajena* — retirada del mercado — no. El `tax_rate_bp` es siempre el del país del cliente, se cotice con el plan que se cotice.

Los `maximum` son topes anti-DoS con la misma lógica que `maxLength` (→ referencia §7.5): sin ellos, `active_users: 1e15` es una petición válida que el motor recorrería. Son deliberadamente holgados: no son reglas de negocio, son el borde de lo físicamente sensato.

**Respuesta `201`**

```json
{
  "id": 7,
  "customer_id": 1,
  "plan_id": 1,
  "plan_name": "Plan Text",
  "plan_version": 1,
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
  "created_by": "María",
  "created_at": "2026-07-15T10:35:00Z"
}
```

Ese es el caso literal del enunciado: 15 usuarios → `10×1000 + 5×800 = 14000` minor = **140 €**, más 21 % = 169,40 €.

- **`breakdown` no se persiste**: es una proyección del cálculo, derivable del `pricing_snapshot` y las entradas. Se devuelve porque la pantalla lo exige ("10 usuarios × 10 € + 5 × 8 €" → referencia §13) y porque el desglose que enseña el servidor debe ser **el del número que el servidor calculó**, no una reconstrucción del cliente.
- **`billed: false` con `subtotal_minor: 0`** es el contrato de "métrica que este plan no factura" (→ referencia §5.2). La métrica **aparece igual**: es lo que permite a la UI atenuar la tarjeta en vez de ocultarla, sin ningún `if` sobre el plan en el cliente.
- **`plan_name` y `plan_version` salen del `pricing_snapshot`**, nunca del plan actual: versionar un plan no cambia el nombre que declara una simulación vieja. Van planos (no un objeto `plan{}`) porque `plan_id` ya vive plano en la raíz y anidar duplicaría el id.
- **`pricing_snapshot` no se devuelve.** Es interno: sirve para explicar el pasado, y lo que la pantalla necesita explicar ya está en `breakdown`. Exponerlo sería filtrar una estructura de persistencia al contrato.
- **`created_by` es el nombre de la sesión que hizo el POST**, puesto por el servidor (nunca un campo del cuerpo, invariante 1). Es el emisor que declara el presupuesto impreso, aunque la hoja la abra otro comercial. `null` = simulación anterior a la columna: el papel omite al emisor en vez de inventarlo.

**Errores**

| Código HTTP | `code` | `field` | Cuándo |
|---|---|---|---|
| `400` | `VALIDATION_ERROR` | — | Forma del cuerpo |
| `404` | `CUSTOMER_NOT_FOUND` | — | El cliente no existe |
| `422` | `PLAN_NOT_FOUND` | `plan_id` | El `plan_id` del cuerpo no existe |
| `422` | `PLAN_ARCHIVED` | `plan_id` | El `plan_id` del cuerpo está archivado **y no es el contratado del cliente** |

Sin `plan_id` en el cuerpo **no existe el caso "plan archivado"**: un cliente con plan archivado debe poder simular con su tarifa contratada (→ referencia §5.5, el versionado protege el contrato presente). El `422 PLAN_ARCHIVED` solo aparece al elegir explícitamente una tarifa retirada ajena.

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

**`search` ausente o vacío no es un error**: devuelve los clientes más recientes, que es el estado inicial del dashboard (→ `diseno-frontend.md`, ventana 2). Un `400` aquí obligaría al frontend a no llamar hasta tener texto, y el estado inicial dejaría de existir.

**Respuesta `200`**

```json
{
  "customers": [
    {
      "id": 1,
      "company_name": "Nébula Cloud S.L.",
      "fiscal_id": "B12345674",
      "fiscal_id_type": "CIF",
      "country": "ES",
      "plan": { "id": 1, "name": "Plan Text", "version": 1 },
      "simulation_count": 3
    }
  ],
  "total": 1
}
```

Sin resultados → `200` con `customers: []` y `total: 0`. **Vacío no es error** y por eso no es un `404`: son dos pantallas distintas (→ referencia §13.1).

**`total` es el tamaño de la COLECCIÓN que coincide, no el de la página devuelta** (un `COUNT` sin el `LIMIT`): con 300 coincidencias y `limit=20`, `customers` trae 20 y `total` dice 300. La misma regla aplica al historial de simulaciones (§3.4). Un campo llamado `total` que devolviera el tamaño de la página sería un contador mintiendo con nombre de verdad.

`simulation_count` va aquí porque la card del buscador lo muestra y evita N+1 peticiones desde el cliente.

### 3.3 `GET /customers/{id}`

→ spec: `features/03-buscador-y-detalle.md`

**Es la petición que alimenta el preview local** (→ referencia §10): debe traer en **una sola llamada** todo lo que el motor necesita en el navegador.

**Respuesta `200`**

```json
{
  "id": 1,
  "company_name": "Nébula Cloud S.L.",
  "fiscal_id": "B12345674",
  "fiscal_id_type": "CIF",
  "email": "compras@nebula.example",
  "country": { "code": "ES", "name": "España", "display_currency": "EUR" },
  "tax_rate_bp": 2100,
  "base_users": 15,
  "base_storage_gb": null,
  "base_api_calls": null,
  "plan": {
    "id": 1,
    "name": "Plan Text",
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
- **Los `base_*` viajan en el detalle y NO en el listado** (`GET /customers?search=`): los necesitan la ficha y el simulador parametrizado; la card del buscador no pinta ninguno, y el listado se mantiene ligero a propósito.

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

Por defecto solo planes **activos** (alimenta el selector del alta). `?include_archived=true` los devuelve todos, para el panel de administración, y **exige rol admin de verdad** (`403 AUTH_FORBIDDEN` → §1.6). Es un parámetro y no un endpoint aparte porque el recurso es el mismo: lo que cambia con el rol es cuánto se ve de él.

**Respuesta `200`**

```json
{
  "plans": [
    {
      "id": 1, "name": "Plan Text", "version": 1, "description": "…",
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

### 3.7 `GET /plans/{id}`

→ spec: `features/08-catalogo-de-planes-visible.md`

Detalle de un plan con sus tramos. Sesión obligatoria, **sin rol admin**, y devuelve el plan **aunque esté archivado**: un comercial ya ve planes archivados enteros embebidos en la ficha de sus clientes (§3.3); lo que exige admin es el *listado* de archivados (§3.5), que es inventario de administración — un dato distinto de un plan concreto cuyo id ya conoces.

**Respuesta `200`**: misma forma que el elemento de `GET /plans`.

| Código HTTP | `code` |
|---|---|
| `404` | `PLAN_NOT_FOUND` |

### 3.8 `PATCH /customers/{id}` — valores base

→ spec: `features/09-simulacion-parametrizada-y-plan-elegido.md` §3

**Acotado a los tres valores base.** No es una edición de cliente: los datos fiscales (nombre, `fiscal_id`, país, email, plan) siguen sin poderse tocar por la API, y el `additionalProperties: false` lo hace verificable — `company_name` en este cuerpo es un `400`, no un campo ignorado.

**Petición** — los tres opcionales, al menos uno (`minProperties: 1`); `null` borra el valor:

```json
{ "base_users": 40, "base_api_calls": null }
```

| Campo | Tipo | Restricciones |
|---|---|---|
| `base_users` | integer \| null | `minimum: 0`, `maximum: 1000000` |
| `base_storage_gb` | integer \| null | `minimum: 0`, `maximum: 10000000` |
| `base_api_calls` | integer \| null | `minimum: 0`, `maximum: 1000000000` |

**Respuesta `200`**: el cliente actualizado, misma forma que la respuesta de `POST /customers`.

| Código HTTP | `code` |
|---|---|
| `400` | `VALIDATION_ERROR` |
| `404` | `CUSTOMER_NOT_FOUND` |

### 3.9 `PATCH /simulations/{id}` — archivar una simulación

→ spec: `features/09-simulacion-parametrizada-y-plan-elegido.md` §5.5

**Acotado a `archived`**, lo ÚNICO mutable de una simulación guardada. La inmutabilidad del §11.2 es de los **números**: el snapshot, las entradas y los importes sellados no se tocan jamás — archivar es estado de vista (fuera del historial por defecto). El `additionalProperties: false` hace la frontera verificable: un `total_minor` en este cuerpo es un `400`.

```json
{ "archived": true }
```

**Respuesta `200`**: la simulación, misma forma que el elemento del historial (con su `archived`).

| Código HTTP | `code` |
|---|---|
| `400` | `VALIDATION_ERROR` |
| `404` | `SIMULATION_NOT_FOUND` |

El historial (§3.4) acepta **`?include_archived=true`**; por defecto solo devuelve las vivas, y su `total` describe la colección pedida.

---

## 4. Endpoints de administración (Fase 2)

→ spec: `features/06-admin-planes.md`. Exigen rol admin **de verdad** en el backend: `403 AUTH_FORBIDDEN` sin él (→ §1.6).

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

`PLAN_TEMPLATE_INVALID` **detalla qué tramo falla**, porque el diseño exige el error sobre la fila afectada (→ `diseno-frontend.md`, ventana 7):

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
{ "id": 9, "name": "Plan Text", "version": 2, "active": true, "…": "…" }
```

`Location: /api/plans/9`. El plan `{id}` de la URL queda con `active = 0` y **los clientes existentes siguen apuntando a él**.

| Código HTTP | `code` |
|---|---|
| `404` | `PLAN_NOT_FOUND` |
| `422` | `PLAN_TEMPLATE_INVALID` |
| `422` | `PLAN_ALREADY_ARCHIVED` — no se versiona desde una versión ya archivada |

### 4.3 `DELETE /plans/{id}` — archivar (o eliminar el jamás usado)

Pone `active = 0`... salvo el plan con **cero clientes y cero simulaciones** que lo referencien, que se elimina físicamente (→ ADR 0013): el plan que un admin creó por error no tiene nada que el archivado proteja. **La condición la decide el servidor**, nunca la pantalla.

**Respuesta `200`** con el plan + **`removed`**: `true` = eliminado de verdad; `false` = archivado. No `204`: la UI actualiza el badge (o quita la fila) con lo devuelto, sin una segunda petición.

| Código HTTP | `code` |
|---|---|
| `404` | `PLAN_NOT_FOUND` |
| `422` | `PLAN_ALREADY_ARCHIVED` — solo para el plan **usado** ya archivado; el archivado sin uso se elimina |

**Que `DELETE` archive y no borre es una desviación consciente de la semántica HTTP**, y es la correcta aquí: el verbo describe la intención del admin ("quitar este plan de circulación") y el sistema la cumple de la única forma que no rompe integridad referencial ni presupuestos ya enviados. La alternativa honesta sería `POST /plans/{id}/archive`; se descarta porque el recurso **sí** desaparece desde el punto de vista del consumidor (deja de listarse), y `DELETE` es lo que cualquiera espera teclear. El README lo declara.

---

## 5. Catálogo de códigos de error

Único listado; cualquier `code` nuevo se añade aquí primero.

| `code` | HTTP | Significado |
|---|---|---|
| `VALIDATION_ERROR` | 400 | El cuerpo no respeta el esquema declarado |
| `MALFORMED_REQUEST` | 400 / 413 / 415 | La petición no se pudo ni leer: JSON roto, cuerpo mayor que el `bodyLimit` o Content-Type que no es JSON. Distinto de `VALIDATION_ERROR`: aquí ni siquiera hay cuerpo que validar |
| `AUTH_REQUIRED` | 401 | Sin sesión viva (toda ruta salvo login y logout la exige, §1.6) |
| `AUTH_INVALID_CREDENTIALS` | 401 | El login falló. Mensaje único: no revela qué campo |
| `AUTH_FORBIDDEN` | 403 | La sesión no tiene el rol que la ruta exige, o la mutación llega declarada cross-site (`Sec-Fetch-Site`) |
| `AUTH_RATE_LIMITED` | 429 | Demasiados intentos de login desde la misma IP |
| `FISCAL_ID_INVALID` | 422 | El validador del país rechaza el identificador |
| `FISCAL_ID_DUPLICATE` | 409 | Ya existe un cliente con ese `fiscal_id` normalizado |
| `COUNTRY_NOT_SUPPORTED` | 422 | El país no tiene fila en `countries` |
| `CUSTOMER_NOT_FOUND` | 404 | — |
| `SIMULATION_NOT_FOUND` | 404 | — |
| `PLAN_NOT_FOUND` | 404 / 422 | 404 si es el recurso de la URL; 422 si es una referencia dentro del cuerpo |
| `PLAN_ARCHIVED` | 422 | No se puede dar de alta un cliente en un plan archivado, ni cotizar con un plan archivado que no sea el contratado del cliente (§2.2) |
| `PLAN_ALREADY_ARCHIVED` | 422 | No se puede archivar ni versionar lo ya archivado |
| `PLAN_NAME_TAKEN` | 409 | Ya hay un plan activo con ese nombre |
| `PLAN_TEMPLATE_INVALID` | 422 | La plantilla de tramos es incoherente (lleva `violations`) |
| `RATES_UNAVAILABLE` | 503 | Sin tipos de cambio y sin caché que servir |
| `INTERNAL_ERROR` | 500 | Fallo no contemplado. Mensaje genérico, detalle solo en el log |

**`PLAN_NOT_FOUND` con dos códigos HTTP no es una inconsistencia**: `PUT /plans/999` es un recurso inexistente (404); `POST /customers` con `plan_id: 999` es un **cuerpo** que referencia algo que no existe, y el recurso de esa URL (la colección de clientes) sí existe. Devolver 404 en el segundo caso haría creer al frontend que la ruta está mal.
