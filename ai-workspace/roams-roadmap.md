# Roams SaaS — Hoja de Ruta

> **Mantenimiento — capa PLANES/HOJA DE RUTA.**
>
> * Qué es: hacia dónde va el proyecto y en qué punto está. Rastrea ESTADO, no cambios.
> * Estado con marcadores (✅ hecho · 🔵 en curso · ⏳ pendiente · 🚫 descartado), NO con fechas de commit ni "antes/ahora". Una fecha solo si es un hito/objetivo real (aquí: la entrega, día 5).
> * El "qué se construye y por qué" → `01-specs/idea-referencia.md` (no duplicar; resumir + enlazar). Diseño de pantallas → `01-specs/diseño-frontend.md`. Proceso con IA → `/ai-workspace`.
> * Ideas sin comprometer (post-entrega) → §6 Diferido. No mezclar con las fases comprometidas.

---

## 1. Marco

**Plazo: 5 días.** El reto evalúa: planificación y diseño (35 %), criterio técnico y control de calidad (25 %), calidad del software entregado (30 %), README y despliegue (10 %).

**Reglas del plan:**

1. **La Fase 1 (core del enunciado) se termina y se testea antes de tocar la Fase 2.** El 30 % de la nota es la robustez de lo entregado; el alcance extra no puede comprometerla.
2. **`/ai-workspace` se alimenta desde el día 1**, no se reconstruye al final: cada feature arranca con su spec; cada sesión de vibe coding deja rastro (prompt de partida + resultado + qué se rechazó y por qué). Pesa el 60 % de la nota (35+25) y no es falsificable a posteriori con credibilidad.
3. **Lo diseñado pero no implementado se documenta como recorte consciente** en `/ai-workspace` y en §6: demuestra criterio sin gastar tiempo de entrega.
4. Al final de cada día: commit estable + nota de estado en este documento.

---

## 2. Fase 0 — Preparación y diseño 🔵

> Objetivo: que ningún código se escriba sin spec. — *Día 1 (mañana)*

- ✅ Documento de requisitos y diseño cerrado (`01-specs/idea-referencia.md`)
- ✅ Decisión de stack: TypeScript full-stack, Fastify + better-sqlite3 + React/Vite, monorepo con paquete `pricing` compartido (→ referencia §2)
- ✅ Decisión preview del slider: híbrido con módulo compartido (→ referencia §10)
- ✅ Decisión países/validación fiscal: tabla `countries` agregadora + registro de estrategias `TaxIdValidator` con fallbacks explícitos (→ referencia §6.1, §7)
- ✅ Monorepo con **npm workspaces** (`/backend`, `/frontend`, `/packages/pricing`, `/ai-workspace`) + scripts raíz (`npm run dev` con `concurrently`, `test`, `seed`) + `engines`/`.nvmrc` (→ referencia §2.1). Incluye el andamiaje del árbol de código `(solo cabeceras, sin implementación)`, el proxy de dev de Vite, la regla ESLint anti `dangerouslySetInnerHTML` y CI con lint + typecheck + test + `npm audit`
- ✅ Repo público creado y publicado: [JCDiaz03/Roams_SaaS](https://github.com/JCDiaz03/Roams_SaaS) — CI en verde desde el primer commit
- ✅ Estructura de `/ai-workspace` creada: specs movidas a `/01-specs`, `/02-arquitectura` (directrices + ADRs) y `/03-proceso` (plantillas)
- ✅ Redactados los esqueletos: directrices-ia (incluye estructura del proyecto), decisiones.md (8 ADRs en un fichero), plantillas.md, recortes-conscientes.md y las 6 specs de feature
- ✅ Contrato de API completo: esquemas de petición/respuesta y códigos de error por endpoint (→ referencia §12) en `01-specs/contrato-api.md`
- ✅ Modelo de datos y seed documentados en `01-specs/modelo-datos.md`
- ✅ Esquema SQL + script de seed (Plan A **literal del enunciado**: 10/8/5 con cortes 10 y 50; Plan B; `countries` con 10 países — ES con esquema `ES_NIF`, resto sin esquema — y sus `tax_rates`, ES 21 %). Incluye `ensureDatabase()`: seed automático si el `.db` no existe (→ referencia §2.1). Pendiente de cerrar el círculo: el seed debe pasar sus datos por el registro de validadores (Fase 1) y por el validador de plantilla (Fase 2) — marcado en `seed.ts`

## 3. Fase 1 — Core del enunciado (innegociable) ⏳

### 3.1 Algoritmos en aislamiento — *Día 1 (tarde)*

> Se implementan y testean ANTES de cualquier endpoint o UI: son el corazón de la nota de calidad.

- ✅ Paquete `pricing`: motor de tramos graduated multi-métrica (función pura) + redondeo **half-up** con `bigint` + enum `Currency` con `minor_unit`
- ✅ Tests del motor: **61 tests**, bordes 0/10/50/51, multi-métrica, métrica no facturada = 0, half-up con `.5` exacto (→ referencia §15). Validados por mutación: cuatro mutantes (half-up→hacia cero, off-by-one del corte, graduated→volume, métrica no facturada) mueren todos
- ✅ Validación fiscal: normalización (→ referencia §7.4) + registro `TaxIdValidator` con `ES_NIF` y `PassThroughValidator` (→ referencia §7.2-7.3). El seed ya pasa por el registro: normaliza y **el tipo lo dice el validador**, no el dato
- ✅ Tests fiscales: **87 tests**, batería de válidos/inválidos por tipo (CIF la más amplia), normalización, fallbacks del registro. Validados por mutación: cinco mutantes (mod 10 exterior, validador permisivo, NIE sin sustituir la inicial, K/L/M como CIF, checksum sin reducir dígitos) mueren todos
- ⏳ Chequeo de integridad dato↔registro **en el arranque**: el registro ya expone `hasValidator()`; el chequeo se cablea con la caché de países (→ §3.2), que es donde se recorre `countries` una sola vez

### 3.2 Backend — *Día 2*

- ✅ Esqueleto Fastify: esquemas JSON por ruta **con `maxLength` en todos los campos de texto** (→ referencia §7.5), gestor de errores de producción (sin stack traces al cliente), middleware de auth `(mock, costura desde el día 1)`, caché de arranque de `countries` **+ tipo vigente** con **chequeo de integridad triple** (esquema registrado, tipo vigente por país y divisas ∈ `Currency`; fallo ruidoso → referencia §6.1), **seed automático si el `.db` no existe** (→ referencia §2.1)
- ✅ `POST /customers` (validación fiscal vía registro por país, `fiscal_id` UNIQUE normalizado, duplicado por captura del UNIQUE y no por `SELECT` previo) · `POST /simulations` (cálculo + snapshot + persistencia)
- ✅ `GET /countries` (desplegable + hint fiscal resuelto por el validador → referencia §7.2) · `GET /customers?search=` (LIKE con escape de `%`/`_` y `ESCAPE` declarado) · `GET /customers/{id}` (**embebe plan con tramos + `tax_rate_bp`**, archivado incluido) · `GET /customers/{id}/simulations` (desglose desde el snapshot) · `GET /plans` (activos; `?include_archived=true` para admin)
- ✅ `GET /rates`: proxy con caché TTL = `time_next_update_unix`, filtrado de divisas, fallback marcado, una sola petición en vuelo (→ referencia §9)
- ✅ Tests de integración: **160 tests** de backend contra la app real (`app.inject`) y base en memoria con el esquema y el seed de producción. Incluye paridad preview/persistencia y los chequeos de arranque
- ✅ Verificado con el servidor real: `.db` creado y sembrado solo · alta con `p-1234 567d` → `P1234567D` · **15 usuarios = 140 € + 21 % = 169,40 €** · cliente con plan archivado mantiene su tarifa (155 €) · `GET /rates` contra `open.er-api.com` filtrando de ~160 a 45 divisas · el arranque **se niega** ante una deriva dato↔código

### 3.3 Frontend core — *Día 3*

- ✅ Configuración Vite con **proxy de dev hacia el backend** (mismo origen; nada de abrir CORS → referencia §14.1)
- ✅ **Sistema de diseño importado** del prototipo de Claude Design (`SaaS-O-Matic.dc.html` → `01-specs/diseño-frontend.md` §6.3): `tokens.css` de ambos temas, primitivas (`Button`, `Card`, `Chip`, `Callout`, `Skeleton`, `Toast`, `ThemeToggle`, iconos), `lib/theme.ts` y `lib/currency-format.ts`. Del prototipo se porta el lenguaje visual; **su lógica no** (reimplementa motor, redondeo y validador fiscal → directrices §5). Poppins auto-alojada, subset latino. **Contraste AA como test que falla el CI** (`ui/tokens.test.ts`, 32 pares): 8 pares del prototipo fallaban AA y se corrigieron
- ⏳ Login mock + sesión `{nombre, rol}` + `hasRole()` (→ referencia §8)
- ⏳ Buscador con debounce (vacío ≠ error)
- ⏳ Cards responsive: detalle de cliente + historial de simulaciones
- ⏳ Alta de cliente: desplegable de países desde `GET /countries`, errores de validación junto al campo
- ⏳ Simulador: sliders por métrica, preview local vía paquete `pricing` (tramos del detalle del cliente), desglose visible del cálculo, guardar → el número del backend manda
- ⏳ Selector de divisa: preselección `auto`/`manual` (la elección manual manda → referencia §13), conversión solo visual, importe marcado como referencia, `Intl.NumberFormat`

### 3.4 Robustez y entrega mínima — *Día 4*

- ⏳ Estados de carga/error en TODAS las llamadas (→ referencia §13.1) — criterio de evaluación explícito
- 🔵 Seguridad §14: regla ESLint anti `dangerouslySetInnerHTML` ✅ · `npm audit` en CI ✅ · CSP estricta ⏳
- ⏳ Test de paridad preview/persistencia (cinturón y tirantes)
- ⏳ Responsive verificado en móvil/escritorio
- ⏳ README v1: arranque en local en 2-3 comandos (clonar → instalar → seed+arrancar), decisiones documentadas (proxy, auth mock, preview híbrido), enlace a `/ai-workspace`
- ⏳ **Gate de fin de Fase 1**: clonado en limpio + arranque siguiendo solo el README + prueba manual del flujo completo (alta con CIF válido → simulación 15 usuarios = 140 € + IVA → cambio de divisa)

## 4. Fase 2 — Valor añadido (solo si el gate de Fase 1 está en verde) ⏳

> *Día 5.* Nota: el motor genérico y las columnas (`version`, `active`, `currency`) ya existen desde Fase 1 porque son baratas; esta fase son los **paneles y endpoints de admin**.

- ⏳ `POST /plans` con validación de plantilla (cortes crecientes, sin huecos/solapes, último abierto…) + sus tests
- ⏳ `PUT /plans/{id}` → versión nueva + archivado · `DELETE /plans/{id}` → archivado
- ⏳ Test de versionado: editar no altera simulaciones guardadas ni clientes existentes
- ⏳ UI admin: plantilla de creación (bloques por métrica, cortes como "hasta cuántos"), listado con archivar, aviso de versionado sin jerga
- ⏳ Pulido final + captura del proceso del día en `/ai-workspace/03-proceso`

## 5. Entrega — *fin del día 5* ⏳

- ⏳ Repo público con `/ai-workspace` en la raíz
- ⏳ Verificación final del README en máquina limpia
- ⏳ Revisión de `/ai-workspace`: specs por feature, directrices de arquitectura, hilos/decisiones de auditoría (aceptado/rechazado y por qué), recortes conscientes documentados

## 6. Diferido (diseñado, no comprometido — solo documentación)

- 🚫 Auth real (SSO/tokens): la costura existe (middleware + módulo de sesión); el modelo de usuario interno se define cuando se conozca el sistema de la empresa
- 🚫 `VIESProvider` / reverse charge intracomunitario (la interfaz `TaxProvider` ya lo permite)
- 🚫 Pasarela de pagos (lock del tipo de cambio en el instante del cobro)
- 🚫 Planes con divisa de facturación ≠ EUR (price localization; la columna `currency` ya existe)
- 🚫 Modelos de tarificación `volume` / `flat` (el Strategy ya deja el hueco)
- 🚫 Consulta de existencia real del fiscal_id (AEAT/VIES) — no-objetivo explícito de la v1
- 🚫 Validadores fiscales de otros países (`PT_NIF`, `FR_SIREN`…): el registro ya los admite con una clase + una entrada + rellenar `tax_id_scheme`
- 🚫 `docker-compose`: sin dependencias de sistema que orquestar en v1 (SQLite es un fichero); útil cuando haya servicios reales (→ referencia §2.1)

## 7. Riesgos del plan

| Riesgo | Mitigación |
|---|---|
| La Fase 2 se come el día 5 y el core llega flojo | Regla 1: gate de Fase 1 obligatorio antes de abrirla. Si no hay tiempo, la Fase 2 entera pasa a §6 con su diseño documentado |
| `/ai-workspace` queda vacío hasta el final | Regla 2: se alimenta por sesión, no al final. Es el 60 % de la nota |
| El evaluador prueba el caso literal del enunciado y no cuadra | Seed del Plan A literal (10/8/5, cortes 10/50) + prueba manual del gate: 15 usuarios = 140 € + IVA |
| README con fricción | Verificación en máquina limpia como tarea explícita (dos veces: gate y entrega) |
