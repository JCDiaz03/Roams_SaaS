# Roams SaaS — Hoja de Ruta v2: el catálogo de planes al servicio del comercial

> **Mantenimiento — capa PLANES/HOJA DE RUTA.** Mismas reglas que [`roams-roadmap.md`](./roams-roadmap.md): estado con marcadores (✅ hecho · 🔵 en curso · ⏳ pendiente · 🚫 descartado), sin fechas de commit. El "qué se construye y por qué" de esta tanda → specs 08 y 09 en `01-specs/features/`. Este documento se actualiza al cerrar cada fase, no al final.

---

## 1. Contexto

El equipo comercial trabaja hoy con los planes casi a ciegas: solo los ve embebidos en la ficha de cada cliente, y una simulación siempre cotiza con el plan contratado. Esta tanda hace que el **catálogo de planes** sea un ciudadano de primera en la herramienta: verlos desde el dashboard, consultarlos en detalle, cotizar a un cliente con un plan distinto al contratado (what-if que se guarda), y partir de valores base del cliente al simular.

Acordado con el usuario:

- Los valores base (empleados, GB, llamadas API) **son atributos del cliente** (columnas nuevas, editables desde la ficha); simulación «parametrizada» y «libre» comparten la ruta del simulador.
- El selector de plan del simulador es visualmente what-if **pero al guardar se guarda con el plan elegido**; botón para revertir al contratado.
- Las simulaciones guardadas **jamás se editan**: el botón del historial crea una nueva partiendo de esa.
- Los modelos «flat premium» y «compromiso + excedente» quedan **diferidos** con su diseño documentado (el modelo actual ya expresa «métrica ilimitada/incluida»: sin tramos = aporta 0 → §5).

**Sin conflictos con el enunciado** (todo es aditivo). Conflictos internos resueltos por decisión explícita: `/planes/:id` era el editor admin (se mueve a `/planes/:id/editar`); `POST /simulations` rechazaba `plan_id` con un test guardián que se reescribe con su ADR; `customers` no tenía campos de consumo (migración aditiva).

## 2. Decisiones de diseño

- **D1 Rutas**: `/planes/:id` = detalle solo-lectura (cualquier sesión); editor admin → `/planes/:id/editar`. Backend nuevo: `GET /plans/:id` (sesión, sin rol, archivado incluido — un comercial ya ve planes archivados embebidos en la ficha de su cliente; no filtra nada nuevo).
- **D2 Migración**: helper `ensureColumn()` idempotente (vía `pragma table_info`) en `migrate.ts`, ejecutado SIEMPRE en el arranque (el seed sigue siendo solo-primera-vez); las columnas también en `schema.sql` para bases nuevas. → ADR 0012.
- **D3 Edición de bases**: `PATCH /customers/:id` acotado SOLO a `base_users | base_storage_gb | base_api_calls` (`additionalProperties: false`, `minProperties: 1`, tipo `['integer','null']`; `null` borra). La edición de datos fiscales NO se abre, y un test lo vigila.
- **D4 `plan_id` opcional en `POST /simulations`**: ausente = plan del cliente (comportamiento de siempre, intacto); presente = debe existir (`422 PLAN_NOT_FOUND`) y estar activo salvo que sea el contratado (`422 PLAN_ARCHIVED`). El `tax_rate_bp` es SIEMPRE el del país del cliente. El snapshot no cambia: ya captura el plan usado. → ADR 0011.
- **D5 Historial**: campos planos `plan_name` y `plan_version` en la respuesta de simulaciones, leídos del `pricing_snapshot` — una simulación vieja no cambia de nombre si el plan se versiona.
- **D6 Precarga del simulador por URL** (coherente con el `?q=` del dashboard): `?base=1` = parametrizada (los controles arrancan en `cliente.base_*`, referencia «base: N» junto al input); `?users=&storage_gb=&api_calls=&plan=` = «usar como base» desde el historial (`plan` se preselecciona solo si está activo o es el contratado; si no, se ignora). Precedencia: params explícitos > `base=1` > defaults.
- **D7 Sugeridos**: 100 % locales con el MISMO `quote()` de `@saas/pricing` sobre los planes activos y las cantidades actuales; solo se comparan planes de la misma divisa; cero red por arrastre, cero segunda implementación.
- **D8**: los `base_*` NO se exponen en `GET /customers?search=` (el listado sigue ligero).

## 3. Fases

> **Estado: la tanda está completa** — las diez fases en ✅, 363 tests + 3 E2E en verde, y la sesión 15 registrada al cierre.

### Fase 0 — Documentación (antes de codificar) ✅

- ✅ Este documento
- ✅ Spec `01-specs/features/08-catalogo-de-planes-visible.md` (dashboard + detalle solo-lectura, D1)
- ✅ Spec `01-specs/features/09-simulacion-parametrizada-y-plan-elegido.md` (D2–D7, invariantes explícitos)
- ✅ `contrato-api.md`: `base_*` en alta y respuestas de cliente (§2.1) · `plan_id` opcional en simulaciones (§2.2) · `GET /plans/{id}` (§3.7) y `PATCH /customers/{id}` (§3.8) nuevos · `plan_name`/`plan_version`. Sin códigos de error nuevos
- ✅ `modelo-datos.md` §2.4: 3 columnas NULLABLE con CHECK (topes de simulations) + nota de mini-migración; seed con bases en Nébula y Meridian (§3.3)
- ✅ ADR 0011 (plan_id opcional) y ADR 0012 (columnas aditivas con ALTER idempotente) en `decisiones.md`
- ✅ Diferidos «compromiso + excedente» (§2.9) y «flat premium» (§2.10) en `recortes-conscientes.md`, y en `roams-roadmap.md` §7
- ✅ `diseño-frontend.md` §8: ventana 8 (detalle de plan) y cambios de ventanas 2/3/4
- ✅ `idea-referencia.md`: §11.1 (columnas base), §12 (endpoints nuevos y `plan_id` opcional), §13 (barra de plan y modo parametrizado)

### Fase 1 — Backend: valores base del cliente ✅

- ✅ `schema.sql` + `migrate.ts` con `ensureColumn()` (D2): migrate corre SIEMPRE al arrancar; el seed sigue siendo solo-primera-vez. **4 tests** de migración (`migrate.test.ts`): base con DDL viejo gana las columnas con datos intactos, segunda pasada inocua, el CHECK rige también en bases migradas
- ✅ Seed con bases visibles: Nébula `base_users: 15` (el caso literal del enunciado precargado) y Meridian los tres campos sobre el multi-métrica
- ✅ Alta con `base_*` opcionales · `PATCH /customers/:id` acotado (D3) con guardián de que la edición fiscal NO se abrió (`company_name` en el body → 400) · el detalle los expone y el buscador no · **11 tests** nuevos de customers

### Fase 2 — Backend: `GET /plans/:id` ✅

- ✅ Ruta con `findPlanById` (ya existía en el repo, ahora expuesta), 404 `PLAN_NOT_FOUND` · **4 tests**: activo 200 con tramos · **archivado 200 con rol sales** (el punto de D1, con test que lo protege de un «endurecimiento» futuro) · inexistente 404 · sin sesión 401

### Fase 3 — Backend: `plan_id` opcional + nombre del plan ✅

- ✅ Body con `plan_id` opcional (reglas D4, comentario del esquema apuntando al ADR 0011) · `plan_name`/`plan_version` en respuesta, del plan cargado en el POST y **del snapshot** en el historial
- ✅ El guardián de «plan_id no se acepta» reescrito como la batería de D4 (**6 tests**): sin plan_id = contratado · activo ajeno 201 con sus tramos y el impuesto del país del cliente (Nébula × Cúspide = 13 500 + 21 %) · archivado ajeno 422 · contratado archivado explícito 201 (Fjord) · inexistente 422 · snapshot captura el elegido
- ✅ Versionar no renombra el pasado: la simulación vieja sigue declarando su `v2` tras crear la v3 (extensión del test de inmutabilidad)
- ✅ **Backend: 268 tests en verde** (258 → 268), typecheck y lint limpios

### Fase 4 — Frontend: cliente API y rutas ✅

- ✅ Tipos (`base_*`, `plan_name`/`plan_version`, `CustomerFlat`) y métodos nuevos (`api.plan`, `api.updateCustomerBases`, `createSimulation` con `plan_id?`) · `/planes/:id` detalle público y `/planes/:id/editar` admin en `routes.tsx` · botón Editar del panel admin apunta a `/editar`

### Fase 5 — Detalle de plan + chip clicable ✅

- ✅ `PlanDetailPage` (chips, tabla de tramos por métrica con `formatMinor`, callout si archivado en la misma voz que la ficha, Editar si admin y activo) · el chip del plan de la ficha es un `<Link>` accesible por teclado

### Fase 6 — Sección de planes activos en el dashboard ✅

- ✅ `ActivePlansSection`: `<details>` colapsado por defecto, estado propio (su fallo no tumba el buscador), cards compactas → detalle · `ETIQUETA_METRICA`/`metricasDe` extraídos a `lib/plan-format.ts` (tercer consumidor: se comparte, no se copia)

### Fase 7 — Ficha en 3 bloques + simulación parametrizada ✅

- ✅ `BaseValuesBlock` (ver/editar en línea → PATCH → toast) entre los datos de empresa y el callout · botones «+ Nueva simulación parametrizada» (solo si hay base) y «+ Nueva simulación libre»
- ✅ Simulador con inicialización D6 (params explícitos > `?base=1` > defaults), referencia «**base: N**» junto al input, y tope del slider ampliado si el valor inicial lo supera (truncar sería cambiar el dato en silencio)

### Fase 8 — Selector de plan + sugeridos ✅

- ✅ `PlanSelectorBar`: `<select>` nativo (contratado siempre elegible aunque archivado + activos), chip «Tarifa contratada»/«Distinto del contratado», «Volver al contratado», enlace al detalle. Si `GET /plans` falla, el simulador degrada al comportamiento de siempre
- ✅ Preview con el plan en uso (impuesto SIEMPRE el del país del cliente) · cambiar de plan invalida el sello · guardar añade `plan_id` solo si difiere del contratado
- ✅ Sugeridos D7 bajo el resultado, con un filtro que la spec no traía y el diseño exigió: **un plan que cotiza a 0 € no se sugiere** (no factura nada de lo que el cliente usa) — spec 09 §4.3 ampliada
- ✅ **`PrintSheet` corregido**: imprimía `cliente.plan.name` y ahora imprime el plan de la simulación sellada (`plan_name` · vN) — con el plan elegido, lo anterior habría puesto la tarifa equivocada en el papel

### Fase 9 — Historial con plan + «usar como base» ✅

- ✅ Chip `{plan_name} · vN` junto a la fecha (del snapshot: versionar no lo cambia) · «Usar como base» navega al simulador con las entradas por URL y `plan=` preseleccionado solo si sigue elegible. La guardada no se toca

### Fase 10 — E2E, accesibilidad y verificación ✅

- ✅ Smoke admin: entra por la **parametrizada** de Nébula («base: 15» visible, el enunciado precargado desde el seed), clava `/planes/:id/editar` en URL, y tras versionar a v3 la simulación vieja **sigue declarando «Plan Ágora · v2»**
- ✅ Smoke comercial: barra «Tarifa contratada», chip del plan en el historial (`· v1` de Fjord) y flujo «usar como base» (sliders precargados)
- ✅ axe pasa por las vistas nuevas dentro de los smokes (ficha con bloques, simulador con barra, dashboard con sección)
- ✅ **Migración verificada sobre la base real**: el `tsx watch` de dev se reinició durante el desarrollo y migró el `.db` viejo en caliente — columnas añadidas, 5 filas intactas, bases a `NULL` (el seed con bases solo aplica a bases nuevas, como manda ADR 0012)
- ✅ **Estado final: 61 + 268 + 34 = 363 tests + 3 E2E, typecheck, lint y build limpios**
- ✅ Sesión [`15-catalogo-de-planes.md`](./03-proceso/sesiones/15-catalogo-de-planes.md) registrada **al cerrar la tanda** (regla 2, cumplida esta vez)

## 3bis. Retoques de la revisión del usuario ✅

> El usuario condujo la app tras la tanda y volvió con una lista. Todo aplicado en una pasada:

- ✅ **Logout vuelve al inicio**: cerrar sesión en `/planes/3` dejaba al siguiente login aterrizando allí; ahora la URL se restablece a `/`
- ✅ **Tema claro por defecto** (antes se heredaba `prefers-color-scheme` del sistema) — `lib/theme.ts`
- ✅ **Revisión del oscuro**: los inputs nuevos usaban `surface` sobre la Card (`surface`) y desaparecían — todos a `surface-2`, como el resto del sistema; el hover del chip-enlace pasó de `brightness()` (direccional) a opacidad (funciona en ambos temas)
- ✅ **Selector de divisa**: ancho fijo de símbolo y código (EUR→CHF ya no hace bailar la píldora) + flecha de desplegable que `appearance: none` había borrado
- ✅ **Volver desde el detalle de plan**: el chip de la ficha y el «Ver detalle» del simulador pasan `state.desde`; el detalle pinta la miga intermedia y un botón «Volver a {origen}» que conserva la query (cantidades y plan elegido incluidos)
- ✅ **Las sugerencias ya no quedan tapadas**: el `position: sticky` se movió del panel de resultado a la **columna** entera — un sticky pegado se desplaza de su posición de flujo y cubría la tarjeta de debajo
- ✅ **Plantilla de planes con feedback de huecos**: enviar con campos vacíos ya no convertía un precio en blanco en `0 €` silencioso — pre-validación con borde rojo en cada campo vacío y aviso accionable, antes de tocar la red
- ✅ **Ventana 9: Ajustes** para todos los usuarios (spec `10-ajustes-y-limites-del-simulador.md`): perfil de demostración solo-lectura + **límites del simulador** (máximo visual de cada slider, con clamps 70/100/1.000 ↔ topes del backend; valores en `frontend/src/lib/simulator-limits.tsx`)
- ✅ **Auditoría XSS almacenado en planes**: cero `dangerouslySetInnerHTML`/`innerHTML` en `frontend/src`; nombre y descripción se pintan solo como texto JSX (React escapa), con la regla ESLint y la CSP del build como segunda y tercera capa. Sin hallazgos
- ✅ **Icono de administración rehecho** (engranaje canónico para Ajustes, deslizadores para Administración) y **logo de marca real** en login **y topbar** (`frontend/src/assets/roams-logo.svg`, movido desde `ai-workspace/`, con inversión de tinta en oscuro; el `IconLogo` de onda, retirado)
- ✅ **Ajustes aprovecha el ancho**: Perfil y Límites lado a lado en escritorio, y los campos de límite en rejilla que llena su tarjeta

## 3ter. Auditoría de accesibilidad y Lighthouse ✅

> Petición del usuario: sin letras pequeñas y Lighthouse en todas las vistas. Detalle completo → [sesión 17](./03-proceso/sesiones/17-auditoria-de-accesibilidad.md).

- ✅ **Suelo tipográfico de 12px** en todo el frontend (21 declaraciones de 10,5–11,5px subidas)
- ✅ **Smoke `e2e/vistas.spec.ts`**: axe sobre ajustes, catálogo y detalle de plan — cazó un contraste real en el summary del catálogo (text-2 sobre fondo de página), corregido. Las 9 pantallas pasan axe en CI
- ✅ **Lighthouse en las 8 vistas** (build con CSP + cookie de sesión): favicon (el 404 penalizaba todas), `meta description` + `robots.txt`, `<main>` en el login, y el **CLS del simulador de 0,25 → 0** (esqueletos con las medidas reales + `Poppins Fallback` con métricas ajustadas para eliminar el salto del swap de fuente)
- ✅ Final: **a11y 100 y SEO 100 en todas; best-practices 100** (96 en login por el 401 contractual del sondeo de sesión); **performance 95–99**
- ✅ Ajustes: layout apilado restaurado a petición del usuario, con texto de ayuda, campos y acciones a ancho completo de su tarjeta
- ✅ **363 tests + 4 E2E** en verde

## 3quater. Segunda revisión del usuario ✅

> Detalle → [sesión 18](./03-proceso/sesiones/18-planes-borrables-y-archivo-de-simulaciones.md).

- ✅ **Borrado físico del plan JAMÁS usado** (→ ADR 0013): `DELETE /plans/{id}` elimina de verdad si cero clientes y cero simulaciones lo referencian; si no, archiva como siempre. La condición la decide el servidor; `removed` en la respuesta; `CLAUDE.md` matizado por escrito («lo rechazable es borrar un plan usado»)
- ✅ **Archivar simulaciones** (spec 09 §5.5): columna aditiva `archived` + `PATCH /simulations/{id}` acotado; historial por defecto sin archivadas y sección colapsada con recuperar. Guardián: archivar no mueve ni un número sellado
- ✅ Favicon de marca (PNG, en su formato óptimo) · desplegable de divisa propio con nombres por `Intl.DisplayNames` · espaciados de callouts en ficha y detalle de plan · contador «3 simulaciones» en una línea
- ✅ **372 tests + 4 E2E** en verde
- ✅ **Higiene del repo**: cero módulos huérfanos en los tres workspaces (barrido de imports); retirados los 4 `.gitkeep` de carpetas ya pobladas y la carpeta `capturas/` jamás usada (el `.gitkeep` de `public/` además se colaba en el build); artefactos regenerables (`test-results/`, `dist/` viejo) purgados. Las 2 imágenes del repo están en uso y en formato adecuado (SVG 7 KB, PNG 3,4 KB)

## 4. Orden y dependencias

Fase 0 → 1 → (2 ∥ 3) → 4 → 5 → 6 → 7 → 8 → 9 → 10. Cada fase de backend lleva sus tests en el mismo commit; el guardián de `plan_id` se reescribe en la Fase 3, nunca antes.

## 5. Evaluado y diferido en esta tanda

| Propuesta | Por qué se difiere | Dónde queda el diseño |
|---|---|---|
| Modelo **flat premium** (cuota fija mensual; habilita «GB/API ilimitados con sobrecoste») | Ninguna feature de la tanda lo necesita; toca el motor (lo mejor testeado del repo) y merece su propia tanda. Lo «ilimitado incluido» ya es expresable: métrica sin tramos = aporta 0 | `recortes-conscientes.md` |
| Modelo **compromiso + excedente** (contratas X y el exceso a tarifa distinta, estilo telefonía) | Requiere cantidad comprometida como dato del contrato + `pricing_model` nuevo; el modelo actual es elástico por diseño (no existe «pasarse», el coste avanza por los tramos). Los `base_*` de esta tanda son la semilla del dato de compromiso si algún día se hace | `recortes-conscientes.md` |

## 6. Riesgos del plan

| Riesgo | Mitigación |
|---|---|
| El `plan_id` opcional debilita la protección del versionado | La regla activo-o-contratado preserva exactamente lo que el guardián protegía (nadie cotiza con un archivado ajeno); el test no se borra, se reescribe como batería más amplia. ADR 0011 |
| La migración rompe un `.db` existente | `ensureColumn()` idempotente + prueba explícita con base generada en `main` (columnas presentes, datos intactos) y con base borrada (seed limpio). ADR 0012 |
| El what-if imprime o persiste el plan equivocado | El snapshot ya captura el plan usado; `PrintSheet` pasa a leer de la simulación sellada; test de que el snapshot captura el plan elegido |
| La tanda desestabiliza lo entregado | Reglas heredadas del roadmap v1: spec primero, suite en verde tras cada fase, gate de Fase 1 (15 usuarios = 169,40 €) re-ejecutable al cierre |
