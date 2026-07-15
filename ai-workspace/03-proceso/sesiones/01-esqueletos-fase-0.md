# Sesión 01 — Los esqueletos de Fase 0

**Objetivo.** Redactar los diez documentos que estaban creados como esqueleto con la nota `(pendiente de redactar)`, para que ninguna feature se implemente sin su spec.
**Spec de partida.** `roams-roadmap.md` §2 (Fase 0) y `01-specs/idea-referencia.md` como documento madre.
**Resultado.** Hecho. Commit `53a10af` — 123 ficheros, la Fase 0 documental cerrada.

## Prompt de partida

> empieza por los esqueletos pendientes de Fase 0

Precedido, en la sesión anterior, de: *"lee ai-workspace/roams-roadmap.md, ai-workspace/01-specs/idea-referencia.md y 00-enunciado-reto.docx"*.

Un prompt de cuatro palabras que funciona **porque el trabajo ya estaba hecho antes**: el roadmap listaba exactamente qué esqueletos faltaban, y `idea-referencia.md` tenía las 469 líneas de decisiones que los documentos solo tenían que desarrollar. La spec es el prompt; el prompt corto es la consecuencia de una spec buena, no una virtud propia.

## Qué generó

Diez documentos, en orden de dependencia: `modelo-datos.md` y `contrato-api.md` primero (son a lo que apuntan los demás), después `directrices-ia.md`, las seis specs de feature, `decisiones.md` con los ocho ADRs, y `plantillas.md` + `recortes-conscientes.md`.

## Qué se aceptó

- El orden de dependencia, en vez del orden del roadmap. Las specs de feature enlazan al contrato y al modelo; escribirlas antes habría obligado a rehacerlas.
- La forma de los ADRs: contexto → alternativas **descartadas** → decisión → consecuencias. El destino ya vive en `idea-referencia.md`; aquí se cuenta el camino.

## Qué se rechazó, y por qué

- **`rate REAL` para los tipos impositivos** → rechazado. El invariante 5 prohíbe el `float` «para dinero», y un tipo impositivo técnicamente no lo es… pero `base * rate` con un `REAL` mete el float justo en el cálculo que el invariante protege. Se cambió a **puntos básicos enteros** (`rate_bp`, `2100` = 21 %). No lo apliqué yo a `idea-referencia.md`: el `CLAUDE.md` dice que ese documento es canónico, así que **lo señalé y esperé**, en vez de que un documento hijo contradijera a la madre.
- **Estados Unidos en el seed** → rechazado. No tiene tipo indirecto federal: el *sales tax* es estatal y depende del nexo. Ponerlo a `0` sería escribir una mentira en la base de datos; ponerlo bien es un modelo de jurisdicciones que no es este proyecto. Se fue a recortes conscientes, y USD se queda como divisa de **visualización**, que es independiente del país.
- **La forma `{ code, minor_unit }` del enum `Currency`**, que era lo que yo mismo había escrito en la spec → se implementó como mapa plano `código → minor_unit` (sesión 04). Con la forma de la spec, la clave y el campo `code` pueden divergir y nada lo impide.

## Qué aprendió el prompt siguiente

Que **proponer no es decidir**. El Plan C multi-métrica y los tres clientes de demo se marcaron `(propuesto)` en la spec en vez de darlos por buenos: son datos que el evaluador va a ver, y meterlos sin preguntar habría sido decidir por el usuario. Se confirmaron dos sesiones después, cuando el diseño trajo sus propios nombres de plan.
