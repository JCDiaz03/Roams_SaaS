// Ventana 4 - Simulador interactivo (la ventana estrella). Diseno: 4, 8

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { METRICS, quote, type Metric, type Quantities } from '@saas/pricing'
import { api, ApiError, type CustomerDetail, type Plan, type Simulation } from '../../lib/api-client'
import { formatMinor } from '../../lib/currency-format'
import { useRatesContext } from '../../lib/rates-context'
import { useSession } from '../../lib/session'
// LIMITE_MAXIMO son los topes del esquema del backend: acotan lo que llegue por la URL
// (un ?users= manipulado no debe producir un 400 al guardar ni un preview absurdo). Se
// importan de su unica casa en vez de re-declararse aqui (lo cazo la code review).
import { LIMITE_MAXIMO, useSimulatorLimits } from '../../lib/simulator-limits'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Skeleton, SkeletonStack } from '../../ui/Skeleton'
import { useToast } from '../../ui/Toast'
import { MetricSliderCard } from './MetricSliderCard'
import { PlanSelectorBar } from './PlanSelectorBar'
import { PrintSheet } from './PrintSheet'
import { ResultPanel } from './ResultPanel'
import styles from './SimulatorPage.module.css'

const LIBRE: Quantities = { users: 15, storage_gb: 0, api_calls: 0 }

/** Un entero >= 0 de la URL, acotado al tope; cualquier otra cosa se ignora. */
function cantidadDeUrl(bruto: string | null, tope: number): number | null {
  if (bruto === null) return null
  const n = Number(bruto)
  if (!Number.isInteger(n) || n < 0) return null
  return Math.min(n, tope)
}

export function SimulatorPage() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const toast = useToast()
  const { session, preselectCurrency } = useSession()
  const rates = useRatesContext()
  // El maximo visual de cada slider: el de /ajustes, ampliable por un valor inicial mayor.
  const { limites } = useSimulatorLimits()

  const [cliente, setCliente] = useState<CustomerDetail | null>(null)
  const [fallo, setFallo] = useState<'error' | 'no-encontrado' | null>(null)
  const [intento, setIntento] = useState(0)

  const [cantidades, setCantidades] = useState<Quantities>(LIBRE)
  // Modo parametrizado (?base=1): las referencias "base: N" junto a cada input.
  const [modoBase, setModoBase] = useState(false)
  // Topes visuales de los sliders, ampliados si el valor inicial supera el de /ajustes:
  // truncar seria cambiar en silencio el dato que el comercial guardo (spec 09, 3.4).
  const [maxs, setMaxs] = useState<Record<Metric, number> | null>(null)

  // El catalogo de activos: alimenta el selector de plan Y los sugeridos. 'fallo' degrada
  // el simulador a su comportamiento de siempre (solo el contratado), sin tumbar nada.
  const [planes, setPlanes] = useState<Plan[] | 'fallo' | null>(null)
  // null = se cotiza con el contratado. Un Plan = what-if que al guardar viaja (ADR 0011).
  const [planElegido, setPlanElegido] = useState<Plan | null>(null)
  const preseleccionAplicada = useRef(false)

  const [guardando, setGuardando] = useState(false)
  // La simulacion GUARDADA entera, no solo su fecha: la hoja de impresion lleva el
  // numero persistido del backend, nunca el preview (PrintSheet).
  const [sellada, setSellada] = useState<Simulation | null>(null)

  useEffect(() => {
    let cancelado = false

    // Cambiar de cliente por la URL (historial del navegador) REUTILIZA este componente
    // montado: sin este reset, la simulacion sellada de un cliente sobreviviria al
    // cambio y la hoja de impresion mezclaria el nombre de uno con los importes de otro
    // -exactamente el documento que PrintSheet jura no producir-.
    setCliente(null)
    setFallo(null)
    setSellada(null)
    setPlanElegido(null)
    preseleccionAplicada.current = false
    setCantidades(LIBRE)
    setMaxs(null)

    // UNA sola peticion: trae el plan con sus tramos, el tax_rate_bp del pais y los
    // valores base. Es lo que hace posible el preview local (referencia 10).
    api
      .customer(Number(id))
      .then((c) => {
        if (cancelado) return

        // Inicializacion D6 (spec 09): params explicitos > ?base=1 > defaults libres,
        // metrica a metrica. Va aqui, en el .then, porque el modo base necesita los
        // base_* del cliente.
        const esModoBase = params.get('base') === '1'
        const base: Record<Metric, number | null> = {
          users: c.base_users,
          storage_gb: c.base_storage_gb,
          api_calls: c.base_api_calls,
        }

        const inicial = {} as Record<Metric, number>
        for (const m of METRICS) {
          inicial[m] =
            cantidadDeUrl(params.get(m), LIMITE_MAXIMO[m]) ??
            (esModoBase ? (base[m] ?? LIBRE[m]) : LIBRE[m])
        }

        const topes = {} as Record<Metric, number>
        for (const m of METRICS) {
          topes[m] = Math.max(limites[m], inicial[m])
        }

        setCliente(c)
        setModoBase(esModoBase)
        setCantidades(inicial)
        setMaxs(topes)
        preselectCurrency(c.country.display_currency)
      })
      .catch((e: unknown) => {
        if (cancelado) return
        // El 404 no es un fallo que reintentar: ese cliente no va a existir (13.1).
        setFallo(e instanceof ApiError && e.status === 404 ? 'no-encontrado' : 'error')
      })

    return () => {
      cancelado = true
    }
    // `limites` solo puede cambiar en /ajustes, que desmonta esta pantalla: esta en las
    // deps por honestidad, no porque pueda relanzar el efecto en caliente.
  }, [id, params, preselectCurrency, intento, limites])

  // El catalogo, una vez por montaje. Su fallo NO es el del simulador: sin el, se cotiza
  // con el contratado como toda la vida (spec 09, 4.2).
  useEffect(() => {
    let cancelado = false
    api
      .plans()
      .then((p) => {
        if (!cancelado) setPlanes(p)
      })
      .catch(() => {
        if (!cancelado) setPlanes('fallo')
      })
    return () => {
      cancelado = true
    }
  }, [])

  // Preseleccion por ?plan= ("usar como base", spec 09, 5.3): solo si esta activo o es el
  // contratado; si no, se ignora en silencio y queda el contratado.
  useEffect(() => {
    if (preseleccionAplicada.current) return
    if (cliente === null || planes === null || planes === 'fallo') return
    preseleccionAplicada.current = true

    const bruto = params.get('plan')
    if (bruto === null) return

    const idPlan = Number(bruto)
    if (idPlan === cliente.plan.id) return

    const plan = planes.find((p) => p.id === idPlan && p.active)
    if (plan !== undefined) setPlanElegido(plan)
  }, [cliente, planes, params])

  const planEnUso = planElegido ?? cliente?.plan ?? null

  /**
   * EL PREVIEW. La MISMA funcion pura que corre en el backend, con los tramos que ya
   * tenemos en memoria: lookup + recorrido de tramos -> 0 ms, sin red (referencia 10).
   * Con el plan elegido cambian los tramos y la divisa; el impuesto es SIEMPRE el del
   * pais del cliente (spec 09, 2).
   */
  const preview = useMemo(() => {
    if (cliente === null || planEnUso === null) return null

    return quote({
      tiers: planEnUso.tiers,
      quantities: cantidades,
      tax_rate_bp: cliente.tax_rate_bp,
      currency: planEnUso.currency,
    })
  }, [cliente, planEnUso, cantidades])

  /**
   * Los sugeridos (spec 09, 4.3): que planes activos de la MISMA divisa saldrian mas
   * baratos con estas cantidades. El mismo quote() en local sobre datos ya cargados:
   * cero red por arrastre, cero segunda implementacion. Comparar divisas distintas seria
   * colar un tipo de cambio en una comparacion de negocio (invariante 3).
   */
  const sugeridos = useMemo(() => {
    if (cliente === null || planEnUso === null || preview === null) return []
    if (planes === null || planes === 'fallo') return []

    return planes
      .filter((p) => p.id !== planEnUso.id && p.currency === planEnUso.currency)
      .map((p) => ({
        plan: p,
        total: quote({
          tiers: p.tiers,
          quantities: cantidades,
          tax_rate_bp: cliente.tax_rate_bp,
          currency: p.currency,
        }).total_minor,
      }))
      // total > 0: un plan que cotiza a cero no factura NADA de lo que el cliente usa
      // (p. ej. Bitacora, solo-almacenamiento, con 15 usuarios y 0 GB) — "mas barato"
      // seria una burla, no una sugerencia (spec 09, 4.3).
      .filter((s) => s.total > 0 && s.total < preview.total_minor)
      .sort((a, b) => a.total - b.total)
  }, [cliente, planes, planEnUso, preview, cantidades])

  const elegirPlan = (plan: Plan | null) => {
    setPlanElegido(plan)
    // Cambiar de plan invalida el sello, igual que mover un slider: lo sellado es un
    // numero concreto de un plan concreto.
    setSellada(null)
  }

  const guardar = async () => {
    if (cliente === null || planEnUso === null) return
    setGuardando(true)

    try {
      // Se envian SOLO ENTRADAS, jamas importes (invariante 1). El backend recalcula
      // desde cero. El plan_id solo viaja si difiere del contratado (ADR 0011): el caso
      // por defecto sigue generando la peticion de siempre.
      const guardada = await api.createSimulation({
        customer_id: cliente.id,
        ...(planEnUso.id !== cliente.plan.id ? { plan_id: planEnUso.id } : {}),
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

  if (fallo === 'no-encontrado') {
    return (
      <Card>
        <p>No encontramos a ese cliente.</p>
        <Button variant="secondary" onClick={() => navegar('/')}>
          Volver al buscador
        </Button>
      </Card>
    )
  }

  if (fallo === 'error') {
    return (
      <Card>
        <p>No hemos podido cargar el cliente.</p>
        <Button variant="secondary" onClick={() => setIntento((i) => i + 1)}>
          Reintentar
        </Button>
        <Button variant="ghost" onClick={() => navegar('/')}>
          Volver al buscador
        </Button>
      </Card>
    )
  }

  if (cliente === null || planEnUso === null || preview === null) {
    return (
      <div role="status" aria-busy="true" aria-label="Cargando simulador">
        {/* Siluetas de las migas y la barra de plan, con SUS medidas: sin ellas, el
            contenido real empuja la rejilla hacia abajo al llegar y el salto de layout
            se nota (lo midio Lighthouse: CLS 0,25 en esta pantalla). */}
        <div className={styles.migas}>
          <Skeleton width={260} height={14} />
        </div>
        <div className={styles.huecoBarra}>
          <Skeleton height={54} radius="var(--radius-card)" />
        </div>

        <div className={styles.rejilla}>
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
      </div>
    )
  }

  /** Que metricas factura el plan EN USO. Sale del breakdown, no de un `if` sobre el plan. */
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

      {/* La barra de plan (spec 09, 4.2): entre las migas y la rejilla. La ruta de
          vuelta codifica el ESTADO VIVO (cantidades, plan elegido, modo base) para que
          "Ver detalle" y volver no pierda el what-if — el estado vive en React, no en
          la URL, asi que hay que ponerlo en la URL de vuelta a proposito. */}
      <PlanSelectorBar
        contratado={cliente.plan}
        enUso={planEnUso}
        activos={planes === 'fallo' || planes === null ? null : planes}
        disabled={guardando}
        onElegir={elegirPlan}
        rutaVuelta={
          `/clientes/${cliente.id}/simular` +
          `?users=${cantidades.users}&storage_gb=${cantidades.storage_gb}&api_calls=${cantidades.api_calls}` +
          (planEnUso.id !== cliente.plan.id ? `&plan=${planEnUso.id}` : '') +
          (modoBase ? '&base=1' : '')
        }
      />

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
              max={maxs?.[m] ?? limites[m]}
              // La referencia "base: N" solo en modo parametrizado, y solo donde hay base.
              baseValue={
                modoBase
                  ? { users: cliente.base_users, storage_gb: cliente.base_storage_gb, api_calls: cliente.base_api_calls }[m]
                  : null
              }
              // Bloqueados mientras se guarda: la respuesta re-sella con los valores
              // ENVIADOS, y un arrastre a mitad de vuelo se desharia sin aviso.
              disabled={guardando}
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

          {/* Sugerencia discreta, solo si hay un plan mas barato (spec 09, 4.3). No se
              persiste ni aparece en el papel: es una ayuda de pantalla. */}
          {sugeridos.length > 0 && (
            <Card className={styles.sugerencias}>
              <p className={styles.sugerenciasTitulo}>Con estos datos saldría más barato:</p>
              <ul className={styles.sugerenciasLista}>
                {sugeridos.map(({ plan, total }) => (
                  <li key={plan.id}>
                    <span>
                      <strong>{plan.name}</strong> — {formatMinor(total, plan.currency)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={guardando}
                      onClick={() => elegirPlan(plan.id === cliente.plan.id ? null : plan)}
                    >
                      Probar
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {/* Solo con la simulacion sellada: el papel lleva el numero del backend. */}
      {sellada !== null && (
        <PrintSheet cliente={cliente} sim={sellada} emisor={session?.nombre ?? ''} />
      )}
    </>
  )
}
