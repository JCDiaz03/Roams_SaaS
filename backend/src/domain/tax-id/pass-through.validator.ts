// Pais sin esquema -> unvalidated; su hint no disimula que no se comprueba. Spec: 7.3

import type { TaxIdValidation, TaxIdValidator } from './tax-id-validator'

/**
 * El validador de los paises con `tax_id_scheme = NULL`: guarda tal cual.
 *
 * ES UNA ESTRATEGIA MAS DEL REGISTRO, NO UN `if`. Esa es toda la idea: sin el, el
 * "pais sin algoritmo" seria una rama especial en el servicio de alta, y de ahi al
 * `if (pais === 'ES')` que el diseno prohibe hay un paso.
 *
 * No es un estado transitorio a la espera de un validador de verdad: es el estado FINAL
 * del caso mayoritario. "Identificador fiscal" es un concepto distinto en cada pais y la
 * mayoria probablemente nunca tendran algoritmo implementado (referencia 7.1). Ocho de
 * los diez paises del seed pasan por aqui.
 */
export class PassThroughValidator implements TaxIdValidator {
  // El hint NO disimula que no se comprueba: no promete una validacion que no ocurre.
  readonly hint = 'Identificador fiscal'
  readonly validates = false

  validate(): TaxIdValidation {
    return { valid: true, type: 'unvalidated' }
  }
}
