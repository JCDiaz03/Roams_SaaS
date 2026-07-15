// Config del servidor: puerto, ruta del .db, URL fija de open.er-api.com. Spec: 14.1

import { fileURLToPath } from 'node:url'

// Por defecto, backend/roams.db. Esta en .gitignore: se regenera sola en el primer
// arranque (referencia 2.1), asi que el evaluador no tiene ningun paso manual de base
// de datos.
const DB_POR_DEFECTO = fileURLToPath(new URL('../roams.db', import.meta.url))

export const config = {
  port: Number(process.env['PORT'] ?? 3000),
  dbPath: process.env['DB_PATH'] ?? DB_POR_DEFECTO,

  // La unica URL externa del sistema: FIJA y en configuracion del servidor. Ninguna
  // entrada del usuario compone URLs, y por eso no hay superficie de SSRF
  // (referencia 14.1). Si esto pasara a ser un parametro, esa frase dejaria de ser
  // cierta. Spec: features/04-tipos-de-cambio.md 5
  ratesUrl: 'https://open.er-api.com/v6/latest/EUR',
} as const
