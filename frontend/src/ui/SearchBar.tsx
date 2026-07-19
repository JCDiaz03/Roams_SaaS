// La barra de busqueda del sistema (lupa + input pastilla). Diseno: 4
//
// Extraida del dashboard cuando el listado de planes necesito la suya: el mismo
// componente en las dos pantallas, no dos copias del CSS de la pastilla.

import { IconSearch } from './icons'
import styles from './SearchBar.module.css'

type Props = {
  value: string
  onChange: (valor: string) => void
  placeholder: string
  /** Obligatorio: la lupa es decorativa y sin esto el input no tiene nombre accesible. */
  ariaLabel: string
  autoFocus?: boolean
  maxLength?: number
}

export function SearchBar({ value, onChange, placeholder, ariaLabel, autoFocus = false, maxLength = 100 }: Props) {
  return (
    <div className={styles.barra}>
      <span className={styles.lupa}>
        <IconSearch size={19} />
      </span>
      <input
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        maxLength={maxLength}
        autoFocus={autoFocus}
      />
    </div>
  )
}
