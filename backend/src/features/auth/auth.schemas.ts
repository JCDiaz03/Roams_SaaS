// Esquemas de /auth: login con topes, respuesta { nombre, rol }. Spec: 07-autenticacion.md 4

/** La sesion tal y como la ve el cliente. La misma forma en login y en rehidratacion. */
const sesionResponseSchema = {
  type: 'object',
  required: ['nombre', 'rol'],
  properties: {
    nombre: { type: 'string' },
    rol: { type: 'string', enum: ['admin', 'sales'] },
  },
} as const

export const loginSchema = {
  body: {
    type: 'object',
    required: ['usuario', 'password'],
    additionalProperties: false,
    properties: {
      // Los mismos topes que el input del login. maxLength en todo campo de texto
      // (referencia 7.5): el proveedor de identidad nunca ve entradas sin acotar.
      usuario: { type: 'string', minLength: 1, maxLength: 60 },
      password: { type: 'string', minLength: 1, maxLength: 100 },
    },
  },
  response: { 200: sesionResponseSchema },
} as const

export const sessionSchema = {
  response: { 200: sesionResponseSchema },
} as const

/** Sin entrada y sin cuerpo de salida: el esquema declara exactamente eso. */
export const logoutSchema = {
  response: { 204: { type: 'null' } },
} as const
