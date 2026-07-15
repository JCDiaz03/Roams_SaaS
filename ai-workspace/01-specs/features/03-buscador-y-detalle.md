# Spec — Buscador y detalle de cliente

> **Capa SPEC de feature.** El porqué de negocio → `../idea-referencia.md` §12, §10. El contrato HTTP → `../contrato-api.md` §3.2, §3.3, §3.4. Las tablas → `../modelo-datos.md` §2.4. Las pantallas → `../diseño-frontend.md` ventanas 2 y 3.

---

## 1. Alcance

`GET /customers?search=`, `GET /customers/{id}` y `GET /customers/{id}/simulations`, con sus tres pantallas. Son la mitad de las vistas obligatorias del enunciado (buscador, cards de detalle e historial).

---

## 2. `GET /customers?search=` — el buscador

### 2.1 La consulta

Busca por **nombre de empresa o identificador fiscal** (→ referencia §13), en una sola consulta:

```sql
SELECT ... FROM customers
WHERE company_name LIKE :patron ESCAPE '\'
   OR fiscal_id    LIKE :patron ESCAPE '\'
ORDER BY created_at DESC
LIMIT :limit;
```

Con `search` vacío o ausente, se omite el `WHERE` entero: devuelve los clientes más recientes, que es el estado inicial del dashboard.

### 2.2 El escape de `%` y `_`: el único cuidado que la parametrización no cubre

Las sentencias preparadas cierran la inyección SQL (→ referencia §14.2), pero **no** impiden que el contenido del parámetro se interprete como comodín. Si el comercial busca `50%`, `:patron = '%50%%'` y el `%` interior hace de comodín: la búsqueda devuelve cualquier cosa que empiece por `50`. No es un agujero de seguridad — es un buscador que miente.

```
escapar(t) = t.replace(/[\\%_]/g, c => '\\' + c)
patron     = '%' + escapar(termino) + '%'
```

Tres detalles que no son obvios y que un `replace` mal escrito se salta:

- **La barra invertida se escapa primero**, o `\` se convierte en `\\` y luego cada `\` nuevo vuelve a escaparse. El `[\\%_]` en un solo `replace` lo resuelve de una pasada; dos `replace` encadenados no.
- **`ESCAPE '\'` es obligatorio en la cláusula.** SQLite **no tiene carácter de escape por defecto** en `LIKE`: sin declararlo, la barra invertida es un carácter literal más y el escape no escapa nada. Es el error silencioso de esta feature: el código *parece* correcto y el `%` sigue siendo comodín.
- **`_` también es comodín** (un carácter cualquiera), y aparece en identificadores más de lo que parece. Se escapa igual que el `%`.

### 2.3 Sensibilidad a mayúsculas

`LIKE` en SQLite es **insensible a mayúsculas solo para ASCII** — `LIKE 'a%'` casa con `A`, pero `LIKE 'á%'` **no** casa con `Á`. Con nombres de empresa españoles (`Nébula`, `Cárpatos`) eso se nota el primer día.

Solución: **normalizar a mayúsculas los dos lados** de la comparación (`upper(company_name) LIKE upper(:patron)`), sabiendo que `upper()` de SQLite tampoco toca los acentuados. La búsqueda por `nébula` funciona; por `nebula` (sin tilde) no. **Es un límite aceptado y declarado**: quitar tildes requiere una tabla de transliteración o la extensión ICU, y el buscador es sobre datos que el propio comercial ha tecleado. La respuesta correcta a escala es FTS5 con `unicode61 remove_diacritics`, que es la misma respuesta que al rendimiento (§2.4) — y por eso las dos esperan al mismo día.

**El mismo problema aparece al ORDENAR, y ahí no se acepta.** La colación por defecto de SQLite es `BINARY`: ordena por bytes, así que `Plan Ágora` cae **después** de `Plan Bitácora` y `Plan Cúspide` (la `Á` es `0xC3`, la `B` es `0x42`). Un `ORDER BY name` en SQL da un orden que a un lector español le parece roto. Regla: **todo listado que se ordene por un texto visible se ordena en JS con `localeCompare(a, b, 'es')`**, no en SQL. Afecta a `GET /countries` y a `GET /plans`.

### 2.4 Rendimiento: la verdad sobre el índice

**`LIKE '%term%'` no usa el índice.** Un comodín inicial impide el descenso por un B-tree; SQLite hará *table scan*. El índice de `company_name` existe igualmente (→ `../modelo-datos.md` §2.4) porque sirve al orden y a las búsquedas por prefijo, y porque a esta escala —miles de filas, herramienta interna— el scan es submilisegundo.

Lo que **no** se hace es fingir lo contrario. Si la tabla creciera a millones, la respuesta es **FTS5**, no otro índice B-tree ni un `LIKE 'term%'` que rompería la búsqueda por infijo que el comercial espera. Está en la lista de rechazo de las directrices (§5) porque "añado un índice para acelerar el LIKE" es una propuesta que suena razonable y no hace nada.

### 2.5 Estados en la pantalla

Tres, y son tres (→ referencia §13.1, `../diseño-frontend.md` ventana 2):

- **Vacío ≠ error.** Sin resultados es `200` con `customers: []`, y la pantalla dice "sin resultados" con CTA "Dar de alta a {término}". Un `404` aquí sería un error de contrato: la colección existe, está vacía.
- **Error de red** → banner con "Reintentar". Mensaje distinto del vacío.
- **Cargando** → skeletons de card, nunca spinner a pantalla completa.

**Debounce en el cliente** (→ referencia §13): el buscador no dispara una petición por tecla. El servidor no lo sabe ni le importa; se menciona aquí porque es la mitad de la feature y vive en el otro lado.

---

## 3. `GET /customers/{id}` — el detalle

### 3.1 Es la petición que hace posible el preview local

Contrato → `../contrato-api.md` §3.3. Debe traer **en una sola llamada** todo lo que `price()` necesita en el navegador (→ referencia §10):

| Qué embebe | Por qué |
|---|---|
| El **plan con sus tramos** | Sin ellos el motor no puede correr en el cliente. Con una petición aparte, el simulador tendría dos estados de carga y una condición de carrera |
| El plan **aunque esté archivado** | Es el caso normal de un cliente antiguo, no una excepción (→ referencia §5.5) |
| El **`tax_rate_bp` del país** | Sin él el preview no puede pintar el impuesto |
| El **`display_currency` del país** | Preselecciona el selector de divisa, solo si el comercial no ha elegido a mano (→ `05-auth-mock.md` §4) |

**Lo que NO embebe: las simulaciones.** Van en `GET /customers/{id}/simulations` (§4) porque son una lista paginable con su propio estado de carga, y porque el simulador no las necesita para arrancar. Embeberlas ataría el tiempo de respuesta del detalle al tamaño del historial.

### 3.2 El plan archivado en pantalla

`active: false` llega al cliente y la UI lo traduce a un aviso discreto: *"Mantiene su tarifa contratada"* (→ `../diseño-frontend.md` ventana 3). **Nada de jerga de versionado** — el comercial no sabe ni tiene que saber qué es una versión de plan. El dato viaja porque la UI lo necesita para decidir; la palabra "archivado" no aparece en pantalla.

---

## 4. `GET /customers/{id}/simulations` — el historial

Contrato → `../contrato-api.md` §3.4.

**El `breakdown` de cada simulación se reconstruye desde su `pricing_snapshot`, jamás desde el plan actual.** Es literalmente para esto que el snapshot existe (→ referencia §11.2): si el desglose se recalculara con los tramos de hoy, editar un plan reescribiría los presupuestos ya enviados, que es el problema que todo el diseño de versionado+snapshot resuelve.

Consecuencia de implementación: el servicio **no consulta `plan_tiers` en este endpoint**. Si aparece un `JOIN` con `plan_tiers` aquí, es un bug —de los que pasan todos los tests que no comprueban precisamente esto— y por eso hay un test dedicado (§5).

**Misma forma de elemento que la respuesta de `POST /simulations`.** La card del historial y la card recién guardada son el mismo componente; una divergencia de forma aquí se paga en el frontend con dos mapeos que hay que mantener sincronizados.

Orden `created_at DESC`, servido por `idx_simulations_customer` (→ `../modelo-datos.md` §2.5). Este índice **sí** trabaja: es igualdad sobre `customer_id` más orden, exactamente lo que un B-tree hace bien.

---

## 5. Tests

**Buscador** (→ referencia §15):
- Término con `%` no se comporta como comodín: con `Nébula` y `50% Descuento SL` dados de alta, buscar `%` devuelve **solo** el que lo contiene literalmente, no los dos.
- Término con `_` idem.
- Término con `\` no rompe la consulta ni escapa el carácter siguiente.
- Término de 101 caracteres → `400` (`maxLength: 100`).
- `search` vacío → `200` con los recientes, **no** `400`.
- Sin resultados → `200` con lista vacía, **no** `404`.
- Busca por `fiscal_id` además de por nombre: `B12345674` encuentra a Nébula.
- Búsqueda con acento: `nébula` encuentra `Nébula Sistemas SL` (§2.3).

**Detalle:**
- Trae el plan con sus tramos y el `tax_rate_bp` en una sola respuesta.
- **Cliente con plan archivado** → `200` con `plan.active: false` y sus tramos. Es el test que impide "filtrar por activos" al escribir el `JOIN`.
- `id` inexistente → `404 CUSTOMER_NOT_FOUND`.

**Historial:**
- **El desglose sale del snapshot**: guardar simulación → versionar el plan con otros precios → releer el historial → mismos números y mismo desglose que al guardar. Es el test que caza el `JOIN` con `plan_tiers`.
- Orden `created_at DESC`.
- Cliente sin simulaciones → `200` con lista vacía.
