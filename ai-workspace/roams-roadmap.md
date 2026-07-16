# Roams SaaS — Hoja de Ruta

> **Mantenimiento — capa PLANES/HOJA DE RUTA.**
>
> * Qué es: hacia dónde va el proyecto y en qué punto está. Rastrea ESTADO, no cambios.
> * Estado con marcadores (✅ hecho · 🔵 en curso · ⏳ pendiente · 🚫 descartado), NO con fechas de commit ni "antes/ahora". Una fecha solo si es un hito/objetivo real (aquí: la entrega, día 5).
> * El "qué se construye y por qué" → `01-specs/idea-referencia.md` (no duplicar; resumir + enlazar). Diseño de pantallas → `01-specs/diseño-frontend.md`. Proceso con IA → `/ai-workspace`.
> * Ideas sin comprometer (post-entrega) → §7 Diferido. No mezclar con las fases comprometidas.

---

## 1. Marco

**Plazo: 5 días.** El reto evalúa: planificación y diseño (35 %), criterio técnico y control de calidad (25 %), calidad del software entregado (30 %), README y despliegue (10 %).

**Reglas del plan:**

1. **La Fase 1 (core del enunciado) se termina y se testea antes de tocar la Fase 2.** El 30 % de la nota es la robustez de lo entregado; el alcance extra no puede comprometerla.
2. **`/ai-workspace` se alimenta desde el día 1**, no se reconstruye al final: cada feature arranca con su spec; cada sesión de vibe coding deja rastro (prompt de partida + resultado + qué se rechazó y por qué). Pesa el 60 % de la nota (35+25) y no es falsificable a posteriori con credibilidad.
3. **Lo diseñado pero no implementado se documenta como recorte consciente** en `/ai-workspace` y en §7: demuestra criterio sin gastar tiempo de entrega.
4. Al final de cada día: commit estable + nota de estado en este documento.

---

## 2. Fase 0 — Preparación y diseño ✅

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
- ✅ Esquema SQL + script de seed (tramos **literales del enunciado**: 10/8/5 con cortes 10 y 50; `countries` con 10 países — ES con esquema `ES_NIF`, resto sin esquema — y sus `tax_rates`, ES 21 %). Incluye `ensureDatabase()`: seed automático si el `.db` no existe (→ referencia §2.1). **Círculo cerrado**: el seed pasa sus `fiscal_id` por el registro de validadores y sus planes por el validador de plantilla — los mismos que usan `POST /customers` y `POST /plans`. Los nombres de plan (Ágora / Bitácora / Cúspide) se adoptaron del diseño en §3.3

## 3. Fase 1 — Core del enunciado (innegociable) ✅

### 3.1 Algoritmos en aislamiento — *Día 1 (tarde)*

> Se implementan y testean ANTES de cualquier endpoint o UI: son el corazón de la nota de calidad.

- ✅ Paquete `pricing`: motor de tramos graduated multi-métrica (función pura) + redondeo **half-up** con `bigint` + enum `Currency` con `minor_unit`
- ✅ Tests del motor: **61 tests**, bordes 0/10/50/51, multi-métrica, métrica no facturada = 0, half-up con `.5` exacto (→ referencia §15). Validados por mutación: cuatro mutantes (half-up→hacia cero, off-by-one del corte, graduated→volume, métrica no facturada) mueren todos
- ✅ Validación fiscal: normalización (→ referencia §7.4) + registro `TaxIdValidator` con `ES_NIF` y `PassThroughValidator` (→ referencia §7.2-7.3). El seed ya pasa por el registro: normaliza y **el tipo lo dice el validador**, no el dato
- ✅ Tests fiscales: **87 tests**, batería de válidos/inválidos por tipo (CIF la más amplia), normalización, fallbacks del registro. Validados por mutación: cinco mutantes (mod 10 exterior, validador permisivo, NIE sin sustituir la inicial, K/L/M como CIF, checksum sin reducir dígitos) mueren todos
- ✅ Chequeo de integridad dato↔registro **en el arranque**: se cableó con la caché de países (→ §3.2), que es donde se recorre `countries` una sola vez. El chequeo **es** la construcción de la caché, no un segundo recorrido

### 3.2 Backend — *Día 2*

- ✅ Esqueleto Fastify: esquemas JSON por ruta **con `maxLength` en todos los campos de texto** (→ referencia §7.5), gestor de errores de producción (sin stack traces al cliente), middleware de auth `(mock, costura desde el día 1)`, caché de arranque de `countries` **+ tipo vigente** con **chequeo de integridad triple** (esquema registrado, tipo vigente por país y divisas ∈ `Currency`; fallo ruidoso → referencia §6.1), **seed automático si el `.db` no existe** (→ referencia §2.1)
- ✅ `POST /customers` (validación fiscal vía registro por país, `fiscal_id` UNIQUE normalizado, duplicado por captura del UNIQUE y no por `SELECT` previo) · `POST /simulations` (cálculo + snapshot + persistencia)
- ✅ `GET /countries` (desplegable + hint fiscal resuelto por el validador → referencia §7.2) · `GET /customers?search=` (LIKE con escape de `%`/`_` y `ESCAPE` declarado) · `GET /customers/{id}` (**embebe plan con tramos + `tax_rate_bp`**, archivado incluido) · `GET /customers/{id}/simulations` (desglose desde el snapshot) · `GET /plans` (activos; `?include_archived=true` para admin)
- ✅ `GET /rates`: proxy con caché TTL = `time_next_update_unix`, filtrado de divisas, fallback marcado, una sola petición en vuelo (→ referencia §9)
- ✅ Tests de integración: **202 tests** de backend contra la app real (`app.inject`) y base en memoria con el esquema y el seed de producción. Incluye paridad preview/persistencia y los chequeos de arranque
- ✅ Verificado con el servidor real: `.db` creado y sembrado solo · alta con `p-1234 567d` → `P1234567D` · **15 usuarios = 140 € + 21 % = 169,40 €** · cliente con plan archivado mantiene su tarifa (155 €) · `GET /rates` contra `open.er-api.com` filtrando de ~160 a 45 divisas · el arranque **se niega** ante una deriva dato↔código

### 3.3 Frontend core — *Día 3*

- ✅ Configuración Vite con **proxy de dev hacia el backend** (mismo origen; nada de abrir CORS → referencia §14.1)
- ✅ **Sistema de diseño importado** del prototipo de Claude Design (`SaaS-O-Matic.dc.html` → `01-specs/diseño-frontend.md` §6.3): `tokens.css` de ambos temas, primitivas (`Button`, `Card`, `Chip`, `Callout`, `Skeleton`, `Toast`, `ThemeToggle`, iconos), `lib/theme.ts` y `lib/currency-format.ts`. Del prototipo se porta el lenguaje visual; **su lógica no** (reimplementa motor, redondeo y validador fiscal → directrices §5). Poppins auto-alojada, subset latino. **Contraste AA como test que falla el CI** (`ui/tokens.test.ts`, 32 pares): 8 pares del prototipo fallaban AA y se corrigieron
- ✅ Login mock + sesión `{nombre, rol}` + `hasRole()` (→ referencia §8). **El literal `"ADMIN"` aparece una sola vez en `frontend/src`, y hay un test que lo vigila** (`lib/session.test.ts`): es lo único que hace que el mock sea sustituible en un módulo, que es la única razón por la que un mock es aceptable
- ✅ Buscador con debounce de 250 ms (vacío ≠ error), término en la URL, `AbortController` para que una respuesta lenta no pise a la rápida
- ✅ Cards responsive: detalle de cliente + historial de simulaciones (grid 1-2-3)
- ✅ Alta de cliente: desplegable de países desde `GET /countries` con el **hint fiscal ya resuelto** (cero `if (país)` en el cliente), errores de validación junto al campo, y enlace a la ficha existente si el `fiscal_id` está duplicado
- ✅ Simulador: sliders + input numérico por métrica, **preview local vía `quote()` de `@saas/pricing`** con los tramos del detalle (0 ms, sin red), desglose visible con su pie explicativo, guardar → el número del backend manda y la simulación queda sellada
- ✅ Selector de divisa: preselección `auto`/`manual` (la elección manual manda → referencia §13), conversión solo visual, importe marcado como referencia con el facturado al lado, `Intl.NumberFormat` con `narrowSymbol`
- ✅ Verificado conduciendo la app real con Chrome (backend + frontend con `npm run dev`): login → buscador (`nébula` → 1 resultado) → ficha de Fjord con el aviso «Mantiene su tarifa contratada» → simulador con **su tarifa archivada (10×12 € + 5×7 € = 155 € + 19 % DE = 184,45 €)** → guardar → cambio a USD (210,62 $ marcado como referencia) → historial. **Cero errores de consola**

### 3.4 Robustez y entrega mínima — *Día 4*

- ✅ Estados de carga/error en TODAS las llamadas (→ referencia §13.1) — criterio de evaluación explícito. Skeletons con la silueta del contenido (nunca spinner a pantalla completa), vacío ≠ error con mensajes distintos, errores de validación junto al campo, y botón deshabilitado durante el envío
- ✅ Seguridad §14: regla ESLint anti `dangerouslySetInnerHTML` ✅ · `npm audit` en CI ✅ · **CSP estricta** ✅ — cabecera desde Vite (`server`/`preview`). El build corre bajo `style-src 'self'` **sin `unsafe-inline`** y con **cero violaciones**, verificado recorriendo la app: la fuente carga (auto-alojada), el CSS aplica y el `fetch` pasa. **El modo dev necesita `unsafe-inline` en `script-src` y `style-src`** (Vite inyecta el preámbulo de React Refresh y el CSS por JS): allí la CSP no defiende de un XSS y **no se pretende que lo haga** — se queda como alarma de deriva. Esta línea es la de la Fase 1: tras la entrega se suman Dependabot, CodeQL y dos endurecimientos (→ §6, «Después de la entrega»)
- ✅ Test de paridad preview/persistencia (cinturón y tirantes)
- ✅ Responsive verificado **midiendo**, no mirando: cero desbordamiento horizontal en las 3 pantallas críticas × 3 anchos (375 / 768 / 1280). Corregidos tres objetivos táctiles por debajo de los 24 px de WCAG 2.5.8 — el slider (su caja eran los 6 px de la ranura), el selector de divisa, y **el botón de usuario, que en móvil salía vacío**
- ✅ README v1: arranque en local en 3 comandos (clonar → instalar → arrancar), qué probar en dos minutos, decisiones documentadas con enlace a su ADR (proxy de divisas, auth mock, preview híbrido, dinero en enteros, versionado, sin Docker), enlace a `/ai-workspace`
- ✅ **Gate de fin de Fase 1**: clonado en limpio + `npm install` (0 vulnerabilidades) + `npm run dev` siguiendo solo el README → el `.db` se crea y siembra solo, y **15 usuarios = 140 € + 21 % = 169,40 €**. En verde

## 4. Fase 2 — Valor añadido ✅

> *Día 5.* Nota: el motor genérico y las columnas (`version`, `active`, `currency`) ya existían desde Fase 1 porque son baratas; esta fase son los **paneles y endpoints de admin**. Se abrió con el gate de Fase 1 en verde (regla 1).

- ✅ `POST /plans` con validación de plantilla + **19 tests** del validador. Devuelve **todas** las violaciones con su métrica e índice, para pintar cada error sobre su fila
- ✅ `PUT /plans/{id}` → versión nueva + archivado (en **transacción**: es la única del backend, y sin ella una caída entre las dos escrituras dejaría dos versiones activas del mismo plan) · `DELETE /plans/{id}` → archivado, nunca borrado físico
- ✅ Test de versionado: editar **no altera** simulaciones guardadas ni el plan de clientes existentes. **46 tests** de la feature
- ✅ UI admin: plantilla (bloques por métrica, cortes como "hasta cuántos", último tramo fijo como "En adelante", **vista previa en vivo con el mismo `quote()`**), listado con archivado y confirmación en lenguaje llano, aviso de versionado sin jerga
- ✅ El seed cierra su círculo: los planes pasan por el **mismo validador de plantilla** que `POST /plans`
- ✅ Verificado conduciendo la app: entrar como `ADMIN` → Administración → editar Ágora → plantilla incoherente rechazada **con el error en su fila** → arreglar y guardar → **v3 activa, v1 y v2 archivadas**, la simulación guardada sigue en 169,40 € con sus tramos de 10 €/8 €, y Nébula sigue apuntando a la v2
- ✅ Registro del proceso en `/ai-workspace/03-proceso`: **9 sesiones** (una por commit, con el prompt literal y qué se rechazó) y **3 auditorías** de los defectos silenciosos. 🚫 **Incumple la regla 2**: se transcribió al final, no por sesión. El contenido es real y trazable a commits, y la [nota de procedencia](./03-proceso/sesiones/00-como-se-registro-esto.md) lo declara en vez de disimularlo

## 5. Fase 3 — Endurecimiento con el margen de plazo ✅

> El reto se planificó a 5 días y el core está completo y verificado; el plazo real de entrega deja margen. Esta fase lo invierte en **profundidad, no en anchura**: cerrar el mayor riesgo declarado (auth, referencia §8.3), convertir las verificaciones manuales en repetibles, y demostrar con un diff dos costuras que hoy son afirmaciones. **Reglas heredadas**: ninguna feature sin su spec (se escribe primero), suite entera en verde tras cada una, y la sesión registrada en `03-proceso/` **al cerrarla, no al final** — que es exactamente como la regla 2 se dejó de cumplir la primera vez. **El orden de esta lista es la prioridad**: si el plazo llega antes que el final, lo no empezado vuelve a §7 con su diseño documentado (regla 3), y el gate de Fase 1 se re-ejecuta al cierre pase lo que pase.

### 5.1 Auth real con identidad enchufable ✅

> Cierra el riesgo aceptado §8.3 (endpoints de admin sin protección) **sin inventar lo que no se puede saber**: el modelo de usuarios interno de la empresa. La línea divisoria es la misma dato/código de siempre, aplicada a la identidad — lo incognoscible (quién es usuario, cómo se autentica: SSO/LDAP/OIDC) queda detrás de un puerto; lo invariante (transporte y aplicación de la identidad) se construye ya.

- ✅ Spec `01-specs/features/07-autenticacion.md` + ADR 0009: sesión de servidor en memoria vs JWT (revocable, cero secretos que gestionar, coherente con un solo proceso — el JWT stateless no aporta nada aquí y quita la revocación)
- ✅ Puerto **`IdentityProvider`** — `authenticate(usuario, password) → { nombre, rol } | null`. La implementación de hoy **es el mock de siempre** (cualquier usuario + `1111`, `ADMIN` → admin), declarado; sin tabla `users` y, por tanto, sin hashing que decidir en falso
- ✅ `POST /auth/login` (rate limit: 10/min por IP → 429) · `GET /auth/session` (rehidratación tras F5: la sesión ya sobrevive a un F5, que antes la perdía) · `POST /auth/logout` (revocación inmediata) · cookie `HttpOnly` + `SameSite=Strict` + `Path=/api`, caducidad absoluta de 12 h, tope de 1.000 sesiones. CSRF: mismo origen por diseño + rechazo de mutaciones declaradas cross-site (`Sec-Fetch-Site`; el intento inicial con `Origin`-vs-`Host` lo desmontó el E2E de §5.2: detrás del proxy el Host llega reescrito)
- ✅ El hook `onRequest` — la costura vacía desde el día 1 — **relleno**: 401 sin sesión en toda la API salvo el login, y el rol en el backend con `requiereRol: 'admin'` declarado en la ruta: `POST/PUT/DELETE /plans` y `?include_archived=true` → 403
- ✅ Frontend: `lib/session.tsx` pregunta a la API; `hasRole()` intacto (los componentes no se enteraron: la costura del 0007 funcionó); **el literal `"ADMIN"` desapareció de `frontend/src`** — su guardián comprueba cero apariciones y el del backend exactamente una, en el `MockIdentityProvider`. Un 401 en cualquier llamada devuelve al login
- ✅ **15 tests de integración nuevos** (login y flags de cookie, 401/403 por rol, Origin ajeno, revocación, caducidad a las 12 h, rate limit, guardián) — 219 de backend en total, **314** en el repo
- ✅ Verificado contra el servidor real por HTTP: sin sesión → 401 · login mal → mensaje único · `sales` + `include_archived` → 403 · `sales` + DELETE plan → 403 · admin → 200 · mutación cross-site → 403 · logout → la misma cookie deja de valer
- ✅ Docs: referencia §8 y §14.3 reescritos, contrato-api §1.6 + 4 códigos nuevos, README, la frase "el gating es UX, no seguridad" actualizada en sus tres sitios, recorte 2.1 estrechado, nota de superseded en `05-auth-mock.md`

### 5.2 E2E con Playwright en CI ✅

> Las pantallas se verificaron conduciendo Chrome a mano (§3.3, §4): válido una vez, invisible en el siguiente push. Esto lo convierte en repetible. → ADR 0010.

- ✅ Smoke comercial: login (sesión real) → buscar → ficha de **Fjord con su tarifa archivada** (10×12 + 5×7 = **184,45 €** con 19 % DE) → guardar → USD marcado como referencia con el facturado al lado → historial → logout. **"Cero errores de consola" es ahora una aserción**, no una frase de verificación manual
- ✅ Smoke admin: simular a Nébula (**169,40 €**, el caso literal del enunciado) → editar Ágora → **v3 activa, 2 archivados** → la ficha de Nébula muestra «Mantiene su tarifa contratada» y su presupuesto **sigue diciendo 169,40 €**: snapshot + versionado recorridos por la UI real
- ✅ axe-core en las 6 pantallas (umbral serious/critical) — **cazó un fallo real**: el atenuado de las métricas no facturadas componía opacidad sobre texto secundario y caía por debajo de AA; corregido en el CSS
- ✅ Contra el sistema ensamblado de verdad: backend real con **base en memoria** (cada ejecución arranca como un evaluador), build servido por `preview` con la **CSP estricta**, y tipos desde un **fixture local** (`RATES_URL`): el smoke no depende de que un tercero esté vivo
- ✅ Job `e2e` en el CI (chromium, separado para no retrasar la señal rápida de lint+test) y `npm run test:e2e` en local
- ✅ **Rindió antes de estar terminado**: su primer arranque cazó que el cinturón anti-CSRF (`Origin` vs `Host`) rechazaba a la propia aplicación detrás del proxy — el defecto exacto que 219 tests de integración no pueden ver, porque `app.inject` no atraviesa ningún proxy. Se corrigió a `Sec-Fetch-Site` (→ §5.1)

### 5.3 Segundo validador fiscal: `PT_NIF` ✅

> No contradice el recorte 2.6 («la mayoría de países nunca lo tendrán»): lo **demuestra**. El argumento entero del registro de estrategias — "añadir un país = una clase + una entrada + rellenar la columna, cero cambios en endpoints" — pasó de afirmación a hecho verificable en un diff que el evaluador puede leer en un minuto (→ spec 02 §3.3).

- ✅ `PortugueseTaxIdValidator`: 9 dígitos, **prefijo asignado por la AT** (aceptar cualquier nueve-dígitos-con-checksum sería más permisivo de lo correcto: el criterio de K/L/M) y mod 11 **con el pliegue de restos 0/1 → control 0**, testeado con casos de ambos restos. **16 tests** de batería (válidos por prefijo, checksums mal, prefijos no asignados con checksum correcto, formas ajenas)
- ✅ Tipo `NIF` nuevo de punta a punta: `FiscalIdType`, `CHECK` de `customers` ampliado **en el mismo commit**, y la colisión de nombres que la referencia §7.1 predecía ("NIF" español vs portugués), disuelta por las claves espaciadas
- ✅ Seed: PT con `tax_id_scheme = 'PT_NIF'` y **Lusitânia Dados Lda.** (NIF sintético `512345678`, sembrado sin normalizar) — el chip «NIF validado» y el hint resuelto, visibles desde el primer arranque
- ✅ La prueba de la promesa: **ningún endpoint ni componente tocado**. Los tests de integración nuevos (alta PT válida/inválida, hint de `GET /countries`) pasan contra el código de siempre. Los tests que usaban `PT_NIF` como ejemplo de "esquema no registrado" migraron a `FR_SIREN` — exactamente el ciclo de vida que esos tests protegen
- ✅ **16 tests nuevos**: 14 de batería del validador + 2 de integración del alta portuguesa

### 5.4 Presupuesto imprimible ✅

> Valor directo para el usuario real: el comercial que hoy explica el número por teléfono puede entregarlo en papel o PDF. Una hoja `@media print` para la simulación —desglose, fecha, divisa de facturación y quién lo emitió— y el diálogo de imprimir del navegador. **Sin librerías de PDF ni generación en servidor** (→ §5.5).

- ✅ `PrintSheet`: hoja solo-para-print (membrete, cliente, plan, desglose por tramos, total, pie de emisión), en tinta sobre blanco — los tokens de tema son de pantalla, y un papel que dependiera del tema oscuro sería un papel negro
- ✅ Dos reglas de producto en el diseño: **solo se imprime la simulación sellada** (el papel lleva el número persistido del backend, nunca un preview que nadie podría reproducir) y **la divisa de visualización no se imprime** — el papel va en la divisa de facturación; la conversión es una referencia efímera de pantalla
- ✅ Botón «Imprimir presupuesto» junto al sello; la app entera desaparece del papel con una regla de visibilidad en `global.css`, sin tocar un solo componente
- ✅ **Verificado en el smoke E2E** con `emulateMedia({ media: 'print' })`: la hoja visible con el número persistido y el emisor, y la app de pantalla invisible — lo que Ctrl+P imprimiría de verdad

### 5.5 Evaluado y descartado para esta fase

Con días extra, la tentación es rellenarlos. Lo que se consideró y **no** entra, para que conste que fue decisión y no olvido — la justificación completa de cada uno vive en [`recortes-conscientes.md`](./03-proceso/recortes-conscientes.md):

| Propuesta | Por qué no entra ni con margen | Razonado en |
|---|---|---|
| `docker-compose` | Sigue sin haber servicios de sistema que orquestar; añadiría fricción al evaluador, no se la quitaría | recortes §4.1, ADR 0008 |
| Cruzada de divisas (`USD→GBP`) | Todos los planes siguen siendo EUR; es una división el día que haga falta | recortes §3 |
| FTS5 / tildes en el buscador | El scan sigue siendo submilisegundo a esta escala; ambos esperan al mismo día | recortes §3 |
| Modelos `volume` / `flat` | Sigue sin existir un plan que los necesite: sería código para un futuro imaginado | recortes §2.5 |
| Panel de administración de impuestos | Rompería el supuesto declarado de caché-hasta-reinicio para una operación que ocurre una vez por década | recortes §2.8 |
| Generación de PDF en servidor | Una dependencia pesada (headless browser o librería) para lo que `@media print` resuelve | §5.4 |
| Validación de plantilla en `@saas/pricing` | Bajarla es cómo un paquete compartido se convierte en vertedero | recortes §3 |

## 6. Entrega ✅

- ✅ Repo público con `/ai-workspace` en la raíz: [JCDiaz03/Roams_SaaS](https://github.com/JCDiaz03/Roams_SaaS)
- ✅ Verificación del README en máquina limpia: clon → `npm install` (0 vulnerabilidades) → `npm run dev` → **15 usuarios = 169,40 €**, sin ningún paso manual de base de datos. Se ejecutó como gate de la Fase 1 (§3.4) y vale como verificación de entrega
- ✅ Revisión de `/ai-workspace`: 6 specs de feature, contrato de API, modelo de datos, directrices, 8 ADRs con sus alternativas descartadas, 9 sesiones, 3 auditorías y los recortes conscientes
- ✅ **Re-verificación en máquina limpia al cierre de la Fase 3** (→ §5): clon limpio → `npm install` (0 vulnerabilidades) → `npm run dev` siguiendo solo el README → el `.db` se crea y siembra solo (con PT y los 5 clientes) → login con sesión real → **15 usuarios = 140 € + 21 % = 169,40 €** → frontend sirviendo. El margen de plazo no le costó la robustez a lo ya verificado

### Después de la entrega ✅

> La entrega no cerró el repositorio. Esto no es una fase nueva: es revisión de lo ya entregado, y se registra aquí porque este documento rastrea **estado**, y el estado cambió.

- ✅ **Contrato de salida blindado**: esquema `response` en las 11 rutas. Fastify serializa con `fast-json-stringify`, así que lo que no está en el esquema no sale: una fuga por un campo añadido sin querer pasa a ser inexpresable en vez de vigilada
- ✅ **El proxy de tipos recuerda el fallo**: con el proveedor caído, el tipo stale se sirve al instante en vez de reintentar y comerse el timeout en cada petición (→ referencia §9)
- ✅ **Los precios del editor de planes usan el `minor_unit` de la divisa**: un plan en JPY guardaba ×100. El invariante estaba escrito (→ referencia §4.4) y la UI de admin no lo aplicaba — el tipo de defecto que solo aparece revisando lo entregado
- ✅ Cinco arreglos más de frontend: el «Reintentar» del buscador reintenta de verdad, `PLAN_NAME_TAKEN` se pinta junto a su campo, avatares deduplicados en `ui/avatar.ts`, y `GET /rates` ya no se dispara en el login
- ✅ **Seguridad, tras una revisión OWASP** que salió limpia dentro del modelo de amenazas declarado (→ referencia §14). Lo que faltaba estaba **fuera del código**:
  - **Dependabot** vigila el lockfile sin esperar a un push, y el `npm audit` del CI corre además **por cron semanal**: una vulnerabilidad se publica cuando se publica, no cuando hay commits (→ referencia §14.3)
  - **CodeQL** analiza *nuestro* código —no las dependencias, que ya cubre `audit`— en push/PR y semanalmente
  - **Tope de 1 MB al cuerpo del proveedor de tipos**: el timeout acotaba el tiempo, no el volumen *dentro* de ese tiempo. El payload de un tercero no es de fiar (→ referencia §9)
  - **`nosniff` y `Referrer-Policy` en toda respuesta**, de la API y de Vite. La CSP no va ahí: es del documento HTML y la envía Vite (→ referencia §14.2)
- ✅ En verde: **204 tests** de backend (los 202 de §3.2 más los 2 del recuerdo de fallo) + **34** de frontend; typecheck, lint y build limpios
- ✅ **Auditoría de cierre con tres lentes en paralelo** (backend+pricing · frontend · config+CI+deriva docs↔código), cada hallazgo verificado contra el código antes de tocar nada: **4 altos corregidos y testeados** — topes anti-overflow del dinero del plan (→ [auditoría 04](./03-proceso/auditorias/04-dinero-sin-tope.md)), `MALFORMED_REQUEST` para peticiones ilegibles que respondían 500, la búsqueda de la topbar que se auto-revertía a los 250 ms, y la hoja de impresión que podía cruzar datos entre clientes — más ~25 medios y bajos aplicados; lo que se decidió NO tocar, razonado en la [sesión 14](./03-proceso/sesiones/14-auditoria-de-cierre.md). Eficiencia: **limpia en los tres informes**. Estado final: **339 tests + 3 E2E**

### Lo que queda fuera, y con qué cara

**Nada de lo comprometido está a medias.** Lo que no está, no está por decisión y tiene su porqué escrito:

- **La regla 2 no se cumplió** (`sesiones/` y `auditorias/` se transcribieron al final). Declarado en la [nota de procedencia](./03-proceso/sesiones/00-como-se-registro-esto.md) y en §8.
- **Lo diferido** (§7) sigue diferido, y ninguno bloquea nada: cada uno tiene su costura hecha.
- **Los recortes de implementación** viven en [`recortes-conscientes.md`](./03-proceso/recortes-conscientes.md): FTS5, tildes en el buscador, refresco proactivo de tipos, `/api/v1`, `docker-compose`.
- **Lo evaluado y descartado para la Fase 3** — docker-compose, cruzada de divisas, FTS5, volume/flat, panel de impuestos… — está en §5.5: se consideró **otra vez** con el margen de plazo y se descartó otra vez, por las mismas razones.
- **La CSP de desarrollo no defiende de un XSS** y se dice en el README en vez de dejar que parezca que sí (§3.4).

## 7. Diferido (diseñado, no comprometido — solo documentación)

- 🚫 **Conexión al sistema de identidad corporativo** (SSO/OIDC/LDAP): la Fase 3 construye la sesión, el enforcement en backend y el puerto `IdentityProvider` (→ §5.1); lo que sigue diferido es la implementación del puerto contra el sistema real, que se define cuando se conozca. El diferido se **estrechó**: antes era "auth real" entero
- 🚫 `VIESProvider` / reverse charge intracomunitario (la interfaz `TaxProvider` ya lo permite)
- 🚫 Pasarela de pagos (lock del tipo de cambio en el instante del cobro)
- 🚫 Planes con divisa de facturación ≠ EUR (price localization; la columna `currency` ya existe)
- 🚫 Modelos de tarificación `volume` / `flat` (el Strategy ya deja el hueco)
- 🚫 Consulta de existencia real del fiscal_id (AEAT/VIES) — no-objetivo explícito de la v1
- 🚫 Validadores fiscales del resto de países (`FR_SIREN`, `DE_USt`…): el registro ya los admite con una clase + una entrada + rellenar `tax_id_scheme`. La Fase 3 añade `PT_NIF` como demostración (→ §5.3); los demás siguen aquí
- 🚫 `docker-compose`: sin dependencias de sistema que orquestar en v1 (SQLite es un fichero); útil cuando haya servicios reales (→ referencia §2.1)

## 8. Riesgos del plan

| Riesgo | Mitigación |
|---|---|
| La Fase 2 se come el día 5 y el core llega flojo | Regla 1: gate de Fase 1 obligatorio antes de abrirla. Si no hay tiempo, la Fase 2 entera pasa a §7 con su diseño documentado. **Funcionó**: el gate se ejecutó antes de abrir la Fase 2, y en verde |
| La Fase 3 desestabiliza lo ya entregado y verificado | Reglas heredadas en §5: spec primero, suite entera en verde tras cada feature, orden de la lista = prioridad, lo no empezado vuelve a §7, y el gate de Fase 1 se re-ejecuta al cierre pase lo que pase |
| El margen de plazo invita a ensanchar en vez de endurecer | §5.5: cada propuesta descartada, reevaluada con el margen y descartada otra vez por escrito. La Fase 3 solo profundiza (seguridad, verificación repetible, demostrar costuras) |
| `/ai-workspace` queda vacío hasta el final | Regla 2: se alimenta por sesión, no al final. Es el 60 % de la nota. **No se cumplió**: las specs y los ADR sí se escribieron antes de programar (que es el grueso), pero `sesiones/` y `auditorias/` se transcribieron al final. Se declara en la nota de procedencia; `git log` lo enseñaría de todas formas |
| El evaluador prueba el caso literal del enunciado y no cuadra | Seed del Plan A literal (10/8/5, cortes 10/50) + prueba manual del gate: 15 usuarios = 140 € + IVA |
| README con fricción | Verificación en máquina limpia como tarea explícita (dos veces: gate y entrega) |
