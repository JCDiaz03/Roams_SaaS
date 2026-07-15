// Solo entradas (usuarios, GB, llamadas); nunca importes. Spec: 3.1, 10

/**
 * Topes anti-DoS con la misma logica que los maxLength (referencia 7.5): sin ellos,
 * `active_users: 1e15` es una peticion valida que el motor recorreria. Son
 * deliberadamente holgados: no son reglas de negocio, son el borde de lo fisicamente
 * sensato.
 */
export const TOPES = {
  activeUsers: 1_000_000,
  storageGb: 10_000_000,
  apiCalls: 1_000_000_000,
} as const

/**
 * La simulacion tal y como sale por la API (espejo de SimulationView). La misma para el
 * POST y para cada elemento del historial, a proposito: la card recien guardada y la del
 * historial son el mismo componente.
 *
 * Es el esquema `response` que mas trabaja: el `pricing_snapshot` es interno y NO esta
 * declarado, asi que aunque una vista futura lo colara, no saldria. Todos los campos en
 * `required`, como en el resto: una regresion falla ruidosamente, no omite en silencio.
 */
const simulationResponseSchema = {
  type: 'object',
  required: [
    'id',
    'customer_id',
    'plan_id',
    'inputs',
    'currency',
    'base_minor',
    'tax_rate_bp',
    'tax_minor',
    'total_minor',
    'breakdown',
    'created_at',
  ],
  properties: {
    id: { type: 'integer' },
    customer_id: { type: 'integer' },
    plan_id: { type: 'integer' },
    inputs: {
      type: 'object',
      required: ['active_users', 'storage_gb', 'api_calls'],
      properties: {
        active_users: { type: 'integer' },
        storage_gb: { type: 'integer' },
        api_calls: { type: 'integer' },
      },
    },
    currency: { type: 'string' },
    base_minor: { type: 'integer' },
    tax_rate_bp: { type: 'integer' },
    tax_minor: { type: 'integer' },
    total_minor: { type: 'integer' },
    breakdown: {
      type: 'array',
      items: {
        type: 'object',
        required: ['metric', 'billed', 'quantity', 'subtotal_minor', 'tiers'],
        properties: {
          metric: { type: 'string' },
          billed: { type: 'boolean' },
          quantity: { type: 'integer' },
          subtotal_minor: { type: 'integer' },
          tiers: {
            type: 'array',
            items: {
              type: 'object',
              required: ['up_to', 'unit_price_minor', 'units', 'amount_minor'],
              properties: {
                up_to: { type: ['integer', 'null'] },
                unit_price_minor: { type: 'integer' },
                units: { type: 'integer' },
                amount_minor: { type: 'integer' },
              },
            },
          },
        },
      },
    },
    created_at: { type: 'string' },
  },
} as const

export const postSimulationSchema = {
  body: {
    type: 'object',
    required: ['customer_id', 'active_users', 'storage_gb', 'api_calls'],
    // Solo ENTRADAS, jamas importes (invariante 1). No es que un importe entrante se
    // ignore: es que NO EXISTE el campo, y additionalProperties lo convierte en un 400.
    // Es lo que hace el invariante verificable con un test.
    //
    // El plan_id TAMPOCO se acepta: se deriva del cliente. Si entrara por el cuerpo, el
    // frontend podria cotizar a un cliente con un plan que no es el suyo, y el plan del
    // cliente es justo lo que el versionado protege (referencia 5.5).
    additionalProperties: false,
    properties: {
      customer_id: { type: 'integer', minimum: 1 },
      active_users: { type: 'integer', minimum: 0, maximum: TOPES.activeUsers },
      storage_gb: { type: 'integer', minimum: 0, maximum: TOPES.storageGb },
      api_calls: { type: 'integer', minimum: 0, maximum: TOPES.apiCalls },
    },
  },
  response: { 201: simulationResponseSchema },
} as const

export const historySchema = {
  params: {
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: { id: { type: 'integer', minimum: 1 } },
  },
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: { limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
  },
  response: {
    200: {
      type: 'object',
      required: ['simulations', 'total'],
      properties: {
        simulations: { type: 'array', items: simulationResponseSchema },
        total: { type: 'integer' },
      },
    },
  },
} as const
