// Chips y badges de atributo. Diseno: 2.4.1

import type { ReactNode } from 'react'
import styles from './Chip.module.css'

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

type Props = {
  children: ReactNode
  tone?: Tone
  icon?: ReactNode
  className?: string | undefined
}

/**
 * Chip de atributo: pais, plan, version, estado del identificador fiscal.
 *
 * El `tone` es SEMANTICO, no un color: quien lo usa dice "esto va bien" (success), no
 * "esto es verde". Es lo que permite que el tema oscuro cambie los dos colores del par
 * (fondo y texto) intercambiando variables, y que el contraste AA se resuelva en
 * tokens.css y no en cada llamada.
 */
export function Chip({ children, tone = 'neutral', icon, className }: Props) {
  const clases = [styles.chip, styles[tone], className ?? ''].filter(Boolean).join(' ')

  return (
    <span className={clases}>
      {icon}
      {children}
    </span>
  )
}
