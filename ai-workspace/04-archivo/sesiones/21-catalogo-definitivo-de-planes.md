# Sesión 21 — El catálogo definitivo de planes (Text, Demo, PRO, MAX, Premium, Almacenamiento, Tokio)

**Objetivo.** Adoptar como seed la propuesta de catálogo del usuario, en dos iteraciones: primero su lista en texto (con licencia explícita para ajustar «cantidades que no tienen sentido»), después los retoques que él mismo hizo en el panel de admin, leídos de su base de datos y convertidos en default. Más cuatro encargos: Ágora pasa a llamarse **Text** y solo tiene v1, se añade **Plan Tokio** (JPY), los sugeridos no pueden recomendar planes que ignoren métricas en uso, y las tarjetas de `planes/:id` van en orden Usuarios → Almacenamiento → Llamadas API.
**Resultado.** Hecho: catálogo de 8 filas (7 activos + MAX v1 archivado), ~40 puntos de tests y 3 smokes E2E reapuntados, specs al día. **375 tests + 4 E2E** en verde.
**Regla 2**: registrada al cierre de la tanda de entrega (→ nota en la sesión 20).

## Prompts de partida (los dos de la tanda)

> revisa mi siguiente propuesta de planes, puedes ajustar algunos datos si ves que hay cantidades que no tiene sentido. luego reajusta los planes […] para que los evaluadores al descargarse empiecen con los siguientes planes: […]

> lee los planes que tengo ahora he hecho ajustes a los planes y haz que el default sean esos. Más estos cambios: cambia en nombre de agora a Text y que solo tenga v1. añade el plan Tokio. solo demo y max tendran v2. cuando realizas una simulacion en los planes recomendados no apareceran planes si pones una cantidad distinta a 0 en un atrivuto no contenga […] por ultimo en la visualizacion planes/id el orden de las targetas es Usuarios, Almacenamiento y Llamadas API.

## Las cantidades que no tenían sentido — y qué se hizo con ellas

La propuesta mezclaba dos modelos mentales: el motor factura **por unidad** (graduated) y varias cifras estaban escritas como **precio del bloque**. Cada ajuste se documentó donde toca (seed y modelo-datos):

- «Hasta 120 GB → 60,00 $» son 7.200 $ per-unit; su equivalente exacto es **0,50 $/GB**. Lo mismo con los bloques de Premium (100 € por 50 usuarios → 2,00 €; 200 € por 256 GB → 0,80 €).
- «Hasta 0 llamadas → 700,00 €» es una **cuota fija**: inválida (`up_to > 0`) e inexpresable en graduated — un tramo de 0 unidades factura 0. Quedó como llamadas ilimitadas incluidas, y la cuota fija pura señalada como el hueco `flat` del Strategy (referencia §5.3), sin implementar.
- El «hasta 20 → 20,00 €» de MAX, seguido de 0,50 €, era un acantilado de 40× que graduated no puede querer decir: se leyó como **0,20 €**, que deja las tres métricas del plan con el mismo patrón creciente.

En la segunda iteración el usuario ya había descubierto por su cuenta el tramo **«hasta 1» caro como cuota de entrada** (150 € el primer usuario de Premium): la forma legítima de expresar una cuota fija dentro de graduated. Se adoptó tal cual.

## Lo que se defendió sin que se pidiera

- **El enunciado sobrevive al renombrado**: Text v1 conserva los tramos literales 10/8/5 — el caso que el evaluador va a probar (140 € + 21 %) sigue en el seed, solo cambió el nombre.
- **El caso «cliente con tarifa archivada» no podía morir** con la v1 de Ágora: es lo único que hace visible el §5.5 en pantalla y lo que ancla el smoke comercial. Se mudó a **MAX v1 archivado** (coherente con «MAX tendrá v2»), y Fjord con él.
- **USD y JPY hacen reales dos piezas del diseño** que solo vivían en tests: Talleres Duero (español) facturado en dólares demuestra que la divisa es del plan y no del país (§4.1), y Tokio con `minor_unit = 0` pone en pantalla el yen sin decimales (§4.4). De paso, la conversión cruzada vía base EUR dejó de ser un párrafo en futuro condicional.

## Las dos reglas de producto nuevas

- **Sugeridos**: un plan solo se recomienda si **factura todo lo que el cliente está usando** (cantidad > 0 ⇒ métrica facturada). Con 15 usuarios, un plan solo-almacenamiento salía «más barato» porque los ignoraba, no porque los cobrara mejor. Implementado sobre el `breakdown` del mismo `quote()` local; el filtro de misma divisa y `total > 0` se conservan. → spec 09 §4.3.
- **Orden canónico de métricas** en `metricasDe()`: la API devuelve los tramos por métrica alfabética (`api_calls` primero) y las tarjetas del plan de almacenamiento pintaban las llamadas antes que los GB. Ahora todo consumidor (detalle, chips del admin, catálogo) ordena Usuarios → Almacenamiento → API, como los sliders.

## Posdata: el fallo que cazó el CI

El smoke de vistas asertaba `getByText('En adelante')` y el detalle de Almacenamiento pasó a tener **dos** tablas (dos métricas, dos tramos abiertos): violación del modo estricto de Playwright. El arreglo no fue el `.first()` reflejo, sino `toHaveCount(2)` — cuenta exacta, más fuerte que la aserción original. Entró como v1.0.1 con el CI de vuelta en verde.

## Verificación

375 tests + 4 E2E (CI: `check` ×2, `e2e` ×2 y `analyze` en success); seed verificado en vivo con base en memoria — catálogo de 8, gate del enunciado (169,40 € con Text) y Fjord cotizando con su MAX v1 archivado (3,57 €).
