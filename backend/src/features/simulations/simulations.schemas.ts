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
    'plan_name',
    'plan_version',
    'inputs',
    'currency',
    'base_minor',
    'tax_rate_bp',
    'tax_minor',
    'total_minor',
    'breakdown',
    'archived',
    'created_by',
    'created_at',
  ],
  properties: {
    id: { type: 'integer' },
    customer_id: { type: 'integer' },
    plan_id: { type: 'integer' },
    // Del pricing_snapshot, nunca del plan actual: versionar un plan no cambia el nombre
    // que declara una simulacion vieja (spec 09, 5.1). Planos y no un objeto plan{}
    // porque plan_id ya vive plano en la raiz y anidar duplicaria el id.
    plan_name: { type: 'string' },
    plan_version: { type: 'integer' },
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
    // Estado de VISTA (spec 09, 5.5): archivada = fuera del historial por defecto.
    archived: { type: 'boolean' },
    // Quien la guardo: el emisor que declara el presupuesto impreso, aunque lo abra otro
    // comercial. null = simulacion anterior a la columna (el papel omite al emisor).
    created_by: { type: ['string', 'null'] },
    created_at: { type: 'string' },
  },
} as const

/**
 * PATCH /simulations/{id}, acotado a `archived` (spec 09, 5.5). Una simulacion guardada
 * sigue siendo inmutable EN SUS NUMEROS: el snapshot, los importes y las entradas no se
 * tocan jamas (11.2); archivar es estado de vista. El additionalProperties hace la
 * frontera verificable: un total_minor en este cuerpo es un 400, no una puerta abierta.
 */
export const patchSimulationSchema = {
  params: {
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: { id: { type: 'integer', minimum: 1 } },
  },
  body: {
    type: 'object',
    required: ['archived'],
    additionalProperties: false,
    properties: { archived: { type: 'boolean' } },
  },
  response: { 200: simulationResponseSchema },
} as const

export const postSimulationSchema = {
  body: {
    type: 'object',
    required: ['customer_id', 'active_users', 'storage_gb', 'api_calls'],
    // Solo ENTRADAS, jamas importes (invariante 1). No es que un importe entrante se
    // ignore: es que NO EXISTE el campo, y additionalProperties lo convierte en un 400.
    // Es lo que hace el invariante verificable con un test.
    //
    // El plan_id es OPCIONAL (ADR 0011): ausente = el plan del cliente, activo o
    // archivado, el camino de siempre. Presente = ese plan, que debe existir y estar
    // activo salvo que sea el contratado — la regla que preserva lo que la prohibicion
    // original protegia: nadie cotiza con una tarifa archivada AJENA (referencia 5.5).
    // Un plan_id es una entrada (una referencia que el backend resuelve y valida), no un
    // importe: el invariante 1 no se mueve.
    additionalProperties: false,
    properties: {
      customer_id: { type: 'integer', minimum: 1 },
      plan_id: { type: 'integer', minimum: 1 },
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
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      // Por defecto, solo las vivas: archivar existe para que no se muestren 100 a la
      // vez. La ficha pide con true y separa en dos secciones (spec 09, 5.5).
      include_archived: { type: 'boolean', default: false },
    },
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
