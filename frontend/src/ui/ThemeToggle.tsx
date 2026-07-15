// Conmutador sol/luna en la topbar. Diseno: 2.3

import type { Theme } from '../lib/theme'
import styles from './ThemeToggle.module.css'
import { IconMoon, IconSun } from './icons'

type Props = {
  theme: Theme
  onToggle: () => void
  /** En el login no hay topbar: flota en la esquina (diseno, ventana 1). */
  floating?: boolean
}

export function ThemeToggle({ theme, onToggle, floating = false }: Props) {
  const aOscuro = theme === 'light'

  return (
    <button
      type="button"
      className={[styles.toggle, floating ? styles.floating : ''].filter(Boolean).join(' ')}
      onClick={onToggle}
      // El boton no tiene texto: sin esto, un lector de pantalla lee "boton" y ya.
      // Y la etiqueta dice lo que VA A PASAR, no el estado actual, que es lo que quien
      // lo pulsa quiere saber.
      aria-label={aOscuro ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
      title={aOscuro ? 'Tema oscuro' : 'Tema claro'}
    >
      {aOscuro ? <IconMoon /> : <IconSun />}
    </button>
  )
}
