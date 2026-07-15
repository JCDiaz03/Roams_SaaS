# /ai-workspace — cómo se ha construido Roams SaaS

Este directorio es el registro del proceso de ingeniería: qué se especificó antes de programar, qué directrices se le dieron a la IA y cómo fue el desarrollo iterativo con ella. El código es la consecuencia; esto es la causa.

## Mapa

| Ruta | Qué contiene |
|---|---|
| `00-enunciado-reto.docx` | El enunciado original, tal cual se recibió. |
| `roams-roadmap.md` | Hoja de ruta y estado del proyecto. Es el índice de por dónde va todo. |
| `01-specs/` | Lo que se decidió antes de escribir código: diseño del sistema, diseño de pantallas, contrato de API, modelo de datos y una spec por feature. |
| `02-arquitectura/` | Las directrices que se le dieron a la IA y las decisiones de arquitectura (ADR), cada una con su porqué y sus alternativas descartadas. |
| `03-proceso/` | El vibe coding: **9 sesiones** (una por commit, con el prompt literal y qué se rechazó), **3 auditorías** de los defectos silenciosos que traía el código generado, y los recortes conscientes. |

## Por dónde empezar a leer

1. `01-specs/idea-referencia.md` — qué se construye y por qué. Es el documento madre; el resto lo enlaza por secciones (`§4.2`, `§7.3`…).
2. `roams-roadmap.md` — en qué punto está y qué queda.
3. `02-arquitectura/directrices-ia.md` — las reglas bajo las que la IA generó cada línea.

**Si solo hay tiempo para tres ficheros**, que sean las [auditorías](./03-proceso/auditorias/): los tres defectos **silenciosos** que el código generado traía —los que compilan, pasan los tests que existen y están mal—. Ahí es donde el control de calidad demuestra si sirve para algo. El [índice de sesiones](./03-proceso/sesiones/00-como-se-registro-esto.md) las enlaza y explica cómo se registró todo.

## Reglas de mantenimiento

- Cada documento declara su capa en la cabecera y respeta **una sola casa por dato**: lo de otra capa se resume en una línea y se enlaza, no se duplica.
- **Estado, no fechas**: lo incompleto se marca `(pendiente)`, `(mock)`, `(parcial)`. El historial está en git.
- Este directorio se alimenta **por sesión, desde el día 1**; no se reconstruye al final.
