// Esquemas JSON con maxLength en todo campo de texto. Spec: 7.5, 14.2
//
// El esquema es PARTE DEL CONTRATO de la ruta, no un middleware olvidable: una ruta sin
// esquema se ve en code review (referencia 2). Es tambien la primera de las tres capas
// de defensa del identificador fiscal: el maxLength protege al validador del tamano, sus
// regex ancladas protegen de la forma, y el CHECK de la tabla protege de cualquier otro
// camino de escritura.

import { planResponseSchema } from '../plans/plans.schemas'

/** Los topes de texto. Los mismos que los CHECK de la tabla (modelo-datos.md 2.4). */
export const LIMITES = {
  companyName: 200,
  fiscalId: 20,
  email: 254,
  search: 100,
} as const

/**
 * El cliente tal y como sale por la API (espejo de CustomerRow). Como en el resto de
 * esquemas `response`: serializacion rapida y contrato de salida blindado, con todos los
 * campos en `required` para que una regresion falle ruidosamente.
 */
const customerResponseSchema = {
  type: 'object',
  required: [
    'id',
    'company_name',
    'fiscal_id',
    'fiscal_id_type',
    'email',
    'country',
    'plan_id',
    'created_at',
  ],
  properties: {
    id: { type: 'integer' },
    company_name: { type: 'string' },
    // El NORMALIZADO: el comercial ve lo que quedo guardado (referencia 7.4).
    fiscal_id: { type: 'string' },
    fiscal_id_type: { type: 'string' },
    email: { type: 'string' },
    country: { type: 'string' },
    plan_id: { type: 'integer' },
    created_at: { type: 'string' },
  },
} as const

export const postCustomerSchema = {
  body: {
    type: 'object',
    required: ['company_name', 'fiscal_id', 'email', 'country', 'plan_id'],
    // Un campo que sobra es un 400, no un campo que se ignora. Es lo que hace que "el
    // frontend nunca envia importes" (invariante 1) sea VERIFICABLE y no una promesa:
    // un `total_minor` en el cuerpo rebota aqui.
    additionalProperties: false,
    properties: {
      company_name: { type: 'string', minLength: 1, maxLength: LIMITES.companyName },
      // Se acepta tal y como lo teclea un humano (con espacios, guiones, minusculas): la
      // normalizacion es del servidor (referencia 7.4). Exigir la forma normalizada seria
      // delegar la regla al cliente y obligar a reimplementarla alli.
      fiscal_id: { type: 'string', minLength: 1, maxLength: LIMITES.fiscalId },
      email: { type: 'string', format: 'email', maxLength: LIMITES.email },
      country: { type: 'string', pattern: '^[A-Z]{2}$' },
      plan_id: { type: 'integer', minimum: 1 },
    },
  },
  response: { 201: customerResponseSchema },
} as const

export const searchCustomersSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      // Sin `required`: ausente o vacio NO es un error, devuelve los recientes. Un 400
      // aqui obligaria al frontend a no llamar hasta tener texto, y el estado inicial del
      // dashboard dejaria de existir (contrato-api.md 3.2).
      search: { type: 'string', maxLength: LIMITES.search },
      limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    },
  },
  response: {
    200: {
      type: 'object',
      required: ['customers', 'total'],
      properties: {
        customers: {
          type: 'array',
          items: {
            type: 'object',
            required: [
              'id',
              'company_name',
              'fiscal_id',
              'fiscal_id_type',
              'country',
              'plan',
              'simulation_count',
            ],
            properties: {
              id: { type: 'integer' },
              company_name: { type: 'string' },
              fiscal_id: { type: 'string' },
              fiscal_id_type: { type: 'string' },
              // String a secas en el listado; el detalle lo expande a objeto.
              country: { type: 'string' },
              plan: {
                type: 'object',
                required: ['id', 'name', 'version'],
                properties: {
                  id: { type: 'integer' },
                  name: { type: 'string' },
                  version: { type: 'integer' },
                },
              },
              simulation_count: { type: 'integer' },
            },
          },
        },
        total: { type: 'integer' },
      },
    },
  },
} as const

export const customerIdSchema = {
  params: {
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: { id: { type: 'integer', minimum: 1 } },
  },
  response: {
    200: {
      type: 'object',
      required: [
        'id',
        'company_name',
        'fiscal_id',
        'fiscal_id_type',
        'email',
        'country',
        'tax_rate_bp',
        'plan',
        'created_at',
      ],
      properties: {
        id: { type: 'integer' },
        company_name: { type: 'string' },
        fiscal_id: { type: 'string' },
        fiscal_id_type: { type: 'string' },
        email: { type: 'string' },
        country: {
          type: 'object',
          required: ['code', 'name', 'display_currency'],
          properties: {
            code: { type: 'string' },
            name: { type: 'string' },
            display_currency: { type: 'string' },
          },
        },
        tax_rate_bp: { type: 'integer' },
        // Embebido CON SUS TRAMOS, activo o archivado: todo lo que el preview local
        // necesita en una sola peticion (referencia 10).
        plan: planResponseSchema,
        created_at: { type: 'string' },
      },
    },
  },
} as const
