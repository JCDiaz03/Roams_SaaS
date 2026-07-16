// Ventana 2 - Dashboard / buscador con debounce. Diseno: 4

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, type CustomerListItem } from '../../lib/api-client'
import { useSession } from '../../lib/session'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Skeleton, SkeletonStack } from '../../ui/Skeleton'
import { IconPlus, IconSearch } from '../../ui/icons'
import { CustomerResultCard } from './CustomerResultCard'
import styles from './DashboardPage.module.css'

/** Ni una peticion por tecla. 250 ms: por debajo no da tiempo a teclear, por encima se nota. */
const DEBOUNCE_MS = 250

type Estado =
  | { estado: 'cargando' }
  | { estado: 'listo'; clientes: CustomerListItem[] }
  | { estado: 'error' }

export function DashboardPage() {
  const { session } = useSession()
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()

  // El termino vive en la URL: asi el buscador sobrevive a un F5 y se puede compartir.
  const termino = params.get('q') ?? ''
  const [borrador, setBorrador] = useState(termino)
  const [datos, setDatos] = useState<Estado>({ estado: 'cargando' })
  // Contador de reintentos: "Reintentar" no puede apoyarse en la URL, porque volver a
  // escribir el mismo termino no cambia nada y el efecto no se relanzaria.
  const [intento, setIntento] = useState(0)

  // Lo ultimo que ESTE debounce escribio en la URL: distingue "la URL cambio porque yo
  // la escribi" de "la URL cambio desde fuera" (el buscador de la topbar navega a /?q=).
  const ultimoEscrito = useRef(termino)

  // Un cambio EXTERNO del termino baja al borrador, o el input no lo mostraria y el
  // debounce de abajo lo revertiria a los 250 ms con el valor viejo del input — que es
  // exactamente lo que pasaba al buscar desde la topbar estando en el dashboard
  // (setSearchParams cambia de identidad con cada URL y relanzaba el efecto).
  useEffect(() => {
    if (termino !== ultimoEscrito.current) {
      ultimoEscrito.current = termino
      setBorrador(termino)
    }
  }, [termino])

  // Debounce: el borrador baja a la URL cuando el comercial deja de teclear. El guard de
  // igualdad es lo que hace inofensivo que el efecto se relance por identidad.
  useEffect(() => {
    if (borrador === termino) return

    const t = setTimeout(() => {
      ultimoEscrito.current = borrador
      setParams(borrador === '' ? {} : { q: borrador }, { replace: true })
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [borrador, termino, setParams])

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

      <div className={styles.barra}>
        <span className={styles.lupa}>
          <IconSearch size={19} />
        </span>
        <input
          className={styles.input}
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
          placeholder="Busca por empresa o identificador fiscal…"
          aria-label="Buscar cliente"
          maxLength={100}
          autoFocus
        />
      </div>

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
        <Card>
          <div className={styles.banner}>
            <span>No hemos podido cargar los clientes.</span>
            <Button variant="secondary" size="sm" onClick={() => setIntento((i) => i + 1)}>
              Reintentar
            </Button>
          </div>
        </Card>
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
    </>
  )
}
