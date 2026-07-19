# Sesión 22 — Buscador en /planes y la deduplicación transversal

**Objetivo.** Dos encargos encadenados: un buscador que filtre el listado de planes **reutilizando** el del dashboard («para no duplicar código»), y después una auditoría de componentes con funcionamiento similar y código distinto — con orden de aplicar cuatro de los seis hallazgos.
**Resultado.** Hecho: dos piezas extraídas para el buscador y cuatro deduplicaciones aplicadas; 34 tests de frontend + typecheck, lint y build en verde, con el bundle ligeramente más pequeño por el CSS deduplicado.
**Regla 2**: registrada al cierre de la tanda de entrega (→ nota en la sesión 20).

## Prompts de partida

> añade un buscador en /planes para que filtre, lo ideal seria que se reutirizara parte del codigo del filtro que hay en el dasbord para no duplicar codio.

> hay componentes con funcionamiento similares pero con codigos distintos que se pueda optimizar en este proyecto? […] aplica la 1, 2, 3 y 4

## El buscador: extraer las dos mitades, no copiar ninguna

El buscador del dashboard tenía dos partes con destinos distintos, y la extracción respetó el corte:

- **`lib/busqueda-url.ts`** — `useBusquedaEnUrl()`: el término en `?q=` con debounce de 250 ms y la parte delicada (distinguir «la URL cambió porque yo tecleé» de «cambió desde fuera», que es lo que hace funcionar el buscador de la topbar). Movida con sus comentarios: esa lógica no debía existir dos veces. Más `contiene()`, la comparación sin mayúsculas ni acentos para filtros locales.
- **`ui/SearchBar`** — la pastilla visual (lupa + input) con su CSS, ahora componente del sistema.

`/planes` filtra **en local** (el catálogo entero ya está en memoria; ningún endpoint nuevo) por nombre, métrica o divisa — «usd» encuentra el plan en dólares, «agora» encontraría «Plan Ágora» sin acento. Dos detalles de producto: el grupo de archivados **se abre solo mientras se filtra** (un archivado que coincide no puede quedar escondido tras el summary) y «ningún plan coincide» es una pantalla, no una lista vacía muda (13.1).

## La auditoría de duplicados: seis hallazgos, cuatro aplicados, dos rechazados

Aplicados, por orden de valor:

1. **`importeMostrado()`** (`lib/currency-format`): la regla del importe convertido —cuándo convertir, y que el convertido **jamás** se enseña sin etiqueta de referencia ni sin el facturado al lado (invariante 4 de la referencia)— estaba calculada dos veces, en el panel de resultado y en las cards del historial. Es regla de producto, no cosmética: el mismo riesgo que motivó el paquete `pricing` compartido, a escala pequeña. Ahora `facturado !== null` significa «esto es una conversión: etiquétala».
2. **`ui/Breadcrumbs`**: tres copias del mismo `<nav>` con tres copias del mismo CSS (ficha, detalle de plan, simulador).
3. **`lib/fechas.ts`**: cuatro formateadores locales que eran dos (`fechaLarga`, `fechaCorta`).
4. **`ui/ErrorCarga`**: la card «no hemos podido cargar X» + Reintentar, dibujada a mano en seis pantallas. Con prop `extra` para el «Volver al buscador» del simulador. Los estados **vacíos** siguen siendo de cada pantalla: error de red ≠ vacío (13.1).

Rechazados, y el porqué es el mismo criterio que rechaza la hexagonal completa:

- **La máquina de estados de carga** (`cancelado`/`intento`/`cargando|listo|error|no-encontrado`, en seis páginas): la mayor en líneas, pero cada página tiene variantes reales (doble petición, 404 vs red, resets por cambio de id) y forzarlas bajo un `useCarga()` genérico es coste cierto por beneficio hipotético.
- **Los `<details>` de archivados**: patrón compartido, contenidos y estilos suficientemente distintos.

## Verificación

Typecheck, lint, 34 tests de frontend y build de producción en verde (CSS 39,06 → 38,60 kB). Único cambio visible: el error del dashboard pasa de banner horizontal a la card centrada común. El E2E que clica la miga de Fjord sigue pasando: mismo rol, mismo `aria-label`, mismos enlaces.
