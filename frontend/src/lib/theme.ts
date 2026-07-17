// data-theme en la raiz; la preferencia vive en la sesion. Diseno: 2.3

export type Theme = 'light' | 'dark'

const ATRIBUTO = 'data-theme'

/**
 * Aplica el tema poniendo `data-theme` en <html>.
 *
 * Es TODO el mecanismo: tokens.css define los dos juegos de variables y el navegador
 * intercambia el que toca. Ningun componente sabe que tema hay, y ninguno puede
 * enterarse: si alguno lo necesitara para pintarse, faltaria un token (tokens.css).
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute(ATRIBUTO, theme)
}

/**
 * El tema inicial: CLARO, siempre (decision de producto de la tanda de retoques). La
 * herramienta arranca con su cara por defecto y quien prefiera oscuro lo conmuta —
 * tambien desde el login. Antes se leia prefers-color-scheme del sistema; se cambio a
 * peticion del usuario: el modo claro es el lenguaje visual principal (diseno 2.1).
 */
export function preferredTheme(): Theme {
  return 'light'
}

export function toggleTheme(actual: Theme): Theme {
  return actual === 'dark' ? 'light' : 'dark'
}

// Nota deliberada: la preferencia NO se guarda en localStorage. Vive en el estado de
// sesion (lib/session.tsx) y muere al cerrar sesion, igual que el nombre y la divisa
// (diseno 2.3). El dia que haya usuarios de verdad, la preferencia es del usuario, no
// del navegador, y localStorage seria el sitio equivocado para dejarla.
