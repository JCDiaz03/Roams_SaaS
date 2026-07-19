# Auditorías — los defectos silenciosos del código generado

> **Qué es este documento.** No es la lista de bugs del proyecto: es el registro de los defectos **silenciosos** — los que compilan, pasan los tests que existen, se ven bien en pantalla y están mal — que el código generado por la IA traía, y de cómo se cazaron. Cada entrada paga un peaje para estar aquí: debe dejar una **regla transferible** que cambió cómo se trabajó desde entonces. Los hallazgos ruidosos o menores viven en el diario de su sesión (→ [`vibe-coding.md`](./vibe-coding.md)).

## Índice

| # | Defecto | Dónde se gestó | Cómo se cazó | Regla que deja |
|---|---|---|---|---|
| [01](#auditoría-01--additionalproperties-false-no-da-400) | `additionalProperties: false` no rechazaba: Fastify borraba el campo sobrante en silencio | sesión 07 | Test escrito desde la spec, no desde el código | Los defaults del framework son parte del contrato |
| [02](#auditoría-02--k-l-y-m-no-son-iniciales-de-cif) | K, L y M tratadas como CIF con el checksum equivocado | sesión 05 | Test del recorte (de lo que el sistema *no* hace) | Un recorte declarado es testeable; si nadie lo testea, es una intención |
| [03](#auditoría-03--ocho-pares-de-color-fallaban-aa) | Ocho pares de color del prototipo incumplían AA | sesión 06 | Medir en vez de mirar, enumerando pares por su uso real | Un requisito duro que solo vive en un documento no es duro |
| [04](#auditoría-04--un-plan-válido-podía-romper-todas-sus-simulaciones-futuras) | Dinero del plan sin tope: overflow y persistencia imprecisa alcanzables por la API | auditoría de cierre (sesión 14) | Preguntar por la asimetría entre zonas análogas | Todo número que multiplica a otro necesita que el producto tenga dueño |
| [05](#auditoría-05--la-hoja-de-impresión-podía-cruzar-los-datos-de-dos-clientes) | La hoja de impresión podía llevar el nombre de un cliente con los importes de otro | auditoría de cierre (sesión 14) | Recorrer escenarios de navegación que ningún test recorre | El estado ligado a la identidad de la ruta debe morir con ella |
| [06](#auditoría-06--guardar-podía-borrar-un-dato-y-celebrarlo-con-un-toast-de-éxito) | Un campo saneado a vacío borraba el valor guardado, con toast de éxito | pre-publicación (sesión 19) | Revisión adversarial por familias de defecto | Validar antes de convertir: la coerción convierte errores en órdenes válidas |

## Seis maneras de cazar lo que no se ve

Las seis entradas comparten la gravedad (silencioso) pero no el método. Leídas juntas, son un repertorio:

1. **El test se escribe desde la spec, no desde el código** (→ 01). Un test escrito mirando el comportamiento actual solo certifica que el bug es reproducible.
2. **Se testea también el recorte** (→ 02): lo que el sistema deliberadamente no hace es una afirmación sobre su comportamiento, y por tanto es testeable. Fue el test de un recorte el que destapó que el sistema sí lo hacía, y mal.
3. **Se mide en vez de mirar, y se enumera por uso real** (→ 03): «`text-3` sobre blanco» es un par que existe en la cabeza; «el placeholder del buscador» es un par que existe en la pantalla. El segundo cazó el octavo fallo.
4. **Se pregunta por la asimetría entre zonas análogas** (→ 04): si las cantidades de simulación tienen topes anti-overflow razonados, ¿por qué los precios del plan no? La asimetría era la pista; la sonda contra el harness, la prueba.
5. **Se recorren los escenarios de navegación que ningún test recorre** (→ 05): el historial del navegador entre dos clientes, la topbar desde otra página. Los defectos de sistema no se ven mirando un fichero aislado — por eso la auditoría de cierre fue de sistema y no de diffs.
6. **Se revisa de forma adversarial y por familias** (→ 06): unos agentes buscan candidatos por ángulo y otros, independientes, intentan refutarlos. Es lo que separa «parece un bug» de «es un bug» (21/21 confirmados, 0 falsos positivos), y la familia más fértil fue la que este proyecto más persigue: caminos de valor-erróneo-sin-error.

Y un patrón común en la corrección: **subir de capa siempre que se pueda** — de "detectable" (alguien lo vio) a "vigilado" (un test lo fija) a "imposible" (la estructura no deja expresarlo). Todas terminan con un guardián en CI que muerde: se verificó que revertir el arreglo tumba tests.

---

# Auditoría 01 — `additionalProperties: false` no da 400

**Dónde.** `backend/src/server.ts` · sesión 07 · commit `49dd58e`.
**Categoría.** Invariante roto.
**Gravedad.** **Silencioso.** No fallaba ningún test de los que existían, y la petición devolvía `201`.

## Qué se pidió

El esqueleto Fastify con «esquemas JSON por ruta con `maxLength` en todos los campos de texto», siguiendo `contrato-api.md` §1.5, que dice:

> **`additionalProperties: false` en todos los cuerpos.** Un campo que sobra es un `400`, no un campo que se ignora. Es lo que hace que "el frontend nunca envía importes" sea verificable.

## Qué devolvió

Exactamente eso. Los esquemas llevaban `additionalProperties: false`. El código parecía correcto y **la spec parecía cumplida**.

```ts
export const postSimulationSchema = {
  body: {
    type: 'object',
    required: ['customer_id', 'active_users', 'storage_gb', 'api_calls'],
    additionalProperties: false,   // <- esto, por si solo, NO hace lo que dice
    properties: { /* ... */ },
  },
} as const
```

## El defecto

**Fastify configura Ajv con `removeAdditional: true` por defecto.** Con esa opción, `additionalProperties: false` no rechaza: **elimina el campo sobrante en silencio** y deja pasar la petición.

O sea:

```
POST /api/simulations  { customer_id: 5, active_users: 15, ..., total_minor: 1 }
                       -> 201. El total_minor se borró y nadie se enteró.
```

**Por qué importa más de lo que parece.** El invariante 1 dice que el backend es la única fuente de verdad del coste y que **el frontend nunca envía importes**. La forma de que eso sea *verificable* en vez de una promesa era precisamente esta: el campo no existe en el esquema, así que mandarlo es un `400`. Con `removeAdditional`, el invariante seguía siendo cierto —el importe se ignoraba— pero **dejaba de ser demostrable**, y un invariante que no se puede demostrar es una frase en un documento.

**Por qué no salta a la vista.** Porque el fallo está en un default del framework, no en el código. Quien lee `server.ts` ve un esquema correcto; quien lee la spec ve una regla correcta. La discrepancia solo existe en la documentación de Fastify.

## Cómo se detectó

**Un test escrito desde la spec**, no desde el código:

```ts
it('UN IMPORTE EN EL CUERPO -> 400', async () => {
  const r = await simular(entradas({ total_minor: 1 }))
  expect(r.statusCode).toBe(400)   // -> recibía 201
})
```

El test se escribió porque la spec decía que ese caso era un `400`. Si se hubiera escrito mirando lo que el código hacía, habría afirmado `201` y el bug estaría hoy en producción, con un test verde encima diciendo que todo va bien.

## Cómo se corrigió

Un default explícito, con el porqué al lado para que nadie lo «limpie»:

```ts
ajv: {
  customOptions: {
    allErrors: false,
    // NO SE TOCA. Fastify trae removeAdditional:true por defecto, y con eso un
    // `additionalProperties: false` NO devuelve 400: ELIMINA el campo sobrante en
    // silencio y sigue adelante. [...]
    removeAdditional: false,
  },
},
```

**¿Se puede subir de capa?** Ya está en la 2 (imposibilidad): con `removeAdditional: false`, el campo de más **es** un `400` y hay un test que lo fija en `simulations.test.ts` y otro en `customers.test.ts`. Lo que no se puede es impedir que alguien vuelva a poner el default; para eso está el comentario y el test.

## Qué regla nueva deja

**Los defaults del framework son parte del contrato.** `additionalProperties: false` es la línea que uno escribe; `removeAdditional` es lo que decide qué significa. Ninguna spec sobrevive a no leer la documentación del framework que la implementa.

Y una que ya estaba y aquí se ganó el sueldo: **los tests se escriben desde la spec, no desde el código**. Un test escrito mirando el comportamiento actual solo certifica que el bug es reproducible.

`contrato-api.md` §1.5 corregida: el gotcha no estaba documentado y ahora lo está.

---

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

---

# Auditoría 03 — Ocho pares de color fallaban AA

**Dónde.** `frontend/src/ui/tokens.css` · sesión 06 · commit `e9a75a8`.
**Categoría.** Accesibilidad (requisito duro incumplido).
**Gravedad.** **Silencioso.** Se ve bien. Simplemente no cumple, y nadie lo nota mirando.

## Qué se pidió

Portar los tokens del prototipo de Claude Design (`SaaS-O-Matic.dc.html`), cuyo brief (`diseno-frontend.md` §2.3) dice:

> Requisito duro: **contraste AA en ambos temas**, incluidos los estados deshabilitados y los badges.

## Qué devolvió

Los colores del prototipo, verbatim. Que es lo correcto: el prototipo es la fuente del lenguaje visual y no se «mejora» al portarlo.

## El defecto

Al **medirlos** en vez de mirarlos, **ocho pares fallaban AA**:

| Par | Ratio | Dónde se ve |
|---|---|---|
| blanco sobre primario (oscuro) | **3,44** | **el botón principal de toda la app** |
| `text-3` sobre `surface` (claro) | 2,75 | placeholders |
| `text-3` sobre `surface-2` (claro) | 4,37 | placeholder del buscador |
| `text-3` sobre `surface` (oscuro) | 3,68 | placeholders |
| `text-3` sobre `surface-2` (oscuro) | 3,42 | placeholder del buscador |
| primario sobre `primary-soft` (claro) | 3,91 | chip «Plan Ágora · v2» |
| success sobre `success-soft` (claro) | 3,96 | chip «CIF validado» |
| warning sobre `warning-soft` (claro) | 4,10 | badge de tipos desactualizados |
| danger sobre `danger-soft` (claro) | 4,21 | callout de error |

**La causa no es descuido del diseño, es estructural**: el magenta de marca `#E6007E` sobre blanco da **4,50 exacto**, justo en el umbral. Sobre cualquier fondo teñido cae por debajo. No hay forma de usar la marca como texto sobre un tinte sin salirse.

**Por qué no salta a la vista.** Porque el diseño **se ve bien**. Un contraste de 3,91 es perfectamente legible para quien tiene buena vista y un buen monitor; el requisito AA existe precisamente para quien no. Es un defecto que no se detecta mirando la pantalla, solo midiendo.

## Cómo se detectó

Midiendo. Un script con la fórmula de luminancia relativa de la WCAG sobre los pares que el diseño pinta de verdad.

Y aquí está lo interesante: **el test cazó un par que yo no había medido a mano**. Mi comprobación manual probó `text-3` sobre `surface` (blanco) y lo dio por resuelto; el test, que enumera los pares por su uso real, probó también `text-3` sobre `surface-2` — que es **el fondo del input donde vive el placeholder del buscador**, o sea el sitio donde ese color se usa de verdad. 4,37. Fallaba.

La comprobación manual mira los pares que uno recuerda. El test mira los que están escritos.

## Cómo se corrigió

Dos tokens nuevos, porque el problema estructural no se arregla ajustando un color:

- **`--color-primary-strong`** (`#d40074` en claro): el magenta para **texto sobre tintes**. El de marca se queda para rellenos.
- **`--color-on-primary`**: el texto sobre un relleno primario. En claro es blanco; **en oscuro es texto oscuro** (`#0f0f1c`, ratio 5,53). El brief sube la luminosidad del fucsia en oscuro *a propósito* (§2.3), así que apagarlo para salvar el blanco sería arreglar el problema por el lado equivocado: se cambia el texto, no la marca.

El resto son ajustes del **5-8 % hacia negro**: a ojo no se distinguen.

**Subida de capa: de detectable a imposible.** `ui/tokens.test.ts` **parsea `tokens.css`** —no duplica los valores, los lee— y falla el CI si algún par baja de 4,5. 32 comprobaciones. Verificado que muerde: devolver un color del prototipo lo tumba.

## Qué regla nueva deja

**Un requisito duro que solo vive en un documento no es duro.** El brief decía «AA en ambos temas» y el diseño lo incumplía en ocho sitios; nadie mintió, simplemente nadie lo midió. La diferencia entre una regla y una intención es si algo la comprueba.

Y una más específica: **enumerar los pares por su uso, no por el token**. «`text-3` sobre blanco» es un par que existe en la cabeza; «el placeholder del buscador» es un par que existe en la pantalla. El segundo es el que hay que medir, y es el que cazó el octavo fallo.

---

# Auditoría 04 — Un plan válido podía romper todas sus simulaciones futuras

**Dónde.** `backend/src/features/plans/plans.schemas.ts` + `plan-template.validation.ts` · auditoría de cierre (sesión 14), tres agentes en paralelo.
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

---

# Auditoría 05 — La hoja de impresión podía cruzar los datos de dos clientes

**Dónde.** Página de ficha de cliente + `PrintSheet` (frontend) · auditoría de cierre ([sesión 14](./vibe-coding.md)), lente de frontend · commit `ca9c90c`.
**Categoría.** Corrección (integridad del documento impreso).
**Gravedad.** **Silencioso.** Ninguna pantalla se ve mal, ningún test fallaba, ninguna consola avisa: el defecto solo existe en un papel.

## Qué había

La hoja de impresión hace una promesa fuerte y documentada: **solo se imprime la simulación sellada** — el número persistido del backend, nunca un preview que nadie podría reproducir. El sello (`sellada`) vivía en el estado de la página de ficha, y todo funcionaba en cualquier recorrido de ida.

## El defecto

Cambiar de cliente **por el historial del navegador** no desmonta la página: cuando solo cambia el parámetro de la ruta, el componente montado se reutiliza, y `sellada` sobrevivía al cambio de `id`. Resultado: la hoja podía imprimir **el nombre de un cliente con los importes de otro** — exactamente el documento que la hoja jura no producir, en el artefacto de más confianza del producto: el papel que el comercial entrega.

**Por qué no salta a la vista.** Porque cada render individual es correcto y cada pantalla, mirada por separado, también. El defecto no vive en ningún fichero: vive en una *secuencia* — ficha de A → sellar → atrás → ficha de B → imprimir. Los tests de integración no atraviesan el historial del navegador, y el smoke E2E tampoco recorría ese camino.

## Cómo se detectó

La lente de frontend de la auditoría de cierre buscaba **escenarios de navegación que ningún test recorre**: la topbar desde el dashboard (hallazgo 3 de esa sesión) y el historial entre clientes (este). Ninguno de los dos era visible mirando un fichero aislado — por eso la auditoría fue de sistema y no de diffs.

## Cómo se corrigió

**Reset completo del estado dependiente de la identidad al cambiar `id`**: el sello, y con él todo lo que la hoja imprime, muere cuando el cliente deja de ser el mismo. No hay test con nombre que lo fije — el frontend no tiene arnés de componentes y el smoke E2E no cruza de cliente —: el guardián es el propio reset del efecto, con su comentario en `SimulatorPage.tsx` explicando exactamente qué documento evita, verificado conduciendo la app en la sesión 14. Dicho aquí antes que fingir un test que no existe.

## Qué regla nueva deja

**El estado de un componente no muere cuando uno cree: muere cuando se desmonta — y la navegación por parámetro no desmonta.** Todo estado derivado de la identidad de la ruta debe atarse a esa identidad de forma explícita. Y el corolario de método: la prueba de fuego de una SPA es recorrerla como un usuario con botón de «atrás», no como un test con render limpio.

---

# Auditoría 06 — Guardar podía borrar un dato y celebrarlo con un toast de éxito

**Dónde.** `BaseValuesBlock` (ficha de cliente, frontend) · revisión pre-publicación ([sesión 19](./vibe-coding.md)), code review multi-agente · commit `f1602c3`.
**Categoría.** Corrección (pérdida de datos con feedback de éxito).
**Gravedad.** **Silencioso.** No hay error en ninguna capa: el backend hizo exactamente lo que se le pidió y el frontend celebró una petición que salió bien. El dato, mientras tanto, desapareció.

## Qué había

Dos piezas correctas por separado. Una: el contrato D3 de la tanda del catálogo — `PATCH /customers/:id` acotado a los `base_*`, donde **`null` borra el valor**; decisión legítima y documentada, porque borrar un valor base es una operación real del negocio. Dos: el bloque de edición saneaba la entrada del usuario antes de enviar.

## El defecto

La conversión se hacía con `Number()` **sin validar antes**. Dos caminos malos: «12.5» producía un 400 críptico (molesto, pero ruidoso); y el grave — una entrada que el saneado dejaba vacía se convertía en el `null` *legítimo* del contrato. **El PATCH borraba el valor guardado y el toast decía éxito.** Un descuido de tecleo, traducido por la coerción en una orden válida de borrado.

**Por qué no salta a la vista.** Porque no hay ningún error que ver: cada capa cumplió su contrato. El defecto vive en la traducción entre las dos — en que después de convertir ya no queda rastro de que hubo un error.

## Cómo se detectó

Code review multi-agente de pre-publicación: 4 buscadores por ángulo + **16 verificadores adversariales independientes** que intentan refutar cada candidato. La familia que más rindió fue la que este proyecto declara perseguir: **caminos de valor-erróneo-sin-error** — 6 de los 8 hallazgos de corrección eran de esa familia, y este era el más grave.

## Cómo se corrigió

**Validación previa a la conversión** (`aValor`): nada viaja si algún campo no es un entero, con mensaje claro junto al campo. El `null` del contrato queda reservado para la intención explícita de borrar, no para el resultado de un saneado. El caso exacto no tiene test de componente (el frontend no tiene arnés de componentes); la red que sí existe es del contrato: el esquema del `PATCH` tipa `['integer','null']`, así que un string que se colara sería un `400` del backend, nunca un guardado silencioso — más el guardián de que el `PATCH` sigue acotado a los tres `base_*` (`customers.test.ts`).

## Qué regla nueva deja

**Validar antes de convertir, porque después de convertir ya no queda rastro del error.** La coerción (`Number()`, `?? 0`) convierte errores del usuario en órdenes válidas del contrato. Y el corolario del feedback: **un toast de éxito es una afirmación sobre lo que se persistió**, no sobre que la petición devolviera 2xx.

El linaje confirma la regla: la misma familia apareció dos veces más — el precio en blanco que valía 0 € en la plantilla de planes (sesión 16, corregido con pre-validación) y el input exacto que recortaba al límite visual (hallazgo 1 de esta misma revisión). Tres apariciones de la misma coerción no son una casualidad: son una regla que faltaba.

---

## Lo que se quedó en el diario, y por qué

Hallazgos importantes que **no** tienen ficha, aplicando el criterio de admisión de la cabecera:

- **`MALFORMED_REQUEST` (500 ante JSON roto) y la búsqueda de la topbar auto-revirtiéndose** (sesión 14): corregidos y testeados, pero *ruidosos* — se manifiestan usando la app, no engañan a nadie en silencio.
- **El recorte al límite visual y las archivadas expulsando presupuestos del LIMIT 20** (sesión 19): silenciosos, pero su lección ya está representada (la familia de la 06 y el contrato-como-tope de la 04).
- **El contraste del summary del catálogo** (sesión 17): lo cazó la extensión del guardián nacido en la ficha 03 — no es un método nuevo, es un método pagando dividendos.
- **La auditoría de XSS almacenado en planes** (sesión 16): salió limpia; una auditoría sin hallazgo se registra en su sesión, no aquí.
