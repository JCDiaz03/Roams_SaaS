// Interfaz TaxIdValidator: validate(id_normalizado) -> { valid, type }, mas su hint propio. Spec: 7.2

/**
 * El resultado de validar, tal y como se persiste en customers.fiscal_id_type.
 * `unvalidated` es un valor de PRIMERA CLASE, no un hueco: es lo que devuelve
 * PassThroughValidator, y la base de datos distingue "no se pudo comprobar" de "no se
 * comprobo por descuido".
 *
 * 'NIF' es el portugues (PT_NIF). No colisiona con España aunque alli "NIF" sea el
 * paraguas coloquial: el validador español devuelve el tipo CONCRETO (DNI/NIE/CIF), que
 * es mas informativo. Añadir un tipo aqui exige ampliar el CHECK de customers en el
 * mismo commit (schema.sql).
 */
export type FiscalIdType = 'DNI' | 'NIE' | 'CIF' | 'NIF' | 'unvalidated'

/**
 * El par (valid, type) nunca es ambiguo:
 *   { valid: true,  type: 'CIF' }         -> es un CIF y su control cuadra
 *   { valid: false, type: 'CIF' }         -> tiene forma de CIF, pero el control no cuadra
 *   { valid: true,  type: 'unvalidated' } -> pais sin esquema: se guarda tal cual
 *   { valid: false, type: 'unvalidated' } -> el validador no reconoce ni el formato
 */
export type TaxIdValidation = {
  valid: boolean
  type: FiscalIdType
}

/**
 * Una estrategia de validacion fiscal. El registro (registry.ts) elige cual segun el
 * `tax_id_scheme` del pais; esta interfaz dice como.
 *
 * Anadir la validacion de un pais = una clase que implemente esto + una entrada en el
 * registro + rellenar la columna. CERO cambios en endpoints (referencia 7.2).
 *
 * ALCANCE (no-objetivo explicito, referencia 7.6): se valida que el identificador es
 * estructuralmente valido y que su caracter de control cuadra. NO que exista o pertenezca
 * a alguien: no se consulta AEAT ni VIES. El mod 23 dice que la letra cuadra con los
 * digitos, no que ese DNI se haya emitido nunca.
 */
export interface TaxIdValidator {
  /**
   * Texto de presentacion, ya resuelto. Vive AQUI, junto al algoritmo, y no en una tabla
   * ni en el frontend: es lo que hace que GET /countries lo sirva resuelto y que el
   * cliente nunca compare un codigo de pais (contrato-api.md 3.1). Quien anade PT_NIF
   * escribe su hint en la misma clase, y no hay una segunda lista que se olvide.
   */
  readonly hint: string

  /** false = PassThrough. Distingue "se comprobara" de "se guarda tal cual". */
  readonly validates: boolean

  /** Recibe la forma YA normalizada (normalize.ts). No normaliza por su cuenta. */
  validate(normalizado: string): TaxIdValidation
}
