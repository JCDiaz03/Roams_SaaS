# Auditoría 04 — Un plan válido podía romper todas sus simulaciones futuras

**Dónde.** `backend/src/features/plans/plans.schemas.ts` + `plan-template.validation.ts` · auditoría de cierre, tres agentes en paralelo.
**Categoría.** Robustez (overflow aritmético alcanzable por la API).
**Gravedad.** **Silencioso dos veces.** El plan malo entra con un 201 impecable, y en la zona intermedia el dinero se persiste **impreciso sin que ningún test ni CHECK lo cace**.

## Qué había

Las cantidades de simulación llevaban topes anti-DoS declarados (`TOPES`, `simulations.schemas.ts`: usuarios ≤ 1e6, llamadas ≤ 1e9), con su comentario explicando el porqué. Los campos de dinero del plan, no: `unit_price_minor` solo exigía `minimum: 0` y `up_to` solo `minimum: 1`.

Y el comentario de `rounding.ts` afirmaba: *«Con los topes de hoy no desborda el rango exacto de number»* — cierto solo a medias: **los topes de hoy acotaban cantidades, no precios**.

## El defecto

Verificado end-to-end contra el harness real:

1. `POST /plans` con `unit_price_minor: 1e15` → **201**. Un plan perfectamente válido para el sistema.
2. Desde ese momento, `POST /simulations` de cualquier cliente de ese plan con `api_calls: 1e9` → **500 permanente** (la base, 1e24, no cabe en el `INTEGER` de SQLite).
3. **La zona intermedia es peor**: con productos entre 2⁵³ y 2⁶³ (precio 9e6 × 1e9 llamadas), el importe se calcula en `number` **con pérdida de precisión y se persiste**. El `CHECK (total = base + tax)` no lo caza, porque los tres números salen de la misma base imprecisa: la tabla guarda un total que cuadra consigo mismo y no con la aritmética real.

El caso 2 es ruidoso pero diferido (revienta al simular, no al crear); el caso 3 es la clase de defecto que este proyecto más persigue: **dinero mal guardado que nada detecta**.

## Cómo se detectó

En la auditoría de cierre, buscando **inconsistencias entre zonas análogas**: si las cantidades de simulación tienen topes anti-overflow razonados, ¿por qué los precios del plan no? La asimetría era la pista; la sonda contra el harness (201 → 500) fue la prueba.

## Cómo se corrigió

`TOPES_PLAN` (`unit_price_minor` ≤ 1e6 minor = 10.000 €/unidad; `up_to` ≤ 1e9), con la derivación escrita en el comentario: el peor producto posible (precio máximo × tope de `api_calls`) queda en 1e15, un orden por debajo de 2⁵³; la suma de tres métricas más el impuesto sigue cabiendo.

Aplicado **en las dos puertas**, como los `maxLength` se duplican en los `CHECK`: el esquema Fastify (400 en la API) y el validador de plantilla (`PRICE_TOO_HIGH` / `CUT_TOO_HIGH`, porque el seed no pasa por el esquema). Tests en ambas capas, incluido el valor exacto del tope.

## Qué regla nueva deja

**Todo número que multiplica a otro necesita que el producto tenga dueño.** No basta con acotar un factor: el comentario de `rounding.ts` era verdad el día que se escribió y mentira el día que los planes se volvieron editables por API. Cuando una afirmación de seguridad depende de topes, los topes deben cubrir *todos* los factores del peor producto — y la forma de encontrar el que falta es preguntar por qué una zona análoga los tiene y esta no.
