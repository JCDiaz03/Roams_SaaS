# Plantillas de proceso

> **Mantenimiento — capa PROCESO.**
>
> * Qué es: el formato que siguen los ficheros de `sesiones/` y `auditorias/`. Nada más — el contenido de cada sesión vive en su fichero.
> * **Se alimenta por sesión, desde el día 1** (→ `../roams-roadmap.md` regla 2). No se reconstruye al final: un `/ai-workspace` escrito la última tarde no es falsificable con credibilidad, y es el 60 % de la nota.
> * **Aquí no se cumplió, y conviene decirlo donde está la regla**: `sesiones/` y `auditorias/` se transcribieron al final del proceso. Lo que hay es real y trazable a commits, pero no es lo mismo. → [nota de procedencia](./sesiones/00-como-se-registro-esto.md).
> * Las directrices que se le dan al modelo → `../02-arquitectura/directrices-ia.md`.

---

## 1. Para qué sirven estas dos plantillas

**Sesión** y **auditoría** responden a preguntas distintas y por eso son dos ficheros:

- La **sesión** cuenta **qué se construyó y cómo se dirigió al modelo**. Es narrativa, va por orden, y su unidad es el rato de trabajo.
- La **auditoría** cuenta **qué defecto tenía el código generado y cómo se detectó**. Es puntual, y su unidad es el hallazgo.

La mayoría de sesiones no generan auditoría, y una auditoría interesante puede salir de una sesión aburrida. Mezclarlas obligaría a leer diez páginas de contexto para llegar al hallazgo, que es lo que tiene valor.

**La regla que gobierna las dos: lo que importa es lo que se rechazó.** Que un modelo genere una ruta Fastify correcta no dice nada de nadie. Que genere un `if (country === 'ES')` y **por qué no se aceptó** es exactamente lo que el enunciado llama "criterio técnico y control de calidad".

---

## 2. Plantilla — sesión de vibe coding

Fichero: `sesiones/NN-titulo-corto.md`. Numeración correlativa; el título dice **qué se construyó**, no cuándo.

```markdown
# Sesión NN — {qué se construyó}

**Objetivo.** Una frase. Qué debía existir al terminar que no existía al empezar.
**Spec de partida.** `01-specs/features/0X-….md` §Y. (Si no hay spec, la sesión no empieza:
se escribe primero → directrices §6.1.)
**Resultado.** Hecho / Parcial / Abandonado, y en una línea por qué.

## Prompt de partida

> El prompt literal, tal cual se envió. Sin limpiar ni embellecer.

## Qué generó

Resumen de lo que devolvió el modelo. Lo que importa es la **forma** de la respuesta,
no el diff — el diff está en git.

## Qué se aceptó

- …

## Qué se rechazó, y por qué   ← la sección que importa

- **{Lo que propuso}** → rechazado: {la razón específica de este proyecto}.
  Referencia: {directrices §5 / referencia §X}.

## Qué aprendió el prompt siguiente

Si hubo que reformular, qué cambió y qué efecto tuvo. Es lo que convierte una anécdota
en criterio reutilizable.
```

**Notas de uso:**

- **El prompt va literal.** Un prompt reescrito a posteriori para que se vea bien no demuestra nada, y es la parte más fácil de detectar como falsa: los prompts reales tienen contexto, referencias a secciones y errores de tecleo.
- **"Qué se rechazó" con la lista vacía es una señal de alarma**, no de éxito. Significa que la sesión fue trivial (y quizá no merece fichero) o que no se auditó.
- **La razón de un rechazo es específica de este proyecto.** "No sigue buenas prácticas" no es una razón; "duplicaría el motor que `@saas/pricing` existe para no duplicar" sí. Si la razón sirve igual para cualquier proyecto, probablemente no se ha entendido el rechazo.
- **Una sesión abandonada se documenta igual.** Es donde está el criterio más caro de aprender.

---

## 3. Plantilla — auditoría de código generado

Fichero: `auditorias/NN-titulo-corto.md`. Se escribe cuando el código generado tiene un **defecto que sobrevive a la primera lectura**: lo que compila, pasa los tests que existen y está mal.

```markdown
# Auditoría NN — {el defecto, en cuatro palabras}

**Dónde.** `ruta/al/fichero.ts` · sesión {NN}.
**Categoría.** Invariante roto / Sobre-arquitectura / Seguridad / Corrección / Deuda encubierta.
**Gravedad.** Silencioso / Visible. (¿Habría fallado algún test o alguna pantalla?)

## Qué se pidió

El prompt o la parte relevante.

## Qué devolvió

El fragmento concreto. Corto: el mínimo que contiene el defecto.

## El defecto

Qué está mal y **por qué no salta a la vista**. Si saltaba a la vista, no es una auditoría:
es una errata.

## Cómo se detectó

Lectura dirigida a un invariante / test que falló / chequeo de arranque / revisión de un
tercero. Esta línea es la que dice si el proceso de control funciona o hubo suerte.

## Cómo se corrigió

El cambio, y si se subió de capa: ¿se puede hacer que este defecto sea **imposible** en vez
de detectable? (→ directrices §1: prevención → imposibilidad → detección.)

## Qué regla nueva deja

Si el defecto puede repetirse, la regla va a `CLAUDE.md` o a la tabla de rechazo de
`directrices-ia.md` §5. Una auditoría que no deja regla se repetirá.
```

**Notas de uso:**

- **La categoría "Silencioso" es la interesante.** Un fallo visible lo caza cualquiera; el valor del auditor está en los que compilan y pasan. En este proyecto los candidatos son conocidos de antemano: `Math.round` que no es half-up, el `ESCAPE` que falta en el `LIKE`, el `JOIN` con `plan_tiers` en el historial, el `PLAN_ARCHIVED` copiado del alta a la simulación.
- **"Cómo se detectó" es la línea más honesta del fichero.** Si la respuesta es "por casualidad", eso también se escribe: es información sobre el proceso, y un proceso que solo funciona con suerte hay que arreglarlo.
- **"Cómo se corrigió" pregunta por la capa.** Corregir la línea es el mínimo; hacer que la línea no se pueda escribir es el trabajo. Cada vez que un defecto sube de capa 3 a capa 2, la auditoría ha pagado su coste para siempre.

---

## 4. Qué NO va en estos ficheros

- **El diff.** Está en git, con más detalle y sin riesgo de desincronizarse.
- **El estado del proyecto.** Va en `../roams-roadmap.md`. Una sesión no dice en qué fase estamos.
- **El diseño.** Va en `../01-specs/`. Si una sesión descubre algo de negocio, se **actualiza la spec** y la sesión enlaza; no se cuenta dos veces.
- **La decisión.** Si de una sesión sale una decisión de arquitectura con alternativas descartadas, va a `../02-arquitectura/decisiones.md` como ADR. La sesión es el camino; el ADR es la conclusión.
