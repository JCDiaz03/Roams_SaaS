// Mayusculas, sin espacios ni guiones. Se persiste la forma normalizada. Spec: 7.4

/**
 * Normaliza un identificador fiscal antes de validarlo. Se PERSISTE la forma normalizada.
 *
 *   "b-1234 5674"  ->  "B12345674"
 *   " 12345678z "  ->  "12345678Z"
 *
 * Es el gotcha clasico que rompe las validaciones con datos reales tecleados por
 * humanos, y arrastra dos consecuencias que no son obvias:
 *
 *  1. El UNIQUE actua sobre la forma normalizada. Sin normalizar, "b12345674" y
 *     "B12345674" son dos empresas distintas para la base de datos y la misma para el
 *     mundo. La tabla lo remata con CHECK (fiscal_id = upper(fiscal_id)).
 *  2. La respuesta del alta devuelve el identificador normalizado, no el que se tecleo:
 *     el comercial debe ver en pantalla lo que quedo guardado.
 *
 * Regla exacta: eliminar todo lo que no sea [A-Za-z0-9] y pasar a mayusculas. NADA MAS.
 * No se rellenan ceros a la izquierda ni se corrigen caracteres parecidos (O por 0): eso
 * seria adivinar la intencion del usuario, y adivinar mal en un identificador fiscal es
 * peor que rechazar.
 *
 * toUpperCase() SIN locale, a proposito: toLocaleUpperCase('tr-TR') convierte la i en I
 * con punto, y entonces la misma entrada validaria distinto segun la maquina que corre
 * el servidor. Los identificadores fiscales son ASCII. Es un bug real de los que solo
 * aparecen en produccion y en un solo pais.
 */
export function normalizeFiscalId(entrada: string): string {
  return entrada.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}
