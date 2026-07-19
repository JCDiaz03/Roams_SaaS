# Sesión 13 — Presupuesto imprimible (Fase 3, §5.4, cierre de la fase)

**Objetivo.** Que el comercial que hoy explica el número por teléfono pueda entregarlo en papel o PDF, sin librerías ni servidor.
**Decisión de partida.** Roadmap §5.4/§5.5: `@media print`; la generación de PDF en servidor quedó evaluada y descartada por escrito antes de empezar.
**Resultado.** Hecho. `PrintSheet` + regla global de visibilidad + botón junto al sello, verificado dentro del smoke E2E con `emulateMedia`.
**Regla 2**: registrada al cerrar la sesión.

## Prompt de partida

> sigue con el 5.4, luego haz comit con todo

## Qué generó

`PrintSheet.tsx` (membrete, cliente, plan, desglose por tramos, total, pie de emisión) con su módulo CSS en unidades de punto, la regla `@media print` de `global.css` (visibilidad, no display: la app desaparece del papel sin tocar un componente), el botón «Imprimir presupuesto» en el panel sellado, y las aserciones de impresión en el smoke comercial.

## Las dos decisiones de producto

1. **Solo se imprime la simulación sellada.** El botón no existe en el estado de preview: lo que se entrega a un cliente es el número que el backend persistió, no un preview que nadie podría reproducir mañana. El estado del simulador pasó de guardar la fecha (`selladaEn`) a guardar la simulación entera, porque la hoja se pinta con `total_minor` y `breakdown` **de la respuesta del POST**, no del preview local — aunque hoy sean idénticos por construcción, la hoja declara con datos de quién es el número.
2. **La divisa de visualización no se imprime.** El papel va en la divisa de facturación con su pie («Importes en EUR, la divisa de facturación del plan»). Imprimir el convertido sería congelar en un documento entregable una referencia que el invariante 4 define como efímera.

## Qué se aceptó

- **Tinta sobre blanco, sin tokens de tema**: los tokens son de pantalla, y un papel que dependiera del tema oscuro sería un papel negro. La hoja usa `#000`/`#fff` y puntos tipográficos, deliberadamente fuera del sistema de diseño.
- **Visibilidad y no display para vaciar el papel**: `body * { visibility: hidden }` + la hoja visible. Con `display: none` habría que marcar contenedores por toda la app; con visibilidad, cero componentes tocados.
- **El pie dice «orientativo, no es una factura»**: el producto no factura (referencia §1), y un papel con membrete y desglose se parece lo bastante a una como para tener que negarlo por escrito.

## Qué se rechazó

- **Generación de PDF en servidor**: ya estaba descartada por escrito (§5.5) — un headless browser o una librería de PDF para lo que `@media print` resuelve con cero dependencias.
- **Imprimir desde el historial**: las cards del historial no llevan el desglose (lo reconstruye el detalle), y añadir una segunda ruta de impresión duplicaría la hoja para un caso que el flujo real (simular → guardar → entregar) no pide. Si se pidiera, es mover `PrintSheet` a un componente compartido, no rehacerlo.

## Verificación

Dentro del smoke E2E, con `emulateMedia({ media: 'print' })`: la hoja visible con el título, el **número persistido** (184,45 €) y el emisor («Emitido por María»), y el selector de divisa —la app de pantalla— invisible. Es literalmente lo que Ctrl+P mandaría a la impresora.
