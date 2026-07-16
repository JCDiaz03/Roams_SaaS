// NIF portugues: 9 digitos, prefijo asignado y checksum mod 11. Spec: 02-validacion-fiscal 4.6

import type { TaxIdValidation, TaxIdValidator } from './tax-id-validator'

// Anclada y lineal, como todas (referencia 7.5). La alternancia codifica QUE PREFIJOS
// ASIGNA la AT portuguesa, no solo la forma:
//   1, 2, 3          -> persona singular
//   45               -> persona singular no residente
//   5                -> persona colectiva (el caso B2B mayoritario)
//   6                -> organismo publico
//   70-72, 74-75,
//   77-79            -> herencias indivisas, arrendamientos y otros regimenes
//   8                -> empresario en nombre individual
//   90-91, 98-99     -> condominios, no residentes colectivos e irregulares
// Un prefijo no asignado (04, 73, 92...) se rechaza aunque el checksum cuadre: un
// validador que acepte cualquier 9-digitos-con-checksum es mas permisivo de lo correcto,
// el mismo criterio que excluye K/L/M del CIF español (es-nif.validator.ts). Si la AT
// asigna un rango nuevo, es una linea de esta alternancia.
const RE_NIF_PT = /^(?:[123568]\d|45|7[0-24-57-9]|9[0189])\d{7}$/

/**
 * El digito de control: los 8 primeros ponderados 9..2, modulo 11.
 *
 * La regla del resto es el gotcha de este algoritmo: si 11 - resto da 10 u 11 (esto es,
 * resto 0 o 1), el control es 0 — no "un digito de dos cifras". Sin ese pliegue, todo
 * NIF cuyo checksum caiga en esos dos restos se rechazaria siempre.
 */
function checksumValido(nif: string): boolean {
  let suma = 0
  for (let i = 0; i < 8; i += 1) {
    suma += Number(nif.charAt(i)) * (9 - i)
  }

  const resto = suma % 11
  const control = resto < 2 ? 0 : 11 - resto

  return Number(nif.charAt(8)) === control
}

/**
 * El esquema portugues (`PT_NIF`). Es la DEMOSTRACION de la promesa del registro
 * (referencia 7.2, roadmap 5.3): añadir la validacion de un pais = esta clase + una
 * entrada en el registro + rellenar `tax_id_scheme` en el seed. Cero cambios en
 * endpoints ni en el frontend: el hint viaja resuelto por GET /countries y el chip
 * "NIF validado" sale del `type` que este validador devuelve.
 *
 * La colision de nombres que la referencia 7.1 predice es ESTA: "NIF" existe en España
 * (donde es el paraguas de DNI/NIE/CIF, con mod 23 y checksum ponderado) y en Portugal
 * (9 digitos, mod 11). Las claves espaciadas por pais (`ES_NIF`/`PT_NIF`) la disuelven.
 *
 * A diferencia del español, aqui no hay deteccion de tipo por formato: el NIF portugues
 * es UN algoritmo (el prefijo distingue a quien pertenece, no como se valida), asi que
 * `type` es siempre 'NIF' cuando la forma es de NIF.
 */
export class PortugueseTaxIdValidator implements TaxIdValidator {
  readonly hint = 'NIF — se comprueba automáticamente'
  readonly validates = true

  validate(normalizado: string): TaxIdValidation {
    if (!RE_NIF_PT.test(normalizado)) return { valid: false, type: 'unvalidated' }

    return { valid: checksumValido(normalizado), type: 'NIF' }
  }
}
