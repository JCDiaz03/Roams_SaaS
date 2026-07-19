# Auditoría 02 — K, L y M no son iniciales de CIF

**Dónde.** `backend/src/domain/tax-id/es-nif.validator.ts` · sesión 05 · commit `4bf3e31`.
**Categoría.** Corrección (validación fiscal).
**Gravedad.** **Silencioso.** Aceptaba identificadores inválidos y rechazaba válidos, sin fallar nada.

## Qué se pidió

El validador español, siguiendo `02-validacion-fiscal-y-alta-cliente.md` §4.3, que traía la tabla de tipos de organización del CIF y este conjunto de iniciales:

> Formato: `^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$`

## Qué devolvió

Exactamente el conjunto de la spec, K, L y M incluidas, con la tabla de control:

```ts
const RE_CIF = /^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/
const CIF_SOLO_NUMERO = new Set(['A', 'B', 'E', 'H'])
const CIF_SOLO_LETRA = new Set(['K', 'P', 'Q', 'R', 'S', 'N', 'W'])
```

## El defecto

**K, L y M no son CIF.** Son NIF de **persona física** del formato antiguo —K para menores, L para españoles no residentes, M para extranjeros sin NIE— y su control es una **letra `mod 23`, como el DNI**, no el checksum ponderado del CIF.

Al tenerlas en el conjunto, el validador les aplicaba el algoritmo equivocado. Las dos direcciones fallan:

- **Da por bueno lo que no lo es**: un `K1234567D` con el checksum ponderado correcto se aceptaba, cuando su control real (mod 23) sería otra letra.
- **Rechaza lo que sí lo es**: un NIF `K` legítimo, con su letra mod 23, se rechazaba.

**Por qué no salta a la vista.** Porque el conjunto `ABCDEFGHJKLMNPQRSUVW` es exactamente el que arrastran **bastantes implementaciones publicadas**. Se ve «bien». Y porque un identificador fiscal aceptado de más no rompe nada visible: se guarda, el cliente existe, las simulaciones funcionan. El dato malo solo aparece el día que alguien lo cruza con Hacienda.

**Lo que hace este caso interesante** no es el error. Es que **la spec ya tenía la respuesta y el código hacía lo contrario**: el §4.4 de ese mismo documento decía «los NIF especiales K, L, M **no se implementan**… se rechazan como inválidos». La spec declaraba un recorte, el conjunto de iniciales lo contradecía, y las dos frases convivían en el mismo fichero sin que nadie lo notara.

## Cómo se detectó

**Un test que intentaba documentar el recorte.** No buscaba este bug; buscaba fijar por escrito que K/L/M se rechazan:

```ts
it('los NIF especiales K/L/M no estan soportados, y se rechazan', () => {
  expect(valida('K1234567L').type).toBe('CIF')  // <- se puso rojo
  ...
})
```

Falló, y al mirar por qué apareció la contradicción entera. Escribir el test **del recorte** —de lo que el sistema deliberadamente no hace— fue lo que destapó que el sistema sí lo hacía, y mal.

## Cómo se corrigió

Fuera del conjunto, con el porqué escrito donde se toma la decisión:

```ts
// La inicial del CIF es el TIPO DE ORGANIZACION. El conjunto excluye a proposito:
//   * I, O y T: I y O se confunden con 1 y 0.
//   * X, Y, Z: son NIE.
//   * K, L y M: NO son CIF. Son NIF de PERSONA FISICA del formato antiguo [...] y su
//     control es una letra mod 23, como el DNI, NO el checksum ponderado de aqui abajo.
const RE_CIF = /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/
```

Y el test pasó a comprobar los **veinte** controles posibles para cada una de las tres iniciales: ninguno vale.

**Subida de capa**: de detectable a imposible. Fuera del conjunto, ningún camino le aplica el checksum equivocado. Y un mutante que las devuelva al conjunto mata 3 tests.

## Qué regla nueva deja

**Escribir el test del recorte, no solo el de la feature.** Un recorte declarado en una spec es una afirmación sobre el comportamiento del sistema —«esto se rechaza»— y por tanto es testeable. Si nadie lo testea, es una intención; y las intenciones no se ejecutan.

Corolario incómodo: **la spec puede contradecirse a sí misma y nadie lo nota**. El §4.3 y el §4.4 del mismo documento decían cosas incompatibles. Un documento largo escrito de una sentada no es más consistente que un programa largo escrito de una sentada; solo es más difícil de compilar.

Spec 02 corregida: el conjunto, la tabla de controles, y un §4.4 que ahora explica **por qué el recorte obliga a sacarlos del conjunto** en vez de solo decir que no se soportan.
