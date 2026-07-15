// DNI (mod 23), NIE (XYZ->012) y CIF (checksum ponderado). Spec: 7.7

import type { TaxIdValidation, TaxIdValidator } from './tax-id-validator'

/** Alfabeto de control del DNI/NIE: la letra es `numero mod 23` indexando aqui. */
const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE'

/** Alfabeto de control del CIF, indexado por el digito de control (0-9). */
const LETRAS_CIF = 'JABCDEFGHI'

// Regex ANCLADAS y LINEALES: sin cuantificadores anidados, sin alternancias solapadas,
// sin backtracking catastrofico (referencia 7.5). Con maxLength 20 en el esquema Fastify
// y estas regex, el validador nunca ve una entrada que pueda hacerle dano: el maxLength
// protege del tamano, el anclaje protege de la forma. Ninguna de las dos basta sola.
const RE_DNI = /^\d{8}[A-Z]$/
const RE_NIE = /^[XYZ]\d{7}[A-Z]$/

// La inicial del CIF es el TIPO DE ORGANIZACION. El conjunto excluye a proposito:
//   * I, O y T: I y O se confunden con 1 y 0.
//   * X, Y, Z: son NIE.
//   * K, L y M: NO son CIF. Son NIF de PERSONA FISICA del formato antiguo (menores,
//     espanoles no residentes, extranjeros sin NIE) y su control es una letra mod 23,
//     como el DNI, NO el checksum ponderado de aqui abajo. Incluirlas -como hacen
//     bastantes implementaciones- significa calcularles el checksum equivocado y dar por
//     bueno lo que no lo es. Quedan fuera de alcance (B2B) y por tanto se rechazan.
const RE_CIF = /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/

// Que control admite cada tipo de organizacion. Es el detalle que casi todas las
// implementaciones se saltan: un validador que acepte siempre ambos es MAS PERMISIVO de
// lo correcto y deja pasar A1234567D (una S.A. con letra de control, que no existe).
const CIF_SOLO_NUMERO = new Set(['A', 'B', 'E', 'H'])
const CIF_SOLO_LETRA = new Set(['P', 'Q', 'R', 'S', 'N', 'W'])
// El resto (C, D, F, G, J, U, V) admite cualquiera de los dos.

/** La letra de control del DNI/NIE a partir del numero de 8 digitos. */
function letraDni(numero: number): string {
  return LETRAS_DNI.charAt(numero % 23)
}

function validaDni(id: string): boolean {
  return id.charAt(8) === letraDni(Number(id.slice(0, 8)))
}

function validaNie(id: string): boolean {
  // X -> 0, Y -> 1, Z -> 2, y despues el MISMO mod 23 que el DNI.
  const inicial = id.charAt(0)
  const digito = inicial === 'X' ? '0' : inicial === 'Y' ? '1' : '2'

  return id.charAt(8) === letraDni(Number(digito + id.slice(1, 8)))
}

function validaCif(id: string): boolean {
  const organizacion = id.charAt(0)
  const digitos = id.slice(1, 8)
  const control = id.charAt(8)

  // Checksum ponderado sobre los 7 digitos centrales:
  //   posiciones PARES (2a, 4a, 6a)        -> se suman tal cual
  //   posiciones IMPARES (1a, 3a, 5a, 7a)  -> se duplican y se suman SUS DIGITOS
  let suma = 0
  for (let i = 0; i < 7; i += 1) {
    const digito = Number(digitos.charAt(i))

    if (i % 2 === 0) {
      // i base 0 par = posicion base 1 impar (1a, 3a, 5a, 7a).
      const doble = digito * 2
      suma += Math.floor(doble / 10) + (doble % 10)
    } else {
      suma += digito
    }
  }

  // El mod 10 EXTERIOR no es decorativo: si suma % 10 == 0, "10 - 0" da 10, que no es un
  // digito. Sin el, todo CIF cuyo checksum acabe en 0 se valida contra "10" y se rechaza
  // siempre. Es el off-by-one clasico de este algoritmo.
  const controlNumero = (10 - (suma % 10)) % 10
  const controlLetra = LETRAS_CIF.charAt(controlNumero)

  if (CIF_SOLO_NUMERO.has(organizacion)) return control === String(controlNumero)
  if (CIF_SOLO_LETRA.has(organizacion)) return control === controlLetra

  return control === String(controlNumero) || control === controlLetra
}

/**
 * El esquema espanol (`ES_NIF`). "DNI/NIF/CIF" no es un algoritmo, son dos: este
 * validador DETECTA EL TIPO POR FORMATO y aplica el control que toque (referencia 7.7).
 *
 * Dos niveles de despacho, pero solo el primero es Strategy: el registro elige el
 * validador del pais; que aqui dentro se distinga DNI/NIE/CIF por formato es deteccion
 * de formato DENTRO de una estrategia, no otra capa de estrategias. Mantenerlo asi evita
 * la sobre-arquitectura de un registro anidado para tres formatos que solo coexisten en
 * un pais.
 *
 * Al ser B2B, el CIF es el caso mayoritario y el mejor testeado.
 *
 * RECORTE CONSCIENTE: los NIF especiales que empiezan por K (menores), L (espanoles no
 * residentes) y M (extranjeros sin NIE) NO se implementan. La herramienta es B2B: un NIF
 * K/L/M no es cliente corporativo de este producto. Consecuencia asumida: un L1234567X
 * se rechaza como invalido, no como "no soportado". Si apareciera el caso, es una rama
 * mas aqui. Spec: 03-proceso/recortes-conscientes.md 3
 */
export class SpanishTaxIdValidator implements TaxIdValidator {
  readonly hint = 'DNI, NIE o CIF — se comprueba automáticamente'
  readonly validates = true

  validate(normalizado: string): TaxIdValidation {
    if (RE_DNI.test(normalizado)) return { valid: validaDni(normalizado), type: 'DNI' }
    if (RE_NIE.test(normalizado)) return { valid: validaNie(normalizado), type: 'NIE' }
    if (RE_CIF.test(normalizado)) return { valid: validaCif(normalizado), type: 'CIF' }

    // Ni siquiera tiene forma de nada conocido.
    return { valid: false, type: 'unvalidated' }
  }
}
