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
} as const
