// Errores de produccion: mensaje generico + codigo; el detalle solo al log. Spec: 14.2

import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

/**
 * Un error de DOMINIO: la forma del cuerpo era correcta, pero el contenido no vale.
 *
 * Es un flujo NORMAL de la aplicacion, no una anomalia: "el CIF no cuadra" es algo que un
 * comercial hace todos los dias. Por eso lleva mensaje de producto y no de log
 * (contrato-api.md 1.2).
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    /** Castellano, para un comercial no tecnico. Sin jerga ni nombres internos. */
    override readonly message: string,
    /** El campo del formulario al que es atribuible, si lo es. */
    readonly field?: string,
    /** Extension del sobre (p. ej. `existing_customer`). Se usa con cuentagotas. */
    readonly extra?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

type SobreError = {
  error: {
    code: string
    message: string
    field?: string
    [k: string]: unknown
  }
}

function sobre(code: string, message: string, field?: string, extra?: Record<string, unknown>): SobreError {
  return {
    error: {
      code,
      message,
      ...(field !== undefined ? { field } : {}),
      ...(extra ?? {}),
    },
  }
}

/**
 * El campo que ha fallado la validacion de esquema, para que la UI pinte el error JUNTO
 * al campo y no en un alert generico (referencia 13.1).
 *
 * Fastify da `instancePath` como "/company_name" (o "" si el fallo es del objeto entero,
 * p. ej. un `required` o un `additionalProperties`). En ese caso se mira `params`.
 */
function campoDe(error: FastifyError): string | undefined {
  const primero = error.validation?.[0]
  if (primero === undefined) return undefined

  const ruta = primero.instancePath.replace(/^\//, '').split('/')[0]
  if (ruta !== undefined && ruta !== '') return ruta

  const params = primero.params as { missingProperty?: string; additionalProperty?: string }
  return params.missingProperty ?? params.additionalProperty
}

/**
 * El unico sitio del backend donde un error se convierte en respuesta.
 *
 * Tres caminos:
 *   * Error de ESQUEMA  -> 400 VALIDATION_ERROR. El cliente esta mal programado: el
 *     formulario nunca deberia producirlo (contrato-api.md 1.3).
 *   * AppError          -> su status y su code. Flujo normal.
 *   * Cualquier otra cosa -> 500 INTERNAL_ERROR con mensaje generico.
 *
 * LO QUE NUNCA SALE: el stack trace, el mensaje de la excepcion original, el SQL, la ruta
 * de un fichero (referencia 14.2). El detalle va al log del servidor. Un `error.message`
 * de better-sqlite3 filtra nombres de tabla y de columna; un stack filtra el arbol de
 * directorios de la maquina.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, req: FastifyRequest, reply: FastifyReply) => {
    if (error.validation !== undefined) {
      req.log.info({ validation: error.validation, url: req.url }, 'Peticion rechazada por el esquema')
      return reply
        .status(400)
        .send(sobre('VALIDATION_ERROR', 'Los datos enviados no tienen el formato esperado.', campoDe(error)))
    }

    if (error instanceof AppError) {
      req.log.info({ code: error.code, url: req.url }, 'Error de dominio')
      return reply.status(error.status).send(sobre(error.code, error.message, error.field, error.extra))
    }

    // Aqui solo llega lo que nadie contemplo. Se loguea ENTERO -es la unica copia del
    // detalle- y al cliente le va un generico.
    req.log.error({ err: error, url: req.url }, 'Error no contemplado')
    return reply
      .status(500)
      .send(sobre('INTERNAL_ERROR', 'Algo ha fallado por nuestra parte. Inténtalo de nuevo.'))
  })

  // El 404 de Fastify trae su propio cuerpo, que no es nuestro sobre. La UI decide con
  // `code`, asi que una ruta inexistente tiene que hablar el mismo idioma que el resto.
  app.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
    return reply.status(404).send(sobre('NOT_FOUND', 'El recurso solicitado no existe.'))
  })
}
