// Ventana 3 - Detalle de cliente. Diseno: 4

import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, type CustomerDetail, type Simulation } from '../../lib/api-client'
import { useRatesContext } from '../../lib/rates-context'
import { useSession } from '../../lib/session'
import { Breadcrumbs } from '../../ui/Breadcrumbs'
import { Button } from '../../ui/Button'
import { ErrorCarga } from '../../ui/ErrorCarga'
import { Callout } from '../../ui/Callout'
import { Card } from '../../ui/Card'
import { Chip } from '../../ui/Chip'
import { Skeleton, SkeletonStack } from '../../ui/Skeleton'
import { useToast } from '../../ui/Toast'
import { IconCheck, IconPlus } from '../../ui/icons'
import { colorAvatar, iniciales } from '../../ui/avatar'
import { PrintSheet } from '../simulator/PrintSheet'
import { BaseValuesBlock } from './BaseValuesBlock'
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
  const toast = useToast()

  const [datos, setDatos] = useState<Estado>({ estado: 'cargando' })
  // Reintento en la SPA, como el buscador: navegar(0) recargaba la pagina entera.
  const [intento, setIntento] = useState(0)
  const [archivando, setArchivando] = useState(false)
  // La simulacion elegida para imprimir: mientras exista, la hoja esta montada y un
  // Ctrl+P repetido reimprime la misma. Cambia con cada boton "Imprimir".
  const [simImpresa, setSimImpresa] = useState<Simulation | null>(null)

  useEffect(() => {
    let cancelado = false
    const idNum = Number(id)
    setDatos({ estado: 'cargando' })
    // Cambiar de cliente por la URL reutiliza el componente montado: sin este reset, la
    // hoja seguiria montada con la simulacion del cliente anterior (el mismo bug que el
    // simulador jura no tener).
    setSimImpresa(null)

    // Las dos en paralelo: el historial no bloquea a la ficha ni al reves. Con las
    // archivadas incluidas (la ficha las separa en su seccion colapsada, spec 09 5.5) y
    // el limit al MAXIMO del contrato (100): con el default de 20, veinte archivadas
    // recientes expulsarian de la pagina a presupuestos vivos mas antiguos (lo cazo la
    // code review). Por encima de 100 simulaciones el corte reaparece; a esa escala la
    // respuesta sera paginacion real, no un limit mas alto.
    Promise.all([api.customer(idNum), api.history(idNum, true, 100)])
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
      <ErrorCarga
        mensaje="No hemos podido cargar la ficha."
        onReintentar={() => setIntento((i) => i + 1)}
      />
    )
  }

  const alternarArchivo = async (sim: Simulation, archived: boolean) => {
    setArchivando(true)
    try {
      // La respuesta del servidor sustituye a la card en el estado local: una sola fuente.
      const actualizada = await api.archiveSimulation(sim.id, archived)
      setDatos((d) =>
        d.estado === 'listo'
          ? { ...d, historial: d.historial.map((s) => (s.id === actualizada.id ? actualizada : s)) }
          : d,
      )
      toast.showOk(archived ? 'Simulación archivada' : 'Simulación recuperada')
    } catch {
      toast.showError('No hemos podido actualizar la simulación.')
    } finally {
      setArchivando(false)
    }
  }

  /**
   * Monta la hoja con ESA simulacion y abre el dialogo del navegador. flushSync es la
   * pieza que lo hace correcto: window.print() es sincrono y sin el, React aun no habria
   * pintado la hoja (y un segundo clic sobre la misma card ni siquiera re-renderizaria).
   */
  const imprimir = (sim: Simulation) => {
    flushSync(() => setSimImpresa(sim))
    window.print()
  }

  const { cliente, historial } = datos
  const [fondo, tinta] = colorAvatar(cliente.id)
  const validado = cliente.fiscal_id_type !== 'unvalidated'
  // Vivas y archivadas, separadas: las archivadas existen para NO verse por defecto.
  const vivas = historial.filter((s) => !s.archived)
  const archivadas = historial.filter((s) => s.archived)
  // Sin ningun valor base, "parametrizada" no significa nada: el boton no aparece.
  const hayBase =
    cliente.base_users !== null || cliente.base_storage_gb !== null || cliente.base_api_calls !== null

  return (
    <>
      <Breadcrumbs camino={[{ to: '/', label: 'Buscador' }]} actual={cliente.company_name} />

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
              {/* El chip del plan ENLAZA a su detalle (spec 08): un Link con el chip
                  dentro, no un chip con onClick — asi tabula, anuncia destino y admite
                  abrir en pestana nueva. El state `desde` es lo que le da al detalle su
                  miga y su boton de volver aqui. */}
              <Link
                to={`/planes/${cliente.plan.id}`}
                state={{ desde: { path: `/clientes/${cliente.id}`, label: cliente.company_name } }}
                className={styles.enlacePlan}
                aria-label={`Ver el ${cliente.plan.name}`}
              >
                <Chip tone="brand">{cliente.plan.name}</Chip>
              </Link>
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

          <div className={styles.botonera}>
            {/* Parametrizada solo si hay algun valor base (spec 09, 3.3): arranca del
                consumo habitual. La libre es el boton de siempre, renombrado. */}
            {hayBase && (
              <Button
                icon={<IconPlus />}
                onClick={() => navegar(`/clientes/${cliente.id}/simular?base=1`)}
              >
                Nueva simulación parametrizada
              </Button>
            )}
            <Button
              variant={hayBase ? 'secondary' : 'primary'}
              icon={<IconPlus />}
              onClick={() => navegar(`/clientes/${cliente.id}/simular`)}
            >
              Nueva simulación libre
            </Button>
          </div>
        </div>

        {/* Segundo bloque de la card (diseno 8): los valores base, editables en linea. */}
        <BaseValuesBlock
          cliente={cliente}
          onActualizado={(bases) =>
            setDatos((d) => (d.estado === 'listo' ? { ...d, cliente: { ...d.cliente, ...bases } } : d))
          }
        />

        {/* El plan archivado se traduce a lenguaje de comercial. NADA de "versión
            archivada" ni de jerga de versionado (referencia 5.5): lo que el comercial
            necesita saber es que a este cliente no le cambia el precio. */}
        {!cliente.plan.active && (
          <div className={styles.avisoTarifa}>
            <Callout tone="info" title="Mantiene su tarifa contratada">
              Este cliente sigue con las condiciones que firmó. Los planes nuevos no le afectan.
            </Callout>
          </div>
        )}
      </Card>

      <section className={styles.seccion}>
        <div className={styles.tituloSeccion}>
          <h2>Simulaciones guardadas</h2>
          <span>
            {vivas.length} {vivas.length === 1 ? 'presupuesto' : 'presupuestos'}
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
            {vivas.map((sim) => (
              <SimulationHistoryCard
                key={sim.id}
                sim={sim}
                display={session?.currency ?? 'EUR'}
                rates={rates.estado === 'listo' ? rates.rates.rates : null}
                onArchivar={(s, a) => void alternarArchivo(s, a)}
                archivando={archivando}
                onImprimir={imprimir}
              />
            ))}
          </div>
        )}

        {/* Las archivadas, colapsadas al final: el mismo patron que los planes
            archivados del panel de admin. Recuperar una la devuelve arriba. */}
        {archivadas.length > 0 && (
          <details className={styles.archivadas}>
            <summary className={styles.resumenArchivadas}>
              {archivadas.length} {archivadas.length === 1 ? 'archivada' : 'archivadas'}
            </summary>
            <div className={styles.historial}>
              {archivadas.map((sim) => (
                <SimulationHistoryCard
                  key={sim.id}
                  sim={sim}
                  display={session?.currency ?? 'EUR'}
                  rates={rates.estado === 'listo' ? rates.rates.rates : null}
                  onArchivar={(s, a) => void alternarArchivo(s, a)}
                  archivando={archivando}
                  onImprimir={imprimir}
                />
              ))}
            </div>
          </details>
        )}
      </section>

      {/* La hoja de impresion, montada con la simulacion elegida: el papel lleva el
          numero PERSISTIDO de esa card y a su emisor (created_by), no un preview ni la
          sesion de quien mira. En pantalla no existe (solo @media print). */}
      {simImpresa !== null && <PrintSheet cliente={cliente} sim={simImpresa} />}
    </>
  )
}
