# Sesión 23 — La destilación del `/ai-workspace`: de 47 ficheros a 23

**Objetivo.** Comprimir el workspace para que un evaluador con 20-30 minutos pueda leerlo, sin perder el registro que lo hace creíble: 47 `.md` + 3 auxiliares → un dossier curado + archivo bruto.
**Herramienta.** Claude (interfaz web), como las fases de planificación: esta sesión no toca código, toca el registro.
**Spec de partida.** No hubo spec nueva: hicieron de spec las reglas de mantenimiento de cada capa y `plantillas.md` — la destilación debía conservar exactamente lo que esas reglas protegen (prompts literales, trazabilidad a commits, el rechazo como sección que importa).
**Resultado.** Hecho. Estructura final: 23 ficheros curados + `04-archivo/` con el bruto congelado. Tres documentos nuevos (`README.md` del workspace, `vibe-coding.md`, `auditorias.md`), dos fichas de auditoría nuevas (05 y 06, nacidas ya destiladas de las sesiones 14 y 19), y una pasada de revisión que cazó una docena de derivas doc↔doc y doc↔código. El commit de esta sesión es el de la reorganización entera — este diario entra en él.

## Prompt de partida

> necesito redactar bien y comprimir informacion del punto 3 del docx de la prueba devs. el proyecto lo tengo acabado pero se me a generado casi 50 archivos de texto y no puedo presentar eso al evaluador

Con el inventario de los 47 ficheros adjunto. El resto de la sesión fue por tandas — raíz y nivel superior, auditorías, sesiones en lotes, arquitectura y proceso, specs troncales, specs de features — con cada documento leído entero antes de decidir su destino.

## Qué generó

- **El criterio de compresión**: pasar de «diario exhaustivo» a «dossier curado» — el material bruto no se borra, se archiva; el destilado se lee, el archivo verifica. La compresión se concentró donde estaba el problema (las 22+1 sesiones → un documento; 6 auditorías → otro) y no donde no lo había (specs, ADR y roadmaps se quedaron, corregidos).
- **`vibe-coding.md`**: nota de procedencia con los tres tramos de la regla 2, la plantilla resumida, la cadena de 15 reglas que el proceso se fue ganando (extraída de los «qué aprendió el prompt siguiente» de los diarios), la tabla de las 23 sesiones con sus commits, y 7 casos representativos elegidos por lección distinta, no por éxito.
- **`auditorias.md`**: las 4 fichas originales casi íntegras + 2 nuevas (la hoja de impresión que cruzaba clientes; el `Number()` que borraba con toast de éxito), con el valor añadido en la cabecera — el criterio de admisión y la taxonomía de los seis métodos de detección — y la sección «lo que se quedó en el diario», que muestra el criterio aplicándose.
- **La revisión de consistencia**, que resultó ser la primera lectura del workspace *como sistema* y cazó lo que ninguna lectura por fichero puede ver: el «half-even» que contradecía a su propio párrafo diez líneas más abajo; los enlaces `§6→§7` de una renumeración vieja; «Sin protección real» sobreviviendo a la sesión 10 en un cuarto sitio; «nunca borrado físico» sobreviviendo al ADR 0013 en cinco; el `plan_id` «nunca del cuerpo» sobreviviendo al ADR 0011; `NIF-PT` contra el `CHECK` real; la doble numeración de invariantes; y un `§7` citado que no existía.

## Qué se aceptó

- La cronología de las cuatro fases (Opus → Fable → Design → Code) como sección del README del workspace: estaba en la memoria y en ningún documento.
- Las dos fichas nuevas y la taxonomía, con las candidatas descartadas por escrito (la topbar era *ruidosa*; el LIMIT 20 repetía lección).
- La sesión 21 como séptimo caso: el único que muestra la dirección aplicada al encargo humano, no solo a la IA.

## Qué se rechazó, y por qué

- **Plegar los roadmaps al README y fusionar las 10 specs de features** → propuestas iniciales de la IA, retiradas por ella misma al leer los documentos: medio workspace los cita por nombre y sección; se ahorraban ficheros rompiendo la trazabilidad que el workspace existe para dar.
- **Aplicar la regla nueva del registro solo en un hogar** → corregido por el usuario: `CLAUDE.md` y `directrices-ia.md` se declaran mutuamente coherentes («si se contradicen, el otro tiene un bug»), así que la regla se escribió en los dos. La IA habría creado exactamente la contradicción que el propio fichero define como bug.
- **Enlazar la regla del `CLAUDE.md` a un fichero que aún no existía** (`vibe-coding.md`) → corregido por el usuario: el enlace apuntó a la nota de procedencia real y se redirigió al final, cuando el destino existió.
- **Corregir el contador 373/375 en el sitio equivocado** → la IA propuso alinear; el usuario resolvió mejor: nota de estado en el roadmap que concilia ambos números sin falsear el registro histórico — los checkpoints no se reescriben.
- **Dos tests guardianes que la IA dio por existentes** en las fichas 05 y 06 → no existían, y se comprobó antes de escribirlo. Se resolvió con la verdad: en la 05, el guardián es el propio reset del efecto, dicho tal cual; en la 06, la red real es el esquema del PATCH más el guardián de acotación que sí existe.

## Qué regla nueva deja

**Un ADR que supersede no está cerrado hasta grepear la frase vieja en todo el repo, documentación incluida.** Es la especie común de casi todos los hallazgos importantes de la revisión: una regla evolucionó en un commit («nunca borrado físico», «el gating es UX», «plan_id no se acepta») y su enunciado viejo sobrevivió en dos, cuatro o cinco sitios. La regla entró en `directrices-ia.md` §6 y, en versión ejecutable, en el `CLAUDE.md` — en los dos hogares, como corresponde.

Y la del propio registro: **las sesiones futuras escriben su diario bruto en `04-archivo/sesiones/` y su fila en la tabla de `vibe-coding.md`; caso o ficha, solo si pagan su peaje.** El archivo conserva, el destilado sintetiza — que es el reparto que esta sesión construyó y la razón de que la primera persona de los diarios viejos siga intacta donde vive.

## Verificación

Chequeo automático de enlaces a cero rotos tras la reorganización y el renombrado `diseño-frontend.md → diseno-frontend.md` (29 referencias en 16 `.md` + 2 comentarios de código); contadores reverificados: **375 tests + 4 E2E · 23 sesiones · 6 auditorías · 13 ADR**; y los `grep` de cierre (`PENDIENTE|VERIFICAR`, rutas viejas de `sesiones/` y `auditorias/`) a cero fuera del archivo.
