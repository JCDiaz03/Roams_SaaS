# Spec — Motor de tramos y simulaciones

> **Capa SPEC de feature.** Qué se implementa, con qué reglas y qué casos lo prueban. El porqué de negocio → `../idea-referencia.md` §5.3, §4.2, §10, §11.2. El contrato HTTP → `../contrato-api.md` §2.2. Las tablas → `../modelo-datos.md`. La pantalla → `../diseño-frontend.md` ventana 4.
>
> Motor y endpoint se especifican juntos porque se implementan y testean juntos: el motor existe para servir a este endpoint y al preview local.

---

## 1. Alcance

- El paquete `@saas/pricing`: motor de tramos *graduated* multi-métrica (función pura) y la única función de redondeo del sistema.
- `POST /simulations`: orden de cálculo, snapshot y persistencia.
- El preview local del slider consume **el mismo motor** (→ referencia §10). No hay nada que especificar de él aparte: si esta spec se cumple, el preview es correcto por construcción.

**Fuera de alcance**: la conversión de divisa (es presentación, → `04-tipos-de-cambio.md`) y el historial (→ `03-buscador-y-detalle.md`).

---

## 2. El motor: `@saas/pricing`

### 2.1 Contrato de la función pura

```ts
type Metric = 'users' | 'storage_gb' | 'api_calls';

type Tier = {
  metric: Metric;
  up_to: number | null;        // límite superior INCLUSIVO; null = infinito
  unit_price_minor: number;    // entero >= 0
  sort_order: number;
};

type Quantities = Record<Metric, number>;   // enteros >= 0

type TierApplication = {
  up_to: number | null;
  unit_price_minor: number;
  units: number;               // unidades que caen en ESTE tramo
  amount_minor: number;        // units * unit_price_minor
};

type MetricBreakdown = {
  metric: Metric;
  billed: boolean;             // false = el plan no tiene tramos de esta métrica
  quantity: number;
  subtotal_minor: number;
  tiers: TierApplication[];    // vacío si billed = false
};

type PriceResult = {
  base_minor: number;
  tax_rate_bp: number;
  tax_minor: number;
  total_minor: number;
  currency: string;            // ISO 4217: la divisa de FACTURACIÓN del plan
  breakdown: MetricBreakdown[];
};

function price(input: {
  tiers: Tier[];
  quantities: Quantities;
  tax_rate_bp: number;
  currency: string;
}): PriceResult;
```

**Todo lo que necesita entra por argumento.** El motor no lee de la base de datos, no llama al `TaxProvider`, no conoce el reloj y no conoce el `plan_id`. Es lo que permite que el navegador lo ejecute con los tramos que trae `GET /customers/{id}` y el servidor con los que lee de SQLite, y que el resultado sea el mismo número por construcción, no por disciplina.

**El motor devuelve el `breakdown` siempre**, no bajo una bandera. Es el mismo trabajo (ya ha recorrido los tramos) y es lo que la pantalla necesita: un total sin desglose no lo puede explicar un comercial por teléfono (→ referencia §13).

**`currency` entra y sale sin usarse en la aritmética.** No es decorativo: es lo que hace que un importe nunca viaje sin su código ISO (→ referencia §3, invariante 5). El motor lo transporta; nadie tiene ocasión de perderlo.

### 2.2 El algoritmo, con la precisión que el enunciado no da

*Graduated*: cada unidad paga el precio del tramo en el que cae (→ referencia §5.3). **No es volume**: 15 usuarios en el Plan A son 140 €, no 120 €.

Por métrica, con los tramos ordenados por `sort_order`:

```
restantes = quantity
inferior  = 0                                  # límite inferior EXCLUSIVO del tramo actual
para cada tramo:
    si restantes == 0: parar
    capacidad = (tramo.up_to == null) ? restantes : tramo.up_to - inferior
    units     = min(restantes, capacidad)
    amount    = units * tramo.unit_price_minor
    restantes -= units
    inferior   = tramo.up_to
subtotal = suma de amounts
```

`base_minor` = suma de los `subtotal` de todas las métricas.

**El detalle que el enunciado deja ambiguo y hay que fijar**: dice "Tramo 1 (0 a 10)" y "Tramo 2 (11 a 50)". Con `up_to` inclusivo, la capacidad del tramo 2 es `50 − 10 = 40` unidades (los usuarios 11 a 50, ambos incluidos). Con 15 usuarios: 10 al primero, 5 al segundo → `10×1000 + 5×800 = 14000` minor = **140 €**. Cuadra con el ejemplo del enunciado, que es la comprobación de que la interpretación es la correcta.

**Solo se recorren los tramos de las métricas que el plan factura.** Una métrica sin ningún tramo produce `billed: false`, `subtotal_minor: 0` y `tiers: []` — **no se omite del `breakdown`** (→ referencia §5.2: la UI la muestra atenuada, nunca la oculta).

**El motor es agnóstico a la métrica**: no sabe si cuenta usuarios o gigas. Añadir `ram_gb` son filas nuevas en `plan_tiers` y una entrada en el tipo `Metric`; el bucle no se toca. Si algún cambio obliga a tocar el bucle para añadir una métrica, la abstracción está rota.

### 2.3 Impuesto y redondeo: dónde está el único `round` del sistema

Orden canónico (→ referencia §4.2):

```
1. base_minor  = motor de tramos                          -> entero exacto, divisa del plan
2. tax_rate_bp = tipo del PAÍS DEL CLIENTE                -> entero, puntos básicos
3. tax_minor   = round_half_up(base_minor * rate_bp / 10000)
4. total_minor = base_minor + tax_minor
5. mostrado    = total_minor * tipo_de_cambio             -> SOLO VISTA, fuera de aquí
```

**`base_minor` no necesita redondeo**: es `Σ (units × unit_price_minor)`, producto y suma de enteros. Exacto. El único punto del sistema donde aparece una fracción es el impuesto, y por eso hay exactamente **un** redondeo.

**Por qué redondear en el paso 3 no contradice el "se redondea una sola vez, al final" del §4.2.** Parece que hubiera dos lecturas —redondear el impuesto, o redondear el total— y que hubiera que elegir. No las hay: como `base_minor ∈ ℤ`,

```
round_half_up(base + tax_exacto) = base + round_half_up(tax_exacto)
```

Las dos lecturas dan **el mismo entero, siempre**. Y la del paso 3 es la única implementable, porque `tax_minor` se persiste y una columna `INTEGER` no admite una fracción. El invariante que sí importa —y que el `CHECK (total_minor = base_minor + tax_minor)` de la tabla garantiza— es que **base y tax suman total exactamente**, sin un céntimo de deriva.

Lo que el §4.2 prohíbe de verdad es otra cosa: **redondear antes de tener el total en la divisa de facturación**, o redondear en la divisa de visualización. Eso sigue prohibido.

**`round_half_up` es una función de `@saas/pricing` y es la única del sistema.**

```ts
// Redondeo half-up sobre enteros: NO usar Math.round (no es half-up para negativos)
// ni coma flotante en ningún paso intermedio.
function roundHalfUpDiv(numerador: bigint, denominador: bigint): bigint;
```

Tres razones para que no sea un `Math.round(base * rate / 10000)`:

1. **`Math.round` no es half-up**: es "half hacia +∞". `Math.round(-2.5) === -2`, y half-up daría `-3`. Hoy no hay importes negativos; el día que haya un abono, el bug es silencioso y contable.
2. **`base_minor * rate_bp` crece rápido**: con los topes del contrato (`active_users ≤ 1e6`) y precios altos, el producto intermedio se acerca a la zona donde un `number` deja de ser exacto. `bigint` la cierra sin tener que razonar dónde está el límite.
3. El float no puede tocar el cálculo en ningún punto (invariante 5), y `x / 10000` en `number` **es** float.

Implementación de half-up sobre enteros, sin float en ningún paso:

```
q = numerador / denominador          (división entera, trunca hacia cero)
r = numerador % denominador
si 2*|r| >= |denominador|: q += signo(numerador)     # la mitad, alejándose del cero
```

**Half-up es "la mitad se aleja del cero"**, que es el estándar de facturación europea y lo que espera cualquiera que compruebe el número a mano. El caso de `.5` exacto se testea explícitamente (§5).

---

## 3. `POST /simulations`

Contrato completo → `../contrato-api.md` §2.2. Aquí, solo lo que el contrato no puede expresar.

### 3.1 Secuencia

1. **Cargar el cliente** por `customer_id`. No existe → `404 CUSTOMER_NOT_FOUND`.
2. **El `plan_id` sale del cliente**, nunca del cuerpo. Es lo que garantiza que se cotiza con la tarifa contratada.
3. **Cargar el plan con sus tramos, esté activo o archivado.** Un plan archivado **no es un error aquí** (→ referencia §5.5): un cliente antiguo cotiza con su versión, y ese es justo el caso que el versionado existe para proteger. Un `PLAN_ARCHIVED` copiado del alta rompería el diseño entero en silencio.
4. **Resolver el tipo impositivo** del país del cliente vía `TaxProvider` (→ referencia §6.2), que lee de la caché de arranque. Sin IO, sin `if` por país.
5. **Llamar a `price()`** con tramos, cantidades, `tax_rate_bp` y la divisa **del plan**.
6. **Construir el snapshot** (§3.2).
7. **Persistir** simulación + snapshot y devolver `201` con el `breakdown` que devolvió el motor.

**El paso 5 es el único que calcula, y no sabe nada de los pasos 1–4.** Todo lo anterior es reunir datos; todo lo posterior es guardarlos. Ese corte es lo que hace que el motor sea testeable sin base de datos y que el navegador pueda ejecutar el paso 5 con los datos que ya tiene.

**Sin transacción explícita**: es un `INSERT` único. `better-sqlite3` lo ejecuta atómicamente. Envolverlo en `BEGIN/COMMIT` sería ceremonia; el día que la simulación escriba en dos tablas, deja de serlo.

### 3.2 Snapshot

Forma exacta → `../modelo-datos.md` §2.5. Se construye con **los datos que se acaban de usar para calcular**, no releyendo nada: si el snapshot se poblara con una segunda consulta, describiría un instante distinto del que produjo el número.

**Regla de qué entra**: si al borrarlo de la base de datos el sistema no pudiera reproducir el total, va dentro (tramos, tipo impositivo, divisa). Si es consultable y mutable sin cambiar el pasado (el email del cliente), no.

**Es la razón por la que un admin no puede alterar un presupuesto ya enviado** (→ referencia §11.2). El snapshot protege el **pasado**; el versionado del plan protege el **contrato presente**. Son complementarios y ninguno sustituye al otro: sin snapshot, editar un plan reescribiría el historial; sin versionado, el cliente cotizaría mañana con una tarifa que no firmó.

### 3.3 Preview local: por qué no hay nada más que especificar

El frontend tiene los tramos y el `tax_rate_bp` desde `GET /customers/{id}` (→ `../contrato-api.md` §3.3), e importa `price()` de `@saas/pricing`. Al arrastrar el slider: lookup en memoria + recorrido de tramos → 0 ms, sin red.

Al guardar, el backend **recalcula desde cero** e ignora cualquier cosa que el cliente pudiera creer. **Su número manda**: si difiere del preview, la UI pinta el del backend (→ referencia §10). Que hoy no pueda diferir —misma función, mismos datos— no hace la regla innecesaria: es lo que mantiene el invariante 1 cierto **por diseño** y no por coincidencia.

---

## 4. Casos borde que el implementador debe resolver a propósito

| Caso | Comportamiento | Por qué se enuncia |
|---|---|---|
| `quantity = 0` en una métrica facturada | `subtotal_minor = 0`, `tiers: []`, `billed: true` | El bucle no debe entrar. `billed: true` con subtotal 0 ≠ `billed: false` |
| `quantity` cae **justo en un corte** (10, 50) | El corte pertenece al tramo inferior (`up_to` inclusivo) | Es el off-by-one clásico. 10 usuarios = 100 €, no 100 € + 0×8 |
| `quantity` = corte + 1 (51) | 10 al primero, 40 al segundo, 1 al tercero | Verifica que la capacidad del tramo intermedio es `50 − 10 = 40` |
| Plan sin tramo abierto y `quantity` lo excede | **Inexpresable**: la validación de plantilla lo impide (→ `06-admin-planes.md`) | El motor **no** defiende contra esto: confía en el invariante. Si se rompe, es un bug de la plantilla, no del motor |
| Métrica sin tramos | `billed: false`, subtotal 0 | Contrato de "el plan no cobra esto" (→ referencia §5.2) |
| `tax_rate_bp = 0` | `tax_minor = 0`, `total = base` | Ningún país del seed lo tiene, pero es aritmética válida y no un caso especial |
| `unit_price_minor = 0` en un tramo | Ese tramo aporta 0 | Es cómo se modela "incluido hasta N" (→ `../modelo-datos.md` §3.2, Plan C). Un precio de cero **es** un precio |

**La cuarta fila es una decisión, no un descuido**: el motor **no valida sus entradas**. Si los tramos tienen huecos, no son crecientes o el último está cerrado, el resultado es basura silenciosa. Se acepta porque los tramos solo pueden entrar por el seed o por `POST /plans`, y **ambos pasan por el mismo validador de plantilla**. Duplicar esa validación dentro del motor lo obligaría a devolver errores, y una función que puede fallar es una función que el preview tiene que saber manejar en mitad de un arrastre de slider. El precio de la decisión: **el validador de plantilla es obligatorio en todo camino de escritura**, y eso está escrito en `../modelo-datos.md` §2.3 y en `06-admin-planes.md`.

---

## 5. Tests

Los del motor y el redondeo se escriben **antes que cualquier endpoint** (→ `roams-roadmap.md` §3.1). Cubren §15 de la referencia.

**Motor — tramos:**
- Plan A con **15 usuarios → `base_minor = 14000`**. Es el caso literal del enunciado; si falla este, no importa nada más.
- Bordes: **0** → 0 · **10** → 10000 · **11** → 10800 · **50** → 42000 (`10×1000 + 40×800`) · **51** → 42500.
- Multi-métrica: Plan C, usuarios + llamadas API, `base` = suma de los dos bloques.
- Métrica no facturada: Plan A con `storage_gb = 500` → aporta 0, aparece en el `breakdown` con `billed: false`.
- Tramo a precio 0: `api_calls = 50000` en el Plan C → 0.
- El `breakdown` cuadra: `Σ tiers[].amount_minor == subtotal_minor` y `Σ subtotal_minor == base_minor`. Es la propiedad que detecta un desglose que no explica su propio total.

**Redondeo — half-up:**
- `.5` exacto redondea **hacia arriba**: con `base_minor = 10` y `rate_bp = 500` (5 %), `tax = 0,5` → **1**.
- El caso simétrico negativo: `-0,5` → `-1`, **no** `0` (lo que daría `Math.round`). Es el test que documenta por qué la función existe.
- Un caso con `base_minor` grande, cuyo producto intermedio quedaría fuera del rango exacto de `number`.
- `rate_bp = 0` → `tax = 0`.

**Integración de `POST /simulations`:**
- 15 usuarios, cliente ES → `base 14000`, `tax_rate_bp 2100`, `tax 2940`, `total 16940`. El caso del gate de Fase 1.
- **Cliente con plan archivado**: `201`, cotiza con la tarifa del plan archivado. Es el test que impide "arreglar" el paso 3 con un `PLAN_ARCHIVED`.
- **El snapshot no cambia al editar el plan**: guardar simulación → versionar el plan → releer el historial → mismos números y mismo desglose (→ referencia §15, §11.2).
- Cuerpo con un campo de importe (`total_minor: 1`) → **`400`**, por `additionalProperties: false`. Es el test que convierte el invariante 1 en algo verificable.
- `customer_id` inexistente → `404`.

**Paridad preview/persistencia** (cinturón y tirantes, → referencia §10, §15):
- La **misma batería de casos** ejecutada por `price()` invocada desde el paquete y comparada con el `total_minor` que devuelve `POST /simulations`. Con módulo único no puede fallar; el test existe para que **siga sin poder** el día que alguien tenga la idea de optimizar uno de los dos lados.
