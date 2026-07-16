// Ventana 4 - Simulador interactivo (la ventana estrella). Diseno: 4

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { METRICS, quote, type Metric, type Quantities } from '@saas/pricing'
import { api, ApiError, type CustomerDetail, type Simulation } from '../../lib/api-client'
import { useRatesContext } from '../../lib/rates-context'
import { useSession } from '../../lib/session'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Skeleton, SkeletonStack } from '../../ui/Skeleton'
import { useToast } from '../../ui/Toast'
import { MetricSliderCard } from './MetricSliderCard'
import { PrintSheet } from './PrintSheet'
import { ResultPanel } from './ResultPanel'
import styles from './SimulatorPage.module.css'

export function SimulatorPage() {
  const { id } = useParams<{ id: string }>()
  const navegar = useNavigate()
  const toast = useToast()
  const { session, preselectCurrency } = useSession()
  const rates = useRatesContext()

  const [cliente, setCliente] = useState<CustomerDetail | null>(null)
  const [fallo, setFallo] = useState(false)

  const [cantidades, setCantidades] = useState<Quantities>({ users: 15, storage_gb: 0, api_calls: 0 })
  const [guardando, setGuardando] = useState(false)
  // La simulacion GUARDADA entera, no solo su fecha: la hoja de impresion lleva el
  // numero persistido del backend, nunca el preview (PrintSheet).
  const [sellada, setSellada] = useState<Simulation | null>(null)

  useEffect(() => {
    let cancelado = false

    // UNA sola peticion: trae el plan con sus tramos y el tax_rate_bp del pais. Es lo que
    // hace posible el preview local (referencia 10).
    api
      .customer(Number(id))
      .then((c) => {
        if (cancelado) return
        setCliente(c)
        preselectCurrency(c.country.display_currency)
      })
      .catch(() => {
        if (!cancelado) setFallo(true)
      })

    return () => {
      cancelado = true
    }
  }, [id, preselectCurrency])

  /**
   * EL PREVIEW. La MISMA funcion pura que corre en el backend, con los tramos que ya
   * tenemos en memoria: lookup + recorrido de tramos -> 0 ms, sin red (referencia 10).
   *
   * No hay debounce ni peticion por arrastre porque no hace falta: no existen dos
   * implementaciones que puedan divergir, asi que el numero de aqui ES el del backend.
   */
  const preview = useMemo(() => {
    if (cliente === null) return null

    return quote({
      tiers: cliente.plan.tiers,
      quantities: cantidades,
      tax_rate_bp: cliente.tax_rate_bp,
      currency: cliente.plan.currency,
    })
  }, [cliente, cantidades])

  const guardar = async () => {
    if (cliente === null) return
    setGuardando(true)

    try {
      // Se envian SOLO ENTRADAS, jamas importes (invariante 1). El backend recalcula
      // desde cero.
      const guardada = await api.createSimulation({
        customer_id: cliente.id,
        active_users: cantidades.users,
        storage_gb: cantidades.storage_gb,
        api_calls: cantidades.api_calls,
      })

      // SU NUMERO MANDA. Si difiriera del preview, la pantalla pinta el suyo (referencia
      // 10). Hoy no puede diferir -misma funcion, mismos datos-, y precisamente por eso
      // la regla se escribe aqui: mantiene el invariante 1 cierto POR DISENO y no por
      // coincidencia.
      setCantidades({
        users: guardada.inputs.active_users,
        storage_gb: guardada.inputs.storage_gb,
        api_calls: guardada.inputs.api_calls,
      })
      setSellada(guardada)
      toast.showOk('Simulación guardada')
    } catch (e) {
      // El error NO pierde los valores de los sliders: reintentar no debe costar volver a
      // colocarlos (diseno, ventana 4).
      toast.showError(
        e instanceof ApiError ? e.message : 'No hemos podido guardar. Inténtalo de nuevo.',
      )
    } finally {
      setGuardando(false)
    }
  }

  if (fallo) {
    return (
      <Card>
        <p>No hemos podido cargar el cliente.</p>
        <Button variant="secondary" onClick={() => navegar('/')}>
          Volver al buscador
        </Button>
      </Card>
    )
  }

  if (cliente === null || preview === null) {
    return (
      <div className={styles.rejilla} aria-busy="true" aria-label="Cargando simulador">
        <div className={styles.controles}>
          {[0, 1, 2].map((i) => (
            <Card key={i} className={styles.migas}>
              <SkeletonStack lines={2} />
            </Card>
          ))}
        </div>
        <div className={styles.resultado}>
          <Card>
            <Skeleton height={44} />
          </Card>
        </div>
      </div>
    )
  }

  /** Que metricas factura el plan. Sale del breakdown, no de un `if` sobre el plan. */
  const factura = (m: Metric) => preview.breakdown.find((b) => b.metric === m)?.billed ?? false

  return (
    <>
      <nav className={styles.migas} aria-label="Migas de pan">
        <Link to="/">Buscador</Link>
        <span>/</span>
        <Link to={`/clientes/${cliente.id}`}>{cliente.company_name}</Link>
        <span>/</span>
        <strong>Nueva simulación</strong>
      </nav>

      <div className={styles.rejilla}>
        <div className={styles.controles}>
          {/* Las TRES metricas, siempre. Las que el plan no factura salen atenuadas con su
              aviso, nunca ocultas (referencia 5.2). */}
          {METRICS.map((m) => (
            <MetricSliderCard
              key={m}
              metric={m}
              value={cantidades[m]}
              billed={factura(m)}
              onChange={(v) => {
                setCantidades((c) => ({ ...c, [m]: v }))
                // Al tocar algo, el sello desaparece: lo que se ve vuelve a ser un
                // preview sin guardar, y decir "guardada" (o imprimirla) seria mentir.
                setSellada(null)
              }}
            />
          ))}
        </div>

        <div className={styles.resultado}>
          <ResultPanel
            resultado={preview}
            display={session?.currency ?? 'EUR'}
            rates={rates.estado === 'listo' ? rates.rates.rates : null}
            stale={rates.estado === 'listo' && rates.rates.stale}
            staleDesde={rates.estado === 'listo' ? rates.rates.as_of : null}
            guardando={guardando}
            selladaEn={sellada?.created_at ?? null}
            onGuardar={() => void guardar()}
          />
        </div>
      </div>

      {/* Solo con la simulacion sellada: el papel lleva el numero del backend. */}
      {sellada !== null && (
        <PrintSheet cliente={cliente} sim={sellada} emisor={session?.nombre ?? ''} />
      )}
    </>
  )
}
