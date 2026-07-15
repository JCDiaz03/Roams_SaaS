// Redondeo half-up en minor_unit. Unica funcion de redondeo del sistema. Spec: 4.2

const abs = (x: bigint): bigint => (x < 0n ? -x : x)

/**
 * Division entera con redondeo HALF-UP: la mitad exacta se aleja del cero.
 *
 *   roundHalfUpDiv(25n, 10n)  ->  3n     (2,5 -> 3)
 *   roundHalfUpDiv(-25n, 10n) -> -3n     (-2,5 -> -3)
 *   roundHalfUpDiv(24n, 10n)  ->  2n     (2,4 -> 2)
 *
 * Half-up es el estandar de facturacion europea y lo que espera cualquiera que compruebe
 * el numero a mano.
 *
 * ES LA UNICA FUNCION DE REDONDEO DEL SISTEMA (invariante 4). Tres razones para que no
 * sea un Math.round(base * rate / 10000):
 *
 *  1. Math.round NO es half-up: es "half hacia +infinito". Math.round(-2.5) === -2, y
 *     half-up da -3. Hoy no hay importes negativos; el dia que haya un abono, el bug es
 *     silencioso y contable. Por eso el caso negativo esta testeado aunque no se use:
 *     documenta por que esta funcion existe.
 *  2. El producto base_minor * rate_bp crece rapido. Con los topes de hoy no desborda el
 *     rango exacto de `number`, pero bigint cierra la cuestion sin obligar a re-derivar
 *     el limite cada vez que un tope cambie.
 *  3. El float no puede tocar el calculo en ningun punto (invariante 5), y `x / 10000`
 *     en `number` ES float.
 *
 * Sobre bigint: no es paranoia gratuita. Es la unica aritmetica exacta que trae el
 * lenguaje, y este es el unico punto del sistema donde aparece una fraccion.
 */
export function roundHalfUpDiv(numerador: bigint, denominador: bigint): bigint {
  if (denominador === 0n) {
    throw new RangeError('roundHalfUpDiv: el denominador no puede ser cero.')
  }

  // El operador / de bigint trunca hacia cero, y % conserva el signo del numerador.
  const cociente = numerador / denominador
  const resto = numerador % denominador

  if (resto === 0n) return cociente

  // Comparar 2*|resto| con |denominador| evita dividir por 2 (que perderia la mitad
  // exacta con denominadores impares: el caso que este redondeo existe para decidir).
  if (2n * abs(resto) < abs(denominador)) return cociente

  // Empate o mas: nos alejamos del cero. El signo del cociente exacto es el producto de
  // los signos, no el del numerador: con denominador negativo, "alejarse del cero" va en
  // la otra direccion.
  const negativo = numerador < 0n !== denominador < 0n
  return negativo ? cociente - 1n : cociente + 1n
}
