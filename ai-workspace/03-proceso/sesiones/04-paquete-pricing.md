# Sesión 04 — El paquete `pricing`

**Objetivo.** El motor de tramos, el redondeo half-up y el enum `Currency`, con sus tests. Antes que cualquier endpoint o UI.
**Spec de partida.** `01-specs/features/01-motor-tramos-y-simulaciones.md` §2 y §5.
**Resultado.** Hecho. Commit `f4d56ce` — 61 tests.

## Prompt de partida

> ahora el paquete pricing con sus tests

## Qué generó

`engine.ts` (graduated multi-métrica), `rounding.ts` (half-up sobre `bigint`), `quote.ts` (orden canónico), `currency.ts` (44 divisas con `minor_unit`) y 61 tests.

## Qué se aceptó

- **El redondeo sobre `bigint`.** `Math.round` **no es half-up**: es «half hacia +∞», así que `Math.round(-2.5)` da `-2` donde half-up da `-3`. Hoy no hay negativos, y por eso el test del caso negativo existe: documenta por qué la función existe.
- **`quote()` en vez de `price()`**, que era el nombre en mi spec. El andamiaje ya lo llamaba `quote` y encaja mejor con el dominio (el producto son presupuestos). Se alineó la spec al código, no al revés.
- **El mapa plano `código → minor_unit`**, contra lo que decía mi propia spec (§4.4 mostraba `{ code, minor_unit }`). Con la forma de la spec, la clave y el campo `code` pueden divergir; aquí la clave **es** el código.

## Qué se rechazó, y por qué

- **Que el motor validara sus entradas** → rechazado, y es una decisión, no un descuido. Si los tramos tienen huecos o el último está cerrado, el motor produce basura silenciosa. Se acepta porque los tramos solo entran por el seed o por `POST /plans`, y **ambos pasan por el mismo validador de plantilla**. Validar aquí obligaría al motor a poder fallar, y una función que falla es una función que el preview tiene que saber manejar **en mitad de un arrastre de slider**.
- **Bajar la validación de plantilla a `@saas/pricing`** (sesión 09) → rechazado. El paquete compartido es el motor y el redondeo; su valor es que lo importan los **dos** lados. Meter ahí «cosas comunes» es como un paquete compartido se convierte en vertedero.

## Dos fallos, y los dos eran míos

Los tests fallaron dos veces, y **ninguna fue del código**:

1. Escribí `66_500` como resultado de 100 usuarios cuando la fórmula de **mi propio comentario** (`10×1000 + 40×800 + 50×500`) da `67.000`. Aritmética mal hecha.
2. Quise demostrar la pérdida de precisión con `expect(Number(2n**53n+1n)).not.toBe(9_007_199_254_740_993)`, sin caer en que **ese literal también es un `double`** y colapsa al mismo valor. La aserción se refutaba a sí misma. La única forma de enseñar la pérdida es afirmar el valor al que cae, y así quedó en el test.

## Lo que de verdad valió: mutación

61 tests en verde no demuestran nada por sí solos. Rompí el código a propósito cuatro veces:

| Mutante | Tests que mueren |
|---|---|
| half-up → redondeo hacia el cero | 11 |
| olvidar restar el límite inferior (off-by-one del corte) | 3 |
| graduated → volume pricing | 15 |
| la métrica no facturada desaparece del desglose | 2 |

Dos minutos, y convierten «los tests pasan» en «los tests sirven».

## Qué aprendió el prompt siguiente

Que la mutación es barata y se hace siempre. Se repitió en la sesión 05 (cinco mutantes) y en la 08 (el test de la costura del auth).

Y una honestidad que quedó escrita en el código: **la spec exageraba**. Decía que el producto `base × rate` «se acerca a la zona donde un `number` deja de ser exacto»; con los topes reales **no desborda**. El `bigint` es defensivo —cierra la cuestión sin tener que re-derivar el límite cada vez que un tope cambie—, y el comentario lo dice así en vez de inventarse un peligro.
