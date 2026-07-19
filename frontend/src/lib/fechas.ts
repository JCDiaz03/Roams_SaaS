// Fechas de pantalla y papel, en es-ES. Una sola casa: habia cuatro copias locales
// (historial, hoja de impresion, sello del panel y badge de la topbar) que solo podian
// divergir en el proximo retoque.

/** "19 de julio de 2026" — historial de simulaciones y presupuesto impreso. */
export const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

/** "19 jul" — sellos y badges compactos (panel de resultado, tipos de la topbar). */
export const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
