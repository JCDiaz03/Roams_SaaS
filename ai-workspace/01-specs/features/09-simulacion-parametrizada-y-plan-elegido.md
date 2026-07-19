# Spec — Valores base del cliente, simulación parametrizada y plan elegido

> **Capa SPEC de feature.** El porqué de negocio → `../../roams-roadmap_v2.md` §1. El contrato HTTP → `../contrato-api.md` §2.1, §2.2, §3.8. Las tablas → `../modelo-datos.md` §2.4. Decisiones → ADR 0011 y 0012 en `../../02-arquitectura/decisiones.md`.

---

## 1. Alcance

Tres piezas que comparten un objetivo: que una simulación arranque del **contexto real del cliente** en vez de en blanco.

1. **Valores base del cliente** (`base_users`, `base_storage_gb`, `base_api_calls`): su consumo habitual como atributo de la ficha, editable, opcional campo a campo.
2. **Plan elegido en la simulación**: el simulador puede cotizar con un plan activo distinto del contratado (what-if que, si se guarda, se guarda con ese plan), con sugerencias de planes más baratos calculadas en local.
3. **Historial que dice con qué plan se cotizó** (`plan_name`/`plan_version` desde el snapshot) y botón «Usar como base» que abre el simulador precargado con las entradas de una simulación guardada.

## 2. Invariantes que esta feature NO mueve

Se escriben porque cada pieza de esta spec roza uno:

- **El frontend sigue enviando entradas, jamás importes** (invariante 1). Un `plan_id` es una entrada: una referencia que el backend resuelve, valida y recalcula desde cero.
- **El `tax_rate_bp` es SIEMPRE el del país del cliente**, se cotice con el plan que se cotice. El impuesto lo determina el cliente, no el plan (→ referencia §4.2).
- **Una simulación guardada no se modifica nunca** (→ referencia §11.2). «Usar como base» **lee** sus entradas para crear otra; no existe ninguna mutación de simulación.
- **Los valores base no participan en ningún cálculo del backend**: son un preajuste de UI persistido en la ficha. El motor solo ve las cantidades que llegan en `POST /simulations`.

---

## 3. Valores base del cliente

### 3.1 El dato

Tres columnas `NULLABLE` en `customers` (→ `../modelo-datos.md` §2.4). `NULL` = "no registrado", y es un valor de primera clase: la UI lo pinta como "—" y la simulación parametrizada deja esa métrica en su valor libre.

**Por qué en el cliente y no derivados de la última simulación**: son un dato de la empresa ("tiene 40 empleados"), no un eco de lo último que alguien tecleó. Un cliente recién dado de alta puede tenerlos antes de su primera simulación; y el comercial los corrige cuando la empresa cambia, sin simular. Nota de futuro: si algún día existe el modelo compromiso+excedente (→ `../../03-proceso/recortes-conscientes.md` §2.9), la cantidad comprometida será un pariente de este dato — la columna ya estará donde debe.

### 3.2 Alta y edición

- `POST /customers` los acepta **opcionales** (topes = los de `POST /simulations`: son la misma magnitud física).
- **`PATCH /customers/{id}` acotado**: solo esos tres campos, `additionalProperties: false`, `minProperties: 1`, tipo `['integer','null']` (`null` borra). Contrato → `../contrato-api.md` §3.8.

**Por qué PATCH y no un `PUT /customers/{id}` general**: la edición de datos fiscales (nombre, `fiscal_id`, país) arrastra revalidación, unicidad y reglas que nadie ha pedido. Abrir la puerta entera para pasar tres enteros sería alcance gratis — y el `additionalProperties: false` convierte "la puerta sigue cerrada" en un `400` verificable por test, no en una intención.

### 3.3 La ficha en tres bloques

La card de cliente se reorganiza: (a) datos de empresa, (b) **valores base** con edición en línea (tres inputs numéricos, Guardar/Cancelar → PATCH → toast), (c) el callout de tarifa contratada cuando aplica. La botonera pasa a dos acciones:

- **«+ Nueva simulación parametrizada»** → `/clientes/:id/simular?base=1`. Visible **solo si algún base ≠ NULL** — parametrizar desde la nada no significa nada.
- **«+ Nueva simulación libre»** → `/clientes/:id/simular` (el botón de siempre, renombrado).

### 3.4 El simulador parametrizado

Misma ruta y misma pantalla; cambia la **inicialización** y una señal visual:

- Con `?base=1`, cada métrica con base arranca en su valor y muestra junto al input la referencia **«base: N»** (en negrita, estilo del sistema); las métricas sin base arrancan en el valor libre por defecto.
- **Precedencia de inicialización**: params explícitos (`?users=&storage_gb=&api_calls=`, → §5.3) > `?base=1` > defaults actuales. En URL, como el `?q=` del buscador: sobrevive a F5 y se puede compartir.
- **Si un valor inicial supera el `max` visual del slider** (p. ej. base 500 con slider hasta 200): el máximo del slider **se amplía a ese valor**; no se trunca. Truncar sería cambiar en silencio el dato que el comercial guardó. El tope real sigue siendo el del esquema del backend, que es el mismo que valida el PATCH.

---

## 4. Plan elegido en la simulación

### 4.1 `plan_id` opcional en `POST /simulations` (→ ADR 0011)

- **Ausente** → el plan del cliente, activo o archivado. El comportamiento de siempre, intacto: es el camino del 100 % de las simulaciones existentes.
- **Presente** → ese plan, con dos reglas: debe existir (`422 PLAN_NOT_FOUND`, `field: plan_id`) y debe estar **activo, salvo que sea el contratado del cliente** (`422 PLAN_ARCHIVED`). La excepción preserva exactamente lo que el guardián original protegía: la tarifa contratada de un cliente antiguo se puede seguir cotizando; la tarifa archivada de *otro* linaje, no — ya no se ofrece.

El snapshot no cambia: siempre capturó "el plan con el que se cotizó", y ahora ese plan puede ser el elegido. `plan_id` en la fila responde "¿con qué plan?" sin parsear JSON, igual que antes.

### 4.2 La barra del simulador

Entre las migas y la rejilla: **«Plan activo:»** + chip del plan en uso + botón de cambiar (desplegable con los planes **activos** de `GET /plans`) + **«Volver al contratado»** (visible solo con un plan distinto elegido).

- El chip cambia de tono cuando el plan en uso no es el contratado: el what-if tiene que verse, no inferirse.
- El preview local recalcula con `quote()` y los tramos del plan elegido — **misma función compartida**, cero implementación nueva. La divisa del resultado es la del plan en uso; el impuesto, el del país del cliente (→ §2).
- Cambiar de plan **invalida el sello**, igual que mover un slider: lo sellado es un número concreto de un plan concreto.
- Al guardar, el body lleva `plan_id` **solo si difiere del contratado**: el caso por defecto sigue generando la petición de siempre.
- Si `GET /plans` falla, el simulador funciona como hasta hoy (sin selector ni sugeridos) con un aviso discreto: la feature nueva degrada, la vieja no.

### 4.3 Planes sugeridos

Bajo el resultado, si algún plan activo **de la misma divisa** sale más barato que el plan en uso para las cantidades actuales: *«Con {plan} saldría {total}»* + botón «Probar» que lo selecciona.

- Se calcula **en local** con el mismo `quote()` sobre los planes ya cargados: cero peticiones por arrastre, cero segunda implementación. Es la misma jugada que el preview (→ ADR 0003).
- **Solo misma divisa**: comparar un total EUR con uno JPY convertido sería colar un tipo de cambio en una comparación de negocio (invariante 3). Hoy todos los planes son EUR; la restricción es la que hace que mañana no mienta.
- Es una sugerencia de pantalla: no se persiste, no se loguea, no aparece en el papel.
- **Un plan solo se sugiere si factura TODO lo que el cliente está usando**: con 15 usuarios, uno solo-almacenamiento saldría «más barato» porque los ignora, no porque los cobre mejor. La regla por métrica: cantidad > 0 ⇒ el plan la factura. Un plan mono-métrica (solo usuarios) solo aparece con las otras dos cantidades a 0. Además, un plan que cotiza a 0 tampoco se sugiere. El filtro completo es `total > 0 ∧ total < total_actual ∧ ∀métrica (cantidad = 0 ∨ facturada)`, ordenado de menor a mayor total.

---

## 5. El historial dice su plan

### 5.1 `plan_name` y `plan_version` en la respuesta

Campos planos nuevos en el elemento de simulación (POST e historial, que comparten forma), leídos **del `pricing_snapshot`** — nunca del plan actual. Versionar un plan no cambia el nombre que muestra una simulación vieja: es la propiedad del snapshot extendida a su presentación. El `pricing_snapshot` sigue sin exponerse.

### 5.2 La card del historial

Chip `{plan_name} · v{plan_version}` junto a la fecha. Con el plan elegido en juego, "¿con qué tarifa era este número?" deja de tener una respuesta única por cliente, así que la card tiene que decirla.

### 5.3 «Usar como base»

Botón en la card: navega a `/clientes/:id/simular?users=…&storage_gb=…&api_calls=…&plan={plan_id}`. El simulador arranca con esas entradas; `plan` se preselecciona **solo si está activo o es el contratado** — si no, se ignora en silencio y queda el contratado (la simulación vieja sigue intacta y explicándose por su snapshot; lo que no se puede es cotizar *de nuevo* con una tarifa retirada, → §4.1).

### 5.4 El papel imprime el plan de la simulación

`PrintSheet` deja de leer `cliente.plan.name` y pasa a leer el plan de la **simulación sellada** (`plan_name`/`plan_version`). Con el plan elegido, lo anterior imprimiría la tarifa equivocada en el papel — el defecto exacto que la regla "solo se imprime la simulación sellada" existe para impedir.

### 5.5 Archivar simulaciones

Un cliente con decenas de simulaciones no debe enseñarlas todas a la vez. **Archivar** (`PATCH /simulations/{id}`, cuerpo acotado a `{ archived }`) saca la card del historial por defecto; una sección colapsada «N archivadas» al pie permite verlas y **recuperarlas**.

- **Convive con la inmutabilidad, no la contradice**: la regla del §11.2 protege los **números** (snapshot, entradas, importes). `archived` es estado de vista — decide si la card se enseña, no qué dice. El `additionalProperties: false` del PATCH hace la frontera verificable, y un test guardián comprueba que archivar no mueve ni un campo sellado.
- El historial acepta `?include_archived=true`; por defecto solo las vivas, y el `total` describe la colección pedida.
- El contador de la ficha («N presupuestos») cuenta las vivas.

---

## 6. Tests

**Valores base:**
- Alta con base → se devuelven; sin base → `null`; tope superado → `400`.
- PATCH parcial actualiza solo lo enviado; `null` borra; body vacío → `400` (`minProperties`); **`company_name` en el body → `400`** — el guardián de que la edición fiscal no se abrió; cliente inexistente → `404`.
- El detalle (`GET /customers/{id}`) expone los tres campos; el buscador no.
- Migración: una base con el DDL viejo gana las columnas al arrancar; una segunda pasada es inocua (→ ADR 0012).

**Plan elegido (sustituye al guardián «plan_id no se acepta»):**
- Sin `plan_id` → se deriva del cliente (el comportamiento de siempre, ahora como test explícito).
- `plan_id` de un activo ajeno → `201`, cotizado con **sus** tramos, `plan_id` devuelto el elegido, y `tax_rate_bp` el del país del cliente.
- `plan_id` archivado ajeno → `422 PLAN_ARCHIVED`.
- `plan_id` == contratado archivado (Fjord) → `201` con su tarifa.
- `plan_id` inexistente → `422 PLAN_NOT_FOUND`.
- El snapshot de una simulación con plan elegido captura **ese** plan.

**Historial:**
- `plan_name`/`plan_version` presentes en POST e historial; tras versionar el plan, la simulación vieja **sigue diciendo su versión** (extensión del test de inmutabilidad del snapshot).

**Preview/paridad:** la batería de paridad existente cubre ya `quote()` con cualesquiera tramos; no necesita casos nuevos por el plan elegido (mismos tramos, distinta procedencia).
