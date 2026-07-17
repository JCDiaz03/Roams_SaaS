# Spec — Catálogo de planes visible: detalle solo-lectura y sección del dashboard

> **Capa SPEC de feature.** El porqué de negocio → `../../roams-roadmap_v2.md` §1. El contrato HTTP → `../contrato-api.md` §3.7. Las pantallas → `../diseño-frontend.md` (ventanas 2 y 3, y la ventana nueva de detalle de plan). Decisión de rutas → roadmap v2, D1.

---

## 1. Alcance

`GET /plans/{id}` y dos piezas de UI: el **detalle de plan solo-lectura** (`/planes/:id`, cualquier sesión) y la **sección de planes activos del dashboard**. Además, el chip del plan en la ficha de cliente pasa a ser un enlace al detalle.

**El problema que resuelve**: hoy el comercial solo ve un plan embebido en la ficha de un cliente que ya lo tiene. No puede responder "¿qué planes ofrecemos y a qué precio?" sin entrar en el panel de admin — que no puede abrir, porque es solo-admin. El catálogo es información de venta, no de administración.

---

## 2. `GET /plans/{id}` — el detalle

Contrato → `../contrato-api.md` §3.7. Sesión obligatoria, **sin rol**: devuelve el plan con sus tramos, **archivado incluido**.

**Por qué el archivado no exige admin, cuando `?include_archived=true` sí.** No son el mismo dato. El *listado* de archivados revela el histórico completo de tarifas de la empresa — inventario de administración. El *detalle por id* revela un plan concreto cuyo id ya conoces, y un comercial ya ve planes archivados enteros (con tramos) embebidos en `GET /customers/{id}`: es el caso normal del cliente antiguo. Exigir admin aquí no protegería nada que no viaje ya; solo rompería el enlace desde la ficha de Fjord.

- `404 PLAN_NOT_FOUND` si el id no existe. Es el recurso de la URL: 404, no 422 (→ `../contrato-api.md` §5).
- Reutiliza `findPlanById` del repo de plans y `planResponseSchema` como respuesta: cero formas nuevas.

---

## 3. Rutas del SPA: el detalle desplaza al editor

`/planes/:id` era el **editor** de admin. Pasa a ser el detalle solo-lectura, y el editor se mueve a `/planes/:id/editar`:

| Ruta | Quién | Qué |
|---|---|---|
| `/planes` | admin | Listado de administración (sin cambios) |
| `/planes/nuevo` | admin | Crear plan (sin cambios) |
| `/planes/:id` | **cualquier sesión** | **Detalle solo-lectura** (nueva) |
| `/planes/:id/editar` | admin | El editor de siempre, reubicado |

**Por qué el detalle se queda con la URL corta**: es la que se enlaza desde chips, cards y sugerencias — la URL que circula. El editor es un destino terminal al que solo se llega desde el listado de admin o desde el propio detalle. La URL corta para la vista de lectura es la convención que cualquier usuario espera (`/recurso/:id` enseña, `/recurso/:id/editar` edita).

React Router ordena `nuevo` por encima de `:id` por ranking de segmento estático: sin conflicto.

## 4. La pantalla de detalle

- Cabecera: nombre + chips (versión `vN`, estado Activo/Archivado, métricas que factura, divisa). Migas de vuelta al origen.
- **Tabla de tramos por métrica**, el formato del desglose que el comercial ya conoce: "hasta N → precio/unidad", el último tramo como "En adelante". Precios con `formatMinor` — jamás se formatea a mano.
- Si está archivado: `Callout` informativo *"Este plan ya no se ofrece a clientes nuevos. Los clientes que lo tienen mantienen su tarifa."* — sin jerga de versionado, la misma voz que la ficha de cliente.
- Si `hasRole('admin')` y el plan está activo: botón «Editar» → `/planes/:id/editar`. El gating visual es UX **sobre** la autorización real del backend, como siempre.
- Estados: cargando (skeleton con la silueta), 404 (plan no encontrado, con vuelta al dashboard), error de red (reintentar).

## 5. La sección del dashboard

Debajo de la lista de resultados del buscador, un `<details>` colapsable **«Planes activos (N)»** con cards compactas: nombre, chip `vN`, chips de métricas, nº de tramos, divisa, y enlace al detalle.

- **Colapsable y debajo, no al lado**: el buscador de clientes es la vista obligatoria del enunciado y el flujo principal; el catálogo es consulta ocasional. Mismo patrón `<details>` que los archivados del panel admin.
- Carga `GET /plans` (activos) con **estado propio**: si falla, un aviso discreto con reintentar — **el fallo del catálogo no tumba el buscador**, que sigue siendo funcional.
- Los helpers de presentación de plan (`metricasDe`, etiquetas de métrica) se **extraen a un módulo compartido** (`lib/plan-format.ts`) desde el panel de admin, en vez de duplicarlos: tercera pantalla que los usa.

---

## 6. Tests

**Backend (`GET /plans/{id}`):**
- Plan activo → `200` con sus tramos, misma forma que el elemento de `GET /plans`.
- **Plan archivado, con sesión de rol `sales` → `200`**. Es el test de la decisión del §2: si alguien "endurece" la ruta con rol admin, esto revienta.
- Id inexistente → `404 PLAN_NOT_FOUND`.
- Sin sesión → `401 AUTH_REQUIRED`.

**Frontend:**
- El chip del plan de la ficha navega al detalle.
- El editor de admin responde en `/planes/:id/editar` y el botón «Editar» del listado apunta ahí.
- axe (serious/critical) en el detalle de plan y en el dashboard con la sección abierta — vía el smoke E2E.
