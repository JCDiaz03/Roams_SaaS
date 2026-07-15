// Historial de simulaciones en cards responsive. Diseno: 4

import type { CurrencyCode } from '@saas/pricing'
import type { Simulation } from '../../lib/api-client'
import { convertMinor, formatMinor } from '../../lib/currency-format'
import { Card } from '../../ui/Card'
import styles from './SimulationHistoryCard.module.css'

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

type Props = {
  sim: Simulation
  /** La divisa del selector. Solo VISTA (invariante 4). */
  display: CurrencyCode
  rates: Readonly<Record<string, number>> | null
}

export function SimulationHistoryCard({ sim, display, rates }: Props) {
  // La conversion es presentacion pura y se hace aqui, con lo que devolvio GET /rates. El
  // importe de facturacion (sim.total_minor, en sim.currency) NO cambia jamas.
  const convertido =
    rates === null || display === sim.currency
      ? null
      : convertMinor(sim.total_minor, sim.currency, display, rates)

  const hayConversion = convertido !== null

  return (
    <Card className={styles.tarjeta}>
      <div className={styles.fecha}>{fecha(sim.created_at)}</div>

      {/* Filas de especificacion del patron Roams: valor destacado + label pequeno. */}
      <div className={styles.entradas}>
        <div className={styles.entrada}>
          <strong>{sim.inputs.active_users.toLocaleString('es-ES')}</strong>
          <span>Usuarios</span>
        </div>
        <div className={styles.entrada}>
          <strong>{sim.inputs.storage_gb.toLocaleString('es-ES')}</strong>
          <span>GB</span>
        </div>
        <div className={styles.entrada}>
          <strong>{sim.inputs.api_calls.toLocaleString('es-ES')}</strong>
          <span>Llamadas API</span>
        </div>
      </div>

      <div className={styles.total}>
        <div className={styles.importe}>
          {hayConversion ? formatMinor(convertido, display) : formatMinor(sim.total_minor, sim.currency)}
        </div>
        {/* El importe convertido va SIEMPRE etiquetado como referencia, con el facturado
            real al lado (referencia 4.1). Nunca se ensena un convertido a secas: el
            comercial tiene que poder decir por telefono cual es el numero de verdad. */}
        <div className={styles.referencia}>
          {hayConversion ? (
            <>
              ≈ referencia · se factura {formatMinor(sim.total_minor, sim.currency)}
            </>
          ) : (
            <>impuestos incluidos</>
          )}
        </div>
      </div>
    </Card>
  )
}
