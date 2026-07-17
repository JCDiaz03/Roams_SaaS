// Tarjeta de resultado (patron Roams). Diseno: 2.4.1

import { useNavigate } from 'react-router-dom'
import type { CustomerListItem } from '../../lib/api-client'
import { colorAvatar, iniciales } from '../../ui/avatar'
import { ClickableCard } from '../../ui/Card'
import { Chip } from '../../ui/Chip'
import styles from './CustomerResultCard.module.css'

export function CustomerResultCard({ cliente }: { cliente: CustomerListItem }) {
  const navegar = useNavigate()
  const [fondo, tinta] = colorAvatar(cliente.id)

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
          {/* En UNA linea ("3 simulaciones"), no numero-sobre-etiqueta: apilados a este
              tamano parecian dos datos sueltos en vez de uno. */}
          <span className={styles.sims}>
            <strong>{cliente.simulation_count}</strong>{' '}
            {cliente.simulation_count === 1 ? 'simulación' : 'simulaciones'}
          </span>
          <span className={styles.cta}>Ver cliente →</span>
        </div>
      </div>
    </ClickableCard>
  )
}
