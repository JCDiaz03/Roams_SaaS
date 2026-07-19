# El proceso de vibe coding — cómo se dirigió a la IA, sesión a sesión

## Nota de procedencia: cómo se registró esto

**Los diarios de las primeras nueve sesiones se transcribieron al final de la primera entrega, no durante.** Conviene decirlo antes que nada, por tres razones.

La primera es que **el roadmap dice explícitamente que no se haga así**: la regla 2 exige que `/ai-workspace` «se alimente por sesión, desde el día 1, no se reconstruya al final». La regla es buena y ahí no se cumplió. Es un incumplimiento del propio plan, y ocultarlo sería peor que el incumplimiento. La historia completa de la regla tiene tres tramos, y los tres están declarados donde tocan: las sesiones **01–09** se transcribieron al final; desde la Fase 3 y toda la tanda del catálogo (**10–19**), cada sesión se registró **al cerrarla** — la regla vive desde entonces también en el `CLAUDE.md` que la IA relee cada sesión, que es donde tenía que haber vivido desde el principio —; las **20–22** se registraron juntas al preparar la entrega, dicho en la propia sesión 20 antes que disimulado; y la **23** —esta destilación— se registró al cerrarla.

La segunda es que **la plantilla de registro de este directorio avisa de lo que pasa cuando se hace a posteriori**: «un prompt reescrito para que se vea bien no demuestra nada, y es la parte más fácil de detectar como falsa». Presentar esto como si se hubiera escrito sobre la marcha sería, además, inútil: `git log` muestra que los primeros diarios entraron en un único commit.

Y la tercera es que **el contenido sí es real, y es verificable**, que es lo que salva el registro:

- **Los prompts son literales.** Copiados tal cual se enviaron, con sus abreviaturas y sus erratas (`"tengo el front hecho con el desing conecta e importa"`). No se han limpiado.
- **Cada sesión corresponde a un commit**, y el commit está enlazado. Lo que dice haber construido está en el diff.
- **Cada hallazgo es comprobable.** Cuando una sesión dice «un test cazó que `additionalProperties: false` no daba 400», ese test existe, ese commit lo arregla, y quien dude puede revertir el arreglo y ver el test ponerse rojo.

Lo que se perdió por no escribirlo a tiempo es real y no se puede recuperar: **los callejones sin salida**. Un registro escrito al final tiende a contar una línea recta —problema, decisión, solución— porque es lo que queda en la memoria y en el diff. Un registro contemporáneo los tendría todos, y esa es exactamente su ventaja.

Este documento es la **destilación** de los 23 diarios; los originales completos, sin editar, están en [`../04-archivo/sesiones/`](../04-archivo/sesiones/).

## Cómo se registró cada sesión

Todos los diarios siguen la misma plantilla: **objetivo · spec de partida · resultado**, el **prompt literal**, qué generó el modelo, **qué se aceptó** (con su porqué, que es lo que distingue aceptar de tragar), **qué se rechazó y por qué** — la sección que importa — y **qué aprendió el prompt siguiente**. La regla que gobierna el formato: *que un modelo genere una ruta Fastify correcta no dice nada de nadie; que genere un `if (country === 'ES')` y por qué no se aceptó es exactamente lo que el enunciado llama "criterio técnico"*. La plantilla original (archivada en [`../04-archivo/plantillas.md`](../04-archivo/plantillas.md)) fija además las reglas que evitan que el registro se convierta en teatro:

- **El prompt va literal.** Un prompt reescrito a posteriori para que se vea bien no demuestra nada, y es la parte más fácil de detectar como falsa: los prompts reales tienen contexto, referencias a secciones y errores de tecleo.
- **«Qué se rechazó» con la lista vacía es una señal de alarma**, no de éxito: o la sesión fue trivial, o no se auditó.
- **La razón de un rechazo es específica de este proyecto.** «No sigue buenas prácticas» no es una razón; «duplicaría el motor que `@saas/pricing` existe para no duplicar», sí.
- **Una sesión abandonada se documenta igual**: es donde está el criterio más caro de aprender.

Las auditorías tienen su plantilla hermana en el mismo fichero, cuya línea más honesta es «cómo se detectó»: si la respuesta fuera «por casualidad», también se escribiría — un proceso que solo funciona con suerte hay que arreglarlo. El resultado está en [`auditorias.md`](./auditorias.md).

## El flujo de trabajo: las reglas que el proceso se fue ganando

Más útil que describir «una sesión típica» es contar cómo cambió el trabajo: casi cada sesión dejó una regla que las siguientes ya cumplen. En orden de adquisición:

1. **La spec es el prompt.** El prompt de la sesión 01 tiene cuatro palabras («empieza por los esqueletos pendientes de Fase 0») y funciona porque el roadmap listaba qué faltaba e `idea-referencia.md` traía las 469 líneas de decisiones. El prompt corto es la consecuencia de una spec buena, no una virtud propia. (→ 01)
2. **Proponer no es decidir.** Lo que la IA propone y el usuario no ha confirmado se marca `(propuesto)` y se espera. (→ 01)
3. **El CI se comprueba antes del push, no después.** La primera vez evitó tres rojos en el commit inicial; ninguna sesión posterior lo puso en rojo. (→ 02)
4. **Los comandos sobre credenciales se acotan antes de ejecutarlos.** Regla nacida de un incidente real, contado abajo. (→ 02, caso)
5. **«No ha dado error» y «hace lo que dice» son cosas distintas.** Cada sesión acaba ejecutando lo construido y mirando el resultado, no el código. (→ 03)
6. **La mutación es barata y se hace siempre.** Dos minutos de romper el código a propósito convierten «los tests pasan» en «los tests sirven». (→ 04, 05, 08)
7. **La spec no es la verdad: es una hipótesis con autoridad.** Cuando spec y test discrepan, gana el test y el documento se corrige **en el mismo commit** — pasó con el conjunto del CIF, el ejemplo de `Intl`, el gotcha de Ajv y el «Crear → versión 1». (→ 05, caso)
8. **Un encargo se puede cumplir mejor rechazando parte de él** — y se dice antes de empezar, con la alternativa y su porqué. (→ 06, caso)
9. **Los defaults del framework son parte del contrato.** `additionalProperties: false` es la línea que uno escribe; `removeAdditional` es lo que decide qué significa. (→ 07 · [auditoría 01](./auditorias.md))
10. **El gate se ejecuta aunque nadie lo mire.** La regla más importante del plan era la más fácil de saltarse; la Fase 2 no se abrió hasta clonar en limpio y ver el 169,40 €. (→ 09, caso)
11. **Lo incognoscible se queda detrás de un puerto.** No se adivina el IdP de la empresa: se construye lo invariante y se deja la costura — y la apuesta se comprobó con un diff. (→ 10)
12. **Verde no es sinónimo de correcto**: una suite entera puede estar en verde con la app rota, si el defecto vive en una frontera que esa suite no atraviesa. (→ 11, caso)
13. **Las ambigüedades se cierran con el usuario antes de escribir el plan.** La tanda del catálogo abrió con cuatro preguntas de producto, y el código llegó después de las respuestas. (→ 15)
14. **A una regla no se la obedece a ciegas ni se la esquiva: se le pregunta qué protege.** (→ 18, caso)
15. **El encargo también se audita.** Las cantidades escritas en el modelo mental equivocado se traducen — ni se siembran tal cual ni se corrigen en silencio — y lo que el encargo pondría en riesgo sin querer se defiende con su porqué. (→ 21, caso)

## Las 23 sesiones

| # | Sesión | Commit | Lo que importa |
|---|---|---|---|
| 01 | Los esqueletos de Fase 0 | `53a10af` | Diez documentos antes de una línea de código. Se rechaza `REAL` para los tipos impositivos → puntos básicos enteros (`rate_bp`) |
| 02 | Repo público y `.gitignore` | `5747351` | El CI mirado antes del push evita tres rojos. Y el incidente del token (→ caso) |
| 03 | Esquema SQL y seed | `52751d3` | Las ocho defensas del esquema, verificadas ejecutándolas: FK, `STRICT`, `CHECK`, UNIQUE saltan de verdad |
| 04 | El paquete `pricing` | `f4d56ce` | 61 tests validados por mutación (4 mutantes, todos mueren). Dos fallos en los tests, ninguno del código |
| 05 | Validación fiscal | `4bf3e31` | Un test destapó que la spec se contradecía: K/L/M no son CIF (→ caso · [auditoría 02](./auditorias.md)) |
| 06 | Importar el diseño | `e9a75a8` | Se rechaza la mitad del encargo: del prototipo se porta el aspecto, no la lógica (→ caso · [auditoría 03](./auditorias.md)) |
| 07 | El backend | `49dd58e` | `additionalProperties: false` no daba 400 (→ [auditoría 01](./auditorias.md)). Y el `ORDER BY` binario que ponía a Ágora detrás de Bitácora |
| 08 | Las cinco pantallas | `e4fe7dd` | El test valioso no protege el mock: protege la costura (`"ADMIN"` una sola vez). El arnés de Chrome costó más que el producto |
| 09 | Fase 2 | `5dc4eb8` | El gate de Fase 1, ejecutado antes de abrir la 2. Y «Crear → versión 1»: mi propia spec inducía al bug (→ caso) |
| 10 | Auth real con identidad enchufable | `2c97812` | La apuesta del ADR 0007, comprobada: sustituir el mock costó exactamente un módulo |
| 11 | Smoke E2E con Playwright | `ffbdbfd` | Su primer arranque cazó el CSRF que 219 tests en verde no podían ver (→ caso) |
| 12 | `PT_NIF`: la promesa del registro | `ef827d2` | Cero endpoints tocados — el diff es la prueba. Cuatro tests se rompieron porque su ciclo de vida se completó |
| 13 | Presupuesto imprimible | `ef827d2` | Solo se imprime lo sellado, y la divisa de visualización no va al papel |
| 14 | Auditoría de cierre: tres lentes | `ca9c90c` | 4 altos y ~25 medios/bajos corregidos, y lo que se decidió NO tocar (→ [auditorías 04 y 05](./auditorias.md)) |
| 15 | La tanda del catálogo de planes | `997755b` | Cuatro preguntas antes que el código; el guardián de `plan_id` reescrito como batería, no borrado (ADR 0011) |
| 16 | Los retoques de la revisión del usuario | `8acf9cd` | Once retoques, la auditoría XSS limpia, y el precio en blanco que valía 0 € |
| 17 | Accesibilidad y Lighthouse | `8acf9cd` | Suelo de 12px, axe en 9 pantallas, CLS 0,25 → 0. A11y 100 en las 8 vistas |
| 18 | Planes borrables y archivo de simulaciones | `8acf9cd` | A la regla del «nunca borrado físico» se le preguntó qué protege (ADR 0013) (→ caso) |
| 19 | Auditoría pre-publicación | `f1602c3` | Review adversarial: 22 agentes, 10/10 hallazgos corregidos (→ [auditoría 06](./auditorias.md)) |
| 20 | El emisor del presupuesto e imprimir desde el historial | `99da140` | `created_by` lo escribe el servidor, jamás el cuerpo — mejor un papel sin firma que con la firma equivocada. La nota de la sesión 13 («mover, no rehacer»), ejecutada |
| 21 | El catálogo definitivo de planes | `99da140` + `d96c551` | Los precios «por bloque» del usuario, traducidos a per-unit con cada ajuste documentado; el caso del enunciado y la tarifa archivada, defendidos sin que se pidiera (→ caso) |
| 22 | Buscador en /planes y deduplicación transversal | `99da140` | Extraer las dos mitades del buscador, no copiar ninguna; 4 duplicados unificados y 2 rechazados con el mismo criterio que la hexagonal |
| 23 | La destilación del `/ai-workspace` | *(el commit de la reorganización — este diario entra en él)* | De 47 ficheros a 23: dossier curado + archivo bruto congelado. Dos fichas nacidas ya destiladas (05, 06) y una pasada que cazó una docena de derivas doc↔doc y doc↔código |

## Casos representativos

No están elegidos por salir bien: están elegidos porque muestran el trabajo de dirección — qué se le pidió al modelo, qué propuso, y qué se rechazó con qué argumento. Cada uno enseña una cosa distinta.

### Caso: el incidente del token (sesión 02)

Para averiguar qué cuenta tenía cacheada el gestor de credenciales se ejecutó `git credential fill`, que **imprime la credencial entera**. El token de GitHub del usuario quedó escrito en el transcript de la conversación. Bastaba con mirar el campo `username`; no se pensó — «vamos a ver qué sale» — y se volcó más de lo necesario. Se avisó en cuanto pasó y se recomendó revocarlo, que es lo que se hizo.

**La regla que deja**: un comando de diagnóstico sobre credenciales se acota **antes** de ejecutarlo, no después de leer la salida. «Vamos a ver qué sale» no es una estrategia aceptable cuando lo que puede salir es un secreto.

Este caso está aquí a propósito: un registro donde todo sale bien es un registro maquillado, y este incidente —confesado en el momento, con su regla escrita— es la mejor prueba de que este no lo está.

### Caso: la spec contradicha por su propio test (sesión 05)

El prompt: «ahora la validación fiscal con sus tests». El modelo implementó el conjunto de iniciales de CIF **exactamente como decía la spec** — K, L y M incluidas, como en bastantes implementaciones publicadas. Y la spec estaba mal: K/L/M son NIF de persona física con control `mod 23`, no CIF con checksum ponderado.

Lo destapó **un test que intentaba documentar un recorte**: el §4.4 de esa misma spec declaraba «K/L/M no se soportan, se rechazan» — el documento se contradecía a sí mismo y solo el test lo notó. De paso salieron dos datos más mal en la spec (la letra de control de `P1234567` y el caso afilado del tipo de control). Código y spec se corrigieron **en el mismo commit**, y la batería se validó por mutación: cinco mutantes, todos mueren — devolver K/L/M al conjunto mata 3 tests. → [Auditoría 02](./auditorias.md).

**La lección**: la spec no es la verdad, es una hipótesis con autoridad. Se escribió antes de programar y por eso vale; el código que la implementa es la primera vez que alguien la comprueba de verdad.

### Caso: la mitad del encargo, rechazada antes de empezar (sesión 06)

El prompt, literal y con su errata — limpiarlo quitaría lo único que prueba que es real:

> tengo el front hecho con el desing conecta e importa:
> Use the claude_design MCP (…) to import this project: (…)
> Implement: SaaS-O-Matic.dc.html

Antes de escribir nada, el modelo leyó el `.dc.html` (82 KB) y **dijo que no a la mitad del encargo**, con motivos:

- **«Implement» al pie de la letra, rechazado.** El prototipo trae su propia reimplementación de todo el núcleo: un motor de tramos (`tierCost`), un `roundHalfUp(x) = Math.floor(x + 0.5)` que opera en float y falla con negativos, un validador fiscal completo y los impuestos como `tax: 0.21`. Perfecto en un mockup, y exactamente lo que las directrices §5 prohíben en producción: sería la segunda implementación del motor y la tercera del validador. **Del prototipo se porta el lenguaje visual; la lógica se tira.**
- **Las cinco pantallas, rechazadas *por ahora***: consumen una API que aún no existía (§3.2 entero pendiente). Se ofreció la alternativa — tokens y primitivas, que no dependen de nada — y el usuario la eligió.
- **Poppins desde Google Fonts, rechazada** (tercero + CSP): auto-alojada con subset latino explícito — sin él se empaquetaba devanagari, 512 KB → 80 KB. **Las banderas del selector de divisa, rechazadas**: el euro no es de un país y una bandera no la lee un lector de pantalla.

Dos detalles que dan la medida del método. Uno: el validador del prototipo **ya excluía K/L/M** (bien) pero aceptaba `okNum || okLet` — el validador permisivo que la sesión anterior había rechazado; sin las directrices, esa lógica habría entrado con el diseño. Dos: al medir el prototipo contra su propio brief, ocho pares de color fallaban AA (→ [auditoría 03](./auditorias.md)).

**Resultado**: parcial y a propósito. Dos sesiones después, las pantallas se montaron encima sin tirar nada.

### Caso: primero no empezar, y la spec que inducía al bug (sesión 09)

El prompt: «ahora la Fase 2». Lo primero que se hizo fue **no empezar**: la regla 1 del roadmap dice que la Fase 2 solo se abre con el gate de Fase 1 en verde, y ese gate no se había ejecutado nunca. Clon limpio → `npm install` (0 vulnerabilidades) → `npm run dev` siguiendo solo el README → **15 usuarios = 169,40 €**. Entonces se abrió la fase. Era la regla más importante del plan y la más fácil de saltarse, porque nadie la estaba mirando.

Dentro de la fase, el hallazgo: crear un plan con el nombre de uno archivado devolvía **500** — `crearPlan` fijaba `version = 1` contra el `UNIQUE (name, version)`. Y el enunciado que indujo el bug **era de la propia spec**: la tabla del §5.5 decía «Crear | Inserta plan, `version = 1`», sin matices, en un documento que se lee como autoridad. La corrección no fue un parche sino coherencia: si el `UNIQUE` dice que el nombre es la identidad del linaje, reutilizarlo es continuarlo — crear usa la siguiente versión de ese nombre, y la versión 1 es el caso particular de un nombre nunca usado. La spec quedó con un §4.4 que lo explica.

**La lección, que es la tesis de toda la Fase 0**: una spec escrita antes de programar acierta en el diseño y se equivoca en los detalles, y las dos cosas son ciertas a la vez. El valor de la Fase 0 no era tener razón en todo. Era tener algo concreto **contra lo que fallar**.

### Caso: el E2E que cazó lo que 219 tests en verde no podían ver (sesión 11)

El objetivo era convertir en repetible la verificación manual de las pantallas. **Rindió antes de estar terminado**: su primer arranque enseñó que el cinturón anti-CSRF (`Origin` vs `Host`) rechazaba a la propia aplicación — toda mutación desde el navegador devolvía 403. La comparación era correcta en `app.inject` (219 tests de integración en verde) y falsa en el mundo real, porque el proxy de Vite reescribe el `Host`. Se corrigió a `Sec-Fetch-Site`, que el navegador calcula contra el origen que el usuario ve y sobrevive a cualquier proxy.

De propina, axe cazó un contraste real que el test de tokens no puede ver (una opacidad compuesta sobre texto secundario), y la estabilidad se compró con criterio y no con muletas: workers = 1, fixture local de tipos, **cero retries** — «un smoke que necesita reintentar está contando un problema real», y el `getByText('v3')` flaky lo demostró: la solución fue un ancla determinista, no un retry que lo habría escondido para siempre.

**La lección incómoda y valiosa**: una suite de integración entera puede estar en verde con la app rota, si el defecto vive en una frontera que esa suite no atraviesa. `app.inject` no pasa por ningún proxy; el navegador, sí.

### Caso: preguntarle a la regla qué protege (sesión 18)

La petición del usuario — *¿se puede eliminar un plan sin clientes?* — chocaba de frente con una norma que `CLAUDE.md` lista como rechazable: «borrado físico de planes». La salida no fue ni ignorar al usuario ni saltarse la norma en silencio, sino **preguntarle a la regla qué protege**: integridad referencial y presupuestos emitidos. Un plan con cero clientes y cero simulaciones no tiene ni la una ni los otros — la regla, en ese caso, no protegía nada.

El resultado: `DELETE /plans/{id}` elimina físicamente solo con cero referencias (**la condición la decide el servidor**, que es quien sabe quién usa qué; las FK `ON DELETE RESTRICT` quedan de red), y archiva en cualquier otro caso. La norma de `CLAUDE.md` se **matizó por escrito** — lo rechazable es borrar un plan *usado* — con su ADR (0013) y 4 tests de frontera.

**La lección**: las directrices que gobiernan a la IA no son dogma ni papel mojado. Cuando una petición legítima choca con una, el trabajo del que dirige es interrogar la regla, decidir, y dejar la decisión escrita donde la IA la relea — que es exactamente para lo que existe el fichero.


### Caso: auditar también el encargo (sesión 21)

El usuario propuso el catálogo definitivo de planes, con licencia explícita: «puedes ajustar algunos datos si ves que hay cantidades que no tienen sentido». Y las había, con causa: la propuesta mezclaba dos modelos mentales — el motor factura **por unidad** (graduated) y varias cifras venían escritas como **precio del bloque**. La respuesta no fue sembrarlas tal cual (datos rotos con permiso) ni corregirlas en silencio (datos distintos de los pedidos): fue **traducir y documentar cada ajuste**. «Hasta 120 GB → 60 $» son 7.200 $/GB; su equivalente exacto es 0,50 $/GB. «Hasta 0 llamadas → 700 €» es una cuota fija, inválida e inexpresable en graduated: quedó como llamadas ilimitadas incluidas, con la cuota fija pura señalada como el hueco `flat` del Strategy, sin implementar. Y el acantilado de 40× de MAX se leyó como la errata que era.

Junto a la traducción, **lo que se defendió sin que se pidiera**: el renombrado Ágora → Text no podía llevarse el caso literal del enunciado (Text v1 conserva los tramos 10/8/5: el 140 € + 21 % que el evaluador va a probar sigue en el seed) ni matar el único sitio donde la inmutabilidad de precios es visible en pantalla — el cliente con tarifa archivada se mudó a MAX v1, y Fjord con él, con los tres smokes E2E reapuntados y en verde.

**La lección**: dirigir a la IA y dirigir el encargo son el mismo trabajo. Al usuario no se le obedece a ciegas ni se le corrige en silencio: se le traduce, y el ajuste se deja escrito donde el dato vive.
