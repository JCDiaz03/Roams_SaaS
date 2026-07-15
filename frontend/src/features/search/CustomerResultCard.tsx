// Tarjeta de resultado (patron Roams). Diseno: 2.4.1

import { useNavigate } from 'react-router-dom'
import type { CustomerListItem } from '../../lib/api-client'
import { ClickableCard } from '../../ui/Card'
import { Chip } from '../../ui/Chip'
import styles from './CustomerResultCard.module.css'

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

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join('')
    .toUpperCase()
}

export function CustomerResultCard({ cliente }: { cliente: CustomerListItem }) {
  const navegar = useNavigate()
  const [fondo, tinta] = PALETA[cliente.id % PALETA.length] as readonly [string, string]

  return (
    <ClickableCard
      onClick={() => navegar(`/clientes/${cliente.id}`)}
      ariaLabel={`Ver ficha de ${cliente.company_name}`}
    >
      <div className={styles.fila}>
        <span className={styles.avatar} style={{ background: fondo, color: tinta }} aria-hidden="true">
          {iniciales(cliente.company_name)}
        </span>

        <div className={styles.centro}>
          <div className={styles.nombre}>{cliente.company_name}</div>
          <div className={styles.chips}>
            <Chip>{cliente.country}</Chip>
            <Chip tone="brand">
              {cliente.plan.name} · v{cliente.plan.version}
            </Chip>
            <span className={styles.fiscal}>{cliente.fiscal_id}</span>
          </div>
        </div>

        <div className={styles.derecha}>
          <div className={styles.sims}>
            <div className={styles.simsNumero}>{cliente.simulation_count}</div>
            <div className={styles.simsLabel}>
              {cliente.simulation_count === 1 ? 'simulación' : 'simulaciones'}
            </div>
          </div>
          <span className={styles.cta}>Ver cliente →</span>
        </div>
      </div>
    </ClickableCard>
  )
}
