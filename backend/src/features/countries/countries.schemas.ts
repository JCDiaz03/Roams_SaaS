// Esquema de respuesta de GET /countries. Spec: 12, contrato-api.md 3.1
//
// Los esquemas `response` cumplen dos funciones: Fastify serializa con
// fast-json-stringify (mas rapido que JSON.stringify) y, sobre todo, BLINDAN el contrato
// de salida: un campo que no este declarado aqui no sale, aunque alguien lo cuele en la
// vista por accidente. Todos los campos van en `required` a proposito: si el servicio
// deja de producir uno, la serializacion falla ruidosamente en vez de omitirlo.

export const listCountriesSchema = {
  response: {
    200: {
      type: 'object',
      required: ['countries'],
      properties: {
        countries: {
          type: 'array',
          items: {
            type: 'object',
            required: ['code', 'name', 'display_currency', 'fiscal_id'],
            properties: {
              code: { type: 'string' },
              name: { type: 'string' },
              display_currency: { type: 'string' },
              fiscal_id: {
                type: 'object',
                required: ['validated', 'hint'],
                properties: {
                  validated: { type: 'boolean' },
                  hint: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
} as const
