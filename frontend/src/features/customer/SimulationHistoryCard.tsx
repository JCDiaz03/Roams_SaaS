// Historial de simulaciones en cards responsive. Diseno: 4, 8

import { useNavigate } from 'react-router-dom'
import type { CurrencyCode } from '@saas/pricing'
import type { Simulation } from '../../lib/api-client'
import { importeMostrado } from '../../lib/currency-format'
import { fechaLarga } from '../../lib/fechas'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Chip } from '../../ui/Chip'
import styles from './SimulationHistoryCard.module.css'

type Props = {
  sim: Simulation
  /** La divisa del selector. Solo VISTA (invariante 4). */
  display: CurrencyCode
  rates: Readonly<Record<string, number>> | null
  /** Archivar/recuperar (spec 09, 5.5). La ficha actualiza su estado con la respuesta. */
  onArchivar: (sim: Simulation, archived: boolean) => void
  /** true mientras el PATCH esta en vuelo, para no archivar dos veces. */
  archivando: boolean
  /** Imprimir el presupuesto guardado. La hoja la monta la ficha, que tiene al cliente. */
  onImprimir: (sim: Simulation) => void
}

export function SimulationHistoryCard({
  sim,
  display,
  rates,
  onArchivar,
  archivando,
  onImprimir,
}: Props) {
  const navegar = useNavigate()

  // La conversion es presentacion pura, con lo que devolvio GET /rates. La regla entera
  // (cuando convertir y que dos numeros salen) vive en importeMostrado, compartida con
  // el panel de resultado: el importe de facturacion NO cambia jamas.
  const { principal, facturado } = importeMostrado(sim.total_minor, sim.currency, display, rates)

  // LEE las entradas de la simulacion para crear OTRA; la guardada no se toca jamas
  // (spec 09, 5.3). El plan viaja en la URL y el simulador lo preselecciona solo si
  // sigue activo o es el contratado.
  const usarComoBase = () =>
    navegar(
      `/clientes/${sim.customer_id}/simular?users=${sim.inputs.active_users}` +
        `&storage_gb=${sim.inputs.storage_gb}&api_calls=${sim.inputs.api_calls}&plan=${sim.plan_id}`,
    )

  return (
    <Card className={styles.tarjeta}>
      <div className={styles.cabecera}>
        <div className={styles.fecha}>{fechaLarga(sim.created_at)}</div>
        {/* Con el plan elegido en juego (ADR 0011), "¿con que tarifa era este numero?" ya
            no tiene una respuesta unica por cliente: la card la dice. Del snapshot, asi
            que versionar el plan no la cambia (spec 09, 5.1-5.2). */}
        <Chip tone="brand">
          {sim.plan_name} · v{sim.plan_version}
        </Chip>
      </div>

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
        <div className={styles.importe}>{principal}</div>
        {/* El importe convertido va SIEMPRE etiquetado como referencia, con el facturado
            real al lado (referencia 4.1). Nunca se ensena un convertido a secas: el
            comercial tiene que poder decir por telefono cual es el numero de verdad. */}
        <div className={styles.referencia}>
          {facturado !== null ? <>≈ referencia · se factura {facturado}</> : <>impuestos incluidos</>}
        </div>
      </div>

      <div className={styles.acciones}>
        {/* Archivar es estado de VISTA: saca la card del historial por defecto sin tocar
            un numero. Por eso convive con la inmutabilidad del presupuesto (11.2). */}
        <Button
          variant="ghost"
          size="sm"
          disabled={archivando}
          aria-label={`${sim.archived ? 'Recuperar' : 'Archivar'} la simulación del ${fechaLarga(sim.created_at)}`}
          onClick={() => onArchivar(sim, !sim.archived)}
        >
          {sim.archived ? 'Recuperar' : 'Archivar'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Usar la simulación del ${fechaLarga(sim.created_at)} como base`}
          onClick={usarComoBase}
        >
          Usar como base
        </Button>
        {/* Imprime el numero PERSISTIDO de esta card (PrintSheet), con el emisor que la
            guardo (created_by), no la sesion que la abre. */}
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Imprimir el presupuesto del ${fechaLarga(sim.created_at)}`}
          onClick={() => onImprimir(sim)}
        >
          Imprimir
        </Button>
      </div>
    </Card>
  )
}
