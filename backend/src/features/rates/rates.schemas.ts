// Esquema de respuesta de GET /rates. Spec: 9, 12
//
// Como en el resto de rutas, el esquema `response` blinda el contrato de salida y acelera
// la serializacion. El 503 (RATES_UNAVAILABLE) no se declara: los errores los forma el
// error handler con el sobre comun.

export const getRatesSchema = {
  response: {
    200: {
      type: 'object',
      required: ['base', 'rates', 'as_of', 'next_update', 'stale'],
      properties: {
        base: { type: 'string' },
        // Las claves son los codigos del enum Currency (el proveedor ya filtro): un mapa
        // abierto codigo -> tipo, no una lista cerrada que obligue a migrar por divisa.
        rates: { type: 'object', additionalProperties: { type: 'number' } },
        as_of: { type: 'string' },
        next_update: { type: 'string' },
        stale: { type: 'boolean' },
      },
    },
  },
} as const
