# Sesión 05 — Validación fiscal

**Objetivo.** Normalización, registro de estrategias por esquema y el validador español (DNI, NIE, CIF), con su batería.
**Spec de partida.** `01-specs/features/02-validacion-fiscal-y-alta-cliente.md`.
**Resultado.** Hecho. Commit `4bf3e31` — 87 tests. Cierra la Fase 1 §3.1.

## Prompt de partida

> ahora la validación fiscal con sus tests

## Qué generó

`normalize.ts`, `tax-id-validator.ts` (la interfaz), `es-nif.validator.ts`, `pass-through.validator.ts`, `registry.ts` y 87 tests, con el CIF como la batería más amplia (es B2B: es el caso mayoritario).

## Qué se aceptó

- **`toUpperCase()` sin locale**, y con el porqué escrito: `toLocaleUpperCase('tr-TR')` convierte la `i` en `İ`, y entonces la misma entrada validaría distinto según la máquina que corre el servidor. Es un bug real de los que solo aparecen en producción y en un solo país.
- **Que un esquema no registrado LANCE** en vez de caer a pass-through. Degradar en silencio daría de alta clientes sin validar marcados como `unvalidated`, y nadie se enteraría hasta auditar los datos.

## Qué se rechazó, y por qué

- **El validador permisivo** (aceptar número o letra de control siempre) → rechazado. Es más permisivo de lo correcto: deja pasar `A1234567D`, una S.A. con letra de control, que no existe. Se implementó la tabla de tipos de organización.

## El hallazgo: un test destapó un error de diseño

**K, L y M no son iniciales de CIF.** Estaban en mi conjunto —como en bastantes implementaciones— y son NIF de **persona física** del formato antiguo, con control `mod 23` como el DNI, no el checksum ponderado. Al tenerlas dentro, el validador les calculaba el checksum equivocado: **daba por bueno lo que no lo es**.

Lo llamativo no es el error. Es que **yo mismo había escrito el recorte** «K/L/M no se soportan, se rechazan» en la spec, y el código hacía justo lo contrario. La spec y el código decían cosas distintas y solo el test lo notó.

→ Auditoría completa: [`02-klm-no-son-cif.md`](../auditorias/02-klm-no-son-cif.md).

De paso salieron **dos datos más mal en mi spec**: el control letra de `P1234567` es **`D`**, no `E` (el control 4 indexa en `JABCDEFGHI`), y el caso afilado del tipo de control es `A1234567D` —donde la letra **sí** es correcta y lo único que falla es el tipo—, no `A1234567J`, que lo rechazaría ya el checksum y no probaría nada.

## Mutación

| Mutante | Tests que mueren |
|---|---|
| quitar el `mod 10` exterior | 2 |
| validador permisivo (acepta ambos controles) | 7 |
| NIE: ignorar la inicial en vez de sustituirla | 4 |
| devolver K/L/M al conjunto del CIF | 3 |
| no reducir los dígitos del duplicado en el checksum | 28 |

## Qué aprendió el prompt siguiente

Que **la spec no es la verdad, es una hipótesis con autoridad**. Se escribió antes de programar y por eso vale; pero tenía tres datos mal, y el código que la implementa es la primera vez que alguien la comprueba de verdad. Cuando spec y test discrepan, gana el test **y se corrige la spec** — que es lo que se hizo, en el mismo commit.

De aquí en adelante, cada sesión que encontró un error en un documento lo arregló en el mismo commit en vez de dejarlo para «luego»: la sesión 06 corrigió el ejemplo de `Intl` de la referencia, la 07 el gotcha de `additionalProperties`, y la 09 el enunciado de «Crear → versión 1».
