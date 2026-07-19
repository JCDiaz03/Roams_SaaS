// Ventana 2 - Dashboard / buscador con debounce. Diseno: 4

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type CustomerListItem } from '../../lib/api-client'
import { useBusquedaEnUrl } from '../../lib/busqueda-url'
import { useSession } from '../../lib/session'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { ErrorCarga } from '../../ui/ErrorCarga'
import { SearchBar } from '../../ui/SearchBar'
import { Skeleton, SkeletonStack } from '../../ui/Skeleton'
import { IconPlus } from '../../ui/icons'
import { ActivePlansSection } from './ActivePlansSection'
import { CustomerResultCard } from './CustomerResultCard'
import styles from './DashboardPage.module.css'

type Estado =
  | { estado: 'cargando' }
  | { estado: 'listo'; clientes: CustomerListItem[] }
  | { estado: 'error' }

export function DashboardPage() {
  const { session } = useSession()
  const navegar = useNavigate()

  // El termino en la URL con debounce (lib/busqueda-url): compartido con /planes.
  const { termino, borrador, setBorrador } = useBusquedaEnUrl()
  const [datos, setDatos] = useState<Estado>({ estado: 'cargando' })
  // Contador de reintentos: "Reintentar" no puede apoyarse en la URL, porque volver a
  // escribir el mismo termino no cambia nada y el efecto no se relanzaria.
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    // AbortController: sin el, dos busquedas seguidas pueden llegar desordenadas y la
    // lenta pisa a la rapida. Es el bug clasico del buscador con debounce.
    const control = new AbortController()
    setDatos({ estado: 'cargando' })

    api
      .searchCustomers(termino, control.signal)
      .then((r) => setDatos({ estado: 'listo', clientes: r.customers }))
      .catch(() => {
        // Cualquier fallo (red o servidor) es la pantalla de error. Sin resultados NO
        // pasa por aqui: es un 200 con lista vacia, que es otra pantalla (13.1).
        if (!control.signal.aborted) setDatos({ estado: 'error' })
      })

    return () => control.abort()
  }, [termino, intento])

  return (
    <>
      <h1 className={styles.saludo}>Hola, {session?.nombre}</h1>
      <p className={styles.subtitulo}>Busca un cliente para simular su presupuesto mensual.</p>

      <SearchBar
        value={borrador}
        onChange={setBorrador}
        placeholder="Busca por empresa o identificador fiscal…"
        ariaLabel="Buscar cliente"
        autoFocus
      />

      <div className={styles.herramientas}>
        {datos.estado === 'listo' && (
          <span className={styles.contador}>
            <strong>{datos.clientes.length}</strong>{' '}
            {datos.clientes.length === 1 ? 'resultado' : 'resultados'}
            {termino !== '' && <> para «{termino}»</>}
          </span>
        )}
        <div className={styles.hueco} />
        <Button variant="secondary" size="sm" icon={<IconPlus />} onClick={() => navegar('/clientes/nuevo')}>
          Nuevo cliente
        </Button>
      </div>

      {datos.estado === 'cargando' && (
        <div className={styles.lista} role="status" aria-busy="true" aria-label="Cargando clientes">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <Skeleton width={44} height={44} radius="var(--radius-panel)" />
                <div style={{ flex: 1 }}>
                  <SkeletonStack lines={2} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ERROR DE RED != VACIO. Son dos pantallas distintas y dos mensajes distintos
          (referencia 13.1): una ofrece reintentar, la otra ofrece dar de alta. */}
      {datos.estado === 'error' && (
        <ErrorCarga
          mensaje="No hemos podido cargar los clientes."
          onReintentar={() => setIntento((i) => i + 1)}
        />
      )}

      {datos.estado === 'listo' && datos.clientes.length === 0 && (
        <Card>
          <div className={styles.vacio}>
            <p className={styles.vacioTitulo}>
              {termino === '' ? 'Todavía no hay clientes' : 'Sin resultados'}
            </p>
            <p className={styles.vacioTexto}>
              {termino === ''
                ? 'Da de alta el primero para empezar a simular.'
                : `No encontramos ninguna empresa que coincida con «${termino}».`}
            </p>
            <Button icon={<IconPlus />} onClick={() => navegar('/clientes/nuevo')}>
              {termino === '' ? 'Dar de alta un cliente' : `Dar de alta a «${termino}»`}
            </Button>
          </div>
        </Card>
      )}

      {datos.estado === 'listo' && datos.clientes.length > 0 && (
        <div className={styles.lista}>
          {datos.clientes.map((c) => (
            <CustomerResultCard key={c.id} cliente={c} />
          ))}
        </div>
      )}

      {/* El catalogo, colapsado bajo los resultados (spec 08, 5): consulta ocasional que
          no debe robarle protagonismo al buscador, la vista obligatoria del enunciado. */}
      <ActivePlansSection />
    </>
  )
}
