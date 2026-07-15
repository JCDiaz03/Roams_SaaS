// Esquema de la plantilla de planes. Spec: 5.4
//
// Estado: (parcial). El esquema de la PLANTILLA (POST/PUT) entra en Fase 2 con sus
// endpoints. Aqui solo esta el del listado.

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
