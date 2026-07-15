# Spec — Administración de planes (Fase 2)

> **Capa SPEC de feature.** El porqué de negocio → `../idea-referencia.md` §5.4, §5.5. El contrato HTTP → `../contrato-api.md` §4. Las tablas → `../modelo-datos.md` §2.3. Las pantallas → `../diseño-frontend.md` ventanas 6 y 7.
>
> **Fase 2**: solo se abre si el gate de Fase 1 está en verde (→ `roams-roadmap.md` regla 1). Si no hay tiempo, esta spec **es** el entregable: el diseño queda documentado y el recorte declarado.

---

## 1. Alcance

`POST /plans`, `PUT /plans/{id}`, `DELETE /plans/{id}`, la validación de plantilla y las dos pantallas de admin.

**No incluye** el motor genérico ni las columnas `version`/`active`/`currency`: existen desde Fase 1 porque son baratas y porque el snapshot y el versionado se diseñan juntos (→ `roams-roadmap.md` §4). Esta fase son **los paneles y los endpoints**.

---

## 2. La plantilla

El admin configura: métrica(s), tramos por métrica, cortes, precio por unidad y divisa de facturación (→ referencia §5.4).

- **Un bloque de tramos por métrica**, los tres opcionales, **mínimo uno relleno**.
- **Bloque vacío = esa métrica no se factura**: se sigue registrando en la simulación y aporta 0 (→ referencia §5.2). No es un caso especial en ningún sitio: es sencillamente no tener filas en `plan_tiers`.
- **La divisa es del plan, no de cada bloque.** Un plan con bloques en divisas distintas no tendría un total sumable.

**Los cortes se piden como "hasta cuántos usuarios"** (límite superior), no como "cantidad por tramo" (→ referencia §5.4). Dos motivos: es más difícil de romper —"hasta 10, hasta 50, en adelante" es una secuencia que el admin lee y verifica de un vistazo— y **es como funciona el acumulativo**: pedir cantidades obligaría al admin a hacer la suma mental (`10, 40, ∞`) que el sistema ya sabe hacer.

---

## 3. Validación de plantilla (backend, obligatoria)

**Es obligatoria en todo camino de escritura**, y eso incluye el seed. El motor **no valida sus entradas** y confía en este invariante (→ `01-motor-tramos-y-simulaciones.md` §4): si un plan incoherente entra en la base de datos, el motor produce basura silenciosa. Este validador es lo único que hay entre el admin y ese escenario.

### 3.1 Reglas

Códigos estables; viajan en `violations[].rule` (→ `../contrato-api.md` §4.1).

| `rule` | Regla | Por qué importa |
|---|---|---|
| `AT_LEAST_ONE_BLOCK` | Al menos un bloque relleno | Un plan que no factura nada cobra 0 a todo el mundo |
| `AT_LEAST_ONE_TIER` | Todo bloque presente tiene ≥ 1 tramo | Un bloque activado y vacío es un error del formulario, no "no factura" |
| `CUTS_NOT_INCREASING` | Los `up_to` de una métrica son **estrictamente crecientes** | Cortes `10, 10` o `50, 10` producen un tramo de capacidad 0 o negativa |
| `LAST_TIER_MUST_BE_OPEN` | El último tramo de cada métrica tiene `up_to = NULL` | Si no, **hay unidades sin precio** y el motor las cobra a 0 sin avisar |
| `OPEN_TIER_NOT_LAST` | Solo el **último** tramo puede tener `up_to = NULL` | Un `NULL` en medio hace inalcanzables los siguientes |
| `PRICE_NEGATIVE` | `unit_price_minor >= 0` | *(lo cubre ya el esquema JSON; la regla existe para el seed, que no pasa por Fastify)* |
| `CURRENCY_NOT_SUPPORTED` | `currency` ∈ enum `Currency` | La divisa es código, no dato (→ referencia §4.3) |
| `METRIC_NOT_SUPPORTED` | `metric` ∈ `users \| storage_gb \| api_calls` | *(idem: esquema + seed)* |

### 3.2 "Sin huecos ni solapes" es gratis, y merece explicarse

La referencia §5.4 pide cortes crecientes, **sin huecos ni solapes** y último tramo abierto. Parecen cuatro reglas; son dos, y no por descuido:

**Al representar los tramos solo con su límite superior, los huecos y los solapes son inexpresables.** Cada tramo empieza exactamente donde acaba el anterior — no hay dónde escribir un hueco. Si el modelo guardara `(from, to)` por tramo, `(1,10)` y `(20,50)` sería un hueco perfectamente representable, y `(1,10)` con `(5,50)` un solape; harían falta las dos validaciones y **seguirían pudiendo entrar por cualquier camino que se saltara el validador**.

Con `up_to` a secas, lo único que queda por validar es el **orden** (`CUTS_NOT_INCREASING`) y que el último cierre el infinito (`LAST_TIER_MUST_BE_OPEN`). Es la representación la que elimina dos clases enteras de error, no el validador. Es el mismo principio que el §14.1 de la referencia aplicado a un modelo de datos: **la mejor validación es la que no hace falta escribir**.

### 3.3 Se devuelven todas las violaciones, no la primera

`violations` es un array. El admin que ha escrito cuatro tramos mal no debe descubrirlos de uno en uno, guardando y fallando cuatro veces — y el diseño pide el error **sobre la fila afectada** (→ `../diseño-frontend.md` ventana 7), lo que exige saber cuáles fallan, en plural. Cada violación lleva `metric` e `index` para que la UI sepa dónde pintarla.

`message` es la traducción a lenguaje de comercial, y **es texto de producto** (→ `../contrato-api.md` §1.2). No dice `LAST_TIER_MUST_BE_OPEN`; dice: *"El último tramo de «Usuarios» debe quedar abierto: hoy los usuarios por encima de 50 no tienen precio."* La regla explica **la consecuencia**, no la regla.

### 3.4 El validador es una función pura

Vive en `features/plans/` y recibe la plantilla, devuelve `violations`. Sin IO, sin base de datos. Es lo que permite que **el seed lo use** (→ `../modelo-datos.md` §2.3) y que la vista previa en vivo de la Ventana 7 lo ejecute en el navegador si hace falta, sin duplicar ninguna regla.

**No baja a `@saas/pricing`**: el paquete compartido es el motor y el redondeo, y su valor es que lo importan los dos lados. La validación de plantilla la usa hoy un solo lado. Bajarla sería empezar a llenar el paquete compartido de "cosas comunes", que es como un paquete compartido se convierte en un vertedero. Si el día de mañana la Ventana 7 la necesita en el navegador, baja entonces — y esa será una razón, no una previsión.

---

## 4. Ciclo de vida

Contrato → `../contrato-api.md` §4. Ni edición libre ni borrado físico: es la práctica de industria (en Stripe un `Price` no permite cambiar su importe; creas uno nuevo y archivas el viejo).

| Acción | Comportamiento real |
|---|---|
| **Crear** (`POST`) | Inserta plan, `version = 1`, `active = 1` |
| **Editar** (`PUT`) | **Crea versión nueva** (`version + 1`, activa) y archiva la anterior. Los clientes existentes **siguen apuntando al `plan_id` antiguo** |
| **Borrar** (`DELETE`) | **Archiva** (`active = 0`). Nunca borrado físico |

**Por qué "el admin edita con conocimiento de causa" no se sostiene** (→ referencia §5.5): no es un problema de competencia del admin, es que **no puede ver las consecuencias desde su pantalla**. No sabe qué presupuestos se enviaron con ese tramo ni qué clientes están dados de alta con ese plan. Ninguna advertencia arregla información que no está en la pantalla.

### 4.1 El versionado en una transacción

`PUT` hace dos escrituras —insertar la versión nueva, archivar la vieja— y **van en una transacción**. Es el único sitio del backend donde hace falta (→ `01-motor-tramos-y-simulaciones.md` §3.1 explica por qué el `INSERT` de simulación no la necesita): una caída entre las dos dejaría **dos versiones activas del mismo plan**, y el selector del alta mostraría el plan duplicado sin que nada estuviera "roto" de forma detectable.

`better-sqlite3` es síncrono: `db.transaction(fn)` es suficiente y no hace falta nada más.

### 4.2 `version` es del nombre, no del `id`

`UNIQUE (name, version)` (→ `../modelo-datos.md` §2.3): el "Plan A v2" es una **fila nueva con `id` nuevo**. De ahí que `PUT /plans/{id}` devuelva `201` con un `id` distinto del de la URL (→ `../contrato-api.md` §4.2) — y ese desajuste aparente **es** la semántica de la operación, no un descuido del contrato.

Consecuencia: `PLAN_NAME_TAKEN` (`409`) se comprueba contra planes **activos**. Un nombre cuya única ocurrencia está archivada se puede reutilizar; si no, archivar un plan quemaría su nombre para siempre.

### 4.3 No se versiona desde una versión archivada

`PUT` sobre un plan con `active = 0` → `422 PLAN_ALREADY_ARCHIVED`. Permitirlo crearía una `v3` a partir de una `v1` mientras la `v2` sigue activa: dos ramas vivas del mismo plan y ninguna forma de saber cuál manda. El versionado es lineal a propósito.

---

## 5. Las pantallas

Detalle → `../diseño-frontend.md` ventanas 6 y 7. Lo que esta spec fija:

- **Nada de jerga de versionado** (→ referencia §5.5). El admin ve "Editar plan" y un aviso: *"Los clientes actuales mantendrán la tarifa anterior. Se creará una nueva versión."* Es **toda** la jerga que se permite, y aparece una vez.
- **El archivado se confirma en lenguaje llano**: *"El plan dejará de ofrecerse a clientes nuevos. Los clientes actuales no se ven afectados."* Son las dos reglas del §5.3 de `02-validacion-fiscal-y-alta-cliente.md`, dichas sin una palabra técnica.
- **Los planes archivados no aparecen al dar de alta clientes**, pero sí en el panel de admin (`?include_archived=true`) y en el histórico.
- **El gating por rol es UX, no seguridad** (→ `05-auth-mock.md` §5). Los endpoints de esta spec **no están protegidos** y es un riesgo declarado.

---

## 6. Tests

**Validación de plantilla** (→ referencia §15) — una función pura, así que son baratos y exhaustivos:
- Cortes no crecientes (`10, 10` y `50, 10`) → `CUTS_NOT_INCREASING`.
- Último tramo cerrado → `LAST_TIER_MUST_BE_OPEN`.
- `up_to: null` en medio → `OPEN_TIER_NOT_LAST`.
- Cero tramos en un bloque presente → `AT_LEAST_ONE_TIER`.
- Cero bloques → `AT_LEAST_ONE_BLOCK`.
- Divisa fuera del enum → `CURRENCY_NOT_SUPPORTED`.
- **Varias violaciones a la vez** → se devuelven **todas**, con su `metric` e `index`. Es el test que impide "optimizar" con un early return.
- **Plantilla válida multi-métrica** (el Plan C del seed) → sin violaciones.

**Versionado** (→ referencia §15, el test que da sentido a toda la feature):
- Editar un plan **no altera las simulaciones guardadas**: sus totales y su desglose siguen iguales (protege el snapshot).
- Editar un plan **no altera el `plan_id` de los clientes existentes**: siguen apuntando a la versión vieja y su detalle sigue trayendo los tramos viejos (protege el contrato presente).
- `PUT` → `201` con `version: 2`, `id` nuevo; el plan de la URL queda `active: 0`.
- `PUT` sobre archivado → `422 PLAN_ALREADY_ARCHIVED`.
- `DELETE` → `active: 0` y **la fila sigue existiendo** (`SELECT` directo). Es el test que caza un borrado físico.
- Nombre de un plan **archivado** reutilizable; nombre de uno **activo** → `409 PLAN_NAME_TAKEN`.

**Seed:**
- El seed pasa por el mismo validador que `POST /plans`. Un seed incoherente debe reventar el arranque, no sembrar un plan que el motor calculará mal en silencio.
