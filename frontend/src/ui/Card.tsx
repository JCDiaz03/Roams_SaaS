// Tarjeta redondeada con sombra suave. Diseno: 2.4.1

import type { ReactNode } from 'react'
import styles from './Card.module.css'

type Props = {
  children: ReactNode
  /** Padding interno estandar. Apagalo cuando la tarjeta gestione su propio relleno. */
  pad?: boolean
  className?: string
}

export function Card({ children, pad = true, className }: Props) {
  const clases = [styles.card, pad ? styles.pad : '', className ?? ''].filter(Boolean).join(' ')
  return <div className={clases}>{children}</div>
}

type ClickableProps = Props & {
  onClick: () => void
  /** Etiqueta accesible cuando el contenido visible no basta por si solo. */
  ariaLabel?: string
}

/**
 * La tarjeta de resultado que SE PULSA (patron 2.4.1: el card de cliente del buscador).
 *
 * Es un <button>, no un <div onClick>: asi entra en el orden de tabulacion, responde a
 * Enter y Espacio, y los lectores de pantalla la anuncian como pulsable. Un div con
 * onClick es invisible para quien no usa raton.
 */
export function ClickableCard({ children, pad = true, className, onClick, ariaLabel }: ClickableProps) {
  const clases = [styles.card, styles.interactive, pad ? styles.pad : '', className ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <button type="button" className={clases} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  )
}
