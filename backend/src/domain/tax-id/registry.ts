// Map<scheme, TaxIdValidator>: ES_NIF -> SpanishTaxIdValidator. Spec: 7.2

import { SpanishTaxIdValidator } from './es-nif.validator'
import { PassThroughValidator } from './pass-through.validator'
import type { TaxIdValidator } from './tax-id-validator'

/**
 * La fila de `countries` dice QUE esquema aplica (`tax_id_scheme`); este registro dice
 * COMO. Esa es la linea divisoria dato/codigo (referencia 6.1): lo que cambia sin
 * desplegar (la cobertura de paises) es dato; los algoritmos de checksum son codigo. La
 * tabla solo guarda la CLAVE que los conecta.
 *
 * Las claves van ESPACIADAS POR PAIS (ES_NIF, PT_NIF): "NIF" existe en Espana y en
 * Portugal con algoritmos distintos, y una clave "NIF" seria una colision esperando a
 * ocurrir. El espaciado permite ademas que dos paises apunten AL MISMO validador con
 * etiqueta local distinta (mismo algoritmo, otro nombre).
 *
 * Anadir un pais con validacion = una clase + una entrada aqui + rellenar la columna.
 */
const REGISTRO: ReadonlyMap<string, TaxIdValidator> = new Map<string, TaxIdValidator>([
  ['ES_NIF', new SpanishTaxIdValidator()],
])

/** El fallback de los paises con `tax_id_scheme = NULL`. Una estrategia mas, no un `if`. */
export const PASS_THROUGH: TaxIdValidator = new PassThroughValidator()

/**
 * Resuelve el validador de un pais a partir de su `tax_id_scheme`.
 *
 *   scheme = 'ES_NIF'  -> SpanishTaxIdValidator
 *   scheme = null      -> PassThroughValidator (pais sin esquema)
 *   scheme desconocido -> LANZA
 *
 * El tercer caso NUNCA debe degradar en silencio a pass-through, y por eso lanza en vez
 * de devolver PASS_THROUGH. Es el fallo que este diseno mas teme: un seed que escribe
 * tax_id_scheme = 'PT_NIF' antes de que exista la clase daria de alta a los clientes
 * portugueses SIN VALIDAR, marcados como 'unvalidated', y nadie se enteraria hasta
 * auditar los datos. La deriva dato<->codigo es silenciosa por naturaleza.
 *
 * En la practica es inalcanzable: el chequeo de integridad del arranque (referencia 7.3)
 * usa `hasValidator()` para abortar el proceso antes de aceptar peticiones. Esto es el
 * cinturon de ese tirante.
 */
export function validatorFor(scheme: string | null): TaxIdValidator {
  if (scheme === null) return PASS_THROUGH

  const validador = REGISTRO.get(scheme)
  if (validador === undefined) {
    throw new Error(
      `Esquema fiscal "${scheme}" referenciado por countries pero no registrado. ` +
        'Anade su TaxIdValidator al registro o pon la columna a NULL: degradar a ' +
        'pass-through en silencio guardaria identificadores sin validar.',
    )
  }

  return validador
}

/** Lo que necesita el chequeo de integridad del arranque para fallar ruidosamente. */
export function hasValidator(scheme: string): boolean {
  return REGISTRO.has(scheme)
}

/** Los esquemas registrados. Util para el mensaje de error del chequeo de arranque. */
export function registeredSchemes(): readonly string[] {
  return [...REGISTRO.keys()]
}
