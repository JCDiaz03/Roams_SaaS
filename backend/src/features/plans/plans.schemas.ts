// Esquema de la plantilla de planes. Spec: 5.4

/** Topes de texto, como en toda ruta (referencia 7.5). */
export const LIMITES = { name: 100, description: 500 } as const

/** Anti-DoS: 30 tramos es holgadisimo para un plan real y acota el bucle del motor. */
const MAX_TIERS = 30

/**
 * Topes del dinero del plan, y son ANTI-OVERFLOW, no de negocio: el peor producto
 * posible del motor es precio maximo x cantidad maxima de api_calls (1e6 x 1e9 = 1e15),
 * un orden por debajo de 2^53, donde `number` empieza a perder enteros. La suma de tres
 * metricas mas el impuesto sigue cabiendo. Sin estos topes, un plan valido con precio
 * 1e15 hacia reventar (500) toda simulacion futura de sus clientes — o peor, en la zona
 * intermedia persistia importes IMPRECISOS en silencio, que el CHECK de la tabla no caza
 * porque base, impuesto y total salen de la misma base imprecisa. Se comprueban aqui
 * (400 en la API) Y en el validador de plantilla (el camino del seed), como los
 * maxLength se duplican en los CHECK.
 */
export const TOPES_PLAN = {
  /** 1_000_000 minor = 10.000,00 EUR por unidad: holgadisimo para cualquier SaaS. */
  unitPriceMinor: 1_000_000,
  /** El mismo orden que el tope mayor de las simulaciones (api_calls, 1e9). */
  upTo: 1_000_000_000,
} as const

const tierSchema = {
  type: 'object',
  required: ['metric', 'up_to', 'unit_price_minor'],
  additionalProperties: false,
  properties: {
    metric: { type: 'string', enum: ['users', 'storage_gb', 'api_calls'] },
    // null = infinito. El esquema NO comprueba que solo el ultimo lo sea, ni que los
    // cortes crezcan: eso mira filas hermanas y vive en el validador de plantilla.
    up_to: { type: ['integer', 'null'], minimum: 1, maximum: TOPES_PLAN.upTo },
    unit_price_minor: { type: 'integer', minimum: 0, maximum: TOPES_PLAN.unitPriceMinor },
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

/**
 * El plan tal y como sale por la API (espejo de PlanWithTiers). Compartido por las cuatro
 * rutas de planes y, via import, por el detalle de cliente que lo embebe.
 *
 * Los esquemas `response` cumplen dos funciones: Fastify serializa con
 * fast-json-stringify (mas rapido que JSON.stringify) y, sobre todo, BLINDAN el contrato
 * de salida: un campo no declarado aqui no sale, aunque una vista lo cuele por accidente.
 * Todos los campos van en `required` a proposito: si el servicio deja de producir uno,
 * la serializacion falla ruidosamente en vez de omitirlo en silencio.
 */
export const planResponseSchema = {
  type: 'object',
  required: ['id', 'name', 'version', 'description', 'currency', 'pricing_model', 'active', 'tiers'],
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    version: { type: 'integer' },
    description: { type: ['string', 'null'] },
    currency: { type: 'string' },
    pricing_model: { type: 'string' },
    active: { type: 'boolean' },
    tiers: {
      type: 'array',
      items: {
        type: 'object',
        required: ['metric', 'up_to', 'unit_price_minor', 'sort_order'],
        properties: {
          metric: { type: 'string' },
          up_to: { type: ['integer', 'null'] },
          unit_price_minor: { type: 'integer' },
          sort_order: { type: 'integer' },
        },
      },
    },
  },
} as const

export const createPlanSchema = {
  body: plantillaBody,
  response: { 201: planResponseSchema },
} as const

export const updatePlanSchema = {
  params: {
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: { id: { type: 'integer', minimum: 1 } },
  },
  body: plantillaBody,
  // 201 y no 200: "editar" crea una version nueva (contrato-api.md 4.2).
  response: { 201: planResponseSchema },
} as const

export const deletePlanSchema = {
  params: {
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: { id: { type: 'integer', minimum: 1 } },
  },
  // Devuelve el plan archivado: la UI actualiza el badge sin segunda peticion.
  response: { 200: planResponseSchema },
} as const

/**
 * GET /plans/{id}: detalle de un plan, archivado incluido y SIN rol (spec 08, 2). Lo que
 * exige admin es el LISTADO de archivados (el inventario), no un plan concreto cuyo id ya
 * conoces: ese viaja entero embebido en la ficha de cualquier cliente antiguo.
 */
export const getPlanSchema = {
  params: {
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: { id: { type: 'integer', minimum: 1 } },
  },
  response: { 200: planResponseSchema },
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
  response: {
    200: {
      type: 'object',
      required: ['plans'],
      properties: { plans: { type: 'array', items: planResponseSchema } },
    },
  },
} as const
