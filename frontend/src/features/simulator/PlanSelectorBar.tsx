// Barra de plan del simulador: cotizar con otro plan y volver al contratado. Spec: 09, 4.2

import { Link } from 'react-router-dom'
import type { Plan } from '../../lib/api-client'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import styles from './PlanSelectorBar.module.css'

type Props = {
  /** El plan del cliente (puede estar archivado: es su tarifa). */
  contratado: Plan
  /** El plan con el que se esta cotizando ahora mismo. */
  enUso: Plan
  /** Los planes activos, o null si GET /plans fallo: la barra degrada a solo-informativa. */
  activos: Plan[] | null
  disabled: boolean
  /** null = volver al contratado. */
  onElegir: (plan: Plan | null) => void
}

/**
 * El what-if visible (spec 09, 4.2): el chip cambia de tono cuando el plan en uso no es
 * el contratado — tiene que VERSE, no inferirse. Un <select> nativo, como el de divisa:
 * teclado y lector de pantalla gratis.
 */
export function PlanSelectorBar({ contratado, enUso, activos, disabled, onElegir }: Props) {
  const esContratado = enUso.id === contratado.id

  // El contratado siempre es elegible (aunque este archivado: es su tarifa); los demas,
  // solo activos. Un archivado ajeno no aparece: el backend lo rechazaria (ADR 0011).
  const opciones = [contratado, ...(activos ?? []).filter((p) => p.id !== contratado.id)]

  return (
    <div className={styles.barra}>
      <span className={styles.etiqueta} id="etiqueta-plan">
        Plan de la simulación:
      </span>

      {activos === null ? (
        // Sin catalogo (fallo de GET /plans): se cotiza con el contratado, como siempre.
        <Chip tone="brand">
          {enUso.name} · v{enUso.version}
        </Chip>
      ) : (
        <select
          className={styles.selector}
          value={enUso.id}
          disabled={disabled}
          aria-labelledby="etiqueta-plan"
          onChange={(e) => {
            const id = Number(e.target.value)
            const plan = opciones.find((p) => p.id === id)
            if (plan !== undefined) onElegir(plan.id === contratado.id ? null : plan)
          }}
        >
          {opciones.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · v{p.version}
              {p.id === contratado.id ? ' — contratado' : ''}
            </option>
          ))}
        </select>
      )}

      {esContratado ? (
        <Chip tone="brand">Tarifa contratada</Chip>
      ) : (
        // El aviso del what-if: este numero NO es la tarifa del cliente.
        <Chip tone="warning">Distinto del contratado</Chip>
      )}

      {!esContratado && (
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onElegir(null)}>
          Volver al contratado
        </Button>
      )}

      <Link className={styles.enlace} to={`/planes/${enUso.id}`}>
        Ver detalle
      </Link>
    </div>
  )
}
