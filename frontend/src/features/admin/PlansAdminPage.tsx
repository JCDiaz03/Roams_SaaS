// Ventana 6 - Admin de planes: lista con ?include_archived=true. Ref: 12 · Diseno: 4

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Plan } from '../../lib/api-client'
import { ETIQUETA_METRICA, metricasDe } from '../../lib/plan-format'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Chip } from '../../ui/Chip'
import { Skeleton } from '../../ui/Skeleton'
import { useToast } from '../../ui/Toast'
import { IconPlus } from '../../ui/icons'
import styles from './PlansAdminPage.module.css'

export function PlansAdminPage() {
  const navegar = useNavigate()
  const toast = useToast()

  const [planes, setPlanes] = useState<Plan[] | null>(null)
  const [fallo, setFallo] = useState(false)
  const [aArchivar, setAArchivar] = useState<Plan | null>(null)
  const [archivando, setArchivando] = useState(false)
  const botonCancelarRef = useRef<HTMLButtonElement>(null)

  const cargar = useCallback(() => {
    // include_archived: el panel de admin es el unico consumidor. Desde la spec 07 el
    // parametro exige rol admin DE VERDAD (403 en el backend); sigue siendo parametro y
    // no endpoint aparte porque el recurso es el mismo.
    setFallo(false)
    setPlanes(null)
    api
      .plans(true)
      .then(setPlanes)
      .catch(() => setFallo(true))
  }, [])

  useEffect(cargar, [cargar])

  // El modal gestiona el foco que su aria-modal promete: al abrir, el foco entra
  // (Cancelar: la accion segura); Escape cierra, como el menu de la topbar.
  useEffect(() => {
    if (aArchivar === null) return

    botonCancelarRef.current?.focus()

    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAArchivar(null)
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [aArchivar])

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
        <Button variant="secondary" onClick={cargar}>
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
                {ETIQUETA_METRICA[m]}
              </Chip>
            ))}
            <Chip>{plan.currency}</Chip>
          </div>
        </div>

        {plan.active && (
          <div className={styles.acciones}>
            {/* El aria-label lleva el nombre: "Editar" a secas obliga al lector de
                pantalla (y al E2E) a adivinar cual de las tres tarjetas es. */}
            <Button
              variant="secondary"
              size="sm"
              aria-label={`Editar ${plan.name}`}
              onClick={() => navegar(`/planes/${plan.id}/editar`)}
            >
              Editar
            </Button>
            <Button
              variant="danger"
              size="sm"
              aria-label={`Archivar ${plan.name}`}
              onClick={() => setAArchivar(plan)}
            >
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
        <div className={styles.lista} role="status" aria-busy="true" aria-label="Cargando planes">
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
        <div
          className={styles.modalFondo}
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-archivar"
          // Clic en el velo = cancelar (solo el velo: los clics dentro de la Card no
          // llegan aqui con target === currentTarget).
          onClick={(e) => {
            if (e.target === e.currentTarget) setAArchivar(null)
          }}
        >
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
              <Button ref={botonCancelarRef} variant="ghost" onClick={() => setAArchivar(null)}>
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
