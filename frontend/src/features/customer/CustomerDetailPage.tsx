// Ventana 3 - Detalle de cliente. Diseno: 4

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, type CustomerDetail, type Simulation } from '../../lib/api-client'
import { useRatesContext } from '../../lib/rates-context'
import { useSession } from '../../lib/session'
import { Button } from '../../ui/Button'
import { Callout } from '../../ui/Callout'
import { Card } from '../../ui/Card'
import { Chip } from '../../ui/Chip'
import { Skeleton, SkeletonStack } from '../../ui/Skeleton'
import { IconCheck, IconPlus } from '../../ui/icons'
import { colorAvatar, iniciales } from '../../ui/avatar'
import { SimulationHistoryCard } from './SimulationHistoryCard'
import styles from './CustomerDetailPage.module.css'

type Estado =
  | { estado: 'cargando' }
  | { estado: 'listo'; cliente: CustomerDetail; historial: Simulation[] }
  | { estado: 'no-encontrado' }
  | { estado: 'error' }

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navegar = useNavigate()
  const { session, preselectCurrency } = useSession()
  const rates = useRatesContext()

  const [datos, setDatos] = useState<Estado>({ estado: 'cargando' })
  // Reintento en la SPA, como el buscador: navegar(0) recargaba la pagina entera.
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let cancelado = false
    const idNum = Number(id)
    setDatos({ estado: 'cargando' })

    // Las dos en paralelo: el historial no bloquea a la ficha ni al reves.
    Promise.all([api.customer(idNum), api.history(idNum)])
      .then(([cliente, historial]) => {
        if (cancelado) return
        setDatos({ estado: 'listo', cliente, historial })
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

  // Preseleccion de divisa por pais, SOLO si el comercial no ha elegido a mano. La regla
  // vive en la sesion (referencia 13); aqui solo se le dice cual seria.
  useEffect(() => {
    if (datos.estado === 'listo') preselectCurrency(datos.cliente.country.display_currency)
  }, [datos, preselectCurrency])

  if (datos.estado === 'cargando') {
    return (
      // role="status" es lo que hace que el aria-label se anuncie: sobre un div sin rol
      // se ignora, y los esqueletos son aria-hidden a proposito (Skeleton.tsx).
      <div role="status" aria-busy="true" aria-label="Cargando cliente">
        <Card>
          <div style={{ display: 'flex', gap: 16 }}>
            <Skeleton width={56} height={56} radius="var(--radius-panel)" />
            <div style={{ flex: 1 }}>
              <SkeletonStack lines={3} />
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (datos.estado === 'no-encontrado') {
    return (
      <Card>
        <div className={styles.vacio}>
          <p>No encontramos a ese cliente.</p>
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
          <p>No hemos podido cargar la ficha.</p>
          <Button variant="secondary" onClick={() => setIntento((i) => i + 1)}>
            Reintentar
          </Button>
        </div>
      </Card>
    )
  }

  const { cliente, historial } = datos
  const [fondo, tinta] = colorAvatar(cliente.id)
  const validado = cliente.fiscal_id_type !== 'unvalidated'

  return (
    <>
      <nav className={styles.migas} aria-label="Migas de pan">
        <Link to="/">Buscador</Link>
        <span>/</span>
        <strong>{cliente.company_name}</strong>
      </nav>

      <Card>
        <div className={styles.cabecera}>
          <span className={styles.avatar} style={{ background: fondo, color: tinta }} aria-hidden="true">
            {iniciales(cliente.company_name)}
          </span>

          <div className={styles.datos}>
            <h1 className={styles.nombre}>{cliente.company_name}</h1>

            <div className={styles.chips}>
              <Chip>{cliente.country.name}</Chip>
              {/* El resultado de la validacion, sin jerga: "CIF validado" o "Sin validar".
                  El pais sin esquema no es un fallo, es el caso mayoritario. */}
              {validado ? (
                <Chip tone="success" icon={<IconCheck />}>
                  {cliente.fiscal_id_type} validado
                </Chip>
              ) : (
                <Chip>Sin validar</Chip>
              )}
              <Chip tone="brand">{cliente.plan.name}</Chip>
            </div>

            <div className={styles.meta}>
              <div>
                <strong>{cliente.fiscal_id}</strong>
                Identificador fiscal
              </div>
              <div>
                <strong>{cliente.email}</strong>
                Contacto
              </div>
            </div>
          </div>

          <Button icon={<IconPlus />} onClick={() => navegar(`/clientes/${cliente.id}/simular`)}>
            Nueva simulación
          </Button>
        </div>

        {/* El plan archivado se traduce a lenguaje de comercial. NADA de "versión
            archivada" ni de jerga de versionado (referencia 5.5): lo que el comercial
            necesita saber es que a este cliente no le cambia el precio. */}
        {!cliente.plan.active && (
          <Callout tone="info" title="Mantiene su tarifa contratada">
            Este cliente sigue con las condiciones que firmó. Los planes nuevos no le afectan.
          </Callout>
        )}
      </Card>

      <section className={styles.seccion}>
        <div className={styles.tituloSeccion}>
          <h2>Simulaciones guardadas</h2>
          <span>
            {historial.length} {historial.length === 1 ? 'presupuesto' : 'presupuestos'}
          </span>
        </div>

        {historial.length === 0 ? (
          <Card>
            <div className={styles.vacio}>
              <p>Aún no hay simulaciones para este cliente.</p>
              <Button icon={<IconPlus />} onClick={() => navegar(`/clientes/${cliente.id}/simular`)}>
                Crear la primera
              </Button>
            </div>
          </Card>
        ) : (
          <div className={styles.historial}>
            {historial.map((sim) => (
              <SimulationHistoryCard
                key={sim.id}
                sim={sim}
                display={session?.currency ?? 'EUR'}
                rates={rates.estado === 'listo' ? rates.rates.rates : null}
              />
            ))}
          </div>
        )}
      </section>
    </>
  )
}
