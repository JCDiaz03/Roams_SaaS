# Sesión 18 — Planes borrables, archivo de simulaciones y retoques

**Objetivo.** Segunda lista de la revisión del usuario: favicon de marca, el desplegable de divisa «muy simple», archivar simulaciones, dos espaciados, el contador de simulaciones del dashboard, y una pregunta que tocaba una norma dura: *¿se puede eliminar un plan sin clientes?*
**Resultado.** Todo hecho: **372 tests + 4 E2E** en verde. Dos features nuevas (borrado del plan jamás usado, ADR 0013; archivo de simulaciones, spec 09 §5.5) y una norma de `CLAUDE.md` matizada por escrito en vez de esquivada.
**Regla 2**: registrada al cerrar.

## La decisión con miga: borrar un plan contra el «nunca borrado físico»

La petición chocaba de frente con una regla que `CLAUDE.md` lista como **rechazable**: «borrado físico de planes». La salida no fue ni ignorar al usuario ni saltarse la norma en silencio, sino preguntarle a la regla **qué protege**: integridad referencial y presupuestos emitidos. Un plan con cero clientes y cero simulaciones no tiene ni la una ni los otros — la regla, en ese caso, no protegía nada.

- `DELETE /plans/{id}`: **cero referencias → eliminación física** (fila y tramos, en transacción); cualquier uso → archivar, como siempre. **La condición la decide el servidor** (la pantalla no sabe quién usa qué); la respuesta lleva `removed` para que el toast cuente la verdad.
- Las simulaciones cuentan como uso a propósito: su fila guarda `plan_id` con FK, snapshot aparte. Las FK `ON DELETE RESTRICT` quedan de red.
- Un archivado jamás usado también se elimina: «quítalo de en medio» pasa a tener cumplimiento.
- `CLAUDE.md` y modelo-datos §1 matizados: lo rechazable es borrar un plan **usado**. → ADR 0013, 4 tests de frontera.

## Archivar simulaciones (para no enseñar 100 a la vez)

- Columna aditiva `archived` (ADR 0012: `ensureColumn`, migra bases existentes con DEFAULT 0) + `PATCH /simulations/{id}` **acotado a `{ archived }`**.
- **Convive con la inmutabilidad**: la regla del §11.2 protege los números; esto es estado de vista. Dos guardianes: archivar no mueve ni un campo sellado (comparación campo a campo), y un `total_minor` en el cuerpo del PATCH es un 400.
- Historial por defecto sin archivadas (`?include_archived=true` para todas; el `total` describe la colección pedida). La ficha las separa en una sección colapsada «N archivadas» con botón de recuperar — el patrón de los planes archivados del panel admin.

## El resto de la lista

- **Favicon**: `favicon_roams_black_57x57.png` movido a `frontend/public/favicon.png`. Se queda en PNG a conciencia: para un raster de 57×57 y 3 KB, PNG ya es el formato óptimo — ICO solo aportaría multi-tamaño que no existe y SVG exigiría vectorizar la marca.
- **Selector de divisa**: el popup nativo del `<select>` no puede enseñar nombre ni marca de la elegida. Desplegable propio con la receta del menú de usuario (botones a secas, Escape, clic fuera), y el nombre de cada divisa en castellano lo deriva `Intl.DisplayNames` — cero tablas, como los símbolos. El E2E pasó de `selectOption` a abrir-y-elegir, como un usuario.
- **Espaciados**: aire entre los valores base y el aviso de tarifa (ficha), y entre la descripción y el aviso de archivado (detalle de plan).
- **Contador del dashboard**: «3 simulaciones» en una línea; apilado parecían dos datos sueltos.

## Verificación

372 tests (backend 277: +5 del borrado de planes… y el resto del archivado) + 4 E2E en verde; typecheck, lint y build limpios. El smoke comercial ejercita el desplegable de divisa nuevo.
