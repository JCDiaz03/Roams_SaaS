// Ventana 6 - Admin de planes: lista con ?include_archived=true. Ref: 12 · Diseno: 4

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Metric } from '@saas/pricing'
import { api, type Plan } from '../../lib/api-client'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Chip } from '../../ui/Chip'
import { Skeleton } from '../../ui/Skeleton'
import { useToast } from '../../ui/Toast'
import { IconPlus } from '../../ui/icons'
import styles from './PlansAdminPage.module.css'

const ETIQUETA: Record<Metric, string> = {
  users: 'Usuarios',
  storage_gb: 'Almacenamiento',
  api_calls: 'Llamadas API',
}

function metricasDe(plan: Plan): Metric[] {
  return [...new Set(plan.tiers.map((t) => t.metric))]
}

export function PlansAdminPage() {
  const navegar = useNavigate()
  const toast = useToast()

  const [planes, setPlanes] = useState<Plan[] | null>(null)
  const [fallo, setFallo] = useState(false)
  const [aArchivar, setAArchivar] = useState<Plan | null>(null)
  const [archivando, setArchivando] = useState(false)

  const cargar = useCallback(() => {
    // include_archived: el panel de admin es el unico consumidor, y es un parametro y no
    // un endpoint aparte porque el gating por rol es UX, no seguridad (referencia 8.3).
    api
      .plans(true)
      .then(setPlanes)
      .catch(() => setFallo(true))
  }, [])

  useEffect(cargar, [cargar])

  const archivar = async () => {
    if (aArchivar === null) return
    setArchivando(true)

    try {
      await api.archivePlan(aArchivar.id)
      toast.showOk(`«${aArchivar.name}» archivado`)
      setAArchivar(null)
      cargar()
    } catch {
      toast.showError('No hemos podido archivar el plan.')
    } finally {
      setArchivando(false)
    }
  }

  if (fallo) {
    return (
      <Card>
        <p>No hemos podido cargar los planes.</p>
        <Button variant="secondary" onClick={() => navegar(0)}>
          Reintentar
        </Button>
      </Card>
    )
  }

  const activos = planes?.filter((p) => p.active) ?? []
  const archivados = planes?.filter((p) => !p.active) ?? []

  const tarjeta = (plan: Plan) => (
    <Card key={plan.id} className={plan.active ? '' : styles.atenuada}>
      <div className={styles.fila}>
        <div className={styles.datos}>
          <div className={styles.nombre}>
            {plan.name}
            {/* La version, como chip discreto. Es toda la jerga de versionado que el
                admin ve en el listado. */}
            <Chip>v{plan.version}</Chip>
            {plan.active ? <Chip tone="success">Activo</Chip> : <Chip>Archivado</Chip>}
          </div>
          <div className={styles.chips}>
            {metricasDe(plan).map((m) => (
              <Chip key={m} tone="brand">
                {ETIQUETA[m]}
              </Chip>
            ))}
            <Chip>{plan.currency}</Chip>
          </div>
        </div>

        {plan.active && (
          <div className={styles.acciones}>
            <Button variant="secondary" size="sm" onClick={() => navegar(`/planes/${plan.id}`)}>
              Editar
            </Button>
            <Button variant="danger" size="sm" onClick={() => setAArchivar(plan)}>
              Archivar
            </Button>
          </div>
        )}
      </div>
    </Card>
  )

  return (
    <>
      <div className={styles.cabecera}>
        <h1 className={styles.titulo}>Planes de precios</h1>
        <div className={styles.hueco} />
        <Button icon={<IconPlus />} onClick={() => navegar('/planes/nuevo')}>
          Nuevo plan
        </Button>
      </div>
      <p className={styles.subtitulo}>
        Los planes archivados no se ofrecen a clientes nuevos, pero siguen aquí porque hay
        clientes con esa tarifa.
      </p>

      {planes === null ? (
        <div className={styles.lista} aria-busy="true" aria-label="Cargando planes">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <Skeleton height={40} />
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className={styles.lista}>{activos.map(tarjeta)}</div>

          {/* Los archivados, agrupados y colapsados al final (diseno, ventana 6). */}
          {archivados.length > 0 && (
            <details className={styles.archivados}>
              <summary className={styles.resumenArchivados}>
                {archivados.length} {archivados.length === 1 ? 'plan archivado' : 'planes archivados'}
              </summary>
              <div className={styles.lista}>{archivados.map(tarjeta)}</div>
            </details>
          )}
        </>
      )}

      {aArchivar !== null && (
        <div className={styles.modalFondo} role="dialog" aria-modal="true" aria-labelledby="titulo-archivar">
          <Card className={styles.modal}>
            <h2 className={styles.modalTitulo} id="titulo-archivar">
              ¿Archivar «{aArchivar.name}»?
            </h2>
            {/* Lenguaje llano, cero jerga: son literalmente las dos reglas del sistema
                dichas sin una palabra tecnica (referencia 5.5). */}
            <p className={styles.modalTexto}>
              El plan dejará de ofrecerse a clientes nuevos. Los clientes actuales no se ven
              afectados: mantienen su tarifa y pueden seguir simulando con ella.
            </p>
            <div className={styles.modalAcciones}>
              <Button variant="ghost" onClick={() => setAArchivar(null)}>
                Cancelar
              </Button>
              <Button variant="danger" loading={archivando} onClick={() => void archivar()}>
                Archivar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
