// Ventana 8 - Detalle de plan, solo lectura y para cualquier sesion. Spec: 08 · Diseno: 8

import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, type Plan } from '../../lib/api-client'
import { formatMinor } from '../../lib/currency-format'
import { ETIQUETA_METRICA, metricasDe } from '../../lib/plan-format'
import { useSession } from '../../lib/session'
import { Button } from '../../ui/Button'
import { Callout } from '../../ui/Callout'
import { Card } from '../../ui/Card'
import { Chip } from '../../ui/Chip'
import { SkeletonStack } from '../../ui/Skeleton'
import styles from './PlanDetailPage.module.css'

type Estado =
  | { estado: 'cargando' }
  | { estado: 'listo'; plan: Plan }
  | { estado: 'no-encontrado' }
  | { estado: 'error' }

/** De donde se llego (chip de la ficha, barra del simulador): miga y boton de volver. */
type Desde = { path: string; label: string }

export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navegar = useNavigate()
  const location = useLocation()
  const { hasRole } = useSession()

  const desde = (location.state as { desde?: Desde } | null)?.desde ?? null

  const [datos, setDatos] = useState<Estado>({ estado: 'cargando' })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let cancelado = false
    setDatos({ estado: 'cargando' })

    api
      .plan(Number(id))
      .then((plan) => {
        if (!cancelado) setDatos({ estado: 'listo', plan })
      })
      .catch((e: unknown) => {
        if (cancelado) return
        if (e instanceof ApiError && e.status === 404) setDatos({ estado: 'no-encontrado' })
        else setDatos({ estado: 'error' })
      })

    return () => {
      cancelado = true
    }
  }, [id, intento])

  if (datos.estado === 'cargando') {
    return (
      <div role="status" aria-busy="true" aria-label="Cargando plan">
        <Card>
          <SkeletonStack lines={4} />
        </Card>
      </div>
    )
  }

  if (datos.estado === 'no-encontrado') {
    return (
      <Card>
        <div className={styles.vacio}>
          <p>Ese plan no existe.</p>
          <Button variant="secondary" onClick={() => navegar('/')}>
            Volver al buscador
          </Button>
        </div>
      </Card>
    )
  }

  if (datos.estado === 'error') {
    return (
      <Card>
        <div className={styles.vacio}>
          <p>No hemos podido cargar el plan.</p>
          <Button variant="secondary" onClick={() => setIntento((i) => i + 1)}>
            Reintentar
          </Button>
        </div>
      </Card>
    )
  }

  const { plan } = datos

  return (
    <>
      <nav className={styles.migas} aria-label="Migas de pan">
        <Link to="/">Buscador</Link>
        <span>/</span>
        {/* Si se llego desde una ficha o el simulador, la miga intermedia es el camino
            de vuelta sin perder nada (query incluida). */}
        {desde !== null && (
          <>
            <Link to={desde.path}>{desde.label}</Link>
            <span>/</span>
          </>
        )}
        <strong>{plan.name}</strong>
      </nav>

      <Card>
        <div className={styles.cabecera}>
          <div className={styles.datos}>
            <h1 className={styles.nombre}>{plan.name}</h1>
            <div className={styles.chips}>
              <Chip>v{plan.version}</Chip>
              {plan.active ? <Chip tone="success">Activo</Chip> : <Chip>Archivado</Chip>}
              {metricasDe(plan).map((m) => (
                <Chip key={m} tone="brand">
                  {ETIQUETA_METRICA[m]}
                </Chip>
              ))}
              <Chip>{plan.currency}</Chip>
            </div>
            {plan.description !== null && plan.description !== '' && (
              <p className={styles.descripcion}>{plan.description}</p>
            )}
          </div>

          <div className={styles.acciones}>
            {/* El boton de volver a donde se estaba (ficha o simulador): la miga hace lo
                mismo, pero un boton explicito no obliga a saber leer migas. */}
            {desde !== null && (
              <Button variant="secondary" onClick={() => navegar(desde.path)}>
                Volver a {desde.label}
              </Button>
            )}
            {/* Gating visual sobre la autorizacion real del backend, como siempre: el 403
                de PUT /plans es quien manda. Solo sobre un plan activo: el archivado no se
                versiona (contrato 4.2). */}
            {hasRole('admin') && plan.active && (
              <Button variant="secondary" onClick={() => navegar(`/planes/${plan.id}/editar`)}>
                Editar
              </Button>
            )}
          </div>
        </div>

        {/* La misma voz que la ficha de cliente: cero jerga de versionado. */}
        {!plan.active && (
          <div className={styles.aviso}>
            <Callout tone="info" title="Este plan ya no se ofrece a clientes nuevos">
              Los clientes que lo tienen mantienen su tarifa y pueden seguir simulando con ella.
            </Callout>
          </div>
        )}
      </Card>

      {/* Una tabla por metrica: el mismo formato "hasta N -> precio" del desglose del
          simulador, que es el que el comercial ya sabe leer (diseno 2.4.5). */}
      {metricasDe(plan).map((metric) => {
        const tramos = plan.tiers
          .filter((t) => t.metric === metric)
          .sort((a, b) => a.sort_order - b.sort_order)

        return (
          <section key={metric} className={styles.seccion}>
            <h2 className={styles.tituloSeccion}>{ETIQUETA_METRICA[metric]}</h2>
            <Card>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th scope="col">Tramo</th>
                    <th scope="col" className={styles.precio}>
                      Precio por unidad
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tramos.map((t) => (
                    <tr key={t.sort_order}>
                      <td>{t.up_to === null ? 'En adelante' : `Hasta ${t.up_to.toLocaleString('es-ES')}`}</td>
                      <td className={styles.precio}>{formatMinor(t.unit_price_minor, plan.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>
        )
      })}

      <p className={styles.pie}>
        Cada unidad paga el precio de su tramo. El presupuesto de un cliente añade el impuesto de su
        país.
      </p>
    </>
  )
}
