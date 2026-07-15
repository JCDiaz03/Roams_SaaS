// Esquemas JSON con maxLength en todo campo de texto. Spec: 7.5, 14.2
//
// El esquema es PARTE DEL CONTRATO de la ruta, no un middleware olvidable: una ruta sin
// esquema se ve en code review (referencia 2). Es tambien la primera de las tres capas
// de defensa del identificador fiscal: el maxLength protege al validador del tamano, sus
// regex ancladas protegen de la forma, y el CHECK de la tabla protege de cualquier otro
// camino de escritura.

/** Los topes de texto. Los mismos que los CHECK de la tabla (modelo-datos.md 2.4). */
export const LIMITES = {
  companyName: 200,
  fiscalId: 20,
  email: 254,
  search: 100,
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
} as const

export const customerIdSchema = {
  params: {
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: { id: { type: 'integer', minimum: 1 } },
  },
} as const
