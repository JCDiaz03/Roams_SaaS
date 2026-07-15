// Interfaz TaxProvider (pura, sin IO). La implementacion vive en infra/. Spec: 6.2

/**
 * De donde sale el tipo impositivo que se aplica a un cliente.
 *
 * ES UNO DE LOS CUATRO PUERTOS DEL SISTEMA (directrices-ia.md 3.3), y existe por una
 * razon concreta y sabida: al integrar con el sistema real de la empresa habra reverse
 * charge intracomunitario. Es un hecho, no una hipotesis, y el dia que llegue se enchufa
 * un VIESProvider sin tocar el motor.
 *
 * El calculo pide el tipo AQUI, nunca a una constante ni a un `if (pais === 'ES')`.
 *
 * Sin IO y sincrono a proposito: la implementacion de hoy
 * (infra/standard-country-rate.provider.ts) lee de la cache de arranque, y una firma
 * asincrona obligaria a ser asincrono a todo el que la use, para nada. El dia que un
 * VIESProvider necesite red, la firma cambia y el compilador dice donde.
 */
export interface TaxProvider {
  /**
   * El tipo del pais, en puntos basicos (2100 = 21 %).
   *
   * No devuelve `null` para un pais sin tipo: ese caso es INEXPRESABLE por diseno
   * (referencia 6.1). Solo se puede dar de alta un cliente de un pais con fila en
   * `countries`, y el chequeo de arranque garantiza que todos tienen tipo vigente. Si
   * este metodo contemplara el fallo, esa garantia seria una frase y no un invariante.
   */
  rateBpFor(countryCode: string): number
}
