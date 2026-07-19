# /ai-workspace — cómo se ha construido Roams SaaS

Este directorio es el registro del proceso de ingeniería: qué se especificó antes de programar, qué directrices se le dieron a la IA y cómo fue el desarrollo iterativo con ella. El código es la consecuencia; esto es la causa.

## Si solo hay tiempo para unos pocos ficheros

1. [`03-proceso/auditorias.md`](./03-proceso/auditorias.md) — los seis defectos **silenciosos** que el código generado traía: los que compilan, pasan los tests que existen y están mal. Ahí es donde el control de calidad demuestra si sirve para algo.
2. [`03-proceso/vibe-coding.md`](./03-proceso/vibe-coding.md) — cómo se registró el desarrollo, la tabla de las 23 sesiones y los casos representativos: el prompt literal, qué generó la IA y qué se rechazó.
3. [`02-arquitectura/decisiones.md`](./02-arquitectura/decisiones.md) — los 13 ADR, cada uno con su porqué y sus alternativas descartadas.

Para la lectura completa, el orden natural es: [`01-specs/idea-referencia.md`](./01-specs/idea-referencia.md) (qué se construye y por qué — es el documento madre; el resto lo enlaza por secciones `§4.2`, `§7.3`…), después [`roams-roadmap.md`](./roams-roadmap.md) (en qué punto está y qué queda), y de ahí a arquitectura y proceso.

## Cómo se construyó: cuatro fases, cuatro herramientas

La regla constante fue la misma en todas: **la IA no decide; propone, y cada propuesta se acepta, se corrige o se rechaza por escrito.**

### Fase 0 — Ideación (Claude Opus 4.8, interfaz web)

Antes de elegir stack o arquitectura, el objetivo era estructurar el problema. Deliberadamente **no se le entregó el enunciado completo**: se le pasaron fragmentos de los puntos 1 y 2, con la instrucción explícita de no dar todavía una solución final — solo recoger requisitos, señalar ambigüedades y apuntar interpretaciones («creo que para el algoritmo de facturación te refieres a X»). Fueron 5 prompts, la mayoría respondiendo a las preguntas de interpretación que la propia IA planteó. Resultado: la primera versión de `idea-referencia.md`.

### Fase 1 — Planificación (Claude Fable 5, interfaz web)

Aquí sí se entregó el enunciado original (`.docx`) junto con el `idea-referencia.md` de la fase anterior, para **contrastar la interpretación contra la letra del reto**. En 9 prompts salió la planificación sustancial: `diseno-frontend.md` (escrito ya como entrada de la fase siguiente), una revisión de `idea-referencia.md` con lo que el contraste sacó a la luz, y `roams-roadmap.md`.

### Fase 2 — Diseño visual (Claude Design)

`diseno-frontend.md` se usó como spec de entrada para generar el prototipo (`SaaS-O-Matic.dc.html`): la spec existía antes que el diseño, la herramienta ejecutó un documento, no una idea vaga. Del prototipo **se portó el lenguaje visual y su lógica no** — tokens y primitivas sí; motor, redondeo y validador fiscal se reimplementaron bajo las directrices (→ [roadmap §3.3](./roams-roadmap.md)). El contraste AA de sus colores se convirtió en test de CI, y 8 pares del propio prototipo fallaban y se corrigieron.

### Fase 3 — Implementación (IntelliJ + Claude Code)

Antes de la primera sesión hubo una elección de herramienta: **dónde conducir Claude Code**. Las opciones de terminal puro (Warp, Kitty) se descartaron por falta de control sobre el proyecto — hacía falta un IDE alrededor del agente. De los tres candidatos: **Cursor** quedó fuera porque su valor diferencial es hoy de pago, y la alternativa gratuita (la extensión Continue) hacía el workflow incómodo; entre **VS Code** e **IntelliJ** ganó IntelliJ por dos motivos que conviene declarar tal cual: la familiaridad — el último trabajo 100 % con IA, un TFG, se hizo ahí — y la comodidad visual, sobre todo para leer los `.md` que este proceso produce a docenas. VS Code habría servido exactamente igual: fue una elección de comodidad, no de capacidad, y decirlo evita disfrazarla de decisión técnica.

Claude Code arrancó leyendo tres documentos — `idea-referencia.md`, `roams-roadmap.md` y el enunciado — y su primera tarea fue generar la estructura de directorios. Desde ahí, el desarrollo fue por sesiones bajo el contrato del [`CLAUDE.md`](../CLAUDE.md) de la raíz (la versión ejecutable de [`directrices-ia.md`](./02-arquitectura/directrices-ia.md), releída en cada sesión), y cada sesión quedó registrada en `03-proceso/`.

### El plan cambió una vez, y a propósito

`roams-roadmap.md` cubría el enunciado y su endurecimiento. [`roams-roadmap_v2.md`](./roams-roadmap_v2.md) nació después de conducir la aplicación entregada: el comercial trabajaba con los planes casi a ciegas — solo los veía embebidos en la ficha de cada cliente, y toda simulación cotizaba con el plan contratado. La v2 convirtió el catálogo de planes en ciudadano de primera (detalle, valores base del cliente, simulación parametrizada, what-if con otro plan, sugerencias). Se conservan las dos hojas de ruta porque un cambio de plan documentado vale más que un plan que finge haber acertado a la primera. Lo diseñado y deliberadamente **no** construido está en [`recortes-conscientes.md`](./03-proceso/recortes-conscientes.md).

## Mapa

| Ruta | Qué contiene |
|---|---|
| `00-enunciado-reto.docx` | El enunciado original, tal cual se recibió. |
| [`roams-roadmap.md`](./roams-roadmap.md) | Hoja de ruta y estado del proyecto. Es el índice de por dónde va todo. |
| [`roams-roadmap_v2.md`](./roams-roadmap_v2.md) | La tanda del catálogo de planes (post-entrega): contexto, decisiones D1–D8 y sus fases. |
| [`01-specs/`](./01-specs/) | Lo que se decidió antes de escribir código: diseño del sistema (`idea-referencia.md`), contrato de API, modelo de datos, diseño de pantallas y una spec por feature en `features/`. |
| [`02-arquitectura/`](./02-arquitectura/) | Las directrices que se le dieron a la IA y los 13 ADR, cada uno con su porqué y sus alternativas descartadas. |
| [`03-proceso/vibe-coding.md`](./03-proceso/vibe-coding.md) | El vibe coding destilado: nota de procedencia (cómo y cuándo se registró), la plantilla de registro, la tabla de las 23 sesiones y los casos representativos con el prompt literal y qué se rechazó. |
| [`03-proceso/auditorias.md`](./03-proceso/auditorias.md) | Los 6 defectos silenciosos del código generado: síntoma → cómo se detectó → causa raíz → arreglo, y la taxonomía de los métodos de detección. |
| [`03-proceso/recortes-conscientes.md`](./03-proceso/recortes-conscientes.md) | Lo diseñado y deliberadamente no hecho, con el porqué de cada recorte. |
| [`04-archivo/`](./04-archivo/) | El material bruto sin destilar del que salen los dos documentos anteriores: los 23 diarios de sesión y las 4 fichas de auditoría originales, tal cual se escribieron (las fichas 05 y 06 nacieron ya en el documento destilado, a partir de las sesiones 14 y 19). |

## Reglas de mantenimiento

- Cada documento declara su capa en la cabecera y respeta **una sola casa por dato**: lo de otra capa se resume en una línea y se enlaza, no se duplica.
- **Estado, no fechas**: lo incompleto se marca `(pendiente)`, `(mock)`, `(parcial)`. El historial está en git.
- Este directorio se alimenta **por sesión**, no se reconstruye al final. En la primera entrega esta regla se incumplió — `sesiones/` y `auditorias/` se transcribieron al final — y está declarado en la nota de procedencia de [`vibe-coding.md`](./03-proceso/vibe-coding.md) en vez de disimulado; desde la Fase 3 y toda la tanda v2 se cumplió, y la regla vive ahora también en el `CLAUDE.md` que la IA relee cada sesión.
- Los documentos curados de `03-proceso/` se destilaron del material bruto de `04-archivo/`, que se conserva sin retocar.
