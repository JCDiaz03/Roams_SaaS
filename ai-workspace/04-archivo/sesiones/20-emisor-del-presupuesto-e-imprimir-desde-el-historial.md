# Sesión 20 — El emisor del presupuesto e imprimir desde el historial

**Objetivo.** Tres arreglos de la revisión del usuario: el nombre y la descripción del plan salían pegados en el alta («Plan ÁgoraTarifa por usuario…»), las simulaciones guardadas necesitaban botón de imprimir —con el empleado que **creó** la simulación en el papel, no quien lo abre—, y la cabecera «Precio por unidad» del detalle de plan estaba desalineada de su columna.
**Resultado.** Hecho: **375 tests + 4 E2E** en verde (+2 tests). Una columna nueva en el contrato (`created_by`) y la hoja de impresión compartida entre dos pantallas, como la sesión 13 dejó anotado.
**Regla 2**: las sesiones 20–22 se registraron juntas al preparar la entrega, no al cerrar cada una — dicho aquí antes que disimulado.

## Prompt de partida

> arregla esto: cuando creas un cliente, quiero que aparezca el nombre del plan en negrita y un salto de linea, luego la descripción, ahora esta todo junto ("Plan ÁgoraTarifa por usuario activo…"). boton de imprimir de las "Simulaciones guardadas" ojo que si lo crea X empleado tiene que aparecer ese empleado en la factura que a creado la simulacion no quien lo abre. planes/id en las targetas el texto/columna "Precio por unidad" no esta alineado con el precio

## La decisión con miga: el emisor es un dato de la simulación, no de la sesión

La hoja de impresión recibía el emisor como prop desde la sesión de quien miraba — correcto mientras solo imprimía quien acababa de guardar, y mentira en cuanto el historial imprime. La corrección no fue pasarle otro prop, sino mover el dato a donde pertenece:

- **Columna aditiva `created_by`** en `simulations` (ADR 0012: `ensureColumn`, filas viejas a `NULL`), rellenada por el **servidor** con el nombre de la sesión que hace el `POST` — nunca un campo del cuerpo, el mismo criterio del invariante 1. El tope 60 es el del `usuario` del login: la identidad nace allí y la columna solo la fotografía.
- `PrintSheet` pasa a leer `sim.created_by`: reimprimir otro día u otro comercial no cambia el autor. La fila anterior a la columna imprime **sin** emisor — mejor un papel sin firma que uno con la firma equivocada.
- El test que fija la regla exacta del prompt: guarda 'Evaluadora', lee 'Comercial B', y el emisor sigue siendo 'Evaluadora'.

## Imprimir desde el historial: mover, no rehacer

La sesión 13 había descartado esta ruta con una nota: «si se pidiera, es mover `PrintSheet` a un componente compartido, no rehacerlo». Se pidió, y la nota se ejecutó: la ficha monta la **misma** hoja con la simulación de la card elegida (número persistido, jamás un preview) y `flushSync` garantiza que está montada antes de que `window.print()` —síncrono— abra el diálogo. Es el único import entre features del frontend, y está documentado en la cabecera del componente.

## Los otros dos arreglos (CSS, pero con causa)

- **Alta de cliente**: `planNombre` y `planResumen` eran `<span>` (inline) — el `margin-bottom` del nombre nunca aplicó. `display: block` en ambos.
- **Detalle de plan**: `.tabla th { text-align: left }` le ganaba a `.precio` por especificidad y la cabecera quedaba a la izquierda de su columna de números. Regla explícita `.tabla th.precio`.

## Verificación

375 tests (+2 del emisor) + typecheck y lint; en vivo contra un backend desechable: POST como Laura → historial leído como Pedro conserva `created_by: "Laura"`, y la migración aditiva probada sobre una copia de la base real (filas viejas a `NULL`).
