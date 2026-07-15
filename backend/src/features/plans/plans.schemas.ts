// Esquema de la plantilla de planes. Spec: 5.4

/** Topes de texto, como en toda ruta (referencia 7.5). */
export const LIMITES = { name: 100, description: 500 } as const

/** Anti-DoS: 30 tramos es holgadisimo para un plan real y acota el bucle del motor. */
const MAX_TIERS = 30

const tierSchema = {
  type: 'object',
  required: ['metric', 'up_to', 'unit_price_minor'],
  additionalProperties: false,
  properties: {
    metric: { type: 'string', enum: ['users', 'storage_gb', 'api_calls'] },
    // null = infinito. El esquema NO comprueba que solo el ultimo lo sea, ni que los
    // cortes crezcan: eso mira filas hermanas y vive en el validador de plantilla.
    up_to: { type: ['integer', 'null'], minimum: 1 },
    unit_price_minor: { type: 'integer', minimum: 0 },
  },
} as const

const plantillaBody = {
  type: 'object',
  required: ['name', 'currency', 'tiers'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: LIMITES.name },
    description: { type: 'string', maxLength: LIMITES.description },
    currency: { type: 'string', pattern: '^[A-Z]{3}$' },
    tiers: { type: 'array', minItems: 1, maxItems: MAX_TIERS, items: tierSchema },
    // El `version` NO se acepta: lo deriva el servidor. El `sort_order` tampoco: sale del
    // orden del array (contrato-api.md 4.1).
  },
} as const

export const createPlanSchema = { body: plantillaBody } as const

export const updatePlanSchema = {
  params: {
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: { id: { type: 'integer', minimum: 1 } },
  },
  body: plantillaBody,
} as const

export const planIdSchema = {
  params: {
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: { id: { type: 'integer', minimum: 1 } },
  },
} as const

export const listPlansSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      // Parametro y no endpoint aparte: el gating por rol es UX, no seguridad
      // (referencia 8.3). Por defecto false: el selector del alta no debe ofrecer un plan
      // archivado.
      include_archived: { type: 'boolean', default: false },
    },
  },
} as const
