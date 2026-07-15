// Paleta de avatares e iniciales, compartidas por buscador y ficha. Diseno: 2.4.1

/**
 * La paleta de avatares del prototipo. Es DECORACION: el color no comunica nada, solo
 * ayuda a distinguir filas de un vistazo. Por eso se elige por el id -estable entre
 * recargas, a diferencia del indice de la lista, que cambia al buscar- y por eso las
 * iniciales van ademas escritas.
 */
const PALETA: readonly (readonly [string, string])[] = [
  ['#fdeaf4', '#c70069'],
  ['#e7eefc', '#2a5bd7'],
  ['#e6f5ee', '#0f7050'],
  ['#fdf1de', '#8a5608'],
  ['#efeafd', '#5c34bd'],
  ['#e6f4f7', '#0b6273'],
]

/** El par [fondo, tinta] de un cliente, estable por su id. */
export function colorAvatar(id: number): readonly [string, string] {
  return PALETA[id % PALETA.length] as readonly [string, string]
}

export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join('')
    .toUpperCase()
}
