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
