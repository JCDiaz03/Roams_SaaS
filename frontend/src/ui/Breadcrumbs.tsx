// Migas de pan del sistema. Diseno: 4
//
// Extraidas cuando la ficha, el detalle de plan y el simulador acumulaban tres copias
// del mismo <nav> con tres copias del mismo CSS.

import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import styles from './Breadcrumbs.module.css'

export type Miga = {
  to: string
  label: string
  /** State de react-router para el destino (p. ej. el `desde` del detalle de plan). */
  state?: unknown
}

type Props = {
  /** Los eslabones con enlace, en orden. El primero suele ser el buscador. */
  camino: Miga[]
  /** Donde se esta: el ultimo eslabon, sin enlace. */
  actual: string
}

export function Breadcrumbs({ camino, actual }: Props) {
  return (
    <nav className={styles.migas} aria-label="Migas de pan">
      {camino.map((m) => (
        <Fragment key={m.to}>
          <Link to={m.to} state={m.state}>
            {m.label}
          </Link>
          <span>/</span>
        </Fragment>
      ))}
      <strong>{actual}</strong>
    </nav>
  )
}
